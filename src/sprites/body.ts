import { grid, set, stamp, H, W } from './grid.ts';
import type { Grid } from './types.ts';

/** The rounded bodies of the robot and the ghost are drawn from a formula instead of by hand. */
export type BodyShape = 'robot' | 'spook';

export interface FrameParams {
  cy: number;
  ryTop: number;
  ryBottom: number;
  /** How far the face and anything on the head moves down (the ghost floats up instead). */
  d: number;
}

export function frameParams(shape: BodyShape, frame: 'A' | 'B' = 'A'): FrameParams {
  if (shape === 'spook') {
    return frame === 'B' ? { cy: 18.5, ryTop: 8.5, ryBottom: 7.5, d: -1 } : { cy: 19.5, ryTop: 8.5, ryBottom: 7.5, d: 0 };
  }
  return frame === 'B' ? { cy: 20, ryTop: 8, ryBottom: 7, d: 1 } : { cy: 19.5, ryTop: 8.5, ryBottom: 7.5, d: 0 };
}

/** Superellipse test: p = 2 is an ellipse, higher p gets squarer. */
function inside(x: number, y: number, f: FrameParams, p: number): boolean {
  const dx = (x + 0.5 - 16) / 9;
  const yy = y + 0.5 - f.cy;
  const dy = yy / (yy < 0 ? f.ryTop : f.ryBottom);
  return Math.abs(dx) ** p + Math.abs(dy) ** p <= 1;
}

export function bodyMask(shape: BodyShape, f: FrameParams, tick: number): Grid {
  const m = grid();
  const p = shape === 'robot' ? 5 : 2.6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let fill: boolean;
      if (shape === 'spook') {
        const yy = y + 0.5 - f.cy;
        fill = yy < 0 ? inside(x, y, f, p) : x >= 7 && x <= 24 && y <= 26 + f.d;
      } else {
        fill = inside(x, y, f, p);
      }
      if (fill) m[y][x] = 'b';
    }
  }
  if (shape === 'spook') {
    // The wavy hem ripples between two positions.
    const base = 27 + f.d;
    const hem = tick % 2 ? [[7, 8], [11, 14], [17, 20], [23, 24]] : [[8, 11], [14, 17], [20, 23]];
    const tips = tick % 2 ? [[7, 7], [12, 13], [18, 19], [24, 24]] : [[9, 10], [15, 16], [21, 22]];
    for (const [a, b] of hem) for (let x = a; x <= b; x++) set(m, x, base, 'b');
    for (const [a, b] of tips) for (let x = a; x <= b; x++) set(m, x, base + 1, 'b');
  }
  // Light comes from the top left: pixels with nothing two below and one to the right are in shade.
  const shaded: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!m[y][x]) continue;
      const below = y + 2 < H && x + 1 < W ? m[y + 2][x + 1] : null;
      if (!below) shaded.push([x, y]);
    }
  }
  for (const [x, y] of shaded) m[y][x] = 's';
  const shine = shape === 'robot' ? [[9, 12], [10, 12], [11, 12], [8, 13]] : [[10, 13], [11, 13], [9, 14]];
  for (const [x, y] of shine) {
    const yy = y + f.d;
    if (m[yy]?.[x]) m[yy][x] = 'h';
  }
  return m;
}

/** Two feet; walking phase 0 lifts the left one, phase 2 the right one. */
export function feetMask(walk?: number): Grid {
  const m = grid();
  stamp(m, 9, walk === 0 ? 26 : 27, ['bbbb', 'ssss']);
  stamp(m, 19, walk === 2 ? 26 : 27, ['bbbb', 'ssss']);
  return m;
}
