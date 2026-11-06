import type { Accessory } from './types.ts';

/** Where a home-made creation goes. */
export type Slot = 'hoed' | 'gezicht' | 'hand';

/** A creation from the atelier, as stored in creations.json. */
export interface Creation {
  id: string;
  name: string;
  slot: Slot;
  /** Gets a one-pixel outline like the built-in accessories. */
  outline: boolean;
  /** Pixel rows; '.' is transparent, other characters are palette keys. */
  rows: string[];
}

/** Drawing area per slot, in sprite pixels. */
export const SLOT_SIZE: Record<Slot, { w: number; h: number }> = {
  hoed: { w: 12, h: 10 },
  gezicht: { w: 12, h: 4 },
  hand: { w: 8, h: 8 },
};

export const SLOT_NAMES: Record<Slot, string> = {
  hoed: 'Hoedje',
  gezicht: 'Op het gezicht',
  hand: 'Vasthouden',
};

/** Colours you can paint with: the fixed ones, plus three that follow the buddy's palette. */
export const PAINTS: { key: string; name: string }[] = [
  { key: 'n', name: 'Zwart' },
  { key: 'w', name: 'Wit' },
  { key: 'r', name: 'Rood' },
  { key: 'R', name: 'Donkerrood' },
  { key: 'm', name: 'Roze' },
  { key: 'y', name: 'Goud' },
  { key: 'Y', name: 'Donker goud' },
  { key: 'k', name: 'Bruin' },
  { key: 'g', name: 'Groen' },
  { key: 'G', name: 'Donkergroen' },
  { key: 't', name: 'Lichtblauw' },
  { key: 'u', name: 'Indigo' },
  { key: 'q', name: 'Cyaan' },
  { key: 'b', name: 'Kleur van je maatje' },
  { key: 's', name: 'Schaduw van je maatje' },
  { key: 'a', name: 'Accent van je maatje' },
];

/** Turns a creation into an accessory. Hats lose empty rows at the bottom so they rest on the head. */
export function toAccessory(c: Creation): Accessory {
  const rows = [...c.rows];
  if (c.slot === 'hoed') while (rows.length > 1 && !/[^.]/.test(rows[rows.length - 1])) rows.pop();
  return {
    name: c.name,
    hat: c.slot === 'hoed',
    face: c.slot === 'gezicht',
    hand: c.slot === 'hand',
    centered: c.slot === 'hoed',
    noOutline: !c.outline,
    rows,
  };
}

/** True when nothing has been drawn yet. */
export function isEmpty(rows: string[]): boolean {
  return rows.every((r) => !/[^.]/.test(r));
}
