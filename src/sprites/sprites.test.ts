import { describe, expect, it } from 'vitest';
import { emotePixels, type Emote } from './emotes.ts';
import { ACCESSORIES, ITEMS, PALETTES, SPECIES, catalog, render, type RenderOptions } from './index.ts';

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

  it('reading glasses stay off when sunglasses are on', () => {
    const shades = render('kat', { accessory: 'zonnebril' }).pixels.flat().join();
    const both = render('kat', { accessory: 'zonnebril', item: 'leesbril' }).pixels.flat().join();
    expect(both).toBe(shades);
  });

  it("a hat replaces the robot's antenna", () => {
    const plain = render('robotje').pixels.slice(0, 8).flat().filter(Boolean).length;
    const hat = render('robotje', { accessory: 'kroon' }).pixels.slice(0, 8).flat().filter(Boolean).length;
    expect(hat).toBeLessThan(plain);
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
