/**
 * Pixling files (`.pixling.json`): home-made buddies and accessories as plain JSON, so people can share
 * them and AI assistants can write them. docs/CREATING-BUDDIES.md describes the format for humans;
 * `aiPrompt()` describes it for AI assistants. Both follow what `parsePixling()` accepts.
 */
import { BUDDY_KEYS, SLOT_MAX, isEmpty, type Anchors, type BuddyLayers, type Creation, type Slot } from './creations.ts';
import { FIXED } from './palettes.ts';

export const EXTENSION = '.pixling.json';

/** What a file looks like on disk. */
export interface PixlingFile {
  pixling: 1;
  type: 'buddy' | 'accessory';
  name: string;
  author?: string;
  /** Accessories: where it goes. */
  slot?: 'hat' | 'face' | 'hand';
  outline?: boolean;
  colors?: Record<string, string>;
  /** Accessories: the drawing. */
  pixels?: string[];
  /** Buddies: the drawing, in layers. */
  layers?: BuddyLayers;
  anchors?: Anchors;
  floats?: boolean;
}

export type ParseResult = { ok: true; creations: Creation[] } | { ok: false; error: string };

const LAYERS: (keyof BuddyLayers)[] = ['back', 'top', 'body', 'feet', 'face'];
const ACCESSORY_SLOTS = ['hat', 'face', 'hand'] as const;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The keys that need no "colors" entry. */
export const KNOWN_KEYS = new Set([...BUDDY_KEYS, ...Object.keys(FIXED)]);

class Problem extends Error {}

const fail = (message: string): never => {
  throw new Problem(message);
};

function hex(value: string): string {
  const v = value.toLowerCase();
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
}

/** Checks a drawing: its size, and that every character is transparent or a colour it knows. */
function drawing(value: unknown, where: string, max: { w: number; h: number }, known: Set<string>): string[] {
  if (!Array.isArray(value) || value.some((r) => typeof r !== 'string')) fail(`${where} should be a list of strings, one per row.`);
  const rows = (value as string[]).map((r) => r.replace(/ /g, '.'));
  if (rows.length > max.h) fail(`${where} has ${rows.length} rows; the most is ${max.h}.`);
  rows.forEach((row, y) => {
    if ([...row].length > max.w) fail(`${where}, row ${y}: ${[...row].length} characters; the most is ${max.w}.`);
    [...row].forEach((k, x) => {
      if (k !== '.' && !known.has(k)) {
        fail(`${where}, row ${y}, column ${x}: unknown colour key "${k}". Add it to "colors" or use a built-in key.`);
      }
    });
  });
  // Trailing transparent rows carry no information.
  while (rows.length && !/[^.]/.test(rows[rows.length - 1])) rows.pop();
  return rows;
}

function point(value: unknown, where: string): [number, number] {
  const ok = Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n >= 0 && n < 32);
  if (!ok) fail(`${where} should be [x, y] with whole numbers from 0 to 31.`);
  return value as [number, number];
}

