import { FIXED } from './palettes.ts';

/** Little icons that float above the buddy's head instead of text. */
export type Emote = 'heart' | 'exclaim' | 'question' | 'zzz' | 'note' | 'sweat' | 'spores' | 'bolt' | 'drop' | 'puff';

const MAPS: Record<Emote, string[]> = {
  heart: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'],
  exclaim: ['yy', 'yy', 'yy', 'yy', '..', 'yy'],
  question: ['.www.', 'w...w', '...w.', '..w..', '.....', '..w..'],
  zzz: ['wwww', '..w.', '.w..', 'wwww'],
  note: ['..ww', '..ww', '..w.', 'www.', 'ww..'],
  sweat: ['.t..', '.tt.', 'tttt', 'tttt', '.tt.'],
  spores: ['y...y', '..y..', 'y.y.y', '.y...'],
  bolt: ['..yy', '.yy.', 'yyyy', '.yy.', 'yy..'],
  drop: ['..t..', '.ttt.', 'ttttt', 'ttwtt', '.ttt.'],
  puff: ['.XX.', 'XXXX', 'XXXX', '.XX.'],
};

const cache = new Map<Emote, (string | null)[][]>();

/** Returns the emote as colours with a dark outline around it (one pixel of padding on every side). */
export function emotePixels(e: Emote): (string | null)[][] {
  const hit = cache.get(e);
  if (hit) return hit;
  const map = MAPS[e];
  const h = map.length + 2;
  const w = Math.max(...map.map((r) => r.length)) + 2;
  const filled = (x: number, y: number) => {
    const row = map[y - 1];
    const k = row?.[x - 1];
    return k !== undefined && k !== '.';
  };
  const out: (string | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < w; x++) {
      if (filled(x, y)) row.push(FIXED[map[y - 1][x - 1]]);
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) row.push(FIXED.z);
      else row.push(null);
    }
    out.push(row);
  }
  cache.set(e, out);
  return out;
}
