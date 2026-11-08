import { describe, expect, it } from 'vitest';
import { elapsedCleaningMinutes, estimatedCleaningMinutes } from '../src/services/cleaning-time.js';

describe('cleaning time reporting', () => {
  it('uses the documented default estimate for each supported service', () => {
    expect(estimatedCleaningMinutes('CHECKOUT')).toBe(30);
    expect(estimatedCleaningMinutes('STAYOVER')).toBe(15);
    expect(estimatedCleaningMinutes('FULL_SERVICE')).toBe(30);
    expect(estimatedCleaningMinutes('DEEP_CLEAN')).toBe(60);
    expect(estimatedCleaningMinutes('ARRIVAL_TOUCHUP')).toBe(15);
    expect(estimatedCleaningMinutes('UNKNOWN')).toBe(0);
  });

  it('returns elapsed minutes only for a valid start and completion interval', () => {
    const start = new Date('2026-11-08T08:00:00.000Z');
    expect(elapsedCleaningMinutes(start, new Date('2026-11-08T08:27:00.000Z'))).toBe(27);
    expect(elapsedCleaningMinutes(null, new Date('2026-11-08T08:27:00.000Z'))).toBeNull();
    expect(elapsedCleaningMinutes(start, null)).toBeNull();
    expect(elapsedCleaningMinutes(start, start)).toBeNull();
    expect(elapsedCleaningMinutes(new Date('2026-11-08T08:30:00.000Z'), start)).toBeNull();
  });
});
