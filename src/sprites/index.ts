import { ACCESSORIES } from './accessories.ts';
import { toSpecies } from './buddy.ts';
import { BUDDY_KEYS, toAccessory, type BuddyLayers, type Creation } from './creations.ts';
import { grid, paint, stamp, H, W } from './grid.ts';
import { ITEMS, itemAnchor } from './items.ts';
import { FIXED, PALETTES } from './palettes.ts';
import { dragon } from './species/dragon.ts';
import { ghost } from './species/ghost.ts';
import { mug } from './species/mug.ts';
import { robot } from './species/robot.ts';
import { shroom } from './species/shroom.ts';
import { sprout } from './species/sprout.ts';
import type { Accessory, Built, Palette, RenderOptions, Species, Sprite, Variant } from './types.ts';
import type { Item } from './items.ts';

export { ACCESSORIES, ITEMS, PALETTES };
export type { Creation } from './creations.ts';
export type { RenderOptions, Species, Sprite };

/** Home-made accessories, by id. */
const CUSTOM: Record<string, Accessory> = {};
/** Home-made buddies, by id. */
const CUSTOM_SPECIES = new Map<string, Species>();
/** Colours brought by home-made things. Each gets a private key of its own, so two files never clash. */
const CUSTOM_COLOURS: Record<string, string> = {};
/** The own colours of home-made buddies, by palette id. */
const OWN_PALETTES: Record<string, Palette> = {};

/** Replaces the home-made accessories and buddies (after the studio saved, or a file was added). */
export function setCreations(list: Creation[]): void {
  for (const id of Object.keys(CUSTOM)) delete CUSTOM[id];
  for (const id of Object.keys(CUSTOM_COLOURS)) delete CUSTOM_COLOURS[id];
  for (const id of Object.keys(OWN_PALETTES)) delete OWN_PALETTES[id];
  CUSTOM_SPECIES.clear();
  let next = 0xe000; // Unicode private use area
  for (const c of list) {
    const buddy = c.slot === 'buddy';
    const keys: Record<string, string> = {};
    const own: Partial<Palette> = {};
    for (const [key, colour] of Object.entries(c.colors ?? {})) {
      if (buddy && (BUDDY_KEYS as readonly string[]).includes(key)) {
        (own as Record<string, string>)[key] = colour;
        continue;
      }
      keys[key] = String.fromCharCode(next++);
      CUSTOM_COLOURS[keys[key]] = colour;
    }
    const remap = (rows: string[] | undefined) => rows?.map((row) => [...row].map((k) => keys[k] ?? k).join(''));
    if (buddy) {
      const paletteId = `own:${c.id}`;
      OWN_PALETTES[paletteId] = { ...PALETTES.sky, ...own, name: c.name };
      const layers = Object.fromEntries(
        Object.entries(c.layers ?? { body: [] }).map(([name, rows]) => [name, remap(rows as string[])]),
      ) as unknown as BuddyLayers;
      CUSTOM_SPECIES.set(c.id, toSpecies({ ...c, layers }, paletteId));
    } else {
      CUSTOM[c.id] = toAccessory({ ...c, rows: remap(c.rows) ?? [] });
    }
  }
  cache.clear();
}

export function accessory(id: string | undefined): Accessory | null {
  return ACCESSORIES[id ?? ''] ?? CUSTOM[id ?? ''] ?? null;
}

/** The built-in buddies. */
export const SPECIES: Species[] = [robot, ghost, sprout, shroom, mug, dragon];

const byId = new Map(SPECIES.map((s) => [s.id, s]));

export function species(id: string): Species {
  return byId.get(id) ?? CUSTOM_SPECIES.get(id) ?? robot;
}

/** Built-in and home-made buddies. */
export function allSpecies(): Species[] {
  return [...SPECIES, ...CUSTOM_SPECIES.values()];
}

/** A buddy's own colours: its default palette, or the colours a home-made buddy brought. */
export function ownPalette(speciesId: string): Palette {
  const sp = species(speciesId);
  return OWN_PALETTES[sp.palette] ?? PALETTES[sp.palette] ?? PALETTES.sky;
}

/** Every colour key a buddy can use, for a palette id from the wardrobe ('default' or none for its own). */
export function colours(speciesId: string, paletteId?: string): Record<string, string> {
  const chosen = PALETTES[paletteId ?? ''] ?? ownPalette(speciesId);
  return { ...FIXED, ...CUSTOM_COLOURS, ...(chosen as unknown as Record<string, string>) };
}

/** The ids and names of everything a buddy can look like; the tray menu is built from this. */
export function catalog() {
  return {
    species: allSpecies().map((s) => ({ id: s.id, name: s.name })),
    palettes: [{ id: 'default', name: 'Own colours' }, ...Object.entries(PALETTES).map(([id, p]) => ({ id, name: p.name }))],
    accessories: [
      { id: 'none', name: 'None' },
      ...Object.entries({ ...ACCESSORIES, ...CUSTOM })
        .filter(([, a]) => !a.hidden)
        .map(([id, a]) => ({ id, name: a.name })),
    ],
  };
}

