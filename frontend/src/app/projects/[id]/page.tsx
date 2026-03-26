'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api, Asset, DemucsModel, Stem, StemMode, TimelineMarker, ProjectSnapshot } from '@/lib/api';
import { formatBrowserDateTime } from '@/lib/datetime';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowUpDown,
  AudioWaveform,
  CheckSquare,
  Clock3,
  Download,
  Flag,
  Gauge,
  Headphones,
  History,
  Key,
  Layers3,
  ListFilter,
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
  const [activeTab, setActiveTab] = useState<'upload' | 'separate' | 'mix'>('upload');
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
  const [isDeletingAssetId, setIsDeletingAssetId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetNameDraft, setAssetNameDraft] = useState('');
  const [detectedBpm, setDetectedBpm] = useState<Record<string, number | null>>({});
  const [detectingBpmId, setDetectingBpmId] = useState<string | null>(null);
  const [detectedKey, setDetectedKey] = useState<Record<string, string | null>>({});
  const [detectingKeyId, setDetectingKeyId] = useState<string | null>(null);
  const [isSavingAssetName, setIsSavingAssetName] = useState(false);
  const [assetFilter, setAssetFilter] = useState<AssetFilterValue>('all');
  const [assetSort, setAssetSort] = useState<AssetSortValue>('newest');
  const [assetSearch, setAssetSearch] = useState('');
  const [demucsModel, setDemucsModel] = useState<DemucsModel>('htdemucs');
  const [stemMode, setStemMode] = useState<StemMode>('four_stem');
  const [masterVolume, setMasterVolume] = useState(80);
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const [masterLevel, setMasterLevel] = useState(0);
  const [masterRms, setMasterRms] = useState(0);
  const [masterPhase, setMasterPhase] = useState(0);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [spectrumData, setSpectrumData] = useState<number[]>([]);
  const [loudnessShortTerm, setLoudnessShortTerm] = useState(-Infinity);
  const [loudnessHistory, setLoudnessHistory] = useState<number[]>([]);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [markerDraft, setMarkerDraft] = useState('');
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const actualTimeRef = useRef<number>(0);
  const seekPositionRef = useRef<number>(0);
  const durationRef = useRef<number>(180);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode; panner: StereoPannerNode; analyser: AnalyserNode }>>(new Map());
  const audioSourceRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const audioBufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const audioNodesRef = useRef<Map<string, { gain: GainNode; panner: StereoPannerNode; analyser: AnalyserNode }>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimationRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

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
      setMasterLevel(0);
      setLoudnessShortTerm(-Infinity);
      setLoudnessHistory([]);
      return;
    }

    const updateMeters = () => {
      const nextTrackLevels: Record<string, number> = {};

      timelineStems.forEach((stem) => {
        const analyser = oscillatorsRef.current.get(stem.id)?.analyser
          ?? (stem.assetId ? audioNodesRef.current.get(stem.assetId)?.analyser : undefined);
        nextTrackLevels[stem.id] = analyser ? getMeterLevel(analyser) : 0;
      });

      setTrackLevels(nextTrackLevels);
      setMasterLevel(masterAnalyserRef.current ? getMeterLevel(masterAnalyserRef.current) : 0);
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
      meterAnimationRef.current = requestAnimationFrame(updateMeters);
    };

    meterAnimationRef.current = requestAnimationFrame(updateMeters);

    return () => {
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
      }
    };
  }, [getLoudness, getMeterLevel, getMeterRms, getPhaseCorrelation, getSpectrumData, isPlaying, showSpectrum, timelineStems]);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      audioContextRef.current = new AudioContextCtor();
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
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
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
    setIsDeletingAssetId(assetId);
    try {
      await api.deleteAsset(assetId);
      const refreshedAssets = await api.getProjectAssets(projectId);
      hydrateProjectAssets(refreshedAssets);
    } catch (error) {
      console.error('Failed to delete asset:', error);
    } finally {
      setIsDeletingAssetId(null);
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

  const startRenamingAsset = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setAssetNameDraft(getAssetDisplayName(asset));
  };

  const cancelRenamingAsset = () => {
    setEditingAssetId(null);
    setAssetNameDraft('');
  };

  const handleRenameAsset = async (assetId: string) => {
    setIsSavingAssetName(true);
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
    } finally {
      setIsSavingAssetName(false);
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

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) return;
    try {
      const mixData = {
        stems: timelineStems.map(s => ({
          id: s.id,
          name: s.name,
          volume: s.volume,
          pan: s.pan,
          muted: s.muted,
          solo: s.solo,
          isSelected: s.isSelected,
        })),
        masterVolume,
      };
      const newSnapshot = await api.createSnapshot(projectId, {
        name: snapshotName.trim(),
        description: snapshotDesc.trim() || undefined,
        data: mixData,
      });
      setSnapshots(prev => [newSnapshot, ...prev]);
      setSnapshotName('');
      setSnapshotDesc('');
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    }
  };

  const handleLoadSnapshot = (snapshot: ProjectSnapshot) => {
    if (!snapshot.data) return;
    const data = snapshot.data as { stems?: Array<{ id: string; volume: number; pan: number; muted: boolean; solo: boolean; isSelected: boolean }>; masterVolume?: number };
    if (data.stems) {
      setTimelineStems(prev => prev.map(stem => {
        const saved = data.stems!.find(s => s.id === stem.id);
        if (saved) {
          return { ...stem, ...saved };
        }
        return stem;
      }));
    }
    if (typeof data.masterVolume === 'number') {
      setMasterVolume(data.masterVolume);
    }
    setShowSnapshots(false);
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await api.deleteSnapshot(projectId, snapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const togglePlay = useCallback(async () => {
    const ctx = initAudioContext();
    
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
      setMasterLevel(0);
      
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
      console.log('=== Loading audio buffers ===');
      timelineStems.forEach(stem => {
        if (stem.assetId) {
          const buffer = audioBufferRef.current.get(stem.assetId);
          console.log(`Stem: ${stem.id}, AssetId: ${stem.assetId}, Duration: ${buffer?.duration || 'NOT LOADED'}`);
          if (buffer && buffer.duration > maxBufferDuration) {
            maxBufferDuration = buffer.duration;
          }
        }
      });
      console.log(`Max duration: ${maxBufferDuration}`);
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
            
            // Start from resume position (offset is in seconds)
            const offsetSeconds = Math.min(resumePosition, buffer.duration);
            source.start(0, offsetSeconds);
            
            audioSourceRef.current.set(stem.assetId, source);
            audioNodesRef.current.set(stem.assetId, { gain: gainNode, panner: pannerNode, analyser: analyserNode });
          }
        } else {
          // Oscillator fallback
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
        setMasterLevel(0);
        
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
                  AudioForge Workspace
                </p>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {projectName || `Project #${projectId}`}
                </h1>
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
                onClick={() => originalAssets.length > 0 && setActiveTab('separate')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'separate' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-white text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'} ${originalAssets.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={originalAssets.length === 0}
              >
                Separate
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
                  {projectName || `Project #${projectId}`}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Manage originals, generated stems, and mixes from one workspace. Preview files, rename assets for clarity,
                  and move only the tracks you want into the mixer.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white/70 px-5 py-4 text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-200">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Project ID</p>
                <p className="mt-2 font-mono text-sm text-slate-600 dark:text-slate-300">{projectId}</p>
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
                        {asset.type === 'original' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSeparateAsset(asset); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white transition hover:bg-purple-700"
                            title="Separate"
                          >
                            <Wand2 size={16} />
                          </button>
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
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🎛️</span>
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">Separating Stems...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">{processingStatus}</p>
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
                    Choose the original file, Demucs model, and output layout before starting a separation job.
                  </p>
                </div>
                {assets.filter(a => a.type === 'original').length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No audio files ready</p>
                    <button onClick={() => setActiveTab('upload')} className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600">
                      Upload Audio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assets.filter(a => a.type === 'original').map((asset) => (
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
                    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Ready to process: {getAssetDisplayName(selectedAsset)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Model: {DEMUCS_MODEL_OPTIONS.find((option) => option.value === demucsModel)?.label} · Output:{' '}
                        {STEM_MODE_OPTIONS.find((option) => option.value === stemMode)?.label}
                      </p>
                      {stemMode === 'four_stem' && (
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

        {/* Mixer Tab */}
        {activeTab === 'mix' && timelineStems.length > 0 && (
          <div className="mx-auto max-w-7xl">
            {/* Transport */}
            <div className="mb-3 rounded-xl border border-white/70 bg-white/85 p-3 shadow backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
              <div className="flex flex-wrap items-center gap-4">
                {/* Play button + time */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    disabled={isLoadingAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow ${
                      isLoadingAudio 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
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
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </span>
                </div>

                {/* Master volume */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Gauge size={12} />
                    Master
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                    className="w-24 accent-sky-600"
                  />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-8">{masterVolume}%</span>
                </div>

                {/* Master meter */}
                <div className="flex items-center gap-1">
                  <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative" title={`Peak: ${Math.round(masterLevel * 100)}%`}>
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                        masterLevel > 0.82 ? 'bg-red-500' : masterLevel > 0.55 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${masterLevel < 0.02 ? 0 : Math.max(4, masterLevel * 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-500/60 rounded-full"
                      style={{ width: `${masterRms < 0.02 ? 0 : Math.max(2, masterRms * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono">
                    {Math.round(masterLevel * 100)}/{Math.round(masterRms * 100)}
                  </span>
                </div>

                {/* Phase meter */}
                <div className="flex items-center gap-1" title={`Phase: ${(masterPhase * 100).toFixed(0)}`}>
                  <span className="text-[9px] text-gray-400">Ph</span>
                  <div className="w-12 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                    <div
                      className={`absolute inset-y-0 rounded-full transition-all ${
                        masterPhase < 0 ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ 
                        left: '50%',
                        width: `${Math.abs(masterPhase) * 50}%`,
                        transform: masterPhase < 0 ? 'translateX(-100%)' : 'translateX(0)'
                      }}
                    />
                  </div>
                  <span className={`text-[9px] font-mono ${masterPhase < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {masterPhase >= 0 ? '+' : ''}{(masterPhase * 100).toFixed(0)}
                  </span>
                </div>

                {/* Spectrum Analyzer toggle */}
                <button
                  onClick={() => setShowSpectrum(!showSpectrum)}
                  className={`p-1 rounded ${showSpectrum ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Spectrum Analyzer"
                >
                  <AudioWaveform size={14} />
                </button>

                {/* Loudness Meter */}
                <div className="flex items-center gap-1" title={`Short-term: ${loudnessShortTerm > -70 ? loudnessShortTerm.toFixed(1) : '-∞'} LUFS`}>
                  <span className="text-[9px] text-gray-400">LUFS</span>
                  <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all bg-sky-500"
                      style={{ width: `${loudnessShortTerm > -70 ? Math.max(2, ((loudnessShortTerm + 70) / 70) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-400">
                    {loudnessShortTerm > -70 ? loudnessShortTerm.toFixed(1) : '-∞'}
                  </span>
                </div>

                {/* Loudness History Mini Graph */}
                <div className="w-20 h-3 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full flex items-end gap-[1px] px-[2px]">
                    {loudnessHistory.length > 0 ? (
                      loudnessHistory.map((val, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t"
                          style={{
                            height: `${Math.max(10, ((val + 70) / 70) * 100)}%`,
                            backgroundColor: val > -14 ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      ))
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                </div>

                <div className="flex-1"></div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{timelineStems.filter((s) => s.isSelected).length} selected</span>
                  <button
                    onClick={() => {
                      const selectedStems = timelineStems.filter((s) => s.isSelected);
                      if (selectedStems.length > 0) {
                        const firstStem = selectedStems[0];
                        if (firstStem.assetId) {
                          const volumes = selectedStems.map((s) => s.volume / 100);
                          const pans = selectedStems.map((s) => s.pan / 100);
                          const url = api.getAssetMixdownUrl(firstStem.assetId, volumes, pans);
                          window.open(url, '_blank');
                        }
                      }
                    }}
                    disabled={timelineStems.filter((s) => s.isSelected).length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    <Download size={12} />
                    Export
                  </button>
                  <button
                    onClick={handleResetMixer}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                  <button
                    onClick={handleUnmuteAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Volume2 size={12} />
                    Unmute
                  </button>
                  <button
                    onClick={handleClearSolo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Headphones size={12} />
                    Clear Solo
                  </button>
                  <button
                    onClick={() => setShowSnapshots(!showSnapshots)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/30 dark:bg-purple-900/20 dark:text-purple-300"
                  >
                    <History size={12} />
                    Snapshots ({snapshots.length})
                  </button>
                </div>
              </div>

              {/* Snapshots Panel */}
              {showSnapshots && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Save Current Mix</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="Snapshot name..."
                      className="flex-1 text-xs px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSnapshot(); }}
                    />
                    <input
                      type="text"
                      value={snapshotDesc}
                      onChange={(e) => setSnapshotDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="flex-1 text-xs px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
                    />
                    <button
                      onClick={handleSaveSnapshot}
                      disabled={!snapshotName.trim()}
                      className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  {snapshots.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Saved Snapshots</span>
                      {snapshots.map((snap) => (
                        <div key={snap.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{snap.name}</div>
                            {snap.description && <div className="text-[10px] text-gray-500 truncate">{snap.description}</div>}
                            <div className="text-[9px] text-gray-400">{new Date(snap.created_at).toLocaleString()}</div>
                          </div>
                          <button
                            onClick={() => handleLoadSnapshot(snap)}
                            className="px-2 py-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded hover:bg-blue-200"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteSnapshot(snap.id)}
                            className="p-1 text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">No snapshots saved yet</div>
                  )}
                </div>
              )}

              {/* Spectrum Analyzer Visualization */}
              {showSpectrum && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Spectrum</span>
                    <div className="flex-1 h-12 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-end px-1 gap-[1px]">
                      {spectrumData.length > 0 ? (
                        spectrumData.map((value, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t transition-all"
                            style={{
                              height: `${Math.max(2, value * 100)}%`,
                              backgroundColor: value > 0.7 ? '#ef4444' : value > 0.4 ? '#f59e0b' : '#22c55e',
                            }}
                          />
                        ))
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-gray-400">Play audio to see spectrum</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline with Stems */}
            <div className="rounded-xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
              {/* Time ruler */}
              <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="w-44 flex-shrink-0 p-1.5 border-r dark:border-gray-700 flex items-center gap-1">
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
                  <span className="text-[9px] text-gray-400">{markers.length} markers</span>
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
                    <div key={stem.id} className="flex border-b dark:border-gray-700 last:border-b-0 min-h-[60px]">
                      {/* Stem controls */}
                      <div className="w-44 flex-shrink-0 p-1.5 bg-white dark:bg-gray-800 border-r dark:border-gray-700">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{stem.icon}</span>
                      <span className={`font-medium text-xs ${stem.color}`}>{stem.name}</span>
                      <div className="flex-1"></div>
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
                    </div>
                    
                    {/* Level meter */}
                    <div className="h-1 mb-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (trackLevels[stem.id] ?? 0) > 0.82
                            ? 'bg-red-500'
                            : (trackLevels[stem.id] ?? 0) > 0.55
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(trackLevels[stem.id] ?? 0) < 0.02 ? 0 : Math.max(4, (trackLevels[stem.id] ?? 0) * 100)}%` }}
                      />
                    </div>
                    
                    {/* Volume + Pan sliders */}
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-[9px] text-gray-400">V</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={stem.volume}
                          onChange={(e) => handleVolumeChange(stem.id, parseInt(e.target.value))}
                          className="w-full h-1 accent-blue-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-[9px] text-gray-400">P</span>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={stem.pan}
                          onChange={(e) => handlePanChange(stem.id, parseInt(e.target.value))}
                          className="w-full h-1 accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Waveform area */}
                  <div 
                    className="flex-1 relative min-h-[60px] cursor-pointer"
                    onMouseDown={handleTimelineMouseDown}
                    onMouseMove={handleTimelineMouseMove}
                    onMouseUp={handleTimelineMouseUp}
                    onMouseLeave={handleTimelineMouseUp}
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
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Waveform visualization component
function Waveform({ assetId, color, currentTime, isPlaying, stemType, audioDuration }: { 
  assetId?: string;
  color: string; 
  currentTime: number;
  isPlaying: boolean;
  stemType: string;
  audioDuration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 60 });
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [waveformDuration, setWaveformDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch waveform data when assetId changes
  useEffect(() => {
    if (!assetId) return;
    
    setIsLoading(true);
    setError(null);
    setWaveformDuration(null);
    
    const fetchWaveform = async () => {
      try {
        const response = await fetch(`/api/v1/assets/${assetId}/waveform`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Waveform fetch error:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        setWaveformData(data.peaks || null);
        if (data.duration) {
          setWaveformDuration(data.duration);
        }
      } catch (err) {
        console.error('Failed to fetch waveform:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setWaveformData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWaveform();
  }, [assetId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({
        width: rect.width,
        height: rect.height || 60,
      });
    };

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const { width, height } = canvasSize;
    if (!canvas || width <= 0 || height <= 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Use audioDuration (from decoded audio) if available, otherwise waveformDuration
    const effectiveDuration = audioDuration || waveformDuration || 0;
    const clampedTime = Math.min(currentTime, effectiveDuration);
    const progress = effectiveDuration > 0 ? (clampedTime / effectiveDuration) * 100 : 0;
    const progressX = (Math.min(progress, 100) / 100) * width;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (waveformData && waveformData.length > 0) {
        // Stretch the backend peaks across the full row so the waveform width matches playback width.
        const gap = 1;
        const availableBars = Math.max(1, Math.floor(width / 3));
        const barCount = Math.max(1, Math.min(waveformData.length, availableBars));
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          const isPlayed = x < progressX;
          const samplePosition = barCount === 1 ? 0 : (i / (barCount - 1)) * (waveformData.length - 1);
          const lowerIndex = Math.floor(samplePosition);
          const upperIndex = Math.min(waveformData.length - 1, Math.ceil(samplePosition));
          const interpolationFactor = samplePosition - lowerIndex;
          const lowerValue = Math.abs(waveformData[lowerIndex] ?? 0);
          const upperValue = Math.abs(waveformData[upperIndex] ?? lowerValue);
          const avgAmplitude = lowerValue + (upperValue - lowerValue) * interpolationFactor;
          const barHeight = Math.max(4, avgAmplitude * height * 0.9);
          
          ctx.fillStyle = isPlayed ? color : '#9ca3af';
          ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - gap), barHeight);
        }
      } else {
        // Fallback to static dummy waveform (no animation)
        const seed = stemType.charCodeAt(0) + stemType.charCodeAt(stemType.length - 1);
        const barCount = Math.max(1, Math.floor(width / 4));
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          const isPlayed = x < progressX;
          
          // Static noise pattern (no Date.now() to avoid animation)
          const noise = Math.sin(i * 0.3 + seed) * 0.3 + Math.sin(i * 0.7 + seed * 2) * 0.2 + Math.sin(i * 1.5 + seed * 0.5) * 0.5;
          const barHeight = Math.max(4, (Math.abs(noise) + 0.2) * height * 0.8);
          
          ctx.fillStyle = isPlayed ? color : '#d1d5db';
          ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
        }
      }
    };
    
    draw();
    
    if (isPlaying) {
      const animate = () => { draw(); animationRef.current = requestAnimationFrame(animate); };
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [canvasSize, currentTime, waveformDuration, audioDuration, color, isPlaying, stemType, waveformData]);
  
  return (
    <div ref={containerRef} className="w-full h-full rounded flex items-center justify-center" style={{ minHeight: '60px', height: '60px' }}>
      {isLoading ? (
        <div className="text-[10px] text-gray-400">...</div>
      ) : error ? (
        <div className="text-[10px] text-red-400" title={error}>No</div>
      ) : (
        <canvas 
          ref={canvasRef} 
          className="w-full h-full rounded" 
          style={{ display: 'block', minHeight: '60px', height: '60px' }} 
        />
      )}
    </div>
  );
}
