'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api, Asset, DemucsModel, Job, Stem, StemMode, TimelineMarker, ProjectSnapshot } from '@/lib/api';
import { formatBrowserDateTime } from '@/lib/datetime';
import { getStatusTone, Knob, StereoMeter } from '@/lib/ui';
import { Waveform } from '@/components/Waveform';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  AudioWaveform,
  CheckSquare,
  ChevronDown,
  Flag,
  Gauge,
  Headphones,
  History,
  Key,
  Layers3,
  Music4,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  SplitSquareVertical,
  Square,
  Timer,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
  Wand2,
  Waves,
  X,
} from 'lucide-react';

interface TimelineStem {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  assetId?: string;
  s3Key?: string;
  frequency?: number;
  sourceType: string;
  isSelected: boolean;
  isPlaying: boolean;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  reverb: number;
  reverbWetDry: number;
  reverbDecay: number;
  reverbPreDelay: number;
  delay: number;
  delayWetDry: number;
  delayFeedback: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compressor: boolean;
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  compressorMakeup: number;
}

type AssetFilterValue = 'all' | 'original' | 'stem' | 'mix' | 'preset';
type AssetSortValue = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'duration_desc' | 'type';

const STEM_CONFIGS = {
  vocals: { icon: '🎤', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', frequency: 440 },
  drums: { icon: '🥁', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', frequency: 100 },
  bass: { icon: '🎸', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', frequency: 80 },
  other: { icon: '🎹', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', frequency: 220 },
  accompaniment: { icon: '🎼', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', frequency: 200 },
};

const GENERIC_ASSET_CONFIGS = {
  original: { icon: '🎵', color: 'text-sky-700', bgColor: 'bg-sky-50', borderColor: 'border-sky-300', frequency: 330 },
  stem: STEM_CONFIGS.other,
  mix: { icon: '🎚️', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', frequency: 262 },
  preset: { icon: '💾', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-300', frequency: 196 },
};

const STEM_ORDER = ['vocals', 'drums', 'bass', 'other', 'accompaniment'] as const;

const DEMUCS_MODEL_OPTIONS: Array<{
  value: DemucsModel;
  label: string;
  description: string;
}> = [
  {
    value: 'htdemucs',
    label: 'HT Demucs',
    description: 'Balanced default for most full-song separations.',
  },
  {
    value: 'htdemucs_ft',
    label: 'HT Demucs FT',
    description: 'Fine-tuned variant aimed at higher-quality stem detail.',
  },
  {
    value: 'mdx',
    label: 'MDX',
    description: 'Lean model choice when you want a different separation profile.',
  },
  {
    value: 'mdx_extra',
    label: 'MDX Extra',
    description: 'Heavier MDX variant that can recover extra detail.',
  },
];

const STEM_MODE_OPTIONS: Array<{
  value: StemMode;
  label: string;
  description: string;
}> = [
  {
    value: 'four_stem',
    label: '4 Stems',
    description: 'Vocals, drums, bass, and other.',
  },
  {
    value: 'two_stem_vocals',
    label: 'Vocals + Accompaniment',
    description: 'A simpler split for vocal extraction workflows.',
  },
];

const FOUR_STEM_MODELS = new Set<DemucsModel>(['htdemucs', 'htdemucs_ft']);

function getAssetDisplayName(asset: Asset): string {
  return asset.result?.display_name?.trim() || asset.s3_key.split('/').pop() || asset.type;
}

function getAssetKindLabel(asset: Asset): string {
  return asset.stem_type ? `${asset.type} · ${asset.stem_type}` : asset.type;
}

function formatAssetDate(dateString: string): string {
  return formatBrowserDateTime(dateString, {
    second: undefined,
  });
}

function getLatestStemAssets(projectAssets: Asset[]): Asset[] {
  const stemAssets = projectAssets.filter((asset) => asset.type === 'stem' && asset.stem_type);
  if (stemAssets.length === 0) {
    return [];
  }

  const groupedAssets = new Map<string, Asset[]>();
  stemAssets.forEach((asset) => {
    const groupKey = asset.parent_asset_id ?? 'ungrouped';
    const existingAssets = groupedAssets.get(groupKey) ?? [];
    existingAssets.push(asset);
    groupedAssets.set(groupKey, existingAssets);
  });

  const latestGroup = Array.from(groupedAssets.values()).sort((groupA, groupB) => {
    const newestAssetA = Math.max(...groupA.map((asset) => new Date(asset.created_at).getTime()));
    const newestAssetB = Math.max(...groupB.map((asset) => new Date(asset.created_at).getTime()));
    return newestAssetB - newestAssetA;
  })[0];

  return [...latestGroup].sort((assetA, assetB) => {
    const stemIndexA = STEM_ORDER.indexOf((assetA.stem_type ?? 'other') as typeof STEM_ORDER[number]);
    const stemIndexB = STEM_ORDER.indexOf((assetB.stem_type ?? 'other') as typeof STEM_ORDER[number]);
    const normalizedIndexA = stemIndexA === -1 ? STEM_ORDER.length : stemIndexA;
    const normalizedIndexB = stemIndexB === -1 ? STEM_ORDER.length : stemIndexB;
    return normalizedIndexA - normalizedIndexB;
  });
}

function buildTimelineStemsFromAssets(stemAssets: Asset[]): TimelineStem[] {
  return stemAssets.map((asset) => {
    const sourceType = asset.stem_type ?? asset.type;
    const config = asset.stem_type
      ? STEM_CONFIGS[asset.stem_type as keyof typeof STEM_CONFIGS] || STEM_CONFIGS.other
      : GENERIC_ASSET_CONFIGS[asset.type];
    const filename = asset.s3_key.split('/').pop() ?? asset.type;
    const trackName = asset.stem_type
      ? asset.stem_type.charAt(0).toUpperCase() + asset.stem_type.slice(1)
      : filename;

    return {
      id: asset.id,
      name: trackName,
      assetId: asset.id,
      s3Key: asset.s3_key,
      sourceType,
      isSelected: true,
      isPlaying: false,
      volume: 70,
      pan: 0,
      muted: false,
      solo: false,
      reverb: 0,
      reverbWetDry: 30,
      reverbDecay: 50,
      reverbPreDelay: 0,
      delay: 0,
      delayWetDry: 30,
      delayFeedback: 30,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      compressor: false,
      compressorThreshold: -24,
      compressorRatio: 4,
      compressorAttack: 0.003,
      compressorRelease: 0.25,
      compressorMakeup: 0,
      ...config,
    };
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'upload' | 'separate' | 'denoise' | 'convert' | 'mix' | 'jobs'>('upload');
  const [projectJobs, setProjectJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | Job['status']>('all');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isMixed, setIsMixed] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [timelineStems, setTimelineStems] = useState<TimelineStem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMixerAssetIds, setSelectedMixerAssetIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetNameDraft, setAssetNameDraft] = useState('');
  const [detectedBpm, setDetectedBpm] = useState<Record<string, number | null>>({});
  const [detectingBpmId, setDetectingBpmId] = useState<string | null>(null);
  const [detectedKey, setDetectedKey] = useState<Record<string, string | null>>({});
  const [detectingKeyId, setDetectingKeyId] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilterValue>('all');
  const [assetSort, setAssetSort] = useState<AssetSortValue>('newest');
  const [assetSearch, setAssetSearch] = useState('');
  const [demucsModel, setDemucsModel] = useState<DemucsModel>('htdemucs');
  const [stemMode, setStemMode] = useState<StemMode>('four_stem');
  const [denoiseOutputMode, setDenoiseOutputMode] = useState<'new' | 'overwrite'>('new');
  const [denoiseStationary, setDenoiseStationary] = useState(true);
  const [denoiseNoiseThreshold, setDenoiseNoiseThreshold] = useState(1.5);
  const [convertFormat, setConvertFormat] = useState<string>('mp3');
  const [convertBitrate, setConvertBitrate] = useState(192000);
  const [convertSampleRate, setConvertSampleRate] = useState(44100);
  const [convertChannels, setConvertChannels] = useState(2);
  const [separator, setSeparator] = useState<'demucs' | 'spleeter'>('demucs');
  const [masterVolume, setMasterVolume] = useState(80);
  const [trackLevels, setTrackLevels] = useState<Record<string, { l: number; r: number }>>({});
  const [masterLevelL, setMasterLevelL] = useState(0);
  const [masterLevelR, setMasterLevelR] = useState(0);
  const [masterRms, setMasterRms] = useState(0);
  const [masterPhase, setMasterPhase] = useState(0);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [showMixerGuide, setShowMixerGuide] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('audioforge_showMixerGuide');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('audioforge_showMixerGuide', String(showMixerGuide));
    }
  }, [showMixerGuide]);
  const [spectrumData, setSpectrumData] = useState<number[]>([]);
  const [loudnessShortTerm, setLoudnessShortTerm] = useState(-Infinity);
  const [loudnessHistory, setLoudnessHistory] = useState<number[]>([]);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [markerDraft, setMarkerDraft] = useState('');
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [expandedEffects, setExpandedEffects] = useState<Record<string, 'reverb' | 'delay' | 'eq' | 'compressor' | null>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const actualTimeRef = useRef<number>(0);
  const seekPositionRef = useRef<number>(0);
  const durationRef = useRef<number>(180);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode; panner: StereoPannerNode; analyser: AnalyserNode; convolver?: ConvolverNode; delay?: DelayNode; delayFeedback?: GainNode; reverbGain?: GainNode; eqLow?: BiquadFilterNode; eqMid?: BiquadFilterNode; eqHigh?: BiquadFilterNode; compressor?: DynamicsCompressorNode }>>(new Map());
  const audioSourceRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const audioBufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const audioNodesRef = useRef<Map<string, { gain: GainNode; panner: StereoPannerNode; analyser: AnalyserNode; convolver?: ConvolverNode; delay?: DelayNode; delayFeedback?: GainNode; reverbGain?: GainNode; eqLow?: BiquadFilterNode; eqMid?: BiquadFilterNode; eqHigh?: BiquadFilterNode; compressor?: DynamicsCompressorNode }>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimationRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const workletSupportedRef = useRef<boolean | null>(null);
  const masterMeterWorkletRef = useRef<AudioWorkletNode | null>(null);
  const workletMeterDataRef = useRef<{
    master: { peak: number; rms: number; stereo: { l: number; r: number }; spectrum: number[]; loudness: number; phase: number };
    stems: Map<string, { peak: number; rms: number; stereo: { l: number; r: number } }>;
  }>({
    master: { peak: 0, rms: 0, stereo: { l: 0, r: 0 }, spectrum: [], loudness: -Infinity, phase: 1 },
    stems: new Map()
  });

  const handlePlayAsset = (asset: Asset) => {
    if (playingAssetId === asset.id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPlayingAssetId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio();
      audio.src = api.getAssetDownloadUrl(asset.id);
      audio.onended = () => setPlayingAssetId(null);
      audio.play();
      previewAudioRef.current = audio;
      setPlayingAssetId(asset.id);
    }
  };

  const hydrateProjectAssets = useCallback((projectAssets: Asset[]) => {
    setAssets(projectAssets);
    setSelectedMixerAssetIds((currentIds) =>
      currentIds.filter((assetId) => projectAssets.some((asset) => asset.id === assetId))
    );
    setEditingAssetId((currentEditingAssetId) =>
      currentEditingAssetId && projectAssets.some((asset) => asset.id === currentEditingAssetId)
        ? currentEditingAssetId
        : null
    );

    const originalAssets = projectAssets.filter((asset) => asset.type === 'original');
    setSelectedAsset((currentSelectedAsset) => {
      if (currentSelectedAsset) {
        const matchingAsset = originalAssets.find((asset) => asset.id === currentSelectedAsset.id);
        if (matchingAsset) {
          return matchingAsset;
        }
      }

      return originalAssets[0] ?? null;
    });

    const latestStemAssets = getLatestStemAssets(projectAssets);
    if (latestStemAssets.length > 0) {
      setTimelineStems(buildTimelineStemsFromAssets(latestStemAssets));
      setIsMixed(true);
    } else {
      setTimelineStems([]);
      setIsMixed(false);
    }
  }, []);

  useEffect(() => {
    const allAudioAssets = assets.filter((asset) => asset.type === 'original' || asset.type === 'stem');
    allAudioAssets.forEach((asset) => {
      if (!detectedBpm[asset.id] && detectingBpmId !== asset.id) {
        handleDetectBpm(asset.id);
      }
      if (!detectedKey[asset.id] && detectingKeyId !== asset.id) {
        handleDetectKey(asset.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  useEffect(() => {
    const loadProjectData = async () => {
      try {
        const [project, projectAssets, projectMarkers, projectSnapshots] = await Promise.all([
          api.getProject(projectId),
          api.getProjectAssets(projectId),
          api.listMarkers(projectId).catch(() => []),
          api.listSnapshots(projectId).catch(() => []),
        ]);

        setProjectName(project.name);
        setMarkers(projectMarkers);
        setSnapshots(projectSnapshots);
        hydrateProjectAssets(projectAssets);
      } catch (error) {
        console.error('Failed to load project data:', error);

        const savedProjects = localStorage.getItem('audioforge_projects');
        if (savedProjects) {
          const projects = JSON.parse(savedProjects);
          const project = projects.find((item: { id: string; name: string }) => item.id === projectId);
          if (project) {
            setProjectName(project.name);

            if (error instanceof Error && error.message === 'Project not found') {
              try {
                const recreatedProject = await api.createProject(project.name);
                const nextProjects = projects.map((item: { id: string; name: string }) =>
                  item.id === projectId ? { ...item, id: recreatedProject.id } : item
                );
                localStorage.setItem('audioforge_projects', JSON.stringify(nextProjects));
                router.replace(`/projects/${recreatedProject.id}`);
                return;
              } catch (recreateError) {
                console.error('Failed to recreate missing project:', recreateError);
              }
            }
          }
        }
      }
    };

    loadProjectData();
  }, [hydrateProjectAssets, projectId, router]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume / 100;
    }
  }, [masterVolume]);

  const getMeterLevel = useCallback((analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    let peak = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = Math.abs((data[i] - 128) / 128);
      if (sample > peak) {
        peak = sample;
      }
    }

    return Math.min(1, peak * 1.35);
  }, []);

  const getStereoLevel = useCallback((analyser: AnalyserNode): { l: number; r: number } => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    
    let peakL = 0;
    let peakR = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const sample = Math.abs((dataArray[i] - 128) / 128);
      if (i % 2 === 0) {
        peakL = Math.max(peakL, sample);
      } else {
        peakR = Math.max(peakR, sample);
      }
    }
    
    const l = Math.min(1, peakL * 1.5);
    const r = Math.min(1, peakR * 1.5);
    
    return { l, r };
  }, []);

  const getMeterRms = useCallback((analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = (data[i] - 128) / 128;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / data.length);
    return Math.min(1, rms * 2.5);
  }, []);

  const getPhaseCorrelation = useCallback((analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    let sum = 0;
    let sumLeft = 0;
    let sumRight = 0;
    const half = Math.floor(data.length / 2);
    
    for (let i = 0; i < half; i += 1) {
      const left = (data[i] - 128) / 128;
      const right = (data[i + half] - 128) / 128;
      sum += left * right;
      sumLeft += left * left;
      sumRight += right * right;
    }

    const denominator = Math.sqrt(sumLeft * sumRight);
    if (denominator === 0) return 1;
    return Math.max(-1, Math.min(1, sum / denominator));
  }, []);

  const getSpectrumData = useCallback((analyser: AnalyserNode): number[] => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const bars = 16;
    const step = Math.floor(dataArray.length / bars);
    const result: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      result.push(sum / step / 255);
    }
    return result;
  }, []);

  const getLoudness = useCallback((analyser: AnalyserNode): number => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128;
      sumSquares += sample * sample;
    }
    
    const rms = Math.sqrt(sumSquares / dataArray.length);
    const dbfs = 20 * Math.log10(Math.max(rms, 0.0001));
    const lufs = dbfs - 0.691;
    
    return Math.max(-70, Math.min(0, lufs));
  }, []);

  const syncLiveAudioState = useCallback((stems: TimelineStem[]) => {
    const anySolo = stems.some((stem) => stem.solo);

    stems.forEach((stem) => {
      const gainValue = stem.isSelected && !stem.muted && (!anySolo || stem.solo)
        ? (stem.volume / 100) * 0.3
        : 0;

      const oscillatorNodes = oscillatorsRef.current.get(stem.id);
      if (oscillatorNodes) {
        oscillatorNodes.gain.gain.value = gainValue;
        oscillatorNodes.panner.pan.value = stem.pan / 100;
      }

      const audioNodes = stem.assetId ? audioNodesRef.current.get(stem.assetId) : undefined;
      if (audioNodes) {
        audioNodes.gain.gain.value = gainValue;
        audioNodes.panner.pan.value = stem.pan / 100;
      }
    });
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
      }
      setTrackLevels({});
      setMasterLevelL(0);
      setMasterLevelR(0);
      setLoudnessShortTerm(-Infinity);
      setLoudnessHistory([]);
      return;
    }

    const updateMeters = () => {
      const nextTrackLevels: Record<string, { l: number; r: number }> = {};
      const useWorklet = workletSupportedRef.current && masterMeterWorkletRef.current;

      timelineStems.forEach((stem) => {
        if (useWorklet) {
          const stemData = workletMeterDataRef.current.stems.get(stem.id);
          if (stemData) {
            nextTrackLevels[stem.id] = stemData.stereo;
          } else {
            nextTrackLevels[stem.id] = { l: 0, r: 0 };
          }
        } else {
          const oscNodes = oscillatorsRef.current.get(stem.id);
          const audioNodes = stem.assetId ? audioNodesRef.current.get(stem.assetId) : undefined;
          const analyser = oscNodes?.analyser ?? audioNodes?.analyser;
          
          if (analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteTimeDomainData(dataArray);
            
            let peakL = 0;
            let peakR = 0;
            
            for (let i = 0; i < dataArray.length; i++) {
              const sample = Math.abs((dataArray[i] - 128) / 128);
              if (i % 2 === 0) {
                peakL = Math.max(peakL, sample);
              } else {
                peakR = Math.max(peakR, sample);
              }
            }
            
            nextTrackLevels[stem.id] = { 
              l: Math.min(1, peakL * 2), 
              r: Math.min(1, peakR * 2) 
            };
          } else {
            nextTrackLevels[stem.id] = { l: 0, r: 0 };
          }
        }
      });

      setTrackLevels(nextTrackLevels);

      if (useWorklet) {
        const workletData = workletMeterDataRef.current.master;
        setMasterLevelL(workletData.stereo.l);
        setMasterLevelR(workletData.stereo.r);
        setMasterRms(workletData.rms);
        setMasterPhase(workletData.phase);
        if (showSpectrum) {
          setSpectrumData(workletData.spectrum || []);
        }
        setLoudnessShortTerm(workletData.loudness);
        setLoudnessHistory(prev => {
          const newHistory = [...prev, workletData.loudness];
          if (newHistory.length > 50) newHistory.shift();
          return newHistory;
        });
      } else {
        const masterLevels = masterAnalyserRef.current ? getStereoLevel(masterAnalyserRef.current) : { l: 0, r: 0 };
        setMasterLevelL(masterLevels.l);
        setMasterLevelR(masterLevels.r);
        setMasterRms(masterAnalyserRef.current ? getMeterRms(masterAnalyserRef.current) : 0);
        setMasterPhase(masterAnalyserRef.current ? getPhaseCorrelation(masterAnalyserRef.current) : 0);
        if (showSpectrum) {
          setSpectrumData(masterAnalyserRef.current ? getSpectrumData(masterAnalyserRef.current) : []);
        }
        const loudness = masterAnalyserRef.current ? getLoudness(masterAnalyserRef.current) : -Infinity;
        setLoudnessShortTerm(loudness);
        setLoudnessHistory(prev => {
          const newHistory = [...prev, loudness];
          if (newHistory.length > 50) newHistory.shift();
          return newHistory;
        });
      }
      meterAnimationRef.current = requestAnimationFrame(updateMeters);
    };

    meterAnimationRef.current = requestAnimationFrame(updateMeters);

    return () => {
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLoudness, getMeterLevel, getMeterRms, getPhaseCorrelation, getSpectrumData, isPlaying, showSpectrum, timelineStems]);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (!masterGainRef.current || !masterAnalyserRef.current) {
      const masterGain = audioContextRef.current.createGain();
      const masterAnalyser = audioContextRef.current.createAnalyser();
      masterGain.gain.value = masterVolume / 100;
      masterAnalyser.fftSize = 256;
      masterGain.connect(masterAnalyser);
      masterAnalyser.connect(audioContextRef.current.destination);
      masterGainRef.current = masterGain;
      masterAnalyserRef.current = masterAnalyser;
    }
    if (workletSupportedRef.current === null) {
      workletSupportedRef.current = typeof AudioWorkletNode !== 'undefined';
      if (workletSupportedRef.current) {
        try {
          await audioContextRef.current.audioWorklet.addModule('/meters.worklet.js');
        } catch (e) {
          console.warn('Failed to load audio worklet, falling back to AnalyserNode:', e);
          workletSupportedRef.current = false;
        }
      }
    }
    if (workletSupportedRef.current && !masterMeterWorkletRef.current && audioContextRef.current) {
      try {
        const meterWorklet = new AudioWorkletNode(audioContextRef.current, 'meter-processor');
        meterWorklet.port.onmessage = (event) => {
          if (event.data.type === 'meter') {
            workletMeterDataRef.current.master = event.data;
          }
        };
        if (masterGainRef.current) {
          masterGainRef.current.connect(meterWorklet);
        }
        masterMeterWorkletRef.current = meterWorklet;
      } catch (e) {
        console.warn('Failed to create meter worklet:', e);
        workletSupportedRef.current = false;
      }
    }
    return audioContextRef.current;
  }, [masterVolume]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    for (const file of Array.from(files)) {
      try {
        // Upload to backend (which uploads to S3)
        const { asset } = await api.uploadFile(file, projectId, (progress) => {
          setUploadProgress(progress);
        });
        
        const newAsset: Asset = {
          ...asset,
          duration: asset.duration || 0,
          channels: asset.channels || 2,
          sample_rate: asset.sample_rate || 44100,
        };
        
        setAssets(prev => [newAsset, ...prev]);
        setSelectedAsset(newAsset);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSeparateStems = async () => {
    if (!selectedAsset) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStatus('Starting separation...');
    setActiveTab('separate');

    try {
      // Create separation job
      const job = await api.createSeparationJob(projectId, [selectedAsset.id], {
        demucs_model: demucsModel,
        stem_mode: stemMode,
        separator: separator,
      });
      
      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getJobStatus(job.id);
          setProcessingProgress(status.progress);
          setProcessingStatus(status.result?.message || `Processing: ${status.progress}%`);
          
          if (status.status === 'succeeded') {
            clearInterval(pollInterval);
            setProcessingProgress(100);
            setProcessingStatus('Separation complete!');
            
            try {
              const refreshedAssets = await api.getProjectAssets(projectId);
              hydrateProjectAssets(refreshedAssets);
            } catch (refreshError) {
              console.error('Failed to refresh project assets after separation:', refreshError);

              if (status.result?.stems) {
                initializeStems(status.result.stems);
                setIsMixed(true);
              }
            }
            
            setTimeout(() => {
              setIsProcessing(false);
              setActiveTab('mix');
            }, 1000);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setProcessingStatus(`Error: ${status.error}`);
            setIsProcessing(false);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Failed to start separation:', error);
      setProcessingStatus('Failed to start separation');
      setIsProcessing(false);
    }
  };

  const handleDenoiseSelected = async () => {
    if (!selectedAsset) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStatus('Starting noise reduction...');

    try {
      const job = await api.createDenoiseJob(projectId, [selectedAsset.id], {
        output_mode: denoiseOutputMode,
        stationary: denoiseStationary,
        noise_threshold: denoiseNoiseThreshold,
      });
      
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getJobStatus(job.id);
          setProcessingProgress(status.progress);
          setProcessingStatus(status.result?.message || `Processing: ${status.progress}%`);
          
          if (status.status === 'succeeded') {
            clearInterval(pollInterval);
            setProcessingProgress(100);
            setProcessingStatus('Noise reduction complete!');
            
            const refreshedAssets = await api.getProjectAssets(projectId);
            hydrateProjectAssets(refreshedAssets);
            
            setTimeout(() => {
              setIsProcessing(false);
              setActiveTab('upload');
            }, 1000);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setProcessingStatus(`Error: ${status.error}`);
            setIsProcessing(false);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Failed to start denoise:', error);
      setProcessingStatus('Failed to start noise reduction');
      setIsProcessing(false);
    }
  };

  const initializeStems = (stems: Stem[]) => {
    const timelineStems: TimelineStem[] = stems.map(stem => {
      const config = STEM_CONFIGS[stem.stem_type as keyof typeof STEM_CONFIGS] || STEM_CONFIGS.other;
      return {
        id: stem.asset_id,
        name: stem.stem_type
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        assetId: stem.asset_id,
        s3Key: stem.s3_key,
        sourceType: stem.stem_type,
        isSelected: true,
        isPlaying: false,
        volume: 70,
        pan: 0,
        muted: false,
        solo: false,
        reverb: 0,
        reverbWetDry: 30,
        reverbDecay: 50,
        reverbPreDelay: 0,
        delay: 0,
        delayWetDry: 30,
        delayFeedback: 30,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        compressor: false,
        compressorThreshold: -24,
        compressorRatio: 4,
        compressorAttack: 0.003,
        compressorRelease: 0.25,
        compressorMakeup: 0,
        ...config,
      };
    });
    setTimelineStems(timelineStems);
  };

  const sendSelectedAssetsToMixer = () => {
    const selectedAssets = assets.filter((asset) => selectedMixerAssetIds.includes(asset.id));
    if (selectedAssets.length === 0) {
      return;
    }

    setTimelineStems(buildTimelineStemsFromAssets(selectedAssets));
    setIsMixed(true);
    setCurrentTime(0);
    actualTimeRef.current = 0;
    playbackOffsetRef.current = 0;
    setActiveTab('mix');
  };

  const openAssetsInMixer = (selectedAssets: Asset[]) => {
    if (selectedAssets.length === 0) {
      return;
    }

    setSelectedMixerAssetIds(selectedAssets.map((asset) => asset.id));
    setTimelineStems(buildTimelineStemsFromAssets(selectedAssets));
    setIsMixed(true);
    setCurrentTime(0);
    actualTimeRef.current = 0;
    playbackOffsetRef.current = 0;
    setActiveTab('mix');
  };

  const handleDeleteSelectedAssets = async () => {
    if (selectedMixerAssetIds.length === 0) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const assetIdsToDelete = Array.from(
        new Set(selectedMixerAssetIds.filter((assetId) => assets.some((asset) => asset.id === assetId)))
      );

      await Promise.allSettled(assetIdsToDelete.map((assetId) => api.deleteAsset(assetId)));
      const refreshedAssets = await api.getProjectAssets(projectId);
      hydrateProjectAssets(refreshedAssets);
      setSelectedMixerAssetIds([]);
    } catch (error) {
      console.error('Failed to delete selected assets:', error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await api.deleteAsset(assetId);
      const refreshedAssets = await api.getProjectAssets(projectId);
      hydrateProjectAssets(refreshedAssets);
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeletingProject(true);
    try {
      await api.deleteProject(projectId);
      setShowDeleteConfirm(false);
      router.push('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete project');
      setIsDeletingProject(false);
    }
  };

  const handleDetectBpm = async (assetId: string) => {
    if (detectedBpm[assetId] || detectingBpmId === assetId) return;
    setDetectingBpmId(assetId);
    try {
      const result = await api.getAssetBpm(assetId);
      if (result.bpm) {
        setDetectedBpm((prev) => ({ ...prev, [assetId]: result.bpm }));
      }
    } catch (error) {
      console.error('Failed to detect BPM:', error);
    } finally {
      setDetectingBpmId(null);
    }
  };

  const handleDetectKey = async (assetId: string) => {
    if (detectedKey[assetId] || detectingKeyId === assetId) return;
    setDetectingKeyId(assetId);
    try {
      const result = await api.getAssetKey(assetId);
      if (result.key) {
        setDetectedKey((prev) => ({ ...prev, [assetId]: result.key }));
      }
    } catch (error) {
      console.error('Failed to detect key:', error);
    } finally {
      setDetectingKeyId(null);
    }
  };

  const handleSeparateAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setActiveTab('separate');
  };

  const handleDenoiseAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setActiveTab('denoise');
  };

  const handleConvertAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setActiveTab('convert');
  };

  const startRenamingAsset = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setAssetNameDraft(getAssetDisplayName(asset));
  };

  const cancelRenamingAsset = () => {
    setEditingAssetId(null);
    setAssetNameDraft('');
  };

  const handleRenameAsset = async (assetId: string) => {
    try {
      const updatedAsset = await api.updateAsset(assetId, {
        display_name: assetNameDraft.trim(),
      });
      setAssets((currentAssets) =>
        currentAssets.map((asset) => (asset.id === assetId ? updatedAsset : asset))
      );
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(updatedAsset);
      }
      cancelRenamingAsset();
    } catch (error) {
      console.error('Failed to rename asset:', error);
    }
  };

  const handleAddMarker = async () => {
    if (isAddingMarker) {
      setIsAddingMarker(false);
      return;
    }
    setIsAddingMarker(true);
  };

  const handleCreateMarker = async () => {
    try {
      const newMarker = await api.createMarker(projectId, {
        time: currentTime,
        label: markerDraft || undefined,
        color: 'yellow',
      });
      setMarkers(prev => [...prev, newMarker].sort((a, b) => a.time - b.time));
      setMarkerDraft('');
      setIsAddingMarker(false);
    } catch (error) {
      console.error('Failed to create marker:', error);
    }
  };

  const handleUpdateMarker = async (markerId: string) => {
    try {
      const updated = await api.updateMarker(projectId, markerId, {
        label: markerDraft || undefined,
      });
      setMarkers(prev => prev.map(m => m.id === markerId ? updated : m));
      setEditingMarkerId(null);
      setMarkerDraft('');
    } catch (error) {
      console.error('Failed to update marker:', error);
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    try {
      await api.deleteMarker(projectId, markerId);
      setMarkers(prev => prev.filter(m => m.id !== markerId));
    } catch (error) {
      console.error('Failed to delete marker:', error);
    }
  };

  const startEditingMarker = (marker: TimelineMarker) => {
    setEditingMarkerId(marker.id);
    setMarkerDraft(marker.label || '');
  };

  const cancelEditingMarker = () => {
    setEditingMarkerId(null);
    setMarkerDraft('');
  };

  const togglePlay = useCallback(async () => {
    const ctx = await initAudioContext();
    
    if (isPlaying) {
      if (playbackRef.current) clearInterval(playbackRef.current);
      
      // Store current playback position before stopping
      if (ctx.currentTime && playbackStartTimeRef.current > 0) {
        actualTimeRef.current = playbackOffsetRef.current + (ctx.currentTime - playbackStartTimeRef.current);
      }
      
      oscillatorsRef.current.forEach((nodes) => {
        try { nodes.osc.stop(); } catch {}
      });
      oscillatorsRef.current.clear();
      
      audioSourceRef.current.forEach((source) => {
        try { source.stop(); } catch {}
      });
      audioSourceRef.current.clear();
      audioNodesRef.current.clear();
      setTrackLevels({});
      setMasterLevelL(0);
      setMasterLevelR(0);
      
      setIsPlaying(false);
      setTimelineStems(prev => prev.map(s => ({ ...s, isPlaying: false })));
    } else {
      setIsLoadingAudio(true);
      
      // Check solo state
      const anySolo = timelineStems.some(s => s.solo);
      
      // Pre-load all audio buffers first
      const loadPromises = timelineStems
        .filter(stem => stem.assetId && stem.s3Key)
        .map(async (stem) => {
          const assetId = stem.assetId;
          if (!assetId || audioBufferRef.current.has(assetId)) {
            return;
          }

          try {
            const downloadUrl = await api.getAssetDownloadUrl(assetId);
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            audioBufferRef.current.set(assetId, audioBuffer);
          } catch (error) {
            console.warn('Failed to load stem audio:', assetId, error);
          }
        });
      
      await Promise.all(loadPromises);
      setIsLoadingAudio(false);
      
      // Calculate actual max duration from loaded audio buffers
      let maxBufferDuration = 0;
      timelineStems.forEach(stem => {
        if (stem.assetId) {
          const buffer = audioBufferRef.current.get(stem.assetId);
          if (buffer && buffer.duration > maxBufferDuration) {
            maxBufferDuration = buffer.duration;
          }
        }
      });
      if (maxBufferDuration > 0) {
        setTotalDuration(maxBufferDuration);
        durationRef.current = maxBufferDuration;
      }
      
      // Get resume position
      const resumePosition = actualTimeRef.current;
      
      // Start playback from resume position
      playbackStartTimeRef.current = ctx.currentTime;
      playbackOffsetRef.current = resumePosition;
      
      timelineStems.forEach((stem) => {
        if (!stem.isSelected || stem.muted) return;
        if (anySolo && !stem.solo) return;
        
        if (stem.assetId) {
          const buffer = audioBufferRef.current.get(stem.assetId);
          if (buffer) {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            
            const dryGain = ctx.createGain();
            const wetGain = ctx.createGain();
            const preDelay = ctx.createDelay(1.0);
            const pannerNode = ctx.createStereoPanner();
            const analyserNode = ctx.createAnalyser();
            const convolver = ctx.createConvolver();
            const delay = ctx.createDelay(1.0);
            const delayFeedback = ctx.createGain();
            const reverbGain = ctx.createGain();
            
            const wetDryMix = stem.reverb > 0 ? stem.reverbWetDry / 100 : 0;
            const decayTime = stem.reverbDecay / 100 * 2 + 0.5;
            const preDelayTime = stem.reverbPreDelay / 100 * 0.1;
            
            dryGain.gain.value = (1 - wetDryMix) * (stem.volume / 100) * 0.3;
            wetGain.gain.value = wetDryMix * (stem.volume / 100) * 0.3;
            preDelay.delayTime.value = preDelayTime;
            reverbGain.gain.value = stem.reverb > 0 ? stem.reverb / 100 : 1;
            
            const impulseLength = Math.round(ctx.sampleRate * decayTime);
            const impulse = ctx.createBuffer(2, impulseLength, ctx.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
              const channelData = impulse.getChannelData(channel);
              for (let i = 0; i < impulseLength; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decayTime / 3));
              }
            }
            convolver.buffer = impulse;
            
            const delayWetDryMix = stem.delay > 0 ? stem.delayWetDry / 100 : 0;
            const dryDelayGain = ctx.createGain();
            const wetDelayGain = ctx.createGain();
            dryDelayGain.gain.value = 1 - delayWetDryMix;
            wetDelayGain.gain.value = delayWetDryMix;
            
            delay.delayTime.value = stem.delay / 100 * 0.5;
            delayFeedback.gain.value = stem.delayFeedback / 100 * 0.7;
            delay.connect(delayFeedback);
            delayFeedback.connect(delay);
            
            const eqLow = ctx.createBiquadFilter();
            eqLow.type = 'lowshelf';
            eqLow.frequency.value = 320;
            eqLow.gain.value = stem.eqLow;
            
            const eqMid = ctx.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = 1000;
            eqMid.Q.value = 0.5;
            eqMid.gain.value = stem.eqMid;
            
            const eqHigh = ctx.createBiquadFilter();
            eqHigh.type = 'highshelf';
            eqHigh.frequency.value = 3200;
            eqHigh.gain.value = stem.eqHigh;
            
            pannerNode.pan.value = stem.pan / 100;
            analyserNode.fftSize = 256;
            
            const hasReverb = stem.reverb > 0;
            const hasDelay = stem.delay > 0;
            
            source.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(dryGain);
            dryGain.connect(pannerNode);
            
            if (hasDelay) {
              pannerNode.connect(dryDelayGain);
              dryDelayGain.connect(delay);
            } else {
              pannerNode.connect(delay);
            }
            
            if (hasReverb) {
              source.connect(wetGain);
              wetGain.connect(preDelay);
              preDelay.connect(convolver);
              convolver.connect(reverbGain);
              if (hasDelay) {
                reverbGain.connect(wetDelayGain);
                wetDelayGain.connect(delay);
              } else {
                reverbGain.connect(delay);
              }
            }
            
            delay.connect(analyserNode);
            analyserNode.connect(masterGainRef.current ?? ctx.destination);
            
            const offsetSeconds = Math.min(resumePosition, buffer.duration);
            source.start(0, offsetSeconds);
            
            audioSourceRef.current.set(stem.assetId, source);
            audioNodesRef.current.set(stem.assetId, { gain: dryGain, panner: pannerNode, analyser: analyserNode, convolver, delay, delayFeedback, reverbGain, eqLow, eqMid, eqHigh });
          }
        } else {
          const osc = ctx.createOscillator();
          const dryGain = ctx.createGain();
          const wetGain = ctx.createGain();
          const preDelay = ctx.createDelay(1.0);
          const panner = ctx.createStereoPanner();
          const analyser = ctx.createAnalyser();
          const convolver = ctx.createConvolver();
          const delay = ctx.createDelay(1.0);
          const delayFeedback = ctx.createGain();
          const reverbGain = ctx.createGain();
          
          const wetDryMix = stem.reverb > 0 ? stem.reverbWetDry / 100 : 0;
          const decayTime = stem.reverbDecay / 100 * 2 + 0.5;
          const preDelayTime = stem.reverbPreDelay / 100 * 0.1;
          
          dryGain.gain.value = (1 - wetDryMix) * (stem.volume / 100) * 0.3;
          wetGain.gain.value = wetDryMix * (stem.volume / 100) * 0.3;
          preDelay.delayTime.value = preDelayTime;
          reverbGain.gain.value = stem.reverb > 0 ? stem.reverb / 100 : 1;
          
          const impulseLength = Math.round(ctx.sampleRate * decayTime);
          const impulse = ctx.createBuffer(2, impulseLength, ctx.sampleRate);
          for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
              channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decayTime / 3));
            }
          }
          convolver.buffer = impulse;
          
          const delayWetDryMix = stem.delay > 0 ? stem.delayWetDry / 100 : 0;
          const dryDelayGain = ctx.createGain();
          const wetDelayGain = ctx.createGain();
          dryDelayGain.gain.value = 1 - delayWetDryMix;
          wetDelayGain.gain.value = delayWetDryMix;
          
          delay.delayTime.value = stem.delay / 100 * 0.5;
          delayFeedback.gain.value = stem.delayFeedback / 100 * 0.7;
          delay.connect(delayFeedback);
          delayFeedback.connect(delay);
          
          osc.type = stem.sourceType === 'drums' ? 'square' : stem.sourceType === 'bass' ? 'sawtooth' : 'sine';
          osc.frequency.value = stem.frequency || 440;
          panner.pan.value = stem.pan / 100;
          analyser.fftSize = 256;
          
          const eqLow = ctx.createBiquadFilter();
          eqLow.type = 'lowshelf';
          eqLow.frequency.value = 320;
          eqLow.gain.value = stem.eqLow;
          
          const eqMid = ctx.createBiquadFilter();
          eqMid.type = 'peaking';
          eqMid.frequency.value = 1000;
          eqMid.Q.value = 0.5;
          eqMid.gain.value = stem.eqMid;
          
          const eqHigh = ctx.createBiquadFilter();
          eqHigh.type = 'highshelf';
          eqHigh.frequency.value = 3200;
          eqHigh.gain.value = stem.eqHigh;
          
          const hasReverb = stem.reverb > 0;
          const hasDelay = stem.delay > 0;
          
          osc.connect(eqLow);
          eqLow.connect(eqMid);
          eqMid.connect(eqHigh);
          eqHigh.connect(dryGain);
          dryGain.connect(panner);
          
          if (hasDelay) {
            panner.connect(dryDelayGain);
            dryDelayGain.connect(delay);
          } else {
            panner.connect(delay);
          }
          
          if (hasReverb) {
            osc.connect(wetGain);
            wetGain.connect(preDelay);
            preDelay.connect(convolver);
            convolver.connect(reverbGain);
            if (hasDelay) {
              reverbGain.connect(wetDelayGain);
              wetDelayGain.connect(delay);
            } else {
              reverbGain.connect(delay);
            }
          }
          
          delay.connect(analyser);
          analyser.connect(masterGainRef.current ?? ctx.destination);
          osc.start(0);
          
          oscillatorsRef.current.set(stem.id, { osc, gain: dryGain, panner, analyser, convolver, delay, reverbGain, eqLow, eqMid, eqHigh });
        }
      });
      
      setIsPlaying(true);
      setTimelineStems(prev => prev.map(s => 
        s.isSelected && !s.muted ? { ...s, isPlaying: true } : s
      ));
      
      // Sync currentTime with actual playback position
      setCurrentTime(resumePosition);
      
      playbackRef.current = setInterval(() => {
        if (ctx.currentTime && playbackStartTimeRef.current > 0) {
          const elapsed = ctx.currentTime - playbackStartTimeRef.current;
          const newTime = playbackOffsetRef.current + elapsed;
          
          if (newTime >= durationRef.current) {
            if (playbackRef.current) clearInterval(playbackRef.current);
            setIsPlaying(false);
            setTimelineStems(stems => stems.map(s => ({ ...s, isPlaying: false })));
            setCurrentTime(0);
            actualTimeRef.current = 0;
            playbackOffsetRef.current = 0;
          } else {
            setCurrentTime(newTime);
            actualTimeRef.current = newTime;
          }
        }
      }, 50);
    }
  }, [isPlaying, initAudioContext, timelineStems]);

  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, durationRef.current));
    seekPositionRef.current = clampedTime;
    
    if (isPlaying) {
      // Stop current playback
      const ctx = audioContextRef.current;
      if (ctx) {
        if (playbackRef.current) clearInterval(playbackRef.current);
        
        oscillatorsRef.current.forEach((nodes) => {
          try { nodes.osc.stop(); } catch {}
        });
        oscillatorsRef.current.clear();
        
        audioSourceRef.current.forEach((source) => {
          try { source.stop(); } catch {}
        });
        audioSourceRef.current.clear();
        audioNodesRef.current.clear();
        setTrackLevels({});
        setMasterLevelL(0);
        setMasterLevelR(0);
        
        // Restart from new position
        const anySolo = timelineStems.some(s => s.solo);
        playbackStartTimeRef.current = ctx.currentTime;
        playbackOffsetRef.current = clampedTime;
        
        timelineStems.forEach((stem) => {
          if (!stem.isSelected || stem.muted) return;
          if (anySolo && !stem.solo) return;
          
          if (stem.assetId) {
            const buffer = audioBufferRef.current.get(stem.assetId);
            if (buffer) {
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              
              const gainNode = ctx.createGain();
              const pannerNode = ctx.createStereoPanner();
              const analyserNode = ctx.createAnalyser();
              
              gainNode.gain.value = (stem.volume / 100) * 0.3;
              pannerNode.pan.value = stem.pan / 100;
              analyserNode.fftSize = 256;
              
              source.connect(gainNode);
              gainNode.connect(pannerNode);
              pannerNode.connect(analyserNode);
              analyserNode.connect(masterGainRef.current ?? ctx.destination);
              
              const offsetSeconds = Math.min(clampedTime, buffer.duration);
              source.start(0, offsetSeconds);
              
              audioSourceRef.current.set(stem.assetId, source);
              audioNodesRef.current.set(stem.assetId, { gain: gainNode, panner: pannerNode, analyser: analyserNode });
            }
          } else {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const panner = ctx.createStereoPanner();
            const analyser = ctx.createAnalyser();
            
            osc.type = stem.sourceType === 'drums' ? 'square' : stem.sourceType === 'bass' ? 'sawtooth' : 'sine';
            osc.frequency.value = stem.frequency || 440;
            gain.gain.value = (stem.volume / 100) * 0.3;
            panner.pan.value = stem.pan / 100;
            analyser.fftSize = 256;
            
            osc.connect(gain);
            gain.connect(panner);
            panner.connect(analyser);
            analyser.connect(masterGainRef.current ?? ctx.destination);
            osc.start(0);
            
            oscillatorsRef.current.set(stem.id, { osc, gain, panner, analyser });
          }
        });
        
        setCurrentTime(clampedTime);
        actualTimeRef.current = clampedTime;
        
        playbackRef.current = setInterval(() => {
          if (ctx.currentTime && playbackStartTimeRef.current > 0) {
            const elapsed = ctx.currentTime - playbackStartTimeRef.current;
            const newTime = playbackOffsetRef.current + elapsed;
            
          if (newTime >= durationRef.current) {
              if (playbackRef.current) clearInterval(playbackRef.current);
              setIsPlaying(false);
              setTimelineStems(stems => stems.map(s => ({ ...s, isPlaying: false })));
              setCurrentTime(0);
              actualTimeRef.current = 0;
              playbackOffsetRef.current = 0;
            } else {
              setCurrentTime(newTime);
              actualTimeRef.current = newTime;
            }
          }
        }, 50);
      }
    } else {
      // Just update position when not playing
      setCurrentTime(clampedTime);
      actualTimeRef.current = clampedTime;
    }
  }, [isPlaying, timelineStems]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * durationRef.current;
    seek(newTime);
  }, [seek]);

  useEffect(() => {
    console.log('[Timeline Render] totalDuration:', totalDuration);
  }, [totalDuration]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleTimelineClick(e);
  }, [handleTimelineClick]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTime = percentage * durationRef.current;
    
    setCurrentTime(newTime);
    actualTimeRef.current = newTime;
  }, [isDragging]);

  const handleTimelineMouseUp = useCallback(() => {
    if (isDragging && isPlaying) {
      seek(actualTimeRef.current);
    }
    setIsDragging(false);
  }, [isDragging, isPlaying, seek]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        if (isPlaying) {
          seek(actualTimeRef.current);
        }
        setIsDragging(false);
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, isPlaying, seek]);

  const toggleMute = (stemId: string) => {
    setTimelineStems(prev => {
      const timelineStems = prev.map(s => {
        if (s.id !== stemId) return s;
        const newMuted = !s.muted;
        
        // Update oscillator nodes
        const nodes = oscillatorsRef.current.get(stemId);
        if (nodes) {
          const anySolo = prev.some(st => st.solo);
          const shouldMute = newMuted || (anySolo && !s.solo);
          nodes.gain.gain.value = shouldMute ? 0 : (s.volume / 100) * 0.3;
        }
        
        // Update real audio nodes
        const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
        if (audioNodes) {
          const anySolo = prev.some(st => st.solo);
          const shouldMute = newMuted || (anySolo && !s.solo);
          audioNodes.gain.gain.value = shouldMute ? 0 : (s.volume / 100) * 0.3;
        }
        
        return { ...s, muted: newMuted };
      });
      
      // If any track has solo, we need to update all other tracks
      const anySolo = timelineStems.some(s => s.solo);
      if (anySolo) {
        return timelineStems.map(s => {
          if (s.id === stemId) return s;
          const shouldMute = !s.solo;
          const nodes = oscillatorsRef.current.get(s.id);
          if (nodes) {
            nodes.gain.gain.value = shouldMute || s.muted ? 0 : (s.volume / 100) * 0.3;
          }
          const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
          if (audioNodes) {
            audioNodes.gain.gain.value = shouldMute || s.muted ? 0 : (s.volume / 100) * 0.3;
          }
          return s;
        });
      }
      
      return timelineStems;
    });
  };

  const toggleSolo = (stemId: string) => {
    setTimelineStems(prev => {
      const currentStem = prev.find(s => s.id === stemId);
      const isSoloing = currentStem?.solo;
      
      // Exclusive solo: if turning on solo, only this track is soloed (others unselected)
      // if turning off solo, all tracks are un-soloed
      const newSoloState = !isSoloing;
      
      const updated = prev.map(s => {
        if (s.id === stemId) {
          // Toggle the clicked track's solo
          return { ...s, solo: newSoloState, isSelected: newSoloState };
        } else {
          // Other tracks: if solo is being turned on, deselect them
          // if solo is being turned off, keep their current state
          return newSoloState ? { ...s, isSelected: false, solo: false } : s;
        }
      });
      
      // Update audio nodes in real-time
      updated.forEach(s => {
        const nodes = oscillatorsRef.current.get(s.id);
        const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
        
        if (newSoloState) {
          // Solo is on - only the soloed track plays
          const shouldPlay = s.id === stemId && !s.muted;
          if (nodes) {
            nodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
          }
          if (audioNodes) {
            audioNodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
          }
        } else {
          // Solo is off - respect individual mute state
          const shouldPlay = !s.muted;
          if (nodes) {
            nodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
          }
          if (audioNodes) {
            audioNodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
          }
        }
      });
      
      return updated;
    });
  };

  const handleVolumeChange = (stemId: string, volume: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      
      // Update oscillator nodes
      const nodes = oscillatorsRef.current.get(stemId);
      const anySolo = prev.some(st => st.solo);
      const shouldMute = s.muted || (anySolo && !s.solo);
      if (nodes && !shouldMute) {
        nodes.gain.gain.value = (volume / 100) * 0.3;
      }
      
      // Update real audio nodes
      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes && !shouldMute) {
        audioNodes.gain.gain.value = (volume / 100) * 0.3;
      }
      
      return { ...s, volume };
    }));
  };

  const handlePanChange = (stemId: string, pan: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      
      // Update oscillator nodes
      const nodes = oscillatorsRef.current.get(stemId);
      if (nodes) {
        nodes.panner.pan.value = pan / 100;
      }
      
      // Update real audio nodes
      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes) {
        audioNodes.panner.pan.value = pan / 100;
      }
      
      return { ...s, pan };
    }));
  };

  const handleReverbChange = (stemId: string, reverb: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;

      const nodes = oscillatorsRef.current.get(stemId);
      if (nodes?.reverbGain) {
        nodes.reverbGain.gain.value = reverb / 100;
      }

      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes?.reverbGain) {
        audioNodes.reverbGain.gain.value = reverb / 100;
      }

      return { ...s, reverb };
    }));
  };

  const handleReverbWetDryChange = (stemId: string, reverbWetDry: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, reverbWetDry };
    }));
  };

  const handleReverbDecayChange = (stemId: string, reverbDecay: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, reverbDecay };
    }));
  };

  const handleReverbPreDelayChange = (stemId: string, reverbPreDelay: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, reverbPreDelay };
    }));
  };

  const handleDelayChange = (stemId: string, delay: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;

      const nodes = oscillatorsRef.current.get(stemId);
      if (nodes && nodes.delay) {
        nodes.delay.delayTime.value = delay / 100 * 0.5;
      }

      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes && audioNodes.delay) {
        audioNodes.delay.delayTime.value = delay / 100 * 0.5;
      }

      return { ...s, delay };
    }));
  };

  const handleDelayWetDryChange = (stemId: string, delayWetDry: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, delayWetDry };
    }));
  };

  const handleDelayFeedbackChange = (stemId: string, delayFeedback: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;

      const nodes = oscillatorsRef.current.get(stemId);
      if (nodes && nodes.delayFeedback) {
        nodes.delayFeedback.gain.value = delayFeedback / 100 * 0.7;
      }

      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes && audioNodes.delayFeedback) {
        audioNodes.delayFeedback.gain.value = delayFeedback / 100 * 0.7;
      }

      return { ...s, delayFeedback };
    }));
  };

  const handleEqChange = (stemId: string, band: 'eqLow' | 'eqMid' | 'eqHigh', value: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;

      const nodes = oscillatorsRef.current.get(stemId);
      if (nodes) {
        if (band === 'eqLow' && nodes.eqLow) nodes.eqLow.gain.value = value;
        if (band === 'eqMid' && nodes.eqMid) nodes.eqMid.gain.value = value;
        if (band === 'eqHigh' && nodes.eqHigh) nodes.eqHigh.gain.value = value;
      }

      const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
      if (audioNodes) {
        if (band === 'eqLow' && audioNodes.eqLow) audioNodes.eqLow.gain.value = value;
        if (band === 'eqMid' && audioNodes.eqMid) audioNodes.eqMid.gain.value = value;
        if (band === 'eqHigh' && audioNodes.eqHigh) audioNodes.eqHigh.gain.value = value;
      }

      return { ...s, [band]: value };
    }));
  };

  const handleCompressorToggle = (stemId: string, enabled: boolean) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, compressor: enabled };
    }));
  };

  const handleCompressorChange = (stemId: string, param: 'compressorThreshold' | 'compressorRatio' | 'compressorAttack' | 'compressorRelease' | 'compressorMakeup', value: number) => {
    setTimelineStems(prev => prev.map(s => {
      if (s.id !== stemId) return s;
      return { ...s, [param]: value };
    }));
  };

  const toggleEffectExpanded = (stemId: string, effect: 'reverb' | 'delay' | 'eq' | 'compressor') => {
    setExpandedEffects(prev => ({
      ...prev,
      [stemId]: prev[stemId] === effect ? null : effect
    }));
  };

  const toggleStemSelection = (stemId: string) => {
    setTimelineStems(prev => {
      const stem = prev.find(s => s.id === stemId);
      const newSelected = !stem?.isSelected;
      
      // Update gain for all tracks based on new selection
      prev.forEach(s => {
        const nodes = oscillatorsRef.current.get(s.id);
        const audioNodes = s.assetId ? audioNodesRef.current.get(s.assetId) : undefined;
        
        let shouldPlay = s.isSelected && !s.muted;
        if (s.id === stemId) {
          shouldPlay = newSelected && !s.muted;
        }
        
        if (nodes) {
          nodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
        }
        if (audioNodes) {
          audioNodes.gain.gain.value = shouldPlay ? (s.volume / 100) * 0.3 : 0;
        }
      });
      
      return prev.map(s => 
        s.id === stemId ? { ...s, isSelected: newSelected } : s
      );
    });
  };

  const handleResetMixer = () => {
    setTimelineStems((prev) => {
      const resetStems = prev.map((stem) => ({
        ...stem,
        isSelected: true,
        volume: 70,
        pan: 0,
        muted: false,
        solo: false,
      }));
      syncLiveAudioState(resetStems);
      return resetStems;
    });
  };

  const handleUnmuteAll = () => {
    setTimelineStems((prev) => {
      const updatedStems = prev.map((stem) => ({ ...stem, muted: false }));
      syncLiveAudioState(updatedStems);
      return updatedStems;
    });
  };

  const handleClearSolo = () => {
    setTimelineStems((prev) => {
      const updatedStems = prev.map((stem) => ({ ...stem, solo: false }));
      syncLiveAudioState(updatedStems);
      return updatedStems;
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const originalAssets = assets.filter((asset) => asset.type === 'original');
  const stemAssets = assets.filter((asset) => asset.type === 'stem');
  const audioAssets = assets.filter((asset) => asset.type === 'original' || asset.type === 'stem');
  const displayedAssets = useMemo(() => {
    const normalizedSearch = assetSearch.trim().toLowerCase();
    const filteredAssets = assets.filter((asset) => {
      const matchesType = assetFilter === 'all' || asset.type === assetFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        getAssetDisplayName(asset).toLowerCase().includes(normalizedSearch) ||
        getAssetKindLabel(asset).toLowerCase().includes(normalizedSearch) ||
        asset.s3_key.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });

    return [...filteredAssets].sort((assetA, assetB) => {
      const originalFirst = (asset: Asset) => asset.type === 'original' ? 0 : 1;
      const sortA = originalFirst(assetA);
      const sortB = originalFirst(assetB);
      if (sortA !== sortB) return sortA - sortB;

      switch (assetSort) {
        case 'oldest':
          return new Date(assetA.created_at).getTime() - new Date(assetB.created_at).getTime();
        case 'name_asc':
          return getAssetDisplayName(assetA).localeCompare(getAssetDisplayName(assetB));
        case 'name_desc':
          return getAssetDisplayName(assetB).localeCompare(getAssetDisplayName(assetA));
        case 'duration_desc':
          return (assetB.duration || 0) - (assetA.duration || 0);
        case 'type':
          return getAssetKindLabel(assetA).localeCompare(getAssetKindLabel(assetB));
        case 'newest':
        default:
          return new Date(assetB.created_at).getTime() - new Date(assetA.created_at).getTime();
      }
    });
  }, [assetFilter, assetSearch, assetSort, assets]);
  const displayedAssetIds = displayedAssets.map((asset) => asset.id);
  const selectedVisibleAssetCount = displayedAssetIds.filter((assetId) =>
    selectedMixerAssetIds.includes(assetId)
  ).length;

  useEffect(() => {
    if (stemMode === 'four_stem' && !FOUR_STEM_MODELS.has(demucsModel)) {
      setDemucsModel('htdemucs_ft');
    }
  }, [demucsModel, stemMode]);

  useEffect(() => {
    if (activeTab !== 'jobs') return;
    
    const loadJobs = async () => {
      setJobsLoading(true);
      try {
        const status = jobStatusFilter === 'all' ? undefined : jobStatusFilter;
        const jobs = await api.getProjectJobs(projectId, { status });
        setProjectJobs(jobs);
      } catch (error) {
        console.error('Failed to load project jobs:', error);
      } finally {
        setJobsLoading(false);
      }
    };
    
    void loadJobs();
  }, [projectId, activeTab, jobStatusFilter]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#edf4fb_55%,_#e9eef6_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(180deg,_#101827_0%,_#111827_50%,_#0f172a_100%)]">
      {/* Header */}
      <header className="z-20 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/85">
        <div className="px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/projects')}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
              >
                <span>←</span>
                <span className="text-sm">Projects</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-900"
                  title="Delete project"
                >
                  <Trash2 size={16} className="mr-2 inline" />
                  Delete
                </button>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'upload' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'}`}
              >
                Upload
              </button>
              <button 
                onClick={() => audioAssets.length > 0 && setActiveTab('separate')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'separate' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'} ${audioAssets.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={audioAssets.length === 0}
              >
                Separate
              </button>
              <button 
                onClick={() => audioAssets.length > 0 && setActiveTab('denoise')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'denoise' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'} ${audioAssets.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={audioAssets.length === 0}
              >
                Denoise
              </button>
              <button 
                onClick={() => audioAssets.length > 0 && setActiveTab('convert')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'convert' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'} ${audioAssets.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={audioAssets.length === 0}
              >
                Convert
              </button>
              <button 
                onClick={() => setActiveTab('jobs')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'jobs' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'}`}
              >
                Jobs
              </button>
              <button 
                onClick={() => isMixed && setActiveTab('mix')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'mix' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'} ${!isMixed ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!isMixed}
              >
                Mixer
              </button>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-5">
        <section className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
                  Project Overview
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white lg:text-3xl">
                  {projectName || 'Project'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Manage originals, generated stems, and mixes from one workspace. Preview files, rename assets for clarity,
                  and move only the tracks you want into the mixer.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 dark:border-sky-900/40 dark:bg-sky-950/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-2 text-sky-600 shadow-sm dark:bg-sky-900/60 dark:text-sky-200">
                    <Layers3 size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">Assets</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{assets.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4 dark:border-violet-900/40 dark:bg-violet-950/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-2 text-violet-600 shadow-sm dark:bg-violet-900/60 dark:text-violet-200">
                    <UploadCloud size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">Originals</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{originalAssets.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-2 text-emerald-600 shadow-sm dark:bg-emerald-900/60 dark:text-emerald-200">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">Generated Stems</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stemAssets.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[1.3fr_0.8fr] xl:items-start">
            <div className="rounded-[20px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Library</p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Project Assets</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                    {selectedMixerAssetIds.length} sel · {displayedAssets.length} vis
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() =>
                        setSelectedMixerAssetIds((currentIds) =>
                          Array.from(new Set([...currentIds, ...displayedAssetIds]))
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                      disabled={displayedAssets.length === 0 || selectedVisibleAssetCount === displayedAssets.length}
                      title="Select all"
                    >
                      <CheckSquare size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedMixerAssetIds([])}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                      disabled={selectedMixerAssetIds.length === 0}
                      title="Clear selection"
                    >
                      <Square size={16} />
                    </button>
                    <button
                      onClick={sendSelectedAssetsToMixer}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                      disabled={selectedMixerAssetIds.length === 0 || isBulkDeleting}
                      title="Open in mixer"
                    >
                      <Music4 size={16} />
                    </button>
                    <button
                      onClick={handleDeleteSelectedAssets}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700 disabled:opacity-50"
                      disabled={selectedMixerAssetIds.length === 0 || isBulkDeleting}
                      title="Delete selected"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-4 grid gap-2 xl:grid-cols-[1fr_150px_150px]">
                <input
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-sky-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <select
                  value={assetFilter}
                  onChange={(e) => setAssetFilter(e.target.value as AssetFilterValue)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="all">All types</option>
                  <option value="original">Originals</option>
                  <option value="stem">Stems</option>
                  <option value="mix">Mixes</option>
                  <option value="preset">Presets</option>
                </select>
                <select
                  value={assetSort}
                  onChange={(e) => setAssetSort(e.target.value as AssetSortValue)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name_asc">A-Z</option>
                  <option value="name_desc">Z-A</option>
                  <option value="duration_desc">Longest</option>
                  <option value="type">Type</option>
                </select>
              </div>
              {assets.length > 0 ? (
                <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                  {displayedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950/40 dark:hover:bg-gray-900"
                      onClick={() => {
                        if (asset.type === 'original') {
                          setSelectedAsset(asset);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMixerAssetIds.includes(asset.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedMixerAssetIds((currentIds) =>
                            currentIds.includes(asset.id)
                              ? currentIds.filter((id) => id !== asset.id)
                              : [...currentIds, asset.id]
                          );
                        }}
                        className="h-4 w-4 rounded accent-blue-600"
                      />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <span className="text-lg">{asset.type === 'stem' ? '🎛️' : asset.type === 'mix' ? '🎚️' : '🎵'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingAssetId === asset.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={assetNameDraft}
                              onChange={(e) => setAssetNameDraft(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-sm text-gray-900 outline-none dark:border-sky-800 dark:bg-sky-950/20 dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleRenameAsset(asset.id); }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelRenamingAsset(); }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {getAssetDisplayName(asset)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); startRenamingAsset(asset); }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] capitalize dark:bg-gray-800">
                            {getAssetKindLabel(asset)}
                          </span>
                          <span>{formatTime(asset.duration || 0)}</span>
                          {detectedBpm[asset.id] && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {detectedBpm[asset.id]} BPM
                            </span>
                          )}
                          {detectedKey[asset.id] && (
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {detectedKey[asset.id]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePlayAsset(asset); }}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                            playingAssetId === asset.id
                              ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                          }`}
                          title={playingAssetId === asset.id ? 'Stop' : 'Play'}
                        >
                          {playingAssetId === asset.id ? <Square size={16} /> : <Play size={16} />}
                        </button>
                        {!detectedBpm[asset.id] && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleDetectBpm(asset.id); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            title="Detect BPM"
                          >
                            <Timer size={16} />
                          </button>
                        )}
                        {!detectedKey[asset.id] && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleDetectKey(asset.id); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            title="Detect Key"
                          >
                            <Key size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openAssetsInMixer([asset]); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                          title="Open in Mixer"
                        >
                          <Music4 size={16} />
                        </button>
                        {(asset.type === 'original' || asset.type === 'stem') && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleDenoiseAsset(asset); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
                              title="Reduce Noise"
                            >
                              <Waves size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSeparateAsset(asset); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white transition hover:bg-purple-700"
                              title="Separate"
                            >
                              <Wand2 size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleConvertAsset(asset); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600 transition hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50"
                              title="Convert Format"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleDeleteAsset(asset.id); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No assets yet. Upload audio files or create new assets.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[20px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Ingest</p>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upload Audio</h2>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-200">
                    <UploadCloud size={18} />
                  </div>
                </div>
                <div 
                  className="rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/70 p-4 text-center transition hover:border-sky-400 dark:border-sky-900/60 dark:bg-sky-950/20 dark:hover:border-sky-500"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (fileInputRef.current) {
                      const dataTransfer = new DataTransfer();
                      Array.from(e.dataTransfer.files).forEach(file => dataTransfer.items.add(file));
                      fileInputRef.current.files = dataTransfer.files;
                      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }}
                >
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Drag & drop audio files</p>
                  <p className="mb-3 text-xs text-gray-500">WAV, MP3, FLAC</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-sky-700"
                    disabled={isUploading}
                  >
                    {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Choose Files'}
                  </button>
                </div>
              </div>

              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Create</p>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Asset Composer</h3>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2 text-emerald-600 dark:bg-gray-900/60 dark:text-emerald-300">
                    <Wand2 size={18} />
                  </div>
                </div>
                <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                  Create musical assets with scale-aware notes, presets, and preview.
                </p>
                <button
                  onClick={() => router.push(`/projects/${projectId}/create-asset`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  <Music4 size={16} />
                  Create New Asset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Separate Tab */}
        {activeTab === 'separate' && (
          <div className="mx-auto max-w-4xl">
            {isProcessing ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-8 text-center">
                <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <svg className="w-16 h-16 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">Separating Stems...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{processingStatus}</p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">This takes time!</span> Audio separation is computationally intensive. Please be patient and do not close this page.
                  </p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                      style={{ width: `${Math.min(processingProgress, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(Math.min(processingProgress, 100))}%</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold dark:text-white">Configure Separation</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Choose an audio file (original or stem), Demucs model, and output layout before starting a separation job.
                  </p>
                </div>
                {audioAssets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No audio files ready</p>
                    <button onClick={() => setActiveTab('upload')} className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600">
                      Upload Audio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audioAssets.map((asset) => (
                      <div 
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={`p-4 border dark:border-gray-600 rounded-lg cursor-pointer dark:bg-gray-700 ${selectedAsset?.id === asset.id ? 'border-blue-500 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🎵</span>
                            <div>
                              <p className="font-medium dark:text-white">{getAssetDisplayName(asset)}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {asset.duration ? formatTime(asset.duration) : 'Unknown length'} · Added {formatAssetDate(asset.created_at)}
                              </p>
                            </div>
                          </div>
                          {selectedAsset?.id === asset.id && (
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-full">Selected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedAsset && (
                  <div className="mt-6 pt-6 border-t dark:border-gray-700">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                          <Waves size={16} className="text-green-500" />
                          Separator
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setSeparator('demucs')}
                            className={`rounded-2xl border p-4 text-left transition ${
                              separator === 'demucs'
                                ? 'border-green-500 bg-green-50 shadow-sm dark:border-green-400 dark:bg-green-950/30'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-900/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-gray-900 dark:text-white">Demucs</span>
                              {separator === 'demucs' && (
                                <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">High-quality neural source separation</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeparator('spleeter')}
                            className={`rounded-2xl border p-4 text-left transition ${
                              separator === 'spleeter'
                                ? 'border-green-500 bg-green-50 shadow-sm dark:border-green-400 dark:bg-green-950/30'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-900/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-gray-900 dark:text-white">Spleeter</span>
                              {separator === 'spleeter' && (
                                <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Fast and reliable separation</p>
                          </button>
                        </div>
                      </div>

                      {separator === 'demucs' && (
                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                              <Sparkles size={16} className="text-purple-500" />
                              Demucs model
                            </div>
                            <div className="grid gap-3">
                              {DEMUCS_MODEL_OPTIONS.map((option) => {
                                const isSelected = demucsModel === option.value;
                                const isDisabled = stemMode === 'four_stem' && !FOUR_STEM_MODELS.has(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setDemucsModel(option.value);
                                      }
                                    }}
                                    disabled={isDisabled}
                                    className={`rounded-2xl border p-4 text-left transition ${
                                      isSelected
                                        ? 'border-purple-500 bg-purple-50 shadow-sm dark:border-purple-400 dark:bg-purple-950/30'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-900/60'
                                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-semibold text-gray-900 dark:text-white">{option.label}</span>
                                      {isSelected && (
                                        <span className="rounded-full bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white">
                                          Selected
                                        </span>
                                      )}
                                      {isDisabled && (
                                        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                          2-stem only
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                              <SplitSquareVertical size={16} className="text-blue-500" />
                              Output mode
                            </div>
                            <div className="grid gap-3">
                              {STEM_MODE_OPTIONS.map((option) => {
                                const isSelected = stemMode === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setStemMode(option.value)}
                                    className={`rounded-2xl border p-4 text-left transition ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/30'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-900/60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-semibold text-gray-900 dark:text-white">{option.label}</span>
                                      {isSelected && (
                                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                                          Selected
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Ready to process: {getAssetDisplayName(selectedAsset)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {separator === 'demucs' 
                          ? `Model: ${DEMUCS_MODEL_OPTIONS.find((option) => option.value === demucsModel)?.label}`
                          : 'Using Spleeter'
                        } · Output: {STEM_MODE_OPTIONS.find((option) => option.value === stemMode)?.label}
                      </p>
                      {separator === 'demucs' && stemMode === 'four_stem' && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          For reliable four-part separation, the UI now limits this mode to HT Demucs variants.
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={handleSeparateStems}
                      className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700"
                    >
                      {stemMode === 'four_stem'
                        ? '🎛️ Separate into 4 Stems'
                        : '🎤 Extract Vocals + Accompaniment'}
                    </button>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {stemMode === 'four_stem'
                        ? 'Create vocals, drums, bass, and other stems with the selected Demucs model.'
                        : 'Generate a focused two-stem output for quick vocal isolation workflows.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Denoise Tab */}
        {activeTab === 'denoise' && (
          <div className="mx-auto max-w-4xl">
            {isProcessing ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-8 text-center">
                <div className="w-24 h-24 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <svg className="w-16 h-16 animate-spin text-cyan-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">Reducing Noise...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{processingStatus}</p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">Please wait!</span> Noise reduction is processing your audio.
                  </p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                      style={{ width: `${Math.min(processingProgress, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(Math.min(processingProgress, 100))}%</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold dark:text-white">Noise Reduction</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Select an audio file to reduce background noise. Uses spectral gating for stationary noise reduction.
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Audio File</h3>
                  <div className="space-y-2">
                    {audioAssets.map((asset) => (
                      <div 
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={`p-4 border dark:border-gray-600 rounded-lg cursor-pointer dark:bg-gray-700 ${selectedAsset?.id === asset.id ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🎵</span>
                            <div>
                              <p className="font-medium dark:text-white">{getAssetDisplayName(asset)}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {asset.duration ? formatTime(asset.duration) : 'Unknown length'} · Added {formatAssetDate(asset.created_at)}
                              </p>
                            </div>
                          </div>
                          {selectedAsset?.id === asset.id && (
                            <CheckSquare size={20} className="text-cyan-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Output Options */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Output Options</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="outputMode"
                        value="new"
                        checked={denoiseOutputMode === 'new'}
                        onChange={() => setDenoiseOutputMode('new')}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Create new asset</span>
                        <p className="text-xs text-gray-500">Preserves original, creates denoised version with &quot;(Denoised)&quot; suffix</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="outputMode"
                        value="overwrite"
                        checked={denoiseOutputMode === 'overwrite'}
                        onChange={() => setDenoiseOutputMode('overwrite')}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overwrite original</span>
                        <p className="text-xs text-gray-500">Replaces the original audio file with the denoised version</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Parameters */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Parameters</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Noise Type</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{denoiseStationary ? 'Stationary' : 'Non-stationary'}</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDenoiseStationary(true)}
                          className={`flex-1 py-2 px-3 text-xs rounded-lg border transition ${
                            denoiseStationary 
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300'
                              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          Stationary
                        </button>
                        <button
                          onClick={() => setDenoiseStationary(false)}
                          className={`flex-1 py-2 px-3 text-xs rounded-lg border transition ${
                            !denoiseStationary 
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300'
                              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          Non-stationary
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {denoiseStationary 
                          ? 'Best for consistent background noise (AC hum, fan noise)'
                          : 'Better for varying noise levels (traffic, moving sources)'}
                      </p>
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Noise Threshold</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{denoiseNoiseThreshold.toFixed(1)} std dev</span>
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={denoiseNoiseThreshold}
                        onChange={(e) => setDenoiseNoiseThreshold(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>More aggressive</span>
                        <span>More subtle</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDenoiseSelected}
                  disabled={!selectedAsset}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🌊 Reduce Noise
                </button>
                {!selectedAsset && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Select an audio file above to start noise reduction
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Convert Tab */}
        {activeTab === 'convert' && (
          <div className="mx-auto max-w-4xl">
            {isProcessing ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-8 text-center">
                <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <RotateCcw className="w-16 h-16 animate-spin text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">Converting Audio...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{processingStatus}</p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">Please wait!</span> Converting your audio to {convertFormat.toUpperCase()}.
                  </p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
                      style={{ width: `${Math.min(processingProgress, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(Math.min(processingProgress, 100))}%</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold dark:text-white">Convert Audio Format</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Convert your audio to a different format. The original file is preserved.
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Audio File</h3>
                  <div className="space-y-2">
                    {audioAssets.map((asset) => (
                      <div 
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={`p-4 border dark:border-gray-600 rounded-lg cursor-pointer dark:bg-gray-700 ${selectedAsset?.id === asset.id ? 'border-orange-500 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🎵</span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{getAssetDisplayName(asset)}</p>
                              <p className="text-sm text-gray-500">
                                {asset.duration ? formatTime(asset.duration) : 'Unknown duration'}
                              </p>
                            </div>
                          </div>
                          {selectedAsset?.id === asset.id && (
                            <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">Selected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Output Format</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {['wav', 'mp3', 'flac', 'aac', 'ogg', 'm4a'].map((format) => (
                      <button
                        key={format}
                        onClick={() => setConvertFormat(format)}
                        className={`py-3 px-3 text-sm rounded-lg border transition ${
                          convertFormat === format
                            ? 'border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {(convertFormat === 'mp3' || convertFormat === 'aac' || convertFormat === 'ogg') && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Bitrate</h3>
                    <div className="space-y-2">
                      {[
                        { value: 128000, label: '128 kbps (Small)' },
                        { value: 192000, label: '192 kbps (Standard)' },
                        { value: 256000, label: '256 kbps (High)' },
                        { value: 320000, label: '320 kbps (Best)' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="bitrate"
                            value={option.value}
                            checked={convertBitrate === option.value}
                            onChange={() => setConvertBitrate(option.value)}
                            className="w-4 h-4 text-orange-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sample Rate</h3>
                  <div className="flex gap-2">
                    {[44100, 48000].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setConvertSampleRate(rate)}
                        className={`flex-1 py-2 px-3 text-sm rounded-lg border transition ${
                          convertSampleRate === rate
                            ? 'border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {rate / 1000} kHz
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Channels</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConvertChannels(1)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg border transition ${
                        convertChannels === 1
                          ? 'border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      Mono
                    </button>
                    <button
                      onClick={() => setConvertChannels(2)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg border transition ${
                        convertChannels === 2
                          ? 'border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      Stereo
                    </button>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!selectedAsset) return;
                    try {
                      const result = await api.convertAsset(selectedAsset.id, {
                        target_format: convertFormat,
                        bitrate: convertBitrate,
                        sample_rate: convertSampleRate,
                        channels: convertChannels,
                      });
                      setIsProcessing(true);
                      setActiveJobId(result.job_id);
                    } catch (error) {
                      console.error('Failed to start conversion:', error);
                    }
                  }}
                  disabled={!selectedAsset}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg font-semibold text-lg hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 Convert to {convertFormat.toUpperCase()}
                </button>
                {!selectedAsset && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Select an audio file above to start conversion
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mixer Tab */}
        {activeTab === 'mix' && timelineStems.length > 0 && (
          <div className="max-w-full">
            {/* Top Meters Bar */}
            <div className="mb-2 rounded-xl border border-white/70 bg-white/85 p-3 shadow backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
              <div className="flex flex-wrap items-center gap-4">
                {/* Play button + time */}
                <div className="flex items-center gap-2" title="Click to play/pause. Time shows current position / total duration">
                  <button
                    onClick={togglePlay}
                    disabled={isLoadingAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow ${
                      isLoadingAudio 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title={isPlaying ? 'Pause playback' : 'Start playback'}
                  >
                    {isLoadingAudio ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : isPlaying ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    )}
                  </button>
                  <span className="text-lg font-mono font-bold dark:text-white">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-lg font-mono text-gray-400">/ {formatTime(totalDuration)}</span>
                </div>

                {/* Master Volume */}
                <div className="flex items-center gap-2" title="Master Volume: Controls overall loudness of all tracks">
                  <Gauge size={16} className="text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400" title="Master Volume: Controls overall output loudness">M</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                    className="w-24 accent-sky-600"
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-10">{masterVolume}%</span>
                </div>

                {/* Master Meters - Stereo Peak + RMS */}
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1" title="Peak: The loudest instantaneous moment. Watch to avoid distortion!">L/R Peak</div>
                    <StereoMeter levelL={masterLevelL} levelR={masterLevelR} height="md" showLabel />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1" title="RMS: The average sustained loudness—how it actually sounds to your ears">RMS</div>
                    <div className="w-16 h-12 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden relative" title="RMS: Average loudness—how it actually sounds">
                      <div
                        className="absolute inset-y-0 left-0 bg-sky-500/80 rounded transition-all"
                        style={{ width: `${masterRms < 0.02 ? 0 : Math.max(4, masterRms * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{Math.round(masterRms * 100)}%</div>
                  </div>
                </div>

                {/* Phase Correlation */}
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1" title="Phase: Stereo correlation. +100 = perfect mono. Around +50 is ideal. Negative can cause cancellation!">Phase</div>
                    <div className="w-20 h-5 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden relative" title="Phase: Stereo correlation. +100 = mono, -100 = out of phase (cancellaton risk)">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-0.5 bg-gray-400" />
                      </div>
                      <div
                        className={`absolute inset-y-0 rounded transition-all ${
                          masterPhase < 0 ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{ 
                          left: '50%',
                          width: `${Math.abs(masterPhase) * 50}%`,
                          transform: masterPhase < 0 ? 'translateX(-100%)' : 'translateX(0)'
                        }}
                      />
                    </div>
                    <div className={`text-[10px] mt-1 font-medium ${masterPhase < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {masterPhase >= 0 ? '+' : ''}{(masterPhase * 100).toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* LUFS Meter */}
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1" title="LUFS: Loudness units—how streaming services measure. -14 LUFS is Spotify target.">LUFS</div>
                    <div className="w-20 h-5 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden relative" title="LUFS: -14 is Spotify target. -14 to -16 is the sweet spot.">
                      <div
                        className="absolute inset-y-0 left-0 rounded transition-all bg-sky-500"
                        style={{ width: `${loudnessShortTerm > -70 ? Math.max(4, ((loudnessShortTerm + 70) / 70) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {loudnessShortTerm > -70 ? loudnessShortTerm.toFixed(1) : '-∞'}
                    </div>
                  </div>
                  {/* LUFS History */}
                  <div className="w-20 h-7 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full flex items-end gap-[1px] px-[2px] py-[2px]">
                      {loudnessHistory.length > 0 ? (
                        loudnessHistory.map((val, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t transition-all"
                            style={{
                              height: `${Math.max(20, ((val + 70) / 70) * 100)}%`,
                              backgroundColor: val > -14 ? '#f59e0b' : '#22c55e',
                            }}
                          />
                        ))
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Spectrum Analyzer Toggle */}
                <button
                  onClick={() => setShowSpectrum(!showSpectrum)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                    showSpectrum 
                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  <AudioWaveform size={12} />
                  Spectrum
                </button>

                <div className="flex-1"></div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleResetMixer}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                  <button
                    onClick={handleUnmuteAll}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Volume2 size={10} />
                    Unmute
                  </button>
                  <button
                    onClick={handleClearSolo}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Headphones size={10} />
                    Clear Solo
                  </button>
                  <button
                    onClick={() => setShowSnapshots(!showSnapshots)}
                    className="inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/30 dark:bg-purple-900/20 dark:text-purple-300"
                  >
                    <History size={10} />
                    Snapshots ({snapshots.length})
                  </button>
                </div>
              </div>

              {/* Spectrum Analyzer */}
              {showSpectrum && (
                <div className="mt-3 pt-3 border-t dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <AudioWaveform size={14} className="text-sky-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Spectrum</span>
                    </div>
                    <div className="flex-1 h-14 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-end px-2 gap-[2px]">
                      {spectrumData.length > 0 ? (
                        spectrumData.map((value, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t transition-all"
                            style={{
                              height: `${Math.max(4, (value / 255) * 100)}%`,
                              backgroundColor: `hsl(${180 - (value / 255) * 60}, 70%, 50%)`,
                            }}
                          />
                        ))
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                    <button
                      onClick={() => setShowSpectrum(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline with Stems */}
            <div className="rounded-xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
              {/* Time ruler */}
              <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="w-10 flex-shrink-0 border-r dark:border-gray-700"></div>
                <div className="w-56 flex-shrink-0 p-1.5 border-r dark:border-gray-700 flex items-center gap-1">
                  <button
                    onClick={handleAddMarker}
                    className={`p-1 rounded ${isAddingMarker ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'text-gray-400 hover:text-amber-500'}`}
                    title="Add marker at current time"
                  >
                    <Flag size={14} />
                  </button>
                  {isAddingMarker && (
                    <>
                      <input
                        type="text"
                        value={markerDraft}
                        onChange={(e) => setMarkerDraft(e.target.value)}
                        placeholder="Label..."
                        className="w-16 text-[10px] px-1 py-0.5 border rounded dark:bg-gray-800 dark:border-gray-600"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateMarker();
                          if (e.key === 'Escape') setIsAddingMarker(false);
                        }}
                      />
                      <button
                        onClick={handleCreateMarker}
                        className="p-0.5 text-amber-600 hover:text-amber-700"
                      >
                        <Save size={12} />
                      </button>
                      <button
                        onClick={() => { setIsAddingMarker(false); setMarkerDraft(''); }}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                  <span className="text-[9px] text-gray-400">{markers.length}</span>
                </div>
                <div className="flex-1 p-1 relative">
                  {/* Time markers */}
                  <div className="absolute inset-x-0 text-[10px] text-gray-500 dark:text-gray-400 font-mono pointer-events-none">
                    {Array.from({ length: Math.floor(totalDuration / 10) + 1 }, (_, i) => {
                      const markerTime = i * 10;
                      const position = totalDuration > 0 ? (markerTime / totalDuration) * 100 : 0;
                      return (
                        <span 
                          key={i} 
                          className="absolute text-center"
                          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                        >
                          {formatTime(markerTime)}
                        </span>
                      );
                    })}
                  </div>
                  {/* Timeline markers */}
                  <div className="absolute inset-0 pointer-events-none">
                    {markers.map((marker) => {
                      const position = totalDuration > 0 ? (marker.time / totalDuration) * 100 : 0;
                      return (
                        <div
                          key={marker.id}
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 group"
                          style={{ left: `${position}%` }}
                        >
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-[8px] px-1 py-0.5 rounded whitespace-nowrap text-black">
                            {marker.label || formatTime(marker.time)}
                          </div>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block bg-white dark:bg-gray-800 border rounded shadow-lg p-1 z-10">
                            <div className="text-[10px] font-medium">{marker.label || 'Marker'}</div>
                            <div className="text-[9px] text-gray-500">{formatTime(marker.time)}</div>
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => startEditingMarker(marker)}
                                className="p-0.5 text-blue-500 hover:text-blue-600"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={() => handleDeleteMarker(marker.id)}
                                className="p-0.5 text-red-500 hover:text-red-600"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Edit marker overlay */}
                  {editingMarkerId && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="bg-white dark:bg-gray-800 border rounded shadow-lg p-2">
                        <input
                          type="text"
                          value={markerDraft}
                          onChange={(e) => setMarkerDraft(e.target.value)}
                          placeholder="Marker label..."
                          className="w-32 text-xs px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateMarker(editingMarkerId);
                            if (e.key === 'Escape') cancelEditingMarker();
                          }}
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={cancelEditingMarker}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateMarker(editingMarkerId)}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

                  {/* Stem rows */}
                  {timelineStems.map((stem) => (
                    <div key={stem.id} className="flex border-b dark:border-gray-700 last:border-b-0 min-h-[56px]">
                      {/* Selection checkbox */}
                      <div className="w-10 flex-shrink-0 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={stem.isSelected}
                          onChange={() => toggleStemSelection(stem.id)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Stem controls - name, mute, solo, volume, pan, level */}
                      <div className="w-56 flex-shrink-0 p-1.5 bg-white dark:bg-gray-800 border-r dark:border-gray-700">
                        {/* Icon, name, mute, solo on same row */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{stem.icon}</span>
                          <span className={`font-medium text-xs ${stem.color}`}>{stem.name}</span>
                          <button
                            onClick={() => toggleMute(stem.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition ${
                              stem.muted ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`}
                            title={stem.muted ? 'Unmute' : 'Mute'}
                          >
                            {stem.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                          </button>
                          <button
                            onClick={() => toggleSolo(stem.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition ${
                              stem.solo ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`}
                            title={stem.solo ? 'Unsolo' : 'Solo'}
                          >
                            <Headphones size={10} />
                          </button>
                          <span className="text-[9px] text-gray-400 ml-auto">{stem.volume}%</span>
                        </div>
                        {/* Knobs row */}
                        <div className="flex justify-around py-2">
                          <Knob
                            label="Vol"
                            value={stem.volume}
                            onChange={(v) => handleVolumeChange(stem.id, v)}
                            color="blue"
                            size="sm"
                          />
                          <Knob
                            label="Pan"
                            value={stem.pan}
                            min={-100}
                            max={100}
                            onChange={(v) => handlePanChange(stem.id, v)}
                            color="blue"
                            size="sm"
                          />
                          <div className="relative">
                            <Knob
                              label="Verb"
                              value={stem.reverb}
                              onChange={(v) => handleReverbChange(stem.id, v)}
                              color="purple"
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={() => toggleEffectExpanded(stem.id, 'reverb')}
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full text-[8px] flex items-center justify-center ${
                                expandedEffects[stem.id] === 'reverb' 
                                  ? 'bg-purple-500 text-white' 
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                              }`}
                            >
                              +
                            </button>
                          </div>
                          <div className="relative">
                            <Knob
                              label="Dly"
                              value={stem.delay}
                              onChange={(v) => handleDelayChange(stem.id, v)}
                              color="amber"
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={() => toggleEffectExpanded(stem.id, 'delay')}
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full text-[8px] flex items-center justify-center ${
                                expandedEffects[stem.id] === 'delay' 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {/* Expanded controls */}
                        {expandedEffects[stem.id] && (
                          <div className="flex justify-around py-2 border-t border-gray-200 dark:border-gray-700 mt-1">
                            {expandedEffects[stem.id] === 'reverb' && (
                              <>
                                <Knob
                                  label="Wet"
                                  value={stem.reverbWetDry}
                                  onChange={(v) => handleReverbWetDryChange(stem.id, v)}
                                  color="purple"
                                  size="sm"
                                />
                                <Knob
                                  label="Dcy"
                                  value={stem.reverbDecay}
                                  onChange={(v) => handleReverbDecayChange(stem.id, v)}
                                  color="purple"
                                  size="sm"
                                />
                                <Knob
                                  label="Pre"
                                  value={stem.reverbPreDelay}
                                  onChange={(v) => handleReverbPreDelayChange(stem.id, v)}
                                  color="purple"
                                  size="sm"
                                />
                              </>
                            )}
                            {expandedEffects[stem.id] === 'delay' && (
                              <>
                                <Knob
                                  label="Wet"
                                  value={stem.delayWetDry}
                                  onChange={(v) => handleDelayWetDryChange(stem.id, v)}
                                  color="amber"
                                  size="sm"
                                />
                                <Knob
                                  label="Fdb"
                                  value={stem.delayFeedback}
                                  onChange={(v) => handleDelayFeedbackChange(stem.id, v)}
                                  color="amber"
                                  size="sm"
                                />
                              </>
                            )}
                          </div>
                        )}
                        {/* EQ - collapsible */}
                        <button
                          type="button"
                          onClick={() => toggleEffectExpanded(stem.id, 'eq')}
                          className={`flex items-center gap-1 w-full text-left ${expandedEffects[stem.id] === 'eq' ? 'text-cyan-600 dark:text-cyan-400' : ''}`}
                        >
                          <span className="text-[9px] text-gray-400" title="EQ: 3-band equalizer">EQ</span>
                          <span className={`text-[8px] ${expandedEffects[stem.id] === 'eq' ? 'rotate-90' : ''} transition-transform`}>▶</span>
                        </button>
                        {expandedEffects[stem.id] === 'eq' && (
                          <div className="flex justify-around py-2 pl-2 border-l-2 border-cyan-200 dark:border-cyan-800">
                            <Knob
                              label="Low"
                              value={stem.eqLow}
                              min={-12}
                              max={12}
                              onChange={(v) => handleEqChange(stem.id, 'eqLow', v)}
                              color="emerald"
                              size="sm"
                            />
                            <Knob
                              label="Mid"
                              value={stem.eqMid}
                              min={-12}
                              max={12}
                              onChange={(v) => handleEqChange(stem.id, 'eqMid', v)}
                              color="emerald"
                              size="sm"
                            />
                            <Knob
                              label="High"
                              value={stem.eqHigh}
                              min={-12}
                              max={12}
                              onChange={(v) => handleEqChange(stem.id, 'eqHigh', v)}
                              color="emerald"
                              size="sm"
                            />
                          </div>
                        )}
                        {/* Compressor - collapsible */}
                        <button
                          type="button"
                          onClick={() => toggleEffectExpanded(stem.id, 'compressor')}
                          className={`flex items-center gap-1 w-full text-left ${expandedEffects[stem.id] === 'compressor' ? 'text-rose-600 dark:text-rose-400' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={stem.compressor}
                            onChange={(e) => handleCompressorToggle(stem.id, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3 h-3"
                          />
                          <span className="text-[9px] text-gray-400" title="Compressor: Dynamic range control">Comp</span>
                          <span className={`text-[8px] ${expandedEffects[stem.id] === 'compressor' ? 'rotate-90' : ''} transition-transform`}>▶</span>
                        </button>
                        {expandedEffects[stem.id] === 'compressor' && (
                          <div className="flex justify-around py-2 pl-2 border-l-2 border-rose-200 dark:border-rose-800">
                            <div className="text-[8px] text-center">
                              <div className="text-gray-400">Thresh</div>
                              <input
                                type="range"
                                min={-60}
                                max={0}
                                value={stem.compressorThreshold}
                                onChange={(e) => handleCompressorChange(stem.id, 'compressorThreshold', parseInt(e.target.value))}
                                className="w-12 h-1 accent-rose-500"
                              />
                              <div className="text-gray-500">{stem.compressorThreshold}</div>
                            </div>
                            <div className="text-[8px] text-center">
                              <div className="text-gray-400">Ratio</div>
                              <input
                                type="range"
                                min={1}
                                max={20}
                                value={stem.compressorRatio}
                                onChange={(e) => handleCompressorChange(stem.id, 'compressorRatio', parseInt(e.target.value))}
                                className="w-12 h-1 accent-rose-500"
                              />
                              <div className="text-gray-500">{stem.compressorRatio}:1</div>
                            </div>
                            <div className="text-[8px] text-center">
                              <div className="text-gray-400">Makeup</div>
                              <input
                                type="range"
                                min={0}
                                max={24}
                                value={stem.compressorMakeup}
                                onChange={(e) => handleCompressorChange(stem.id, 'compressorMakeup', parseInt(e.target.value))}
                                className="w-12 h-1 accent-rose-500"
                              />
                              <div className="text-gray-500">+{stem.compressorMakeup}dB</div>
                            </div>
                          </div>
                        )}
                        {/* Stereo Level meter - always show */}
                        <div className="flex items-center justify-center mt-1">
                          <StereoMeter
                            levelL={trackLevels[stem.id]?.l ?? 0.01}
                            levelR={trackLevels[stem.id]?.r ?? 0.01}
                            height="sm"
                          />
                        </div>
                      </div>
                    
                      {/* Waveform area - only waveform in timeline */}
                      <div 
                        className="flex-1 relative min-h-[60px] cursor-pointer"
                        ref={timelineRef}
                      >
                        <Waveform 
                          assetId={stem.assetId}
                          color={stem.color.includes('purple') ? '#a855f7' : stem.color.includes('red') ? '#ef4444' : stem.color.includes('blue') ? '#3b82f6' : '#22c55e'}
                          currentTime={currentTime}
                          isPlaying={isPlaying && stem.isSelected && !stem.muted}
                          stemType={stem.sourceType}
                          audioDuration={durationRef.current}
                        />
                        {/* Playhead */}
                        <div 
                          className={`absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                          style={{ left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                          onMouseDown={handleTimelineMouseDown}
                          onMouseMove={handleTimelineMouseMove}
                          onMouseUp={handleTimelineMouseUp}
                        />
                      </div>
                    </div>
                  ))}
            </div>
          </div>
          )}

          {/* Mixer Guide - Collapsible */}
          {activeTab === 'mix' && timelineStems.length > 0 && (
            <div className="mt-2 rounded-xl border border-white/70 bg-white/85 shadow dark:border-gray-800 dark:bg-gray-900/80">
              <button
                onClick={() => {
                  setShowMixerGuide(!showMixerGuide);
                  localStorage.setItem('audioforge_showMixerGuide', String(!showMixerGuide));
                }}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mixer Guide
                </span>
                <ChevronDown 
                  size={16} 
                  className={`text-gray-400 transition-transform ${showMixerGuide ? 'rotate-180' : ''}`} 
                />
              </button>
              
              {showMixerGuide && (
                <div className="px-4 pb-4 text-xs text-gray-600 dark:text-gray-400 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Understanding the Meters</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Peak</span>
                      <p>The loudest instantaneous moment—the spike that might clip. Watch this to avoid distortion!</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <span className="font-semibold text-sky-600 dark:text-sky-400">RMS</span>
                      <p>The average sustained loudness—how it actually sounds to your ears.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Phase</span>
                      <p>Stereo correlation. +100 = perfect mono (same in both speakers). Around +50 is ideal. Negative values can cause cancellation!</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">LUFS</span>
                      <p>Loudness units—how streaming services measure loudness. -14 LUFS is the Spotify target. -14 to -16 is the sweet spot.</p>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">Meter Colors</p>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-emerald-500"></span> Green = Good level
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-amber-500"></span> Amber = Getting loud
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-500"></span> Red = Too loud! Turn down!
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="max-w-full">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Project Jobs</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Track all audio processing jobs for this project
                  </p>
                </div>
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value as 'all' | Job['status'])}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-sky-500"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {jobsLoading ? (
                <div className="mt-8 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading jobs...
                </div>
              ) : projectJobs.length === 0 ? (
                <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No jobs found for this project.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {projectJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.type}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              job.status === 'failed'
                                ? 'bg-rose-500'
                                : job.status === 'succeeded'
                                  ? 'bg-emerald-500'
                                  : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.min(Math.max(job.progress, 4), 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Created: {formatBrowserDateTime(job.created_at)}</span>
                        {job.ended_at && <span>Finished: {formatBrowserDateTime(job.ended_at)}</span>}
                      </div>
                      {job.error && (
                        <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
                          {job.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-white/70 bg-white/95 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/95">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Project?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This will permanently delete &quot;{projectName || 'this project'}&quot; and all its assets and jobs. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeletingProject}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingProject ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
