// Draws the app icon (the default buddy) and the menu bar icon from the sprite engine.
// `npm run icons` runs this and then `tauri icon` to make every size the bundle needs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { render } from '../src/sprites/index.ts';
import { Canvas } from './png.ts';

mkdirSync('build', { recursive: true });

// App icon: the default robot on a warm rounded square, following the macOS icon grid
// (an 824 px square with rounded corners inside a 1024 px canvas).
const SIZE = 1024;
const icon = new Canvas(SIZE, SIZE);
const inset = 100;
const radius = 185;
for (let y = inset; y < SIZE - inset; y++) {
  const dy = Math.max(inset + radius - y, y - (SIZE - inset - radius - 1), 0);
  const dx = dy > 0 ? radius - Math.sqrt(radius * radius - dy * dy) : 0;
  const x0 = Math.ceil(inset + dx);
  icon.fill(x0, y, SIZE - 2 * x0, 1, '#fdf0d5');
}
const robot = render('robot', { palette: 'sky' });
const scale = 24;
const { x0, y0, x1, y1 } = robot.box;
const left = Math.round(SIZE / 2 - ((x0 + x1 + 1) / 2) * scale);
const top = Math.round(SIZE / 2 - ((y0 + y1 + 1) / 2) * scale) + 12;
icon.fill(left + (x0 + 3) * scale, top + (y1 + 1) * scale - 4, (x1 - x0 - 5) * scale, 22, '#e9cfa3');
icon.drawPixels(robot.pixels, left, top, scale);
writeFileSync('build/app-icon.png', icon.toPng());

// Menu bar icon: a black robot head on transparent; macOS recolours it for light and dark menu bars.
const GLYPH = [
  '..................',
  '........##........',
  '.......####.......',
  '........##........',
  '..##############..',
  '.################.',
  '.##............##.',
  '.##............##.',
  '.##..##....##..##.',
  '.##..##....##..##.',
  '.##............##.',
  '.##....####....##.',
  '.##............##.',
  '.################.',
  '..##############..',
  '...###......###...',
  '...###......###...',
  '..................',
];
const tray = new Canvas(36, 36);
GLYPH.forEach((row, y) =>
  [...row].forEach((ch, x) => {
    if (ch === '#') tray.fill(x * 2, y * 2, 2, 2, '#000000');
  }),
);
writeFileSync('src-tauri/icons/tray.png', tray.toPng());

console.log('wrote build/app-icon.png and src-tauri/icons/tray.png');
