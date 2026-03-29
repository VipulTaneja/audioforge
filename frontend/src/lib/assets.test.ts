import { describe, it, expect } from 'vitest';
import {
  STEM_CONFIGS,
  GENERIC_ASSET_CONFIGS,
  getAssetKindLabel,
  getAssetDisplayName,
  getAssetConfig,
  getStemTypeFromS3Key,
  formatAssetDate,
  formatTime,
} from './assets';
import { Asset } from './api';


describe('assets', () => {
  describe('STEM_CONFIGS', () => {
    it('should have configs for all stem types', () => {
      expect(STEM_CONFIGS.vocals).toBeDefined();
      expect(STEM_CONFIGS.drums).toBeDefined();
      expect(STEM_CONFIGS.bass).toBeDefined();
      expect(STEM_CONFIGS.other).toBeDefined();
      expect(STEM_CONFIGS.accompaniment).toBeDefined();
    });

    it('should have correct icons', () => {
      expect(STEM_CONFIGS.vocals.icon).toBe('🎤');
      expect(STEM_CONFIGS.drums.icon).toBe('🥁');
      expect(STEM_CONFIGS.bass.icon).toBe('🎸');
    });
  });

  describe('GENERIC_ASSET_CONFIGS', () => {
    it('should have configs for all asset types', () => {
      expect(GENERIC_ASSET_CONFIGS.original).toBeDefined();
      expect(GENERIC_ASSET_CONFIGS.stem).toBeDefined();
      expect(GENERIC_ASSET_CONFIGS.mix).toBeDefined();
      expect(GENERIC_ASSET_CONFIGS.preset).toBeDefined();
    });
  });

  describe('getAssetDisplayName', () => {
    it('should return display_name if available', () => {
      const asset: Partial<Asset> = { display_name: 'My Song', filename: 'song.mp3', s3_key: 'test/song.mp3' };
      expect(getAssetDisplayName(asset as Asset)).toBe('My Song');
    });

    it('should fallback to filename', () => {
      const asset: Partial<Asset> = { filename: 'song.mp3', s3_key: 'test/song.mp3' };
      expect(getAssetDisplayName(asset as Asset)).toBe('song.mp3');
    });

    it('should fallback to s3_key basename', () => {
      const asset: Partial<Asset> = { s3_key: 'project-123/audio-file.wav' };
      expect(getAssetDisplayName(asset as Asset)).toBe('audio-file.wav');
    });

    it('should return Untitled for empty asset', () => {
      expect(getAssetDisplayName({} as Asset)).toBe('Untitled');
    });
  });

  describe('getAssetKindLabel', () => {
    it('should return capitalized type for original', () => {
      const asset: Partial<Asset> = { type: 'original' };
      expect(getAssetKindLabel(asset as Asset)).toBe('Original');
    });

    it('should return capitalized stem_type for stems', () => {
      const asset: Partial<Asset> = { type: 'stem', stem_type: 'vocals' };
      expect(getAssetKindLabel(asset as Asset)).toBe('Vocals');
    });

    it('should return capitalized type for unknown stem_type', () => {
      const asset: Partial<Asset> = { type: 'stem' };
      expect(getAssetKindLabel(asset as Asset)).toBe('Stem');
    });
  });

  describe('getAssetConfig', () => {
    it('should return stem config for stem assets with stem_type', () => {
      const asset: Partial<Asset> = { type: 'stem', stem_type: 'drums' };
      expect(getAssetConfig(asset as Asset)).toBe(STEM_CONFIGS.drums);
    });

    it('should return original config for original assets', () => {
      const asset: Partial<Asset> = { type: 'original' };
      expect(getAssetConfig(asset as Asset)).toBe(GENERIC_ASSET_CONFIGS.original);
    });
  });

  describe('getStemTypeFromS3Key', () => {
    it('should detect vocals', () => {
      expect(getStemTypeFromS3Key('vocals.wav')).toBe('vocals');
      expect(getStemTypeFromS3Key('test/vocals.wav')).toBe('vocals');
    });

    it('should detect drums', () => {
      expect(getStemTypeFromS3Key('drums.wav')).toBe('drums');
      expect(getStemTypeFromS3Key('Drums.wav')).toBe('drums');
    });

    it('should detect bass', () => {
      expect(getStemTypeFromS3Key('bass.wav')).toBe('bass');
    });

    it('should detect accompaniment', () => {
      expect(getStemTypeFromS3Key('accompaniment.wav')).toBe('accompaniment');
    });

    it('should return other for unknown', () => {
      expect(getStemTypeFromS3Key('unknown.wav')).toBe('other');
    });
  });

  describe('formatTime', () => {
    it('should format seconds correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(125)).toBe('2:05');
    });
  });

  describe('formatAssetDate', () => {
    it('should return Just now for recent dates', () => {
      const now = new Date().toISOString();
      expect(formatAssetDate(now)).toBe('Just now');
    });
  });
});
