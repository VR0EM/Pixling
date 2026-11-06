import '@fontsource/pixelify-sans/500.css';
import './wardrobe.css';
import './studio.css';
import * as bridge from './platform/bridge.ts';
import {
  BUDDY_KEYS,
  LAYER_NAMES,
  PAINTS,
  SLOT_NAMES,
  SLOT_SIZE,
  isEmpty,
  type BuddyLayers,
  type Creation,
  type Slot,
} from './sprites/creations.ts';
import { KNOWN_KEYS, TEMPLATE, aiPrompt, fileName, parsePixling, serialize } from './sprites/format.ts';
import { FIXED, PALETTES } from './sprites/palettes.ts';
import { allSpecies, colours, render, setCreations, type RenderOptions } from './sprites/index.ts';

type Cells = (string | null)[][];
type LayerName = keyof BuddyLayers;

const CONCEPT = '__concept';
const LAYER_ORDER: LayerName[] = ['back', 'top', 'feet', 'body', 'face'];
const DEFAULT_NAMES: Record<Slot, string> = { buddy: 'My buddy', hat: 'My hat', face: 'My glasses', hand: 'My thing' };
/** Keys handed out to new custom colours. */
const FREE_KEYS = [...'1234567890ABCDFHIJLOPSTUVWZdfijlpvx'].filter((k) => !KNOWN_KEYS.has(k));
/** Where the wardrobe asks the studio to start (both pages share the same storage). */
const START_KEY = 'pixling.studio.start';

const board = document.getElementById('board') as HTMLCanvasElement;
const ctx = board.getContext('2d')!;
const mirror = document.getElementById('mirror') as HTMLInputElement;
const outline = document.getElementById('outline') as HTMLInputElement;
const floats = document.getElementById('floats') as HTMLInputElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const message = document.getElementById('message') as HTMLElement;
const colourInput = document.getElementById('colour') as HTMLInputElement;
const colourLabel = document.getElementById('colour-label') as HTMLElement;
const colourHint = document.getElementById('colour-hint') as HTMLElement;
const importBox = document.getElementById('import') as HTMLElement;
const importText = document.getElementById('import-text') as HTMLTextAreaElement;
const importMessage = document.getElementById('import-message') as HTMLElement;

let config = await bridge.getConfig();
let saved = await bridge.getCreations<Creation>();
let slot: Slot = 'buddy';
let layer: LayerName = 'body';
/** The drawing: one grid per layer for a buddy, only `body` for an accessory. */
let cells: Partial<Record<LayerName, Cells>> = {};
let palette: Record<string, string> = {};
let paint: string | null = 'b';
let editing: Creation | null = null;

const say = (text: string, error = false) => {
  message.textContent = text;
  message.classList.toggle('error', error);
};

function size(): { w: number; h: number } {
  const g = cells.body;
  return g ? { w: g[0].length, h: g.length } : SLOT_SIZE[slot];
}

function blank(w: number, h: number): Cells {
  return Array.from({ length: h }, () => new Array<string | null>(w).fill(null));
}

function load(rows: string[] | undefined, w: number, h: number): Cells {
  const g = blank(w, h);
  rows?.forEach((row, y) => [...row].forEach((k, x) => y < h && x < w && k !== '.' && (g[y][x] = k)));
  return g;
}