/** Something to stamp on top of the buddy, with its spot already worked out. */
interface Placed {
  rows: string[];
  x: number;
  y: number;
  outline: boolean;
  slot: 'head' | 'face' | 'hand';
}

/** A species' own version; head and face things move along with the breathing. */
function fromVariant(v: Variant, rows: string[], slot: Placed['slot'], outline: boolean, bob: number): Placed {
  const s = v.slot ?? slot;
  const y = v.at[1] + (s === 'hand' ? 0 : bob);
  return { rows: v.rows ?? rows, x: v.at[0], y, outline: v.outline ?? outline, slot: s };
}

function placeItem(item: Item, id: string, built: Built, bob: number, tick: number): Placed | null {
  const rows = item.frames ? item.frames[tick % item.frames.length] : item.rows;
  const v = item.variants?.[id];
  if (v === null) return null;
  if (v) return fromVariant(v, rows, item.slot, item.outline, bob);
  const [x, y] = itemAnchor(item, built);
  return { rows, x, y, outline: item.outline, slot: item.slot };
}

function placeAccessory(acc: Accessory, id: string, built: Built, bob: number): Placed | null {
  const slot = acc.face ? 'face' : acc.hand ? 'hand' : 'head';
  const outline = !acc.noOutline;
  const v = acc.variants?.[id];
  if (v === null) return null;
  if (v) return fromVariant(v, acc.rows, slot, outline, bob);
  let x: number;
  let y: number;
  if (slot === 'face') {
    // Centred on the 12-wide glasses spot, so wider or narrower home-made glasses fit too.
    const width = Math.max(...acc.rows.map((r) => r.length));
    [x, y] = built.glasses;
    if (acc.centered) x += 6 - Math.round(width / 2);
  }
  else if (slot === 'hand') [x, y] = built.hand ?? [23, 19];
  else {
    const width = Math.max(...acc.rows.map((r) => r.length));
    x = acc.centered ? built.hat[0] + 3 - Math.round(width / 2) : built.hat[0];
    // A tall hat on a tall buddy sinks into the head rather than falling off the top of the sprite.
    y = Math.max(0, built.hat[1] - acc.rows.length + 1);
  }
  return { rows: acc.rows, x, y, outline, slot };
}

const cache = new Map<string, Sprite>();

/** Renders a species to colours. Results are cached, so calling this every frame is cheap. */
export function render(speciesId: string, o: RenderOptions = {}): Sprite {
  const key = speciesId + JSON.stringify(o);
  const cached = cache.get(key);
  if (cached) return cached;

  const sp = species(speciesId);
  const palette = colours(speciesId, o.palette);
  const acc = accessory(o.accessory);
  const item = ITEMS[o.item ?? ''] ?? null;
  // Some things catch the buddy's eye, like the screen of its laptop.
  const variant = item?.variants?.[sp.id];
  const gaze = variant === null ? undefined : (variant?.gaze ?? item?.gaze);
  const built = sp.build(gaze !== undefined && o.walk === undefined ? { ...o, faceDx: gaze } : o, acc);

  const out = grid();
  for (const [layer, outline] of built.layers) paint(out, layer, outline);
  const draw = (p: Placed | null) => {
    if (!p) return;
    const layer = grid();
    stamp(layer, p.x, p.y, p.rows);
    paint(out, layer, p.outline ? 'o' : null);
  };
  const bob = built.bob ?? 0;
  const held = item ? placeItem(item, sp.id, built, bob, o.tick ?? 0) : null;
  const worn = acc ? placeAccessory(acc, sp.id, built, bob) : null;
  // Headphones go under a hat; glasses only when the buddy isn't already wearing something on its face.
  if (held?.slot === 'head') draw(held);
  draw(worn);
  if (held?.slot === 'face' && worn?.slot !== 'face') draw(held);
  if (held?.slot === 'hand') draw(held);

  const pixels: (string | null)[][] = [];
  const box = { x0: W, y0: H, x1: -1, y1: -1 };
  for (let y = 0; y < H; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < W; x++) {
      const k = out[y][o.flip ? W - 1 - x : x];
      const colour = k ? (palette as Record<string, string | undefined>)[k] ?? '#ff00ff' : null;
      row.push(colour);
      if (colour) {
        box.x0 = Math.min(box.x0, x);
        box.y0 = Math.min(box.y0, y);
        box.x1 = Math.max(box.x1, x);
        box.y1 = Math.max(box.y1, y);
      }
    }
    pixels.push(row);
  }

  const sprite: Sprite = { pixels, box };
  if (cache.size > 4000) cache.clear();
  cache.set(key, sprite);
  return sprite;
}
