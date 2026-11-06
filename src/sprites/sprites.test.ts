import { describe, expect, it } from 'vitest';
import { emotePixels, type Emote } from './emotes.ts';
import { ACCESSORIES, ITEMS, PALETTES, SPECIES, catalog, render, setCreations, type RenderOptions } from './index.ts';

const poses: RenderOptions[] = [
  {},
  { frame: 'B', tick: 1 },
  { blink: true, tick: 3 },
  { walk: 0, faceDx: -1 },
  { walk: 2, faceDx: 1 },
  { flip: true },
];

describe('sprites', () => {
  for (const sp of SPECIES) {
    it(`${sp.id} renders in every palette, accessory and pose`, () => {
      for (const palette of [undefined, ...Object.keys(PALETTES)]) {
        for (const accessory of [undefined, ...Object.keys(ACCESSORIES)]) {
          for (const pose of poses) {
            const sprite = render(sp.id, { ...pose, palette, accessory });
            expect(sprite.pixels).toHaveLength(32);
            const colours = sprite.pixels.flat();
            // Magenta means a palette key without a colour.
            expect(colours).not.toContain('#ff00ff');
            expect(sprite.box.x1).toBeGreaterThan(sprite.box.x0);
            expect(sprite.box.y1).toBeGreaterThan(sprite.box.y0);
          }
        }
      }
    });

    it(`${sp.id} stands on the ground line`, () => {
      // Row 29 is the outline under the feet; nothing should be drawn below it.
      const { box } = render(sp.id);
      expect(box.y1).toBeLessThanOrEqual(29);
      if (!sp.floats) expect(box.y1).toBe(29);
    });
  }

  for (const sp of SPECIES) {
    it(`${sp.id} can hold or wear every item, with or without accessories`, () => {
      for (const item of Object.keys(ITEMS)) {
        for (const accessory of [undefined, ...Object.keys(ACCESSORIES)]) {
          const sprite = render(sp.id, { item, accessory, faceDx: 1 });
          expect(sprite.pixels.flat()).not.toContain('#ff00ff');
        }
      }
    });
  }

  it('uses a species-specific version when there is one', () => {
    const generic = render('spookje', { item: 'koptelefoon' });
    const own = render('robotje', { item: 'koptelefoon' });
    // The ghost wears headphones on its head; the boombox isn't there.
    const low = (s: typeof generic) => s.pixels.slice(22).flat().filter((c) => c === '#4f5363').length;
    expect(low(generic)).toBe(0);
    expect(own.pixels.flat()).toContain('#e8454f');
    // A buddy without its own version gets the boombox at its feet.
    expect(low(render('boontje', { item: 'koptelefoon' }))).toBeGreaterThan(0);
  });

  it('code appears on the laptop as time goes on', () => {
    const at = (tick: number) => render('robotje', { item: 'laptop', tick }).pixels.flat().join();
    expect(new Set([0, 1, 2, 3].map(at)).size).toBe(4);
  });

  it('the buddy looks at its laptop, except while walking', () => {
    const look = (o: RenderOptions) => render('robotje', { item: 'laptop', ...o }).pixels.flat().join();
    expect(look({ faceDx: -1 })).toBe(look({ faceDx: 1 }));
    expect(look({ faceDx: -1, walk: 1 })).not.toBe(look({ faceDx: 1, walk: 1 }));
  });

  it('a variant of null leaves the item off', () => {
    expect(render('mokje', { item: 'koffie' }).pixels.flat().join()).toBe(render('mokje').pixels.flat().join());
  });

  it('head things breathe along with the head', () => {
    const top = (frame: 'A' | 'B') =>
      render('robotje', { item: 'koptelefoon', frame }).pixels.findIndex((row) => row.includes('#26242e'));
    expect(top('B')).toBe(top('A') + 1);
  });

  it('a tall hat never sticks out above the sprite', () => {
    setCreations([{ id: 'hoog', name: 'Hoog', slot: 'hoed', outline: false, rows: Array(10).fill('....rr....') }]);
    for (const id of ['paddo', 'draakje']) {
      const rows = render(id, { accessory: 'hoog' }).pixels.filter((row) => row.includes('#e8454f'));
      expect(rows).toHaveLength(10);
    }
    setCreations([]);
  });

  it("a hat replaces the robot's antenna", () => {
    const lamp = (accessory?: string) => render('robotje', { accessory }).pixels.slice(0, 10).flat().includes('#7cf8ff');
    expect(lamp()).toBe(true);
    expect(lamp('kroon')).toBe(false);
  });

  it('the catalog lists every species, palette and accessory', () => {
    const c = catalog();
    expect(c.species.map((s) => s.id)).toEqual(SPECIES.map((s) => s.id));
    expect(c.palettes[0].id).toBe('eigen');
    expect(c.accessories[0].id).toBe('geen');
    expect(c.palettes).toHaveLength(Object.keys(PALETTES).length + 1);
  });

  it('emotes get an outline', () => {
    for (const e of ['hart', 'uitroep', 'vraag', 'slaap', 'noot', 'zweet'] as Emote[]) {
      const px = emotePixels(e);
      expect(px[0].some(Boolean)).toBe(true);
      expect(px.flat().filter(Boolean).length).toBeGreaterThan(4);
    }
  });
});
