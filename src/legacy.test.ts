import { describe, expect, it } from 'vitest';
import { migrateConfig, migrateCreations, migrateDiary } from './legacy.ts';
import { DEFAULT_CONFIG } from './platform/bridge.ts';

describe('legacy ids', () => {
  it('translates Dutch settings and leaves English ones alone', () => {
    const old = { ...DEFAULT_CONFIG, species: 'paddo', palette: 'houtskool', accessory: 'zonnebril', character: 'brutaal' };
    expect(migrateConfig(old)).toEqual({ species: 'shroom', palette: 'charcoal', accessory: 'sunglasses', character: 'cheeky' });
    expect(migrateConfig(DEFAULT_CONFIG)).toBeNull();
    // Buddies and hats that were removed fall back to something that exists.
    expect(migrateConfig({ ...DEFAULT_CONFIG, species: 'kat', accessory: 'mijter' })).toEqual({ species: 'robot', accessory: 'none' });
  });

  it('renames the slots of old creations', () => {
    const list = [{ id: 'a', slot: 'hoed' }, { id: 'b', slot: 'hand' }];
    expect(migrateCreations(list)).toEqual([{ id: 'a', slot: 'hat' }, { id: 'b', slot: 'hand' }]);
    expect(migrateCreations([{ id: 'c', slot: 'face' }])).toBeNull();
  });

  it('renames diary counters and drops the Dutch sentences', () => {
    const diary = { days: { '2026-11-05': { aai: 3, focus: 1, zin: 'Vandaag: 1 focusronde.' } as Record<string, unknown> } };
    expect(migrateDiary(diary)).toBe(true);
    expect(diary.days['2026-11-05']).toEqual({ pets: 3, focus: 1 });
    expect(migrateDiary(diary)).toBe(false);
  });
});