function one(raw: unknown, index: number, makeId: (slot: Slot) => string): Creation {
  const label = index >= 0 ? `Item ${index + 1}: ` : '';
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('expected an object with "type", "name" and a drawing.');
    const f = raw as Record<string, unknown>;
    const type = f.type ?? (f.layers ? 'buddy' : f.slot ? 'accessory' : undefined);
    if (type !== 'buddy' && type !== 'accessory') fail('"type" should be "buddy" or "accessory".');

    const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 24) : 'Untitled';
    const author = typeof f.author === 'string' && f.author.trim() ? f.author.trim().slice(0, 40) : undefined;

    const colors: Record<string, string> = {};
    if (f.colors !== undefined) {
      if (!f.colors || typeof f.colors !== 'object' || Array.isArray(f.colors)) fail('"colors" should be an object like { "1": "#ff8800" }.');
      for (const [key, value] of Object.entries(f.colors as Record<string, unknown>)) {
        if ([...key].length !== 1 || key === '.' || key === ' ') fail(`"colors": the key "${key}" should be one character (not "." or a space).`);
        if (typeof value !== 'string' || !HEX.test(value)) fail(`"colors": "${key}" should be a colour like "#ff8800".`);
        colors[key] = hex(value as string);
      }
    }
    const known = new Set([...KNOWN_KEYS, ...Object.keys(colors)]);
    const outline = typeof f.outline === 'boolean' ? f.outline : undefined;
    const extra = Object.keys(colors).length ? { colors } : {};

    if (type === 'accessory') {
      const slot = f.slot as (typeof ACCESSORY_SLOTS)[number];
      if (!ACCESSORY_SLOTS.includes(slot)) fail('"slot" should be "hat", "face" or "hand".');
      const rows = drawing(f.pixels ?? f.rows, '"pixels"', SLOT_MAX[slot], known);
      if (isEmpty(rows)) fail('"pixels" is empty: draw something.');
      return { id: makeId(slot), name, slot, outline: outline ?? slot !== 'face', rows, ...extra, ...(author ? { author } : {}) };
    }

    if (!f.layers || typeof f.layers !== 'object') fail('a buddy needs "layers" with at least a "body".');
    const given = f.layers as Record<string, unknown>;
    for (const key of Object.keys(given)) {
      if (!LAYERS.includes(key as keyof BuddyLayers)) fail(`"layers": unknown layer "${key}". Use ${LAYERS.join(', ')}.`);
    }
    const layers: BuddyLayers = { body: [] };
    for (const key of LAYERS) {
      if (given[key] !== undefined) layers[key] = drawing(given[key], `layer "${key}"`, SLOT_MAX.buddy, known);
    }
    if (isEmpty(layers.body)) fail('the "body" layer is empty: a buddy needs a body.');

    let anchors: Anchors | undefined;
    if (f.anchors !== undefined) {
      if (!f.anchors || typeof f.anchors !== 'object') fail('"anchors" should be an object like { "hat": [13, 9] }.');
      anchors = {};
      for (const [key, value] of Object.entries(f.anchors as Record<string, unknown>)) {
        if (key !== 'hat' && key !== 'glasses' && key !== 'hand') fail(`"anchors": unknown anchor "${key}". Use hat, glasses or hand.`);
        anchors[key as keyof Anchors] = point(value, `"anchors.${key}"`);
      }
    }
    return {
      id: makeId('buddy'),
      name,
      slot: 'buddy',
      outline: outline ?? true,
      rows: [],
      layers,
      ...extra,
      ...(anchors ? { anchors } : {}),
      ...(f.floats === true ? { floats: true } : {}),
      ...(author ? { author } : {}),
    };
  } catch (e) {
    if (e instanceof Problem) throw new Problem(label + e.message);
    throw e;
  }
}

let counter = 0;
const newId = (slot: Slot) => `${slot === 'buddy' ? 'buddy' : 'custom'}-${Date.now()}-${counter++}`;

/**
 * Reads a Pixling file: one object, or a list of them. Forgiving about what an AI assistant tends to add
 * around it (a ```json fence, a sentence before or after).
 */
export function parsePixling(text: string, makeId: (slot: Slot) => string = newId): ParseResult {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start < 0 || end < start) return { ok: false, error: 'No Pixling file found: it should be JSON that starts with { or [.' };
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return { ok: false, error: `This isn’t valid JSON: ${(e as Error).message}` };
  }
  try {
    const list = Array.isArray(data) ? data : [data];
    if (list.length === 0) return { ok: false, error: 'The list is empty.' };
    return { ok: true, creations: list.map((raw, i) => one(raw, list.length > 1 ? i : -1, makeId)) };
  } catch (e) {
    if (e instanceof Problem) return { ok: false, error: e.message };
    throw e;
  }
}

/** Pads every row to 32 characters and the layer to 32 rows, so coordinates are easy to read. */
function full(rows: string[] | undefined): string[] {
  const out = Array.from({ length: 32 }, (_, y) => (rows?.[y] ?? '').padEnd(32, '.'));
  return out;
}

/** A creation as a file, ready to share. */
export function toFile(c: Creation): PixlingFile {
  const base = { pixling: 1 as const, name: c.name, ...(c.author ? { author: c.author } : {}) };
  const colors = c.colors && Object.keys(c.colors).length ? { colors: c.colors } : {};
  if (c.slot === 'buddy') {
    const layers = Object.fromEntries(
      (['back', 'top', 'body', 'feet', 'face'] as const).filter((k) => c.layers?.[k]?.length).map((k) => [k, full(c.layers?.[k])]),
    ) as unknown as BuddyLayers;
    return {
      ...base,
      type: 'buddy',
      outline: c.outline,
      ...colors,
      layers,
      ...(c.anchors ? { anchors: c.anchors } : {}),
      ...(c.floats ? { floats: true } : {}),
    };
  }
  return { ...base, type: 'accessory', slot: c.slot, outline: c.outline, ...colors, pixels: c.rows };
}

export function serialize(c: Creation): string {
  return `${JSON.stringify(toFile(c), null, 2)}\n`;
}

