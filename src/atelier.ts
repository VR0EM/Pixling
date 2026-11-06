import '@fontsource/pixelify-sans/500.css';
import './wardrobe.css';
import './atelier.css';
import * as bridge from './platform/bridge.ts';
import { PAINTS, SLOT_NAMES, SLOT_SIZE, isEmpty, type Creation, type Slot } from './sprites/creations.ts';
import { FIXED, PALETTES } from './sprites/palettes.ts';
import { SPECIES, render, setCreations, species } from './sprites/index.ts';

const CELL = 30;
const CONCEPT = '__concept';
const DEFAULT_NAMES: Record<Slot, string> = { hoed: 'Mijn hoedje', gezicht: 'Mijn bril', hand: 'Mijn ding' };

const board = document.getElementById('board') as HTMLCanvasElement;
const ctx = board.getContext('2d')!;
const mirror = document.getElementById('mirror') as HTMLInputElement;
const outline = document.getElementById('outline') as HTMLInputElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const message = document.getElementById('message') as HTMLElement;

let config = await bridge.getConfig();
let saved = await bridge.getCreations<Creation>();
let slot: Slot = 'hoed';
let cells: (string | null)[][] = [];
let paint: string | null = 'r';
let editing: string | null = null;

/** The buddy's colours, so "kleur van je maatje" shows what it will really look like. */
function colours(): Record<string, string> {
  const sp = species(config.species);
  return { ...FIXED, ...(PALETTES[config.palette] ?? PALETTES[sp.palette]) };
}

function blank(s: Slot): (string | null)[][] {
  const { w, h } = SLOT_SIZE[s];
  return Array.from({ length: h }, () => new Array<string | null>(w).fill(null));
}

const rowsOf = (grid: (string | null)[][]) => grid.map((row) => row.map((c) => c ?? '.').join(''));

function concept(): Creation {
  return { id: editing ?? CONCEPT, name: nameInput.value || DEFAULT_NAMES[slot], slot, outline: outline.checked, rows: rowsOf(cells) };
}

function drawBoard(): void {
  const { w, h } = SLOT_SIZE[slot];
  board.width = w * CELL;
  board.height = h * CELL;
  board.style.width = `${w * CELL}px`;
  board.style.height = `${h * CELL}px`;
  const pal = colours();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#ece6da' : '#f6f2ea';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      const key = cells[y][x];
      if (key) {
        ctx.fillStyle = pal[key] ?? '#ff00ff';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }
  // A guide down the middle; for hats also where the head starts.
  ctx.strokeStyle = 'rgb(43 42 64 / 25%)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo((w / 2) * CELL, 0);
  ctx.lineTo((w / 2) * CELL, h * CELL);
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintSprite(canvas: HTMLCanvasElement, speciesId: string, accessoryId: string | undefined): void {
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, 32, 32);
  render(speciesId, { palette: config.palette === 'eigen' ? undefined : config.palette, accessory: accessoryId }).pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      c.fillStyle = colour;
      c.fillRect(x, y, 1, 1);
    }),
  );
}

const previews = SPECIES.map((sp) => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32, title: sp.name });
  document.getElementById('previews')!.append(canvas);
  return { id: sp.id, canvas };
});

/** Shows the drawing on every buddy. The concept is registered next to the saved creations. */
function drawPreviews(): void {
  const others = saved.filter((c) => c.id !== editing);
  setCreations([...others, concept()]);
  for (const p of previews) paintSprite(p.canvas, p.id, editing ?? CONCEPT);
}

function redraw(): void {
  drawBoard();
  drawPreviews();
}

// Painting: click or drag; the right mouse button (or the eraser) clears.
let painting: string | null | undefined;
function cellAt(e: PointerEvent): [number, number] | null {
  const r = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / CELL);
  const y = Math.floor((e.clientY - r.top) / CELL);
  const { w, h } = SLOT_SIZE[slot];
  return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null;
}
let lastCell: [number, number] | null = null;
function set(x: number, y: number): void {
  const { w } = SLOT_SIZE[slot];
  cells[y][x] = painting ?? null;
  if (mirror.checked) cells[y][w - 1 - x] = painting ?? null;
}
/** Paints the cell under the pointer, and every cell on the way from the previous one (fast drags). */
function apply(e: PointerEvent): void {
  const at = cellAt(e);
  if (!at || painting === undefined) return;
  const [x1, y1] = at;
  const [x0, y0] = lastCell ?? at;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps));
  lastCell = at;
  redraw();
}
board.addEventListener('pointerdown', (e) => {
  board.setPointerCapture(e.pointerId);
  painting = e.button === 2 ? null : paint;
  lastCell = null;
  message.textContent = '';
  apply(e);
});
board.addEventListener('pointermove', (e) => apply(e));
board.addEventListener('pointerup', () => {
  painting = undefined;
  lastCell = null;
});
board.addEventListener('contextmenu', (e) => e.preventDefault());

