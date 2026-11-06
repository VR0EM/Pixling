import './wardrobe.css';
import * as bridge from './platform/bridge.ts';
import { ACCESSORIES, PALETTES, SPECIES, catalog, render, species, type RenderOptions } from './sprites/index.ts';

type Config = bridge.Config;

/** Paints a 32×32 sprite onto a canvas (cleared first). */
function paint(canvas: HTMLCanvasElement, speciesId: string, o: RenderOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  render(speciesId, o).pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

function choice(parent: HTMLElement, label: string, className: string, onPick: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', className, textContent: label });
  button.addEventListener('click', onPick);
  parent.append(button);
  return button;
}

async function start(): Promise<void> {
  let config: Config = await bridge.getConfig();
  let autostart = await bridge.getAutostart();
  const list = catalog();

  const change = async (patch: Partial<Config>) => {
    config = await bridge.updateConfig(patch);
    refresh();
  };

  const looks = (o: RenderOptions = {}): RenderOptions => ({
    palette: config.palette === 'eigen' ? undefined : config.palette,
    accessory: config.accessory === 'geen' ? undefined : config.accessory,
    ...o,
  });

  // Species cards, each showing the species in the chosen colour and accessory.
  const speciesBox = document.getElementById('species')!;
  const speciesCards = SPECIES.map((sp) => {
    const button = el('button', { type: 'button', className: 'card' });
    const canvas = el('canvas', { width: 32, height: 32 });
    button.append(canvas, el('span', { textContent: sp.name }));
    button.addEventListener('click', () => void change({ species: sp.id }));
    speciesBox.append(button);
    return { id: sp.id, button, canvas };
  });

  const paletteBox = document.getElementById('palettes')!;
  const paletteButtons = list.palettes.map((p) => {
    const button = choice(paletteBox, '', 'swatch', () => void change({ palette: p.id }));
    button.title = p.name;
    button.setAttribute('aria-label', p.name);
    return { id: p.id, button };
  });

  const accessoryBox = document.getElementById('accessories')!;
  const accessoryButtons = list.accessories.map((a) => ({
    id: a.id,
    button: choice(accessoryBox, a.name, 'pill', () => void change({ accessory: a.id })),
  }));

  const scaleBox = document.getElementById('scale')!;
  const scaleButtons = [2, 3, 4].map((s) => ({
    id: s,
    button: choice(scaleBox, `${s}×`, 'pill', () => void change({ scale: s })),
  }));

  const focusBox = document.getElementById('focus')!;
  const focusButtons = [15, 25, 50].map((m) => ({
    id: m,
    button: choice(focusBox, `${m} min`, 'pill', () => void change({ focusMinutes: m })),
  }));

  const habits: [keyof Config | 'autostart', string][] = [
    ['watchApps', 'Kijkt mee met je apps'],
    ['climbWindows', 'Klimt op vensters'],
    ['water', 'Waterherinnering'],
    ['breaks', 'Pauzeherinnering'],
    ['watchSystem', 'Let op batterij en drukte'],
    ['autostart', 'Start bij inloggen'],
  ];
  const habitBox = document.getElementById('habits')!;
  const habitInputs = habits.map(([key, label]) => {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', async () => {
      if (key === 'autostart') {
        await bridge.setAutostart(input.checked);
        autostart = await bridge.getAutostart();
        refresh();
      } else {
        await change({ [key]: input.checked } as Partial<Config>);
      }
    });
    const row = el('label', { className: 'toggle' });
    row.append(input, el('span', { textContent: label }));
    habitBox.append(row);
    return { key, input };
  });

  const summary = document.getElementById('summary')!;
  const preview = document.getElementById('preview') as HTMLCanvasElement;

  function refresh(): void {
    const sp = species(config.species);
    const paletteName = PALETTES[config.palette]?.name ?? `eigen kleur (${PALETTES[sp.palette].name.toLowerCase()})`;
    const accessoryName = ACCESSORIES[config.accessory]?.name.toLowerCase() ?? 'geen accessoire';
    summary.textContent = `${sp.name} · ${paletteName.toLowerCase()} · ${accessoryName}`;

    for (const card of speciesCards) {
      paint(card.canvas, card.id, looks());
      card.button.setAttribute('aria-pressed', String(card.id === config.species));
    }
    for (const { id, button } of paletteButtons) {
      const p = PALETTES[id] ?? PALETTES[sp.palette];
      button.style.background = id === 'eigen' ? `linear-gradient(135deg, ${p.b} 50%, ${p.s} 50%)` : p.b;
      button.setAttribute('aria-pressed', String(id === config.palette));
    }
    for (const { id, button } of accessoryButtons) button.setAttribute('aria-pressed', String(id === config.accessory));
    for (const { id, button } of scaleButtons) button.setAttribute('aria-pressed', String(id === config.scale));
    for (const { id, button } of focusButtons) button.setAttribute('aria-pressed', String(id === config.focusMinutes));
    for (const { key, input } of habitInputs) input.checked = key === 'autostart' ? autostart : Boolean(config[key]);
  }

  // A living preview: breathing, blinking and looking around.
  let blinkUntil = 0;
  setInterval(() => {
    const t = performance.now();
    if (Math.random() < 0.04) blinkUntil = t + 160;
    paint(
      preview,
      config.species,
      looks({
        frame: Math.floor(t / 550) % 2 ? 'B' : 'A',
        tick: Math.floor(t / 650) % 4,
        blink: t < blinkUntil,
        faceDx: [0, 0, -1, 0, 0, 1][Math.floor(t / 1700) % 6],
      }),
    );
  }, 60);

  bridge.onConfigChanged((c) => {
    config = c;
    refresh();
  });
  refresh();
}

start().catch((e) => bridge.log(`kleerkast: ${String(e)}`));
