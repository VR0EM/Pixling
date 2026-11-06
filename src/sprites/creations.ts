import type { Accessory } from './types.ts';

/** What a home-made creation is: something to wear or hold, or a whole buddy. */
export type Slot = 'hat' | 'face' | 'hand' | 'buddy';

/** The layers of a home-made buddy, each a 32×32 map (shorter rows and fewer rows are fine). */
export interface BuddyLayers {
  /** Behind everything: wings, a tail, ears. Moves with the breathing. */
  back?: string[];
  /** On top of the head, hidden when the buddy wears a hat: an antenna, a tuft, steam. */
  top?: string[];
  /** The main shape. Required. */
  body: string[];
  /** Feet or legs; they don't move with the breathing and lift one by one while walking. */
  feet?: string[];
  /** Eyes ('e'), mouth, cheeks. No outline; it follows the cursor and the eyes blink by themselves. */
  face?: string[];
}

export interface Anchors {
  /** Left x of a 6-wide hat and the row its bottom rests on. */
  hat?: [number, number];
  /** Top-left of 12-wide glasses. */
  glasses?: [number, number];
  /** Top-left of something held, like a glass of water. */
  hand?: [number, number];
}

/** A creation from the studio or a shared file, as stored in creations.json. */
export interface Creation {
  id: string;
  name: string;
  slot: Slot;
  author?: string;
  /** Gets a one-pixel outline like the built-in art. */
  outline: boolean;
  /** Pixel rows of an accessory; '.' is transparent, other characters are colour keys. Empty for buddies. */
  rows: string[];
  /** Extra colours by key, and for buddies their own body colours (b, s, h, a, c, o, e). */
  colors?: Record<string, string>;
  layers?: BuddyLayers;
  anchors?: Anchors;
  /** A buddy without feet that hovers, like the ghost. */
  floats?: boolean;
}

/** Drawing area per slot in the studio, in sprite pixels. */
export const SLOT_SIZE: Record<Slot, { w: number; h: number }> = {
  hat: { w: 12, h: 10 },
  face: { w: 12, h: 4 },
  hand: { w: 8, h: 8 },
  buddy: { w: 32, h: 32 },
};

/** The biggest size a shared file may use per slot. */
export const SLOT_MAX: Record<Slot, { w: number; h: number }> = {
  hat: { w: 16, h: 12 },
  face: { w: 16, h: 6 },
  hand: { w: 12, h: 12 },
  buddy: { w: 32, h: 32 },
};

export const SLOT_NAMES: Record<Slot, string> = {
  buddy: 'Buddy',
  hat: 'Hat',
  face: 'On the face',
  hand: 'To hold',
};

export const LAYER_NAMES: Record<keyof BuddyLayers, string> = {
  body: 'Body',
  feet: 'Feet',
  face: 'Face',
  top: 'Top',
  back: 'Back',
};

/** Keys that follow the buddy's colours: its own colours, or the palette picked in the wardrobe. */
export const BUDDY_KEYS = ['b', 's', 'h', 'a', 'c', 'o', 'e'] as const;

/** Colours you can paint with: the fixed ones, plus the ones that follow the buddy's palette. */
export const PAINTS: { key: string; name: string }[] = [
  { key: 'b', name: 'Your buddy’s colour' },
  { key: 's', name: 'Your buddy’s shade' },
  { key: 'h', name: 'Your buddy’s highlight' },
  { key: 'a', name: 'Your buddy’s accent' },
  { key: 'c', name: 'Your buddy’s cheeks' },
  { key: 'o', name: 'Your buddy’s outline' },
  { key: 'e', name: 'Eyes' },
  { key: 'n', name: 'Black' },
  { key: 'w', name: 'White' },
  { key: 'r', name: 'Red' },
  { key: 'R', name: 'Dark red' },
  { key: 'm', name: 'Pink' },
  { key: 'y', name: 'Gold' },
  { key: 'Y', name: 'Dark gold' },
  { key: 'k', name: 'Brown' },
  { key: 'g', name: 'Green' },
  { key: 'G', name: 'Dark green' },
  { key: 't', name: 'Light blue' },
  { key: 'u', name: 'Indigo' },
  { key: 'q', name: 'Cyan' },
  { key: 'X', name: 'Light grey' },
  { key: 'N', name: 'Dark grey' },
];

/** Turns an accessory creation into an accessory. Hats lose empty rows at the bottom so they rest on the head. */
export function toAccessory(c: Creation): Accessory {
  const rows = [...c.rows];
  if (c.slot === 'hat') while (rows.length > 1 && !/[^.]/.test(rows[rows.length - 1])) rows.pop();
  return {
    name: c.name,
    hat: c.slot === 'hat',
    face: c.slot === 'face',
    hand: c.slot === 'hand',
    centered: c.slot === 'hat' || c.slot === 'face',
    noOutline: !c.outline,
    rows,
  };
}

/** True when nothing has been drawn yet. */
export function isEmpty(rows: string[]): boolean {
  return rows.every((r) => !/[^.]/.test(r));
}
