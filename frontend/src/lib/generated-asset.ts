export type GeneratedInstrument = 'piano' | 'lead' | 'bass' | 'pad';
export type GeneratedScale = 'major' | 'minor' | 'minor_pentatonic' | 'dorian';

export const GENERATED_INSTRUMENT_OPTIONS: Array<{
  value: GeneratedInstrument;
  label: string;
  description: string;
}> = [
  { value: 'piano', label: 'Piano', description: 'Short, bright notes with quick decay.' },
  { value: 'lead', label: 'Lead Synth', description: 'Clear melodic synth with extra bite.' },
  { value: 'bass', label: 'Bass', description: 'Low-end monophonic style for root notes.' },
  { value: 'pad', label: 'Pad', description: 'Soft sustained texture with slower attack.' },
];

export const NOTE_LENGTH_OPTIONS = [
  { value: 0.5, label: 'Eighth' },
  { value: 1, label: 'Quarter' },
  { value: 2, label: 'Half' },
] as const;

export const ROOT_NOTE_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SCALE_OPTIONS: Array<{
  value: GeneratedScale;
  label: string;
  description: string;
}> = [
  { value: 'major', label: 'Major', description: 'Bright and stable diatonic scale.' },
  { value: 'minor', label: 'Minor', description: 'Natural minor for moody melodic sketches.' },
  { value: 'minor_pentatonic', label: 'Minor Pentatonic', description: 'Safe five-note set for riffs and hooks.' },
  { value: 'dorian', label: 'Dorian', description: 'Minor color with a lifted sixth for groove writing.' },
];

export const PHRASE_PRESET_OPTIONS = [
  { id: 'arp_up', label: 'Arp Up' },
  { id: 'arp_down', label: 'Arp Down' },
  { id: 'bass_pulse', label: 'Bass Pulse' },
  { id: 'pad_swells', label: 'Pad Swells' },
] as const;

