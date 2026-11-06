import type { Line } from './voice.ts';

/**
 * Reacts to how the computer is doing: limp and a remark when the battery runs low, happy when the
 * charger goes in, sweating when the processor works hard. Pure logic, so it's easy to test.
 */
export interface SystemInfo {
  battery: number | null;
  charging: boolean;
  busy: boolean;
}

export interface SystemReaction {
  say?: Line;
  tired: boolean;
  sweaty: boolean;
}

export class SystemWatch {
  private warned = 100;
  private wasCharging: boolean | null = null;

  react(info: SystemInfo | null, enabled: boolean): SystemReaction {
    if (!info || !enabled) return { tired: false, sweaty: false };
    let say: Line | undefined;
    const level = info.battery;
    const low = level !== null && !info.charging && level <= 20;

    if (level !== null && !info.charging) {
      if (level <= 10 && this.warned > 10) say = { key: 'batterij10', vars: { pct: level } };
      else if (level <= 20 && this.warned > 20) say = { key: 'batterij20', vars: { pct: level } };
      if (level <= 20) this.warned = Math.min(this.warned, level <= 10 ? 10 : 20);
    }
    if (info.charging || (level !== null && level > 25)) this.warned = 100;
    if (this.wasCharging === false && info.charging && level !== null && level <= 50) say = { key: 'stroom' };
    this.wasCharging = info.charging;

    return { say, tired: low, sweaty: info.busy };
  }
}
