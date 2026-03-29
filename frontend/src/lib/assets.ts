import { Asset } from './api';

export interface TimelineStem {
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


export const STEM_CONFIGS: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  frequency: number;
}> = {
  vocals: { icon: '🎤', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', frequency: 440 },
  drums: { icon: '🥁', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', frequency: 100 },
  bass: { icon: '🎸', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', frequency: 80 },
  other: { icon: '🎹', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', frequency: 220 },
  accompaniment: { icon: '🎼', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', frequency: 200 },
};

export const GENERIC_ASSET_CONFIGS: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  frequency: number;
}> = {
  original: { icon: '🎵', color: 'text-sky-700', bgColor: 'bg-sky-50', borderColor: 'border-sky-300', frequency: 330 },
  stem: STEM_CONFIGS.other,
  mix: { icon: '🎚️', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', frequency: 262 },
  preset: { icon: '💾', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-300', frequency: 196 },
};

export const STEM_ORDER = ['vocals', 'drums', 'bass', 'other', 'accompaniment'] as const;

export type StemType = keyof typeof STEM_CONFIGS;

export function getAssetKindLabel(asset: Asset): string {
  if (asset.type === 'stem' && asset.stem_type) {
    return asset.stem_type.charAt(0).toUpperCase() + asset.stem_type.slice(1);
  }
  return asset.type.charAt(0).toUpperCase() + asset.type.slice(1);
}

export function getAssetDisplayName(asset: Asset): string {
  return asset.display_name || asset.filename || asset.s3_key?.split('/').pop() || 'Untitled';
}

export function getAssetConfig(asset: Asset) {
  if (asset.type === 'stem' && asset.stem_type && STEM_CONFIGS[asset.stem_type]) {
    return STEM_CONFIGS[asset.stem_type];
  }
  return GENERIC_ASSET_CONFIGS[asset.type] || GENERIC_ASSET_CONFIGS.original;
}

export function getStemTypeFromS3Key(s3Key: string): string {
  const key = s3Key.toLowerCase();
  if (key.includes('vocals') || key.includes('vocals.wav')) return 'vocals';
  if (key.includes('drums') || key.includes('drums.wav')) return 'drums';
  if (key.includes('bass') || key.includes('bass.wav')) return 'bass';
  if (key.includes('accompaniment') || key.includes('other') || key.includes(' Accompaniment')) return 'accompaniment';
  return 'other';
}

export function formatAssetDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getLatestStemAssets(projectAssets: Asset[]): Asset[] {
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

export function buildTimelineStemsFromAssets(stemAssets: Asset[]): TimelineStem[] {
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
      icon: config.icon,
      color: config.color,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      assetId: asset.id,
      s3Key: asset.s3_key,
      frequency: config.frequency,
      sourceType,
      isSelected: false,
      isPlaying: false,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      reverb: 0,
      reverbWetDry: 0.3,
      reverbDecay: 1.5,
      reverbPreDelay: 0.02,
      delay: 0,
      delayWetDry: 0.3,
      delayFeedback: 0.4,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      compressor: false,
      compressorThreshold: -24,
      compressorRatio: 4,
      compressorAttack: 0.003,
      compressorRelease: 0.25,
      compressorMakeup: 0,
    };
  });
}

export function createDefaultTimelineStem(stemType: string, assetId: string, s3Key: string): TimelineStem {
  const config = STEM_CONFIGS[stemType as keyof typeof STEM_CONFIGS] || STEM_CONFIGS.other;
  return {
    id: assetId,
    name: stemType.charAt(0).toUpperCase() + stemType.slice(1),
    icon: config.icon,
    color: config.color,
    bgColor: config.bgColor,
    borderColor: config.borderColor,
    assetId,
    s3Key,
    frequency: config.frequency,
    sourceType: stemType,
    isSelected: false,
    isPlaying: false,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    reverb: 0,
    reverbWetDry: 0.3,
    reverbDecay: 1.5,
    reverbPreDelay: 0.02,
    delay: 0,
    delayWetDry: 0.3,
    delayFeedback: 0.4,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressor: false,
    compressorThreshold: -24,
    compressorRatio: 4,
    compressorAttack: 0.003,
    compressorRelease: 0.25,
    compressorMakeup: 0,
  };
}
