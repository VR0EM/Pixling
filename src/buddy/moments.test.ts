import { describe, expect, it } from 'vitest';
import { momentFor } from './moments.ts';

const at = (iso: string) => new Date(iso);

describe('momentFor', () => {
  it('wears a nightcap late at night', () => {
    expect(momentFor(at('2026-03-10T23:30:00')).hat).toBe('slaapmuts');
    expect(momentFor(at('2026-03-10T04:00:00')).hat).toBe('slaapmuts');
  });

  it('drinks coffee in the morning', () => {
    expect(momentFor(at('2026-03-10T08:15:00')).item).toBe('koffie');
    expect(momentFor(at('2026-03-10T11:00:00')).item).toBeUndefined();
  });

  it('parties on Friday evening and New Year’s Eve', () => {
    expect(momentFor(at('2026-03-13T18:00:00')).hat).toBe('feesthoed'); // a Friday
    expect(momentFor(at('2026-03-13T12:00:00')).hat).toBeUndefined();
    expect(momentFor(at('2026-12-31T20:00:00')).hat).toBe('feesthoed');
  });

  it('wears a beanie in winter, but sleeps in a nightcap and parties on New Year', () => {
    expect(momentFor(at('2026-12-10T14:00:00')).hat).toBe('wintermuts');
    expect(momentFor(at('2027-02-02T14:00:00')).hat).toBe('wintermuts');
    expect(momentFor(at('2026-11-20T14:00:00')).hat).toBeUndefined();
    expect(momentFor(at('2027-03-02T14:00:00')).hat).toBeUndefined();
    expect(momentFor(at('2026-12-10T23:30:00')).hat).toBe('slaapmuts');
    expect(momentFor(at('2027-01-01T14:00:00')).hat).toBe('feesthoed');
  });

  it('is plain on an ordinary afternoon', () => {
    expect(momentFor(at('2026-03-10T15:00:00'))).toEqual({});
  });
});