/** Accessories keep their full width (hats are centred on it); buddy layers drop what's transparent at the end. */
function rowsOf(g: Cells | undefined, trim: boolean): string[] {
  if (!g) return [];
  const rows = g.map((row) => row.map((c) => c ?? '.').join(''));
  if (!trim) return rows;
  const out = rows.map((r) => r.replace(/\.+$/, ''));
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

const isBuddyKey = (key: string) => (BUDDY_KEYS as readonly string[]).includes(key);

/** Colours that belong to the creation: its custom keys, and for a buddy its own body colours. */
const editable = (key: string | null): key is string => !!key && (!KNOWN_KEYS.has(key) || (slot === 'buddy' && isBuddyKey(key)));

function ownColours(): Record<string, string> {
  return Object.fromEntries(Object.entries(palette).filter(([k]) => k !== 'name' && editable(k)));
}

function concept(): Creation {
  const id = editing?.id ?? CONCEPT;
  const name = nameInput.value.trim() || DEFAULT_NAMES[slot];
  const colors = ownColours();
  if (slot === 'buddy') {
    const layers = Object.fromEntries(LAYER_ORDER.map((n) => [n, rowsOf(cells[n], true)]).filter(([, r]) => r.length)) as unknown as BuddyLayers;
    layers.body ??= [];
    return {
      id,
      name,
      slot,
      outline: outline.checked,
      rows: [],
      colors,
      layers,
      ...(floats.checked ? { floats: true } : {}),
      ...(editing?.anchors ? { anchors: editing.anchors } : {}),
      ...(editing?.author ? { author: editing.author } : {}),
    };
  }
  const custom = colors;
  return {
    id,
    name,
    slot,
    outline: outline.checked,
    rows: rowsOf(cells.body, false),
    ...(Object.keys(custom).length ? { colors: custom } : {}),
    ...(editing?.author ? { author: editing.author } : {}),
  };
}

/** The colours the board shows: the buddy's own (for a buddy) or your buddy's current look (for an accessory). */
function refreshPalette(colors: Record<string, string> = {}): void {
  const base = slot === 'buddy' ? { ...FIXED, ...(PALETTES.sky as unknown as Record<string, string>) } : colours(config.species, config.palette === 'default' ? undefined : config.palette);
  delete (base as Record<string, string>).name;
  palette = { ...base, ...colors };
}

const cellSize = () => (slot === 'buddy' ? 15 : 30);

function drawBoard(): void {
  const { w, h } = size();
  const cell = cellSize();
  board.width = w * cell;
  board.height = h * cell;
  board.style.width = `${w * cell}px`;
  board.style.height = `${h * cell}px`;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#ece6da' : '#f6f2ea';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // Other layers show through faintly, the one you're drawing on at full strength.
  const order: LayerName[] = slot === 'buddy' ? LAYER_ORDER : ['body'];
  for (const name of order) {
    const g = cells[name];
    if (!g) continue;
    ctx.globalAlpha = slot !== 'buddy' || name === layer ? 1 : 0.35;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const key = g[y][x];
        if (!key) continue;
        ctx.fillStyle = palette[key] ?? '#ff00ff';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  ctx.globalAlpha = 1;
  // Guides: the middle, and for a buddy the ground it stands on.
  ctx.strokeStyle = 'rgb(43 42 64 / 25%)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo((w / 2) * cell, 0);
  ctx.lineTo((w / 2) * cell, h * cell);
  if (slot === 'buddy') {
    ctx.moveTo(0, 29 * cell);
    ctx.lineTo(w * cell, 29 * cell);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintSprite(canvas: HTMLCanvasElement, speciesId: string, o: RenderOptions): void {
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, 32, 32);
  render(speciesId, o).pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      c.fillStyle = colour;
      c.fillRect(x, y, 1, 1);
    }),
  );
}

const looks = (): RenderOptions => ({ palette: config.palette === 'default' ? undefined : config.palette });

// Previews: an accessory on every buddy, or a home-made buddy doing a few things.
const previewBox = document.getElementById('previews')!;
const previewTitle = document.getElementById('preview-title')!;
let previews: { canvas: HTMLCanvasElement; species: string; options: (t: number) => RenderOptions }[] = [];

function figure(caption: string): HTMLCanvasElement {
  const fig = document.createElement('figure');
  const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
  fig.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: caption }));
  previewBox.append(fig);
  return canvas;
}

function buildPreviews(): void {
  previewBox.replaceChildren();
  const id = () => editing?.id ?? CONCEPT;
  if (slot === 'buddy') {
    previewTitle.textContent = 'Preview';
    const breathe = (t: number): RenderOptions => ({
      frame: Math.floor(t / 550) % 2 ? 'B' : 'A',
      tick: Math.floor(t / 650) % 4,
      blink: t % 3200 < 160,
      faceDx: [0, 0, -1, 0, 0, 1][Math.floor(t / 1700) % 6],
    });
    previews = [
      { canvas: figure('Breathing'), species: id(), options: breathe },
      { canvas: figure('Walking'), species: id(), options: (t) => ({ walk: Math.floor(t / 160) % 4, frame: Math.floor(t / 160) % 2 ? 'B' : 'A', faceDx: 1 }) },
      { canvas: figure('Your colours'), species: id(), options: (t) => ({ ...breathe(t), ...looks() }) },
      { canvas: figure('Party hat'), species: id(), options: (t) => ({ ...breathe(t), accessory: 'partyhat' }) },
      { canvas: figure('Coding'), species: id(), options: (t) => ({ ...breathe(t), item: 'laptop' }) },
      { canvas: figure('Music'), species: id(), options: (t) => ({ ...breathe(t), item: 'headphones', frame: Math.floor(t / 300) % 2 ? 'B' : 'A' }) },
    ];
  } else {
    previewTitle.textContent = 'On every buddy';
    previews = allSpecies()
      .filter((sp) => sp.id !== CONCEPT && sp.id !== editing?.id)
      .map((sp) => ({ canvas: figure(sp.name), species: sp.id, options: () => ({ ...looks(), accessory: id() }) }));
  }
}