/** A file name for sharing: the name in lower case with dashes. */
export function fileName(c: Creation): string {
  const slug = c.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'pixling'}${EXTENSION}`;
}

/** The starting point for a new buddy in the studio, and the example in the AI prompt. */
export const TEMPLATE: Creation = {
  id: 'template',
  name: 'Blob',
  slot: 'buddy',
  outline: true,
  rows: [],
  colors: { b: '#a0d4ff', s: '#68a7e6', h: '#e8f5ff', a: '#ffe08a', c: '#ff9fb8', o: '#21406b' },
  layers: {
    top: [...Array(10).fill(''), '.................aa', '................aa', '...............aa'],
    body: [
      ...Array(13).fill(''),
      '..........bbbbbbbbbbbs',
      '.........bbhhbbbbbbbbbs',
      '........bbhbbbbbbbbbbbbs',
      '.......bbhbbbbbbbbbbbbbbs',
      '.......bbhbbbbbbbbbbbbbbs',
      '.......bbbbbbbbbbbbbbbbbs',
      '.......bbbbbbbbbbbbbbbbbs',
      '.......bbbbbbbbbbbbbbbbbs',
      '.......bbbbbbbbbbbbbbbbbs',
      '.......bbbbbbbbbbbbbbbbbs',
      '.......sbbbbbbbbbbbbbbbbs',
      '........sbbbbbbbbbbbbbbs',
      '.........ssssssssssssss',
      '..........ssssssssssss',
    ],
    feet: [...Array(27).fill(''), '...........sss....sss', '...........sss....sss'],
    face: [
      ...Array(17).fill(''),
      '............we....we',
      '............ee....ee',
      '............ee....ee',
      '..........cc..o..o..cc',
      '...............oo',
    ],
  },
};

/** Instructions an AI assistant can follow to make a buddy or accessory. Paste them into the chat. */
export function aiPrompt(): string {
  const example = serialize({ ...TEMPLATE, author: 'Pixling' });
  return `You are making a file for Pixling, a little pixel-art buddy that lives on the desktop. Reply with only
a JSON object in the format below (no explanation). The user describes what they want after these instructions.

STYLE
- Front view, cute but simple, chunky pixel art like a small video game sprite. No side views, no realistic animals.
- A strong, recognisable silhouette that fills about 18 of the 32 pixels in width.
- Flat colours with one highlight and one shade. Do not draw an outline: Pixling adds a 1-pixel outline itself.
- Eyes are 2 pixels wide and 3 tall, about 6 pixels apart, with a white glint pixel on the top-left one.

BUDDY FILE
{
  "pixling": 1,
  "type": "buddy",
  "name": "Short name (max 24 characters)",
  "outline": true,
  "colors": { "b": "#hex body", "s": "#hex shade", "h": "#hex highlight", "a": "#hex accent", "c": "#hex cheeks", "o": "#hex outline" },
  "layers": { "back": [...], "top": [...], "body": [...], "feet": [...], "face": [...] }
}
- Each layer is a list of exactly 32 strings of exactly 32 characters: row 0 is the top, column 0 the left.
- "." is transparent. Every other character is a colour key (see COLOURS).
- body (required): the main shape, centred around column 16, ending at row 26.
- feet: two small feet on rows 27 and 28, one left of column 16 and one right of it. Leave out for a floating buddy and add "floats": true.
- face: eyes with key "e" (each eye 2 wide, 3 tall), a glint "w", a mouth with key "o", cheeks with key "c". It is drawn on top of the body.
- top (optional): something on top of the head that a hat would replace, like an antenna, leaf or tuft.
- back (optional): things behind the body, like wings, a tail or ears.
- Pixling animates it: the body breathes, the feet step, the eyes blink and look around. Draw one still pose.

ACCESSORY FILE
{ "pixling": 1, "type": "accessory", "name": "Top hat", "slot": "hat", "outline": true, "colors": { "1": "#2b2a40" }, "pixels": [...] }
- slot "hat": at most 16 wide and 12 tall, drawn centred; its bottom row rests on the buddy's head.
- slot "face": at most 16 wide and 6 tall, like glasses 12 wide with the lenses over columns 0-4 and 7-11.
- slot "hand": at most 12 wide and 12 tall, something the buddy holds.

COLOURS
- b, s, h, a, c, o, e follow the buddy's colours (the user can recolour the buddy in Pixling).
- Built-in fixed colours: w white, n black, r red, R dark red, m pink, y gold, Y dark gold, k brown, g green,
  G dark green, t light blue, u indigo, q cyan, X light grey, N dark grey, O orange, P dark orange.
- Any other single character (digits 0-9 work well) can be a custom colour: define it in "colors" as "#rrggbb".

EXAMPLE BUDDY
${example}`;
}
