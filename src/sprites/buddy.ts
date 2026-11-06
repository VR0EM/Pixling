import type { Anchors, BuddyLayers, Creation } from './creations.ts';
import { grid, set, H, W } from './grid.ts';
import type { Grid, Layer, Species } from './types.ts';

/** The sprite row the feet stand on; a home-made buddy is moved up or down to land on it. */
const GROUND = 28;

function toGrid(rows: string[] | undefined): Grid {
  const g = grid();
  rows?.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.' && row[x] !== ' ') set(g, x, y, row[x]);
  });
  return g;
}

function shifted(g: Grid, dx: number, dy: number, keep: (x: number, y: number) => boolean = () => true): Grid {
  const out = grid();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] && keep(x, y)) set(out, x + dx, y + dy, g[y][x]!);
  return out;
}

function rowsWithPixels(g: Grid): number[] {
  return g.flatMap((row, y) => (row.some(Boolean) ? [y] : []));
}

/** Eyes close by dropping every eye pixel (and the glint above it) that has an eye pixel right below it. */
function blinked(face: Grid): Grid {
  const out = grid();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = face[y][x];
      if (!k) continue;
      const eyeBelow = face[y + 1]?.[x] === 'e';
      if ((k === 'e' || k === 'w') && eyeBelow) continue;
      set(out, x, y, k);
    }
  }
  return out;
}

/** Where hats, glasses and held things go, worked out from the drawing unless the file says so. */
function anchorsFor(layers: Record<keyof BuddyLayers, Grid>, outline: boolean, given: Anchors = {}): Required<Omit<Anchors, 'hand'>> & Anchors {
  const body = layers.body;
  const top = rowsWithPixels(body)[0] ?? 12;
  const xs = body[top].flatMap((k, x) => (k ? [x] : []));
  const middle = xs.length ? Math.round((xs[0] + xs[xs.length - 1] + 1) / 2) : 16;
  const hat: [number, number] = [middle - 3, outline ? top - 1 : top];

  const eyes: [number, number][] = [];
  layers.face.forEach((row, y) => row.forEach((k, x) => k === 'e' && eyes.push([x, y])));
  let glasses: [number, number] = [middle - 6, top + 6];
  if (eyes.length) {
    const ex = eyes.map(([x]) => x);
    const ey = Math.min(...eyes.map(([, y]) => y));
    glasses = [Math.round((Math.min(...ex) + Math.max(...ex) + 1) / 2) - 6, ey];
  }
  return { hat: given.hat ?? hat, glasses: given.glasses ?? glasses, hand: given.hand };
}

/**
 * Turns a home-made buddy into a species. The drawing is one still pose; the animation comes from the
 * layers: the body breathes a pixel down (a floating buddy bobs up), the feet take turns lifting while
 * walking, the face follows the cursor and the eyes blink.
 */
export function toSpecies(c: Creation, palette: string): Species {
  const raw = c.layers ?? { body: [] };
  const names: (keyof BuddyLayers)[] = ['back', 'top', 'body', 'feet', 'face'];
  const loaded = Object.fromEntries(names.map((n) => [n, toGrid(raw[n])])) as Record<keyof BuddyLayers, Grid>;

  // Stand on the ground, wherever it was drawn.
  const used = names.filter((n) => n !== 'face').flatMap((n) => rowsWithPixels(loaded[n]));
  const bottom = used.length ? Math.max(...used) : GROUND;
  const dy = Math.max(-Math.min(...(used.length ? used : [0])), GROUND - bottom);
  const layers = Object.fromEntries(names.map((n) => [n, shifted(loaded[n], 0, dy)])) as Record<keyof BuddyLayers, Grid>;
  const given: Anchors = {};
  for (const key of ['hat', 'glasses', 'hand'] as const) {
    const a = c.anchors?.[key];
    if (a) given[key] = [a[0], a[1] + dy];
  }
  const anchors = anchorsFor(layers, c.outline, given);
  const outline = c.outline ? 'o' : null;

  return {
    id: c.id,
    name: c.name,
    palette,
    floats: c.floats,
    build(o, accessory) {
      const d = o.frame === 'B' ? (c.floats ? -1 : 1) : 0;
      const fx = o.faceDx ?? 0;
      const lifted = (x: number) => (o.walk === 0 && x < 16) || (o.walk === 2 && x >= 16);
      const feet = grid();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const k = layers.feet[y][x];
          if (k) set(feet, x, lifted(x) ? y - 1 : y, k);
        }
      }
      const face = shifted(o.blink ? blinked(layers.face) : layers.face, fx, d);
      const out: Layer[] = [[shifted(layers.back, 0, d), outline]];
      if (!accessory?.hat) out.push([shifted(layers.top, 0, d), outline]);
      out.push([feet, outline], [shifted(layers.body, 0, d), outline], [face, null]);
      return {
        layers: out,
        hat: [anchors.hat[0], anchors.hat[1] + d],
        glasses: [anchors.glasses[0] + fx, anchors.glasses[1] + d],
        hand: anchors.hand,
        bob: d,
      };
    },
  };
}