function drawPreviews(): void {
  const t = performance.now();
  for (const p of previews) paintSprite(p.canvas, p.species, p.options(t));
}

/** Registers the drawing next to the saved creations, so the previews show it. */
function registerConcept(): void {
  setCreations([...saved.filter((c) => c.id !== editing?.id), concept()]);
}

function redraw(): void {
  drawBoard();
  registerConcept();
  drawPreviews();
}

setInterval(() => {
  if (slot === 'buddy') drawPreviews();
}, 80);

// Painting: click or drag; the right mouse button (or the eraser) clears.
let painting: string | null | undefined;
let lastCell: [number, number] | null = null;
function cellAt(e: PointerEvent): [number, number] | null {
  const r = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / cellSize());
  const y = Math.floor((e.clientY - r.top) / cellSize());
  const { w, h } = size();
  return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null;
}
function set(x: number, y: number): void {
  const g = (cells[layer] ??= blank(size().w, size().h));
  g[y][x] = painting ?? null;
  if (mirror.checked) g[y][g[0].length - 1 - x] = painting ?? null;
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
  say('');
  apply(e);
});
board.addEventListener('pointermove', (e) => apply(e));
board.addEventListener('pointerup', () => {
  painting = undefined;
  lastCell = null;
});
board.addEventListener('contextmenu', (e) => e.preventDefault());

// Paint pots: the buddy's own colours, the fixed ones, custom ones, a "+" for a new colour, and the eraser.
const paintBox = document.getElementById('paints')!;

function buildPots(): void {
  paintBox.replaceChildren();
  const custom = Object.keys(palette).filter((k) => !KNOWN_KEYS.has(k));
  const list = [...PAINTS, ...custom.map((key) => ({ key, name: `Custom colour ${key}` }))];
  for (const p of list) {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'paint', title: p.name });
    button.setAttribute('aria-label', p.name);
    button.style.background = palette[p.key] ?? '#ff00ff';
    button.setAttribute('aria-pressed', String(p.key === paint));
    button.addEventListener('click', () => pick(p.key));
    paintBox.append(button);
  }
  const add = Object.assign(document.createElement('button'), { type: 'button', className: 'paint add', textContent: '+', title: 'New colour' });
  add.addEventListener('click', () => {
    const key = FREE_KEYS.find((k) => !(k in palette));
    if (!key) return say('That’s all the custom colours there are.', true);
    palette[key] = '#ff8a3d';
    pick(key);
    colourInput.click();
  });
  const eraser = Object.assign(document.createElement('button'), { type: 'button', className: 'paint eraser', textContent: '⌫', title: 'Eraser' });
  eraser.setAttribute('aria-pressed', String(paint === null));
  eraser.addEventListener('click', () => pick(null));
  paintBox.append(add, eraser);
  // The colour picker changes the selected colour, when that one belongs to the creation.
  const canEdit = editable(paint);
  colourInput.disabled = !canEdit;
  colourInput.value = paint && palette[paint]?.length === 7 ? palette[paint] : '#000000';
  colourLabel.textContent = canEdit ? 'Edit colour' : 'Colour';
  colourHint.textContent =
    slot === 'buddy' && paint && isBuddyKey(paint)
      ? 'One of your buddy’s own colours; the wardrobe can still recolour it.'
      : slot !== 'buddy' && paint && isBuddyKey(paint)
        ? 'Follows the colours of whoever wears it.'
        : '';
}

function pick(key: string | null): void {
  paint = key;
  buildPots();
}

colourInput.addEventListener('input', () => {
  if (!editable(paint)) return;
  palette[paint] = colourInput.value;
  for (const b of paintBox.querySelectorAll<HTMLButtonElement>('.paint[aria-pressed="true"]')) b.style.background = colourInput.value;
  redraw();
});
colourInput.addEventListener('change', buildPots);

