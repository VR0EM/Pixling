import type { Cell, Grid } from './types.ts';

export const W = 32;
export const H = 32;

export function grid(): Grid {
  const g: Grid = [];
  for (let y = 0; y < H; y++) g.push(new Array<Cell>(W).fill(null));
  return g;
}

export function set(g: Grid, x: number, y: number, key: string): void {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = key;
}

/** Copies a pixel map into the grid. '.' is transparent, any other character is a palette key. */
export function stamp(g: Grid, x0: number, y0: number, rows: readonly string[]): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const key = row[i];
      if (key !== '.') set(g, x0 + i, y0 + j, key);
    }
  });
}

/** Stamps a map on the left and its mirror image on the right (the mirror axis runs between x 15 and 16). */
export function stampPair(g: Grid, x0: number, y0: number, rows: readonly string[]): void {
  stamp(g, x0, y0, rows);
  const width = Math.max(...rows.map((r) => r.length));
  const mirrored = rows.map((r) => r.padEnd(width, '.').split('').reverse().join(''));
  stamp(g, W - x0 - width, y0, mirrored);
}

/** Paints a layer onto `out`, first giving it a one-pixel outline (4-neighbourhood) in `outlineKey`. */
export function paint(out: Grid, layer: Grid, outlineKey: string | null): void {
  if (outlineKey) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (layer[y][x]) continue;
        const touches =
          (y > 0 && layer[y - 1][x]) ||
          (y < H - 1 && layer[y + 1][x]) ||
          (x > 0 && layer[y][x - 1]) ||
          (x < W - 1 && layer[y][x + 1]);
        if (touches) out[y][x] = outlineKey;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const key = layer[y][x];
      if (key) out[y][x] = key;
    }
  }
}
