import { afterEach, describe, expect, it } from 'vitest';
import { ACCESSORIES, ITEMS, allSpecies, catalog, render, setCreations } from './index.ts';
import { TEMPLATE, aiPrompt, fileName, parsePixling, serialize } from './format.ts';
import type { Creation } from './creations.ts';

const id = (slot: string) => `test-${slot}`;
const parse = (value: unknown) => parsePixling(typeof value === 'string' ? value : JSON.stringify(value), id);
const errorOf = (value: unknown) => {
  const r = parse(value);
  return r.ok ? '' : r.error;
};

afterEach(() => setCreations([]));

describe('Pixling files', () => {
  it('survive a round trip', () => {
    const r = parse(serialize(TEMPLATE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [back] = r.creations;
    expect(back.slot).toBe('buddy');
    expect(back.colors).toEqual(TEMPLATE.colors);
    expect(back.layers?.body.join('').replace(/\./g, '')).toBe(TEMPLATE.layers?.body.join('').replace(/\./g, ''));
    expect(fileName({ ...TEMPLATE, name: 'Mr. Blob 2' })).toBe('mr-blob-2.pixling.json');
  });

  it('accept what AI assistants tend to wrap around them', () => {
    const answer = `Here is your hat!\n\`\`\`json\n${JSON.stringify({ pixling: 1, type: 'accessory', slot: 'hat', name: 'Cap', pixels: ['.rrrr.', 'rrrrrr'] })}\n\`\`\`\nEnjoy!`;
    const r = parse(answer);
    expect(r.ok && r.creations[0].name).toBe('Cap');
  });

  it('accept a list, and spaces as transparent pixels', () => {
    const r = parse([
      { type: 'accessory', slot: 'hand', name: 'Stick', pixels: ['  k ', '  k '] },
      { type: 'accessory', slot: 'face', name: 'Mask', pixels: ['nnnn'] },
    ]);
    expect(r.ok && r.creations.map((c) => c.rows[0])).toEqual(['..k.', 'nnnn']);
    // Glasses have no outline unless asked for; hats and held things do.
    expect(r.ok && r.creations.map((c) => c.outline)).toEqual([true, false]);
  });

  it('explain what is wrong, and where', () => {
    expect(errorOf('not json at all')).toMatch(/No Pixling file/);
    expect(errorOf('{"type": "buddy",}')).toMatch(/valid JSON/);
    expect(errorOf({ type: 'robot' })).toMatch(/"type" should be/);
    expect(errorOf({ type: 'buddy', name: 'X', layers: { body: ['..Z.'] } })).toMatch(/layer "body", row 0, column 2: unknown colour key "Z"/);
    expect(errorOf({ type: 'buddy', name: 'X', layers: { face: ['.e'] } })).toMatch(/needs a body/);
    expect(errorOf({ type: 'buddy', name: 'X', layers: { body: ['b'], legs: ['b'] } })).toMatch(/unknown layer "legs"/);
    expect(errorOf({ type: 'buddy', name: 'X', layers: { body: ['b'.repeat(33)] } })).toMatch(/33 characters; the most is 32/);
    expect(errorOf({ type: 'accessory', slot: 'hat', name: 'X', colors: { 1: 'pink' }, pixels: ['1'] })).toMatch(/"1" should be a colour/);
    expect(errorOf({ type: 'accessory', slot: 'hat', name: 'X', pixels: ['.'.repeat(17)] })).toMatch(/the most is 16/);
    expect(errorOf({ type: 'accessory', slot: 'cape', name: 'X', pixels: ['r'] })).toMatch(/"slot" should be/);
    expect(errorOf([{ type: 'accessory', slot: 'hat', pixels: ['r'] }, { type: 'accessory', slot: 'hat', pixels: ['?'] }])).toMatch(/^Item 2: /);
  });

  it('keep the colours of different files apart, even with the same keys', () => {
    const r = parse([
      { type: 'accessory', slot: 'hat', name: 'Blue', colors: { 1: '#0000ff' }, pixels: ['111111'] },
      { type: 'accessory', slot: 'hand', name: 'Green', colors: { 1: '#00ff00' }, pixels: ['11', '11'] },
    ]);
    if (!r.ok) throw new Error(r.error);
    const [blue, green] = r.creations.map((c, i) => ({ ...c, id: `c${i}` }));
    setCreations([blue, green]);
    const colours = (accessory: string) => new Set(render('robot', { accessory }).pixels.flat());
    expect(colours('c0').has('#0000ff')).toBe(true);
    expect(colours('c0').has('#00ff00')).toBe(false);
    expect(colours('c1').has('#00ff00')).toBe(true);
  });

  it('come with an AI prompt whose example is a valid file', () => {
    const prompt = aiPrompt();
    expect(parse(prompt.slice(prompt.indexOf('EXAMPLE BUDDY'))).ok).toBe(true);
  });

  it('in examples/ are all valid and draw cleanly', () => {
    const files = import.meta.glob<string>('../../examples/*.pixling.json', { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(files).length).toBeGreaterThan(0);
    const all: Creation[] = [];
    for (const [f, text] of Object.entries(files)) {
      const r = parsePixling(text, () => f);
      if (!r.ok) throw new Error(`${f}: ${r.error}`);
      all.push(...r.creations);
    }
    setCreations(all);
    for (const c of all) {
      const pixels = c.slot === 'buddy' ? render(c.id).pixels : render('robot', { accessory: c.id }).pixels;
      expect(pixels.flat()).not.toContain('#ff00ff');
    }
  });
});

describe('home-made buddies', () => {
  const blob = { ...TEMPLATE, id: 'blob' };

  it('join the catalog and render in every pose, accessory and item', () => {
    setCreations([blob]);
    expect(allSpecies().map((s) => s.id)).toContain('blob');
    expect(catalog().species.map((s) => s.name)).toContain('Blob');
    for (const accessory of [undefined, ...Object.keys(ACCESSORIES)]) {
      for (const item of [undefined, ...Object.keys(ITEMS)]) {
        for (const pose of [{}, { frame: 'B' as const }, { blink: true }, { walk: 0 }, { walk: 2, faceDx: 1 }, { flip: true }]) {
          expect(render('blob', { ...pose, accessory, item }).pixels.flat()).not.toContain('#ff00ff');
        }
      }
    }
  });

  it('stand on the ground wherever they were drawn', () => {
    const high = { ...blob, id: 'high', layers: Object.fromEntries(Object.entries(blob.layers!).map(([k, rows]) => [k, (rows as string[]).slice(5)])) };
    setCreations([blob, high as unknown as Creation]);
    expect(render('high').box.y1).toBe(29);
    expect(render('blob').box.y1).toBe(29);
    expect(render('robot').box.y1).toBe(29);
  });

  it('use their own colours, and the wardrobe palette when one is picked', () => {
    setCreations([blob]);
    expect(render('blob').pixels.flat()).toContain('#a0d4ff');
    expect(render('blob', { palette: 'red' }).pixels.flat()).toContain('#e8524f');
  });

  it('breathe, blink, step and look around', () => {
    setCreations([blob]);
    const flat = (o = {}) => render('blob', o).pixels.flat().join();
    expect(flat({ frame: 'B' })).not.toBe(flat());
    const eyes = (o = {}) => render('blob', o).pixels.flat().filter((c) => c === '#1d1a2c').length;
    expect(eyes({ blink: true })).toBeLessThan(eyes());
    expect(flat({ walk: 0 })).not.toBe(flat({ walk: 2 }));
    expect(flat({ faceDx: -1 })).not.toBe(flat({ faceDx: 1 }));
  });

  it('lose the top layer under a hat', () => {
    setCreations([blob]);
    const lampColour = '#ffe08a'; // the accent of the tuft on top
    expect(render('blob').pixels.flat()).toContain(lampColour);
    expect(render('blob', { accessory: 'crown' }).pixels.slice(0, 13).flat()).not.toContain(lampColour);
  });
});
