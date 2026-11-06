/** One pixel: a palette key (a single character) or null for transparent. */
export type Cell = string | null;

/** A 32×32 drawing surface of palette keys. */
export type Grid = Cell[][];

/** A layer and the outline key it gets (null = no outline). Layers are painted back to front. */
export type Layer = [Grid, string | null];

/**
 * A palette maps the shared keys to colours:
 * o = outline, b = body, s = shade, h = highlight, a = accent, c = cheeks/nose, e = eyes (optional override).
 */
export interface Palette {
  name: string;
  o: string;
  b: string;
  s: string;
  h: string;
  a: string;
  c: string;
  e?: string;
}

/**
 * A version of an accessory or item drawn especially for one species, because the general one doesn't fit
 * its shape (headphones around a mushroom cap, shades on a robot's screen).
 */
export interface Variant {
  rows: string[];
  /** Top-left corner in sprite pixels; head and face things move along when the species bobs. */
  at: [number, number];
  slot?: 'head' | 'face' | 'hand';
  outline?: boolean;
}

export interface Accessory {
  name: string;
  /** Sits on top of the head and hides things like antennas. */
  hat?: boolean;
  /** Sits on the face, anchored at the eyes. */
  face?: boolean;
  noOutline?: boolean;
  /** Not offered in the menu; the buddy puts it on by itself (a nightcap at night). */
  hidden?: boolean;
  /** Held at the side, like the items from the backpack. */
  hand?: boolean;
  /** Centred on the head instead of starting at the 6-wide hat anchor (for home-made hats). */
  centered?: boolean;
  /** Species-specific versions, by species id; null leaves it off that species. */
  variants?: Record<string, Variant | null>;
  rows: string[];
}

export interface RenderOptions {
  /** Palette id; leave out (or 'eigen') for the species' own colours. */
  palette?: string;
  /** Accessory id; leave out (or 'geen') for none. */
  accessory?: string;
  /** Breathing frame: B is the "exhale" pose. */
  frame?: 'A' | 'B';
  /** Slow counter for secondary motion (tails, wings, antenna light). */
  tick?: number;
  blink?: boolean;
  /** Where the face looks: -1 left, 0 ahead, 1 right. */
  faceDx?: number;
  /** Walking phase 0–3: 0 lifts the left foot, 2 the right one. */
  walk?: number;
  flip?: boolean;
  /** Item id from items.ts, picked up because of the app in front. */
  item?: string;
}

/** What a species hands back to the renderer. */
export interface Built {
  layers: Layer[];
  /** Hat anchor: left x of a 6-wide hat and the row its bottom sits on. */
  hat: [number, number];
  /** Glasses anchor: top-left of the 12-wide glasses. */
  glasses: [number, number];
  /** Where a held item's top-left goes, if the default spot doesn't suit this species. */
  hand?: [number, number];
  /** How far the head moved down in this frame (breathing); variants follow it. */
  bob?: number;
}

export interface Species {
  id: string;
  name: string;
  /** Default palette id. */
  palette: string;
  /** Floats instead of standing (no feet, smaller shadow). */
  floats?: boolean;
  build(o: RenderOptions, accessory: Accessory | null): Built;
}

/** A rendered sprite: colours per pixel plus the bounding box of the visible pixels. */
export interface Sprite {
  pixels: (string | null)[][];
  box: { x0: number; y0: number; x1: number; y1: number };
}
