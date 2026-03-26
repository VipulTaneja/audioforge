'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Layers3,
  Piano,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  buildPhrasePreset,
  GENERATED_INSTRUMENT_OPTIONS,
  GeneratedInstrument,
  GeneratedScale,
  getScaleNotes,
  NOTE_LENGTH_OPTIONS,
  noteNameToFrequency,
  PHRASE_PRESET_OPTIONS,
  renderGeneratedAsset,
  ROOT_NOTE_OPTIONS,
  SCALE_OPTIONS,
  transposeNotesByOctave,
} from '@/lib/generated-asset';

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const WHITE_KEY_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BLACK_KEY_POSITIONS: Record<string, number> = {
  'C#': 0.62,
  'D#': 1.62,
  'F#': 3.62,
  'G#': 4.62,
  'A#': 5.62,
};

export default function CreateAssetPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [assetName, setAssetName] = useState('Idea Sketch');
  const [instrument, setInstrument] = useState<GeneratedInstrument>('piano');
  const [rootNote, setRootNote] = useState<typeof ROOT_NOTE_OPTIONS[number]>('C');
  const [scale, setScale] = useState<GeneratedScale>('major');
  const [notes, setNotes] = useState('C4 E4 G4 C5');
  const [tempo, setTempo] = useState(120);
  const [noteLength, setNoteLength] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const project = await api.getProject(projectId);
        setProjectName(project.name);
      } catch (loadError) {
        console.error('Failed to load project:', loadError);
      }
    };

    void loadProject();
  }, [projectId]);

  useEffect(() => {
    if (!previewFile) {
      return;
    }
    setPreviewFile(null);
  }, [previewFile]);

  useEffect(() => {
    if (previewUrl && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyboardOctave = instrument === 'bass' ? 3 : 4;
  const keyboardScaleNotes = useMemo(
    () => new Set(getScaleNotes(rootNote, scale, keyboardOctave)),
    [keyboardOctave, rootNote, scale],
  );
  const rootPitch = `${rootNote}${keyboardOctave}`;

  const buildFile = async () => {
    const parsedNotes = notes
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (parsedNotes.length === 0) {
      setError('Add at least one note, for example C4 E4 G4.');
      return null;
    }

    const isValidNote = (token: string) => {
      const normalized = token.trim().toUpperCase();
      if (normalized === 'R' || normalized === 'REST' || normalized === '-') return true;
      return noteNameToFrequency(token) !== null;
    };

    const invalidNote = parsedNotes.find((token) => !isValidNote(token));
    if (invalidNote) {
      setError(`"${invalidNote}" is not valid. Use notes like C4, F#3, Bb4, or R for rest.`);
      return null;
    }

    setError(null);
    const renderedFile = await renderGeneratedAsset({
      instrument,
      notes: parsedNotes,
      bpm: tempo,
      noteLengthInBeats: noteLength,
    });

    const safeName = assetName.trim() || 'Generated Idea';
    return new File([renderedFile], `${safeName.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.wav`, {
      type: 'audio/wav',
    });
  };

  const handlePreview = async () => {
    setIsRenderingPreview(true);
    setError(null);
    try {
      const file = await buildFile();
      if (!file) {
        return;
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (previewError) {
      console.error('Failed to preview generated asset:', previewError);
      setError(previewError instanceof Error ? previewError.message : 'Failed to preview generated asset.');
    } finally {
      setIsRenderingPreview(false);
    }
  };

  const handleSaveAsset = async () => {
    setIsSavingAsset(true);
    setUploadProgress(0);
    try {
      const file = previewFile ?? await buildFile();
      if (!file) {
        return;
      }

      const { asset } = await api.uploadFile(file, projectId, (progress) => {
        setUploadProgress(progress);
      });

      await api.updateAsset(asset.id, {
        display_name: assetName.trim() || 'Generated Idea',
      });

      router.push(`/projects/${projectId}`);
    } catch (saveError) {
      console.error('Failed to save generated asset:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save generated asset.');
    } finally {
      setIsSavingAsset(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#edf6f1_50%,_#e9f2f7_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_26%),linear-gradient(180deg,_#0f172a_0%,_#111827_50%,_#09111f_100%)]">
      <header className="border-b border-white/60 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Composer</p>
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                {projectName ? `${projectName} · New Asset` : 'New Asset'}
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Main controls */}
          <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
            {/* Row 1: Instrument + Tempo + Step */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Instrument</label>
                <div className="flex gap-1">
                  {GENERATED_INSTRUMENT_OPTIONS.map((option) => {
                    const isActive = instrument === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setInstrument(option.value)}
                        title={option.label}
                        className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                      >
                        {option.value === 'piano' ? <Piano size={12} /> :
                         option.value === 'lead' ? <Sparkles size={12} /> :
                         option.value === 'bass' ? <Layers3 size={12} /> :
                         <Sparkles size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Tempo</label>
                <input
                  type="number"
                  min="60"
                  max="220"
                  value={tempo}
                  onChange={(e) => setTempo(Math.max(60, Math.min(220, parseInt(e.target.value || '120', 10))))}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-400">BPM</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Step</label>
                <div className="flex gap-1">
                  {NOTE_LENGTH_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNoteLength(option.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                        noteLength === option.value
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Root + Scale */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Root</label>
                <div className="flex gap-1">
                  {ROOT_NOTE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRootNote(option)}
                      className={`w-7 rounded-lg border px-1 py-0.5 text-xs font-semibold transition ${
                        rootNote === option
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Scale</label>
                <div className="flex gap-1">
                  {SCALE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScale(option.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                        scale === option.value
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Keyboard */}
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Keyboard</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNotes(transposeNotesByOctave(notes, -1))}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Oct -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotes(transposeNotesByOctave(notes, 1))}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    Oct +1
                  </button>
                </div>
              </div>
              <CompactKeyboard
                octave={keyboardOctave}
                rootPitch={rootPitch}
                scaleNotes={keyboardScaleNotes}
                onSelectNote={(note) => setNotes((current) => `${current.trim()} ${note}`.trim())}
                onAddRest={() => setNotes((current) => `${current.trim()} R`.trim())}
              />
            </div>

            {/* Row 4: Phrase presets + Notes */}
            <div className="mb-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Presets</label>
                {PHRASE_PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setNotes(buildPhrasePreset(preset.id, rootNote, scale))}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 5: Notes textarea */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Notes</label>
                <span className="text-xs text-slate-400">Root: {rootPitch} · {SCALE_OPTIONS.find((o) => o.value === scale)?.label}</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="C4 E4 G4 C5"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Notes like C4, F#3, Bb4 separated by spaces. Use R for rest.
              </p>
            </div>
          </section>

          {/* Preview sidebar */}
          <aside className="space-y-3">
            <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">Asset Name</p>
              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />

              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => void handlePreview()}
                  disabled={isRenderingPreview || isSavingAsset}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                >
                  <Play size={12} />
                  {isRenderingPreview ? 'Rendering...' : 'Preview'}
                </button>
                <button
                  onClick={() => void handleSaveAsset()}
                  disabled={isSavingAsset}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus size={12} />
                  {isSavingAsset ? `${Math.round(uploadProgress)}%` : 'Save'}
                </button>
              </div>

              {previewUrl ? (
                <audio
                  ref={audioRef}
                  controls
                  preload="auto"
                  src={previewUrl}
                  className="h-8 w-full"
                />
              ) : (
                <div className="flex h-8 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                  {isRenderingPreview ? 'Rendering...' : 'Preview will appear here'}
                </div>
              )}

              {error && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
              )}
            </section>

            <Link
              href={`/projects/${projectId}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <ArrowLeft size={14} />
              Back to Project
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function CompactKeyboard({
  octave,
  rootPitch,
  scaleNotes,
  onSelectNote,
  onAddRest,
}: {
  octave: number;
  rootPitch: string;
  scaleNotes: Set<string>;
  onSelectNote: (note: string) => void;
  onAddRest: () => void;
}) {
  const whiteKeys = WHITE_KEY_ORDER.map((note) => `${note}${octave}`);
  const blackKeys = CHROMATIC_NOTES
    .filter((note) => note.includes('#'))
    .map((note) => `${note}${octave}`);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-950">
      <div className="relative h-24">
        <div className="grid h-full grid-cols-7 gap-0.5">
          {whiteKeys.map((note) => {
            const isInScale = scaleNotes.has(note);
            const isRoot = note === rootPitch;

            return (
              <button
                key={note}
                type="button"
                onClick={() => onSelectNote(note)}
                className={`flex flex-col items-center justify-end rounded-b-lg border pb-1 pt-2 text-center transition ${
                  isRoot
                    ? 'border-emerald-500 bg-emerald-200 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-900/60'
                    : isInScale
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <span className="text-[9px] font-semibold uppercase">{note.slice(0, -1)}</span>
                <span className="text-[8px] opacity-60">{octave}</span>
              </button>
            );
          })}
        </div>

        {blackKeys.map((note) => {
          const baseNote = note.slice(0, -1);
          const isInScale = scaleNotes.has(note);
          const isRoot = note === rootPitch;
          return (
            <button
              key={note}
              type="button"
              onClick={() => onSelectNote(note)}
              className={`absolute top-1 z-10 w-[14%] rounded-b-lg border px-0.5 pb-1 text-center text-[9px] font-semibold transition ${
                isRoot
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : isInScale
                    ? 'border-emerald-700 bg-emerald-600 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-200'
              }`}
              style={{ left: `${((BLACK_KEY_POSITIONS[baseNote] ?? 0) + 0.5) * (100 / 7) - 7}%` }}
            >
              {baseNote}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAddRest}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          + Rest
        </button>
      </div>
    </div>
  );
}
