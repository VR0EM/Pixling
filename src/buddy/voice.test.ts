import { describe, expect, it } from 'vitest';
import { daysTogether, dayKey, emptyDay, sentence } from './diary.ts';
import { PERSONALITIES, dagdeel, line, type Character, type Situation } from './voice.ts';

const characters = Object.keys(PERSONALITIES) as Character[];
const situations: Situation[] = [
  'groet', 'aai', 'gegooid', 'wakker', 'venster', 'genoteerd', 'nom', 'water', 'proost', 'focusStart',
  'focusStop', 'pauze', 'pauzeKlaar', 'moe', 'snooze', 'batterij20', 'batterij10', 'stroom', 'kletsen',
  'kletsenCode', 'kletsenMuziek', 'kletsenVideo', 'kletsenGame', 'kletsenNacht',
];

describe('voice', () => {
  it('has something to say in every situation, for every character', () => {
    for (const c of characters) {
      for (const key of situations) {
        for (const r of [0, 0.5, 0.99]) {
          const text = line(c, { key, vars: { pct: 15, min: 25, dagdeel: 'Goedemorgen' } }, () => r);
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('fills in the placeholders', () => {
    expect(line('rustig', { key: 'batterij20', vars: { pct: 18 } })).toBe('Batterij: 18%.');
    expect(line('lief', { key: 'focusStart', vars: { min: 25 } }, () => 0)).toBe('Focus! 25 minuten, ik lees wel even.');
  });

  it('sounds different per character', () => {
    const texts = new Set(characters.map((c) => line(c, { key: 'gegooid' }, () => 0)));
    expect(texts.size).toBe(characters.length);
  });

  it('greets by time of day', () => {
    expect(dagdeel(new Date('2026-03-10T08:00:00'))).toBe('Goedemorgen');
    expect(dagdeel(new Date('2026-03-10T14:00:00'))).toBe('Goedemiddag');
    expect(dagdeel(new Date('2026-03-10T20:00:00'))).toBe('Goedenavond');
    expect(dagdeel(new Date('2026-03-10T02:00:00'))).toBe('Hallo nachtuil');
  });
});

describe('diary', () => {
  it('counts the days together, starting at day 1', () => {
    expect(daysTogether('2026-11-06', '2026-11-06')).toBe(1);
    expect(daysTogether('2026-11-06', '2026-12-06')).toBe(31);
    expect(dayKey(new Date('2026-03-05T23:00:00'))).toBe('2026-03-05');
  });

  it('writes a sentence about the most remarkable things', () => {
    const day = { ...emptyDay(), focus: 3, water: 2, aai: 5, notities: 1 };
    expect(sentence(day, 'lief')).toBe('Vandaag: 3 focusrondes, 2× water en 5× geaaid. Wat een fijne dag!');
    expect(sentence(day, 'brutaal')).toMatch(/^3 focusrondes.*koekje\.$/);
    expect(sentence(emptyDay(), 'druk')).toMatch(/NIKS/);
    expect(sentence({ ...emptyDay(), aai: 1 }, 'rustig')).toBe('Vandaag 1× geaaid.');
  });
});
