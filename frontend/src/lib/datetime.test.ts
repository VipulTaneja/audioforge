import { describe, it, expect } from 'vitest';
import {
  formatBrowserDateTime,
  getBrowserTimeZone,
} from './datetime';


describe('datetime', () => {
  describe('getBrowserTimeZone', () => {
    it('should return timezone string', () => {
      const tz = getBrowserTimeZone();
      expect(tz).toBeDefined();
      expect(typeof tz).toBe('string');
    });
  });

  describe('formatBrowserDateTime', () => {
    it('should format date correctly', () => {
      const result = formatBrowserDateTime('2024-01-15T10:30:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format with custom options', () => {
      const result = formatBrowserDateTime('2024-01-15T10:30:00Z', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle different date formats', () => {
      const result1 = formatBrowserDateTime('2024-12-25T00:00:00');
      const result2 = formatBrowserDateTime('2024-06-15T12:30:45.123Z');
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