// What you're making, and for a buddy which layer you draw on.
const slotBox = document.getElementById('slots')!;
const slotButtons = (Object.keys(SLOT_NAMES) as Slot[]).map((s) => {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'pill', textContent: SLOT_NAMES[s] });
  button.addEventListener('click', () => start(s));
  slotBox.append(button);
  return { s, button };
});
const layerBox = document.getElementById('layers')!;
const layerButtons = (Object.keys(LAYER_NAMES) as LayerName[]).map((n) => {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'pill', textContent: LAYER_NAMES[n] });
  button.addEventListener('click', () => {
    layer = n;
    if (n === 'face' && paint && !['e', 'w', 'o', 'c', 'n'].includes(paint)) pick('e');
    markLayers();
    drawBoard();
  });
  layerBox.append(button);
  return { n, button };
});
function markLayers(): void {
  for (const { n, button } of layerButtons) button.setAttribute('aria-pressed', String(n === layer));
}

/** Starts a new drawing of this kind, or opens a saved creation (or a template) to edit. */
function start(s: Slot, from?: Creation): void {
  slot = s;
  editing = from && from.id !== TEMPLATE.id ? from : null;
  const source = from ?? (s === 'buddy' ? TEMPLATE : undefined);
  if (s === 'buddy') {
    cells = Object.fromEntries(LAYER_ORDER.map((n) => [n, load(source?.layers?.[n], 32, 32)]));
    layer = 'body';
    paint = 'b';
  } else {
    const w = Math.max(SLOT_SIZE[s].w, ...(source?.rows ?? []).map((r) => r.length));
    const h = Math.max(SLOT_SIZE[s].h, source?.rows.length ?? 0);
    cells = { body: load(source?.rows, w, h) };
    paint = 'r';
  }
  refreshPalette(source?.colors);
  outline.checked = source?.outline ?? s !== 'face';
  floats.checked = !!source?.floats;
  nameInput.value = from && from.id !== TEMPLATE.id ? from.name : '';
  nameInput.placeholder = DEFAULT_NAMES[s];
  layerBox.hidden = s !== 'buddy';
  document.getElementById('floats-row')!.hidden = s !== 'buddy';
  for (const { s: id, button } of slotButtons) button.setAttribute('aria-pressed', String(id === s));
  markLayers();
  buildPots();
  registerConcept();
  buildPreviews();
  redraw();
}

document.getElementById('clear')!.addEventListener('click', () => {
  const { w, h } = size();
  cells[slot === 'buddy' ? layer : 'body'] = blank(w, h);
  redraw();
});
outline.addEventListener('change', redraw);
floats.addEventListener('change', redraw);
nameInput.addEventListener('input', redraw);

/** Saves the list and makes the new or changed creation the one your buddy uses. */
async function keep(list: Creation[], use?: Creation): Promise<void> {
  saved = list;
  registerConcept();
  await bridge.setCreations(saved);
  if (use) config = await bridge.updateConfig(use.slot === 'buddy' ? { species: use.id } : { accessory: use.id });
  drawList();
}

document.getElementById('save')!.addEventListener('submit', async (e) => {
  e.preventDefault();
  const c = concept();
  if (slot === 'buddy' ? isEmpty(c.layers?.body ?? []) : isEmpty(c.rows)) {
    say(slot === 'buddy' ? 'Draw a body first.' : 'Draw something first.', true);
    return;
  }
  const creation = { ...c, id: editing?.id ?? `${slot === 'buddy' ? 'buddy' : 'custom'}-${Date.now()}` };
  editing = creation;
  await keep([...saved.filter((x) => x.id !== creation.id), creation], creation);
  say(slot === 'buddy' ? `${creation.name} is saved and is your buddy now.` : `${creation.name} is saved and your buddy is wearing it.`);
  buildPreviews();
  redraw();
});

