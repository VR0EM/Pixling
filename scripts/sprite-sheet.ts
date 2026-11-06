// Renders every buddy in a few poses to a PNG, so the pixel art can be checked without starting the app.
// Usage: node scripts/sprite-sheet.ts <out.png> [scale]
import { writeFileSync } from 'node:fs';
import { PALETTES, SPECIES, render, type RenderOptions } from '../src/sprites/index.ts';
import { Canvas } from './png.ts';

const out = process.argv[2] ?? 'docs/sprites.png';
const scale = Number(process.argv[3] ?? 4);

const poses: RenderOptions[] = [
  {},
  { frame: 'B', tick: 1 },
  { blink: true },
  { walk: 0, faceDx: -1 },
  { walk: 2, faceDx: 1, tick: 3 },
  { accessory: 'feesthoed' },
  { accessory: 'kroon' },
  { accessory: 'mijter' },
  { accessory: 'zonnebril' },
  { palette: 'houtskool' },
  { item: 'leesbril' },
  { item: 'koptelefoon', accessory: 'kroon' },
  { item: 'popcorn' },
  { item: 'controller' },
];

const rows: [string, RenderOptions][][] = SPECIES.map((s) => poses.map((p) => [s.id, p] as [string, RenderOptions]));
rows.push(Object.keys(PALETTES).map((p) => ['robotje', { palette: p, accessory: 'kroon' }]));

const cell = 34;
const cols = Math.max(...rows.map((r) => r.length));
const canvas = new Canvas(cols * cell * scale, rows.length * cell * scale);
rows.forEach((row, cy) => {
  for (let cx = 0; cx < cols; cx++) {
    canvas.fill(cx * cell * scale, cy * cell * scale, cell * scale, cell * scale, (cx + cy) % 2 ? '#eaeaf1' : '#f8f8fb');
    const item = row[cx];
    if (!item) continue;
    const sprite = render(item[0], item[1]);
    canvas.drawPixels(sprite.pixels, (cx * cell + 1) * scale, (cy * cell + 1) * scale, scale);
  }
});
writeFileSync(out, canvas.toPng());
console.log(`wrote ${out} (${canvas.width}×${canvas.height})`);
