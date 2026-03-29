import { describe, it, expect } from 'vitest';
import {
  noteNameToFrequency,
  getScaleNotes,
  transposeNotesByOctave,
  buildPhrasePreset,
  GENERATED_INSTRUMENT_OPTIONS,
  SCALE_OPTIONS,
  ROOT_NOTE_OPTIONS,
  NOTE_LENGTH_OPTIONS,
  PHRASE_PRESET_OPTIONS,
} from './generated-asset';


describe('generated-asset', () => {
  describe('noteNameToFrequency', () => {
    it('should convert note name to frequency', () => {
      expect(noteNameToFrequency('A4')).toBe(440);
      expect(noteNameToFrequency('A5')).toBe(880);
      expect(noteNameToFrequency('C4')).toBeCloseTo(261.63, 1);
    });

    it('should handle sharps', () => {
      expect(noteNameToFrequency('C#4')).toBeDefined();
    });

    it('should handle flats', () => {
      expect(noteNameToFrequency('Db4')).toBeDefined();
    });

    it('should return null for rest notes', () => {
      expect(noteNameToFrequency('R')).toBeNull();
      expect(noteNameToFrequency('REST')).toBeNull();
      expect(noteNameToFrequency('-')).toBeNull();
    });

    it('should return null for invalid notes', () => {
      expect(noteNameToFrequency('')).toBeNull();
      expect(noteNameToFrequency('invalid')).toBeNull();
      expect(noteNameToFrequency('X4')).toBeNull();
    });
  });

  describe('getScaleNotes', () => {
    it('should generate scale notes for C major', () => {
      const notes = getScaleNotes('C', 'major', 4);
      expect(notes).toHaveLength(7);
      expect(notes[0]).toBe('C4');
    });

    it('should generate scale notes for A minor', () => {
      const notes = getScaleNotes('A', 'minor', 4);
      expect(notes).toHaveLength(7);
      expect(notes[0]).toBe('A4');
    });

    it('should handle different octaves', () => {
      const notes3 = getScaleNotes('C', 'major', 3);
      const notes5 = getScaleNotes('C', 'major', 5);
      expect(notes3[0]).toBe('C3');
      expect(notes5[0]).toBe('C5');
    });
  });

  describe('transposeNotesByOctave', () => {
    it('should transpose notes up by one octave', () => {
      const result = transposeNotesByOctave('C4 D4 E4', 1);
      expect(result).toBe('C5 D5 E5');
    });

    it('should transpose notes down by one octave', () => {
      const result = transposeNotesByOctave('C4 D4 E4', -1);
      expect(result).toBe('C3 D3 E3');
    });

    it('should handle rest notes', () => {
      const result = transposeNotesByOctave('C4 R D4', 1);
      expect(result).toBe('C5 R D5');
    });

    it('should handle empty string', () => {
      expect(transposeNotesByOctave('', 1)).toBe('');
    });
  });

  describe('buildPhrasePreset', () => {
    it('should build arp_up preset', () => {
      const result = buildPhrasePreset('arp_up', 'C', 'major');
      expect(result).toBeDefined();
      expect(result.split(' ')).toHaveLength(4);
    });

    it('should build arp_down preset', () => {
      const result = buildPhrasePreset('arp_down', 'C', 'major');
      expect(result).toBeDefined();
    });

    it('should build bass_pulse preset', () => {
      const result = buildPhrasePreset('bass_pulse', 'C', 'major');
      expect(result).toBeDefined();
    });

    it('should build pad_swells preset', () => {
      const result = buildPhrasePreset('pad_swells', 'C', 'major');
      expect(result).toBeDefined();
    });
  });

  describe('constants', () => {
    it('should have valid instrument options', () => {
      expect(GENERATED_INSTRUMENT_OPTIONS).toHaveLength(4);
      expect(GENERATED_INSTRUMENT_OPTIONS[0]).toHaveProperty('value');
      expect(GENERATED_INSTRUMENT_OPTIONS[0]).toHaveProperty('label');
    });

    it('should have valid scale options', () => {
      expect(SCALE_OPTIONS).toHaveLength(4);
      expect(SCALE_OPTIONS[0]).toHaveProperty('value');
    });

    it('should have 12 root notes', () => {
      expect(ROOT_NOTE_OPTIONS).toHaveLength(12);
    });

    it('should have note length options', () => {
      expect(NOTE_LENGTH_OPTIONS).toHaveLength(3);
    });

    it('should have phrase preset options', () => {
      expect(PHRASE_PRESET_OPTIONS).toHaveLength(4);
    });
  });
});