// Saved creations: edit, share as a file, copy, or throw away (two clicks).
function drawList(): void {
  const list = document.getElementById('mine')!;
  list.replaceChildren();
  for (const c of saved) {
    const li = document.createElement('li');
    const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
    paintSprite(canvas, c.slot === 'buddy' ? c.id : config.species, c.slot === 'buddy' ? {} : { ...looks(), accessory: c.id });
    const label = document.createElement('span');
    label.className = 'label';
    const kind = SLOT_NAMES[c.slot] + (c.author ? ` · by ${c.author}` : '');
    label.append(c.name, Object.assign(document.createElement('small'), { textContent: kind }));
    const button = (text: string, title: string, onClick: () => void) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, title });
      b.addEventListener('click', onClick);
      return b;
    };
    const edit = button('Edit', 'Edit', () => start(c.slot, c));
    const share = button('Share', 'Save as a file in Downloads', async () => {
      try {
        const where = await bridge.exportFile(fileName(c), serialize(c));
        say(`Saved as ${where.split('/').pop()} in Downloads. Send it to anyone with Pixling.`);
      } catch (err) {
        say(`Saving didn’t work: ${String(err)}`, true);
      }
    });
    const copy = button('Copy', 'Copy the file to paste somewhere', async () => {
      await bridge.copyText(serialize(c));
      say(`${c.name} is copied. Paste it in a chat or a note to share it.`);
    });
    const remove = button('×', 'Throw away', async () => {
      if (remove.textContent !== 'Sure?') {
        remove.textContent = 'Sure?';
        setTimeout(() => (remove.textContent = '×'), 3000);
        return;
      }
      if (config.species === c.id) config = await bridge.updateConfig({ species: 'robot' });
      if (config.accessory === c.id) config = await bridge.updateConfig({ accessory: 'none' });
      await keep(saved.filter((x) => x.id !== c.id));
      if (editing?.id === c.id) start(slot);
      else redraw();
    });
    li.append(canvas, label, edit, share, copy, remove);
    list.append(li);
  }
  document.getElementById('none')!.hidden = saved.length > 0;
}

// Adding files: paste, pick or drop. One new thing is put to use right away.
async function add(text: string): Promise<void> {
  const result = parsePixling(text);
  if (!result.ok) {
    importBox.hidden = false;
    importMessage.textContent = result.error;
    importMessage.classList.add('error');
    return;
  }
  const added = result.creations;
  await keep([...saved, ...added], added.length === 1 ? added[0] : undefined);
  importMessage.classList.remove('error');
  importMessage.textContent = `Added ${added.map((c) => c.name).join(', ')}.`;
  importText.value = '';
  registerConcept();
  if (slot !== 'buddy') buildPreviews();
  drawPreviews();
}

document.getElementById('open-import')!.addEventListener('click', () => {
  importBox.hidden = !importBox.hidden;
  if (!importBox.hidden) importText.focus();
});
document.getElementById('import-add')!.addEventListener('click', () => void add(importText.value));
const filePicker = document.getElementById('import-file') as HTMLInputElement;
document.getElementById('import-pick')!.addEventListener('click', () => filePicker.click());
filePicker.addEventListener('change', async () => {
  for (const file of filePicker.files ?? []) await add(await file.text());
  filePicker.value = '';
});
document.getElementById('copy-prompt')!.addEventListener('click', async () => {
  await bridge.copyText(aiPrompt());
  importBox.hidden = false;
  importMessage.classList.remove('error');
  importMessage.textContent = 'AI prompt copied. Paste it into your AI assistant, say what you’d like, and paste its answer here.';
});

// Files dropped on the window (the app hands over paths; a browser hands over the files themselves).
bridge.onFileDrop(async (kind, paths) => {
  document.body.classList.toggle('dropping', kind === 'over');
  if (kind !== 'drop') return;
  for (const path of paths) {
    try {
      await add(await bridge.readTextFile(path));
    } catch (err) {
      importBox.hidden = false;
      importMessage.classList.add('error');
      importMessage.textContent = String(err);
    }
  }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  for (const file of e.dataTransfer?.files ?? []) await add(await file.text());
});

bridge.onConfigChanged((c) => {
  config = c;
  if (slot !== 'buddy') refreshPalette(ownColours());
  buildPots();
  redraw();
  drawList();
});
bridge.onCreationsChanged<Creation>((list) => {
  saved = list;
  registerConcept();
  if (slot !== 'buddy') buildPreviews();
  drawList();
  drawPreviews();
});

// The wardrobe can ask for a particular kind ("Draw your own…" next to the accessories).
function startFromWardrobe(): boolean {
  let wanted: string | null = null;
  try {
    wanted = localStorage.getItem(START_KEY);
    localStorage.removeItem(START_KEY);
  } catch {
    // No storage: just start with a buddy.
  }
  if (wanted && wanted in SLOT_NAMES) {
    start(wanted as Slot);
    return true;
  }
  return false;
}
window.addEventListener('storage', (e) => {
  if (e.key === START_KEY && e.newValue) startFromWardrobe();
});
window.addEventListener('focus', () => startFromWardrobe());

if (!startFromWardrobe()) start('buddy');
drawList();
