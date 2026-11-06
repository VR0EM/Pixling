import { ACCESSORIES } from './accessories.ts';
import { grid, paint, stamp, H, W } from './grid.ts';
import { ITEMS, itemAnchor } from './items.ts';
import { FIXED, PALETTES } from './palettes.ts';
import { boontje } from './species/boontje.ts';
import { draakje } from './species/draakje.ts';
import { kat } from './species/kat.ts';
import { konijn } from './species/konijn.ts';
import { robotje } from './species/robotje.ts';
import { spookje } from './species/spookje.ts';
import type { RenderOptions, Species, Sprite } from './types.ts';

export { ACCESSORIES, ITEMS, PALETTES };
export type { RenderOptions, Species, Sprite };

export const SPECIES: Species[] = [robotje, spookje, boontje, kat, konijn, draakje];

const byId = new Map(SPECIES.map((s) => [s.id, s]));

export function species(id: string): Species {
  return byId.get(id) ?? robotje;
}

/** The ids and Dutch names of everything a buddy can look like; the tray menu is built from this. */
export function catalog() {
  return {
    species: SPECIES.map((s) => ({ id: s.id, name: s.name })),
    palettes: [{ id: 'eigen', name: 'Eigen kleur' }, ...Object.entries(PALETTES).map(([id, p]) => ({ id, name: p.name }))],
    accessories: [
      { id: 'geen', name: 'Geen' },
      ...Object.entries(ACCESSORIES)
        .filter(([, a]) => !a.hidden)
        .map(([id, a]) => ({ id, name: a.name })),
    ],
  };
}

const cache = new Map<string, Sprite>();

/** Renders a species to colours. Results are cached, so calling this every frame is cheap. */
export function render(speciesId: string, o: RenderOptions = {}): Sprite {
  const key = speciesId + JSON.stringify(o);
  const cached = cache.get(key);
  if (cached) return cached;

  const sp = species(speciesId);
  const palette = { ...FIXED, ...(PALETTES[o.palette ?? ''] ?? PALETTES[sp.palette]) };
  const accessory = ACCESSORIES[o.accessory ?? ''] ?? null;
  const item = ITEMS[o.item ?? ''] ?? null;
  const built = sp.build(o, accessory);

  const out = grid();
  for (const [layer, outline] of built.layers) paint(out, layer, outline);
  const drawItem = () => {
    if (!item) return;
    const layer = grid();
    const [x, y] = itemAnchor(item, built);
    stamp(layer, x, y, item.rows);
    paint(out, layer, item.outline ? 'o' : null);
  };
  // Headphones go under a hat; glasses only when the buddy isn't already wearing something on its face.
  if (item?.slot === 'head') drawItem();
  if (accessory) {
    const layer = grid();
    if (accessory.face) stamp(layer, built.glasses[0], built.glasses[1], accessory.rows);
    else stamp(layer, built.hat[0], built.hat[1] - accessory.rows.length + 1, accessory.rows);
    paint(out, layer, accessory.noOutline ? null : 'o');
  }
  if (item?.slot === 'face' && !accessory?.face) drawItem();
  if (item?.slot === 'hand') drawItem();

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