// Paint pots, plus the eraser.
const paintBox = document.getElementById('paints')!;
const pots: { key: string | null; button: HTMLButtonElement }[] = [];
for (const p of [...PAINTS, { key: null, name: 'Gum' }]) {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: p.key ? 'paint' : 'paint eraser', title: p.name });
  button.setAttribute('aria-label', p.name);
  if (!p.key) button.textContent = '⌫';
  button.addEventListener('click', () => {
    paint = p.key;
    markPots();
  });
  paintBox.append(button);
  pots.push({ key: p.key, button });
}
function markPots(): void {
  const pal = colours();
  for (const { key, button } of pots) {
    if (key) button.style.background = pal[key];
    button.setAttribute('aria-pressed', String(key === paint));
  }
}

// Which kind of thing you're making.
const slotBox = document.getElementById('slots')!;
const slotButtons = (Object.keys(SLOT_NAMES) as Slot[]).map((s) => {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'pill', textContent: SLOT_NAMES[s] });
  button.addEventListener('click', () => start(s));
  slotBox.append(button);
  return { s, button };
});
function start(s: Slot, from?: Creation): void {
  slot = s;
  editing = from?.id ?? null;
  cells = blank(s);
  from?.rows.forEach((row, y) => [...row].forEach((k, x) => y < cells.length && x < cells[0].length && (cells[y][x] = k === '.' ? null : k)));
  outline.checked = from?.outline ?? s !== 'gezicht';
  nameInput.value = from?.name ?? '';
  nameInput.placeholder = DEFAULT_NAMES[s];
  for (const { s: id, button } of slotButtons) button.setAttribute('aria-pressed', String(id === s));
  redraw();
}

document.getElementById('clear')!.addEventListener('click', () => {
  cells = blank(slot);
  redraw();
});
outline.addEventListener('change', drawPreviews);
nameInput.addEventListener('input', drawPreviews);

document.getElementById('save')!.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isEmpty(rowsOf(cells))) {
    message.textContent = 'Teken eerst iets.';
    return;
  }
  const creation = { ...concept(), id: editing ?? `eigen-${Date.now()}` };
  saved = [...saved.filter((c) => c.id !== creation.id), creation];
  editing = creation.id;
  await bridge.setCreations(saved);
  config = await bridge.updateConfig({ accessory: creation.id });
  message.textContent = `${creation.name} is bewaard en je maatje draagt het nu.`;
  drawList();
  redraw();
});

// Saved creations: click to edit, two clicks on × to throw away.
function drawList(): void {
  const list = document.getElementById('mine')!;
  list.replaceChildren();
  for (const c of saved) {
    const li = document.createElement('li');
    const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
    paintSprite(canvas, config.species, c.id);
    const label = document.createElement('span');
    label.className = 'label';
    label.append(c.name, Object.assign(document.createElement('small'), { textContent: SLOT_NAMES[c.slot] }));
    const edit = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Bewerk' });
    edit.addEventListener('click', () => start(c.slot, c));
    const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: 'Weggooien' });
    remove.addEventListener('click', async () => {
      if (remove.textContent !== 'Zeker?') {
        remove.textContent = 'Zeker?';
        setTimeout(() => (remove.textContent = '×'), 3000);
        return;
      }
      saved = saved.filter((x) => x.id !== c.id);
      await bridge.setCreations(saved);
      if (config.accessory === c.id) config = await bridge.updateConfig({ accessory: 'geen' });
      if (editing === c.id) start(slot);
      drawList();
      drawPreviews();
    });
    li.append(canvas, label, edit, remove);
    list.append(li);
  }
  document.getElementById('none')!.hidden = saved.length > 0;
}

bridge.onConfigChanged((c) => {
  config = c;
  markPots();
  redraw();
  drawList();
});

markPots();
start('hoed');
drawList();
