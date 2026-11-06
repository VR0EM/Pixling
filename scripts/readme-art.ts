// Draws the pictures in the README with the sprite engine itself: an animated banner and three strips of
// buddies with captions. Usage: node scripts/readme-art.ts (writes to docs/)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parsePixling, TEMPLATE } from '../src/sprites/format.ts';
import { render, setCreations, type Creation, type RenderOptions } from '../src/sprites/index.ts';
import { encodeGif } from './gif.ts';
import { Canvas } from './png.ts';

const INK = '#2b2a40';
const PAPER = '#fbf6ec';
const CARD = '#fffdf8';
const GOLD = '#ffd54f';

// A 5×7 pixel font, capitals only.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
};

/** Width of a text in pixels at this scale (each letter is 5 wide plus 1 space). */
const textWidth = (text: string, k: number) => text.length * 6 * k - k;

function text(c: Canvas, s: string, x: number, y: number, k: number, colour: string): void {
  [...s.toUpperCase()].forEach((ch, i) => {
    (FONT[ch] ?? FONT[' ']).forEach((row, ry) =>
      [...row].forEach((p, rx) => {
        if (p === '#') c.fill(x + (i * 6 + rx) * k, y + ry * k, k, k, colour);
      }),
    );
  });
}

function centredText(c: Canvas, s: string, y: number, k: number, colour: string, shadow?: string): void {
  const x = Math.round((c.width - textWidth(s, k)) / 2);
  if (shadow) text(c, s, x + k, y + k, k, shadow);
  text(c, s, x, y, k, colour);
}

/** A soft shadow on the ground under a buddy. */
function shadow(c: Canvas, cx: number, y: number, w: number, colour: string): void {
  c.fill(Math.round(cx - w / 2), y, Math.round(w), 4, colour);
  c.fill(Math.round(cx - w / 2 + 6), y + 4, Math.round(w - 12), 3, colour);
}

// Home-made buddies and accessories: the studio's template and the example files.
const custom: Creation[] = [TEMPLATE];
for (const file of readdirSync('examples').filter((f) => f.endsWith('.pixling.json'))) {
  const result = parsePixling(readFileSync(`examples/${file}`, 'utf8'), () => file.replace('.pixling.json', ''));
  if (result.ok) custom.push(...result.creations);
}
setCreations(custom);

// --- The banner: the six buddies, alive.
const W = 820;
const H = 300;
const GROUND = 268;
const ab = (f: number) => (Math.floor(f / 3) % 2 ? 'B' : 'A') as 'A' | 'B';
const frames: Canvas[] = [];
for (let f = 0; f < 12; f++) {
  const c = new Canvas(W, H);
  c.fill(0, 0, W, 90, '#d6ecff');
  c.fill(0, 90, W, 90, '#e3f2ff');
  c.fill(0, 180, W, GROUND - 180, '#eef8ff');
  c.fill(0, GROUND, W, 4, '#9dd07e');
  c.fill(0, GROUND + 4, W, H - GROUND - 4, '#7cc65a');
  centredText(c, 'Pixling', 24, 7, INK, GOLD);
  centredText(c, 'A little pixel buddy that lives on your desktop', 98, 2, INK);
  const wave = Math.sin((f / 12) * Math.PI * 2);
  const cast: [string, RenderOptions, number][] = [
    ['robot', { frame: ab(f), tick: f % 4, blink: f === 7 }, 0],
    ['ghost', { frame: ab(f + 1), blink: f === 3 }, Math.round((1 + wave) * 4)],
    ['sprout', { frame: ab(f), growth: 3 }, 0],
    ['shroom', { frame: ab(f + 1), blink: f === 10 }, 0],
    ['mug', { frame: ab(f), tick: f % 4 }, 0],
    ['dragon', { fly: f % 2 }, 22 + Math.round(wave * 5)],
  ];
  cast.forEach(([id, o, lift], i) => {
    const x = 18 + i * 132;
    if (lift) shadow(c, x + 64, GROUND - 2, 56 - lift, '#6dab5c');
    c.drawPixels(render(id, o).pixels, x, GROUND - 30 * 4 - lift, 4);
  });
  frames.push(c);
}
writeFileSync('docs/banner.gif', encodeGif(frames, 160));

// --- Strips: six buddies, each with a caption.
function strip(file: string, cells: [string, RenderOptions, string][]): void {
  const c = new Canvas(W, 196);
  c.fill(0, 0, W, 196, PAPER);
  cells.forEach(([id, o, caption], i) => {
    const x = 8 + i * 136;
    c.fill(x, 8, 128, 180, INK);
    c.fill(x + 3, 11, 122, 174, CARD);
    c.drawPixels(render(id, o).pixels, x, 14, 4);
    text(c, caption, x + Math.round((128 - textWidth(caption, 2)) / 2), 162, 2, INK);
  });
  writeFileSync(file, c.toPng());
}

strip('docs/personalities.png', [
  ['robot', { charging: true, charge: 0.45, tick: 1 }, 'Charges'],
  ['mug', { fill: 0 }, 'Refills'],
  ['dragon', { fly: 0 }, 'Flies'],
  ['ghost', { fade: 2 }, 'Vanishes'],
  ['sprout', { growth: 3 }, 'Blooms'],
  ['shroom', { glow: true }, 'Glows'],
]);
strip('docs/along.png', [
  ['robot', { item: 'laptop', tick: 3 }, 'Codes'],
  ['ghost', { item: 'headphones' }, 'Listens'],
  ['mug', { item: 'umbrella' }, 'Rain'],
  ['dragon', { item: 'cake', accessory: 'partyhat' }, 'Birthdays'],
  ['sprout', { item: 'calendar' }, 'Meetings'],
  ['shroom', { accessory: 'santahat' }, 'Holidays'],
]);
strip('docs/custom.png', [
  ['template', {}, 'Blob'],
  ['cactus', {}, 'Cactus'],
  ['cactus', { accessory: 'top-hat' }, 'Top hat'],
  ['robot', { accessory: 'heart-glasses' }, 'Hearts'],
  ['ghost', { accessory: 'top-hat' }, 'Fancy'],
  ['template', { palette: 'red', accessory: 'heart-glasses' }, 'Recolour'],
]);
console.log('wrote docs/banner.gif, docs/personalities.png, docs/along.png and docs/custom.png');