const SCALE_INTERVALS: Record<GeneratedScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  minor_pentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteNameToFrequency(noteToken: string): number | null {
  const normalized = noteToken.trim().toUpperCase();
  if (!normalized || normalized === 'R' || normalized === 'REST' || normalized === '-') {
    return null;
  }

  const match = normalized.match(/^([A-G])([#B]?)(-?\d)$/);
  if (!match) {
    return null;
  }

  const [, letter, accidental, octaveText] = match;
  const semitoneMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let semitone = semitoneMap[letter];
  if (accidental === '#') {
    semitone += 1;
  } else if (accidental === 'B') {
    semitone -= 1;
  }

  const octave = parseInt(octaveText, 10);
  const midiNote = (octave + 1) * 12 + semitone;
  return 440 * 2 ** ((midiNote - 69) / 12);
}

export function getScaleNotes(root: string, scale: GeneratedScale, octave = 4): string[] {
  const rootSemitone = NOTE_TO_SEMITONE[root] ?? 0;
  return SCALE_INTERVALS[scale].map((interval) => {
    const semitone = rootSemitone + interval;
    const nextOctave = octave + Math.floor(semitone / 12);
    return `${SEMITONE_TO_NOTE[semitone % 12]}${nextOctave}`;
  });
}

export function transposeNotesByOctave(noteText: string, direction: -1 | 1): string {
  return noteText
    .split(/[\s,]+/)
    .map((token) => {
      const normalized = token.trim();
      if (!normalized || /^R(EST)?$/i.test(normalized) || normalized === '-') {
        return normalized;
      }

      const match = normalized.match(/^([A-Ga-g])([#bB]?)(-?\d)$/);
      if (!match) {
        return normalized;
      }

      const [, letter, accidental, octaveText] = match;
      const octave = parseInt(octaveText, 10) + direction;
      return `${letter.toUpperCase()}${accidental}${octave}`;
    })
    .filter(Boolean)
    .join(' ');
}

export function buildPhrasePreset(
  presetId: typeof PHRASE_PRESET_OPTIONS[number]['id'],
  root: string,
  scale: GeneratedScale,
): string {
  const notes = getScaleNotes(root, scale, 4);
  const lowerNotes = getScaleNotes(root, scale, 3);

  switch (presetId) {
    case 'arp_down':
      return [...notes.slice(0, 4)].reverse().join(' ');
    case 'bass_pulse':
      return [lowerNotes[0], 'R', lowerNotes[0], 'R', lowerNotes[2] ?? lowerNotes[0], 'R', lowerNotes[0], 'R'].join(' ');
    case 'pad_swells':
      return [notes[0], notes[2] ?? notes[1], notes[4] ?? notes[2], notes[2] ?? notes[1]].join(' ');
    case 'arp_up':
    default:
      return notes.slice(0, 4).join(' ');
  }
}

function pcmToWavBlob(channelData: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < channelData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function renderGeneratedAsset(params: {
  instrument: GeneratedInstrument;
  notes: string[];
  bpm: number;
  noteLengthInBeats: number;
}): Promise<File> {
  const OfflineAudioContextCtor = window.OfflineAudioContext || (window as Window & typeof globalThis & {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }).webkitOfflineAudioContext;

  if (!OfflineAudioContextCtor) {
    throw new Error('Offline audio rendering is not supported in this browser.');
  }

  const sampleRate = 44100;
  const secondsPerBeat = 60 / params.bpm;
  const noteDuration = secondsPerBeat * params.noteLengthInBeats;
  const tailDuration = params.instrument === 'pad' ? 1.2 : 0.45;
  const totalDuration = Math.max(1.5, params.notes.length * noteDuration + tailDuration);
  const totalFrames = Math.ceil(totalDuration * sampleRate);
  const context = new OfflineAudioContextCtor(1, totalFrames, sampleRate);
  const masterGain = context.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(context.destination);

  params.notes.forEach((note, index) => {
    const frequency = noteNameToFrequency(note);
    if (!frequency) {
      return;
    }

    const startTime = index * noteDuration;
    const endTime = startTime + noteDuration;
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    const mainOscillator = context.createOscillator();

    mainOscillator.frequency.value = frequency;
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    let attack = 0.01;
    let sustain = 0.3;
    let release = 0.15;

    switch (params.instrument) {
      case 'bass':
        mainOscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        attack = 0.008;
        sustain = 0.42;
        release = 0.18;
        break;
      case 'lead':
        mainOscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        attack = 0.01;
        sustain = 0.24;
        release = 0.12;
        break;
      case 'pad':
        mainOscillator.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        attack = 0.18;
        sustain = 0.22;
        release = 0.55;
        break;
      case 'piano':
      default:
        mainOscillator.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        attack = 0.006;
        sustain = 0.28;
        release = 0.16;
        break;
    }

    gainNode.gain.linearRampToValueAtTime(sustain, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, Math.min(totalDuration, endTime + release));

    mainOscillator.connect(filter);
    mainOscillator.start(startTime);
    mainOscillator.stop(Math.min(totalDuration, endTime + release));

    if (params.instrument === 'piano' || params.instrument === 'lead' || params.instrument === 'pad') {
      const companionOscillator = context.createOscillator();
      companionOscillator.type = params.instrument === 'lead' ? 'square' : 'sine';
      companionOscillator.frequency.value = params.instrument === 'pad' ? frequency * 1.5 : frequency * 2;
      const companionGain = context.createGain();
      companionGain.gain.value = params.instrument === 'pad' ? 0.08 : 0.12;
      companionOscillator.connect(companionGain);
      companionGain.connect(filter);
      companionOscillator.start(startTime);
      companionOscillator.stop(Math.min(totalDuration, endTime + release));
    }
  });

  const renderedBuffer = await context.startRendering();
  const wavBlob = pcmToWavBlob(renderedBuffer.getChannelData(0), sampleRate);
  return new File([wavBlob], `generated-${params.instrument}-${Date.now()}.wav`, { type: 'audio/wav' });
}
