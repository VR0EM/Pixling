import { describe, expect, it } from 'vitest';
import { BREAK_COUNTS, Backpack, TIRED_AFTER, WATER_EVERY, type BackpackSettings } from './backpack.ts';

const MIN = 60_000;
const settings: BackpackSettings = { water: true, breaks: true, focusMinutes: 25, breakMinutes: 5 };

describe('Backpack', () => {
  it('runs a focus round with a book, then a break, then stops', () => {
    const bp = new Backpack(0);
    bp.startFocus(0, settings);
    let a = bp.update(0, 0, settings);
    expect(a.item).toBe('boek');
    expect(a.stayPut).toBe(true);
    expect(a.say).toMatch(/Focus/);
    expect(a.trayTitle).toBe('25:00');
    a = bp.update(10 * MIN + 30_000, 0, settings);
    expect(a.trayTitle).toBe('14:30');
    expect(a.say).toBeUndefined();
    a = bp.update(25 * MIN, 0, settings);
    expect(bp.phase).toBe('pauze');
    expect(a.item).toBeUndefined();
    expect(a.say).toMatch(/Pauze/);
    expect(a.trayTitle).toBe('Pauze 5:00');
    a = bp.update(30 * MIN, 0, settings);
    expect(bp.phase).toBe('uit');
    expect(a.trayTitle).toBeNull();
  });

  it('can stop a focus round early', () => {
    const bp = new Backpack(0);
    bp.startFocus(0, settings);
    bp.stopFocus();
    expect(bp.update(MIN, 0, settings).item).toBeUndefined();
  });

  it('offers water after a while, and clicking says cheers', () => {
    const bp = new Backpack(0);
    expect(bp.update(WATER_EVERY - 1, 0, settings).item).toBeUndefined();
    const a = bp.update(WATER_EVERY, 0, settings);
    expect(a.item).toBe('water');
    expect(a.say).toBe('Slokje water?');
    expect(bp.answer(WATER_EVERY + 1000)).toBe(true);
    const b = bp.update(WATER_EVERY + 1000, 0, settings);
    expect(b.item).toBeUndefined();
    expect(b.say).toBe('Proost!');
  });

  it('waits with water until a focus round is over, and skips it when nobody is there', () => {
    const bp = new Backpack(0);
    bp.startFocus(WATER_EVERY - 1, settings);
    expect(bp.update(WATER_EVERY + MIN, 0, settings).item).toBe('boek');
    bp.stopFocus();
    expect(bp.update(WATER_EVERY + 2 * MIN, 10 * MIN, settings).item).toBeUndefined();
    expect(bp.update(WATER_EVERY + 3 * MIN, 0, settings).item).toBe('water');
  });

  it('gets tired after an hour without a break, says so later, and resets after a real break', () => {
    const bp = new Backpack(0);
    for (let t = 0; t <= TIRED_AFTER; t += MIN) bp.update(t, 1000, { ...settings, water: false });
    let a = bp.update(TIRED_AFTER + MIN, 1000, { ...settings, water: false });
    expect(a.tired).toBe(true);
    expect(a.say).toBeUndefined();
    a = bp.update(TIRED_AFTER + 6 * MIN, 1000, { ...settings, water: false });
    expect(a.say).toMatch(/pauze/);
    a = bp.update(TIRED_AFTER + 20 * MIN, BREAK_COUNTS + 1, { ...settings, water: false });
    expect(a.tired).toBe(false);
  });

  it('respects the switches in the menu', () => {
    const off = { ...settings, water: false, breaks: false };
    const bp = new Backpack(0);
    for (let t = 0; t <= 2 * TIRED_AFTER; t += MIN) {
      const a = bp.update(t, 1000, off);
      expect(a.item).toBeUndefined();
      expect(a.tired).toBe(false);
    }
  });
});
