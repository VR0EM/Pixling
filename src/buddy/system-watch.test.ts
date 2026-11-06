import { describe, expect, it } from 'vitest';
import { SystemWatch } from './system-watch.ts';

describe('SystemWatch', () => {
  it('warns once at 20% and once more at 10%, and goes limp', () => {
    const w = new SystemWatch();
    expect(w.react({ battery: 50, charging: false, busy: false }, true).say).toBeUndefined();
    const at20 = w.react({ battery: 19, charging: false, busy: false }, true);
    expect(at20.say).toEqual({ key: 'battery20', vars: { pct: 19 } });
    expect(at20.tired).toBe(true);
    expect(w.react({ battery: 15, charging: false, busy: false }, true).say).toBeUndefined();
    expect(w.react({ battery: 9, charging: false, busy: false }, true).say).toEqual({ key: 'battery10', vars: { pct: 9 } });
    expect(w.react({ battery: 8, charging: false, busy: false }, true).say).toBeUndefined();
  });

  it('is happy when the charger goes in, and warns again after a recharge', () => {
    const w = new SystemWatch();
    w.react({ battery: 18, charging: false, busy: false }, true);
    const plugged = w.react({ battery: 18, charging: true, busy: false }, true);
    expect(plugged.say?.key).toBe('charging');
    expect(plugged.tired).toBe(false);
    w.react({ battery: 90, charging: false, busy: false }, true);
    expect(w.react({ battery: 20, charging: false, busy: false }, true).say?.key).toBe('battery20');
  });

  it('sweats when the computer is busy, and stays quiet when switched off', () => {
    const w = new SystemWatch();
    expect(w.react({ battery: null, charging: true, busy: true }, true).sweaty).toBe(true);
    expect(w.react({ battery: 5, charging: false, busy: true }, false)).toEqual({ tired: false, sweaty: false });
  });
});
