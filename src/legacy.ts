/**
 * Pixling started out in Dutch. Settings, creations and diaries saved back then use Dutch ids; these
 * functions translate them once, at startup, so nobody loses their buddy.
 */
import type { Config } from './platform/bridge.ts';

const IDS: Record<'species' | 'palette' | 'accessory' | 'character', Record<string, string>> = {
  species: { robotje: 'robot', spookje: 'ghost', boontje: 'sprout', paddo: 'shroom', mokje: 'mug', draakje: 'dragon', kat: 'robot', konijn: 'robot' },
  palette: {
    eigen: 'default',
    rood: 'red',
    gember: 'ginger',
    zand: 'sand',
    mos: 'moss',
    spookwit: 'snow',
    hemel: 'sky',
    houtskool: 'charcoal',
  },
  accessory: {
    geen: 'none',
    feesthoed: 'partyhat',
    kroon: 'crown',
    strikje: 'bow',
    wintermuts: 'beanie',
    slaapmuts: 'nightcap',
    zonnebril: 'sunglasses',
    mijter: 'none',
  },
  character: { lief: 'sweet', druk: 'hyper', rustig: 'calm', brutaal: 'cheeky' },
};

/** The settings that still have a Dutch id, translated; null when there's nothing to change. */
export function migrateConfig(config: Config): Partial<Config> | null {
  const patch: Partial<Config> = {};
  for (const key of Object.keys(IDS) as (keyof typeof IDS)[]) {
    const now = IDS[key][config[key]];
    if (now) patch[key] = now;
  }
  return Object.keys(patch).length ? patch : null;
}

const SLOTS: Record<string, string> = { hoed: 'hat', gezicht: 'face' };

/** Creations with the old slot names get the new ones. Returns null when none needed changing. */
export function migrateCreations<T extends { slot: string }>(list: T[]): T[] | null {
  if (!list.some((c) => c.slot in SLOTS)) return null;
  return list.map((c) => (c.slot in SLOTS ? { ...c, slot: SLOTS[c.slot] } : c));
}

const DAY_KEYS: Record<string, string> = { aai: 'pets', gegooid: 'throws', notities: 'notes', bestanden: 'files', vensters: 'climbs' };

/**
 * Renames the counters of old diary days. Their Dutch sentences are dropped, so they get written again
 * in English. Changes the diary in place and returns true if it changed anything.
 */
export function migrateDiary(diary: { days: Record<string, Record<string, unknown>> }): boolean {
  let changed = false;
  for (const day of Object.values(diary.days ?? {})) {
    for (const [old, now] of Object.entries(DAY_KEYS)) {
      if (old in day) {
        day[now] = day[old];
        delete day[old];
        changed = true;
      }
    }
    if ('zin' in day) {
      delete day.zin;
      changed = true;
    }
  }
  return changed;
}
