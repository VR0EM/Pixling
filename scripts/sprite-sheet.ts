// Renders every buddy in a few poses to a PNG, so the pixel art can be checked without starting the app.
// Usage: node scripts/sprite-sheet.ts <out.png> [scale]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parsePixling, TEMPLATE } from '../src/sprites/format.ts';
import { PALETTES, SPECIES, render, setCreations, type Creation, type RenderOptions } from '../src/sprites/index.ts';
import { Canvas } from './png.ts';

const out = process.argv[2] ?? 'docs/sprites.png';
const scale = Number(process.argv[3] ?? 4);

const poses: RenderOptions[] = [
  {},
  { frame: 'B', tick: 1 },
  { blink: true },
  { walk: 0, faceDx: -1 },
  { walk: 2, faceDx: 1, tick: 3 },
  { accessory: 'partyhat' },
  { accessory: 'crown' },
  { accessory: 'bow' },
  { accessory: 'beanie' },
  { accessory: 'sunglasses' },
  { palette: 'charcoal' },
  { item: 'laptop' },
  { item: 'headphones' },
  { item: 'headphones', accessory: 'crown', frame: 'B' },
  { item: 'popcorn' },
  { item: 'controller' },
  { item: 'book' },
  { item: 'water' },
  { item: 'coffee', accessory: 'nightcap' },
];

// Home-made buddies go through the same poses: the studio's template and the example files.
const custom: Creation[] = [TEMPLATE];
for (const file of readdirSync('examples').filter((f) => f.endsWith('.pixling.json'))) {
  const result = parsePixling(readFileSync(`examples/${file}`, 'utf8'), () => file.replace('.pixling.json', ''));
  if (result.ok) custom.push(...result.creations);
}
setCreations(custom);
const buddies = [...SPECIES.map((s) => s.id), ...custom.filter((c) => c.slot === 'buddy').map((c) => c.id)];

const rows: [string, RenderOptions][][] = buddies.map((id) => poses.map((p) => [id, p] as [string, RenderOptions]));
rows.push(Object.keys(PALETTES).map((p) => ['robot', { palette: p, accessory: 'crown' }]));

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
