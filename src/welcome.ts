import '@fontsource/pixelify-sans/500.css';
import './wardrobe.css';
import './welcome.css';
import { PERSONALITIES } from './buddy/voice.ts';
import { parsePlaces } from './buddy/weather.ts';
import * as bridge from './platform/bridge.ts';
import { emotePixels } from './sprites/emotes.ts';
import { PALETTES, allSpecies, catalog, ownPalette, render, setCreations, type Creation, type RenderOptions } from './sprites/index.ts';

/**
 * The welcome tour, shown once on the first start (and from the menu): your buddy introduces itself, you
 * pick how it looks and who it is, learn where to find it, and set a few optional extras.
 */

const STEPS = ['hello', 'pick', 'find', 'extras', 'done'] as const;
type Step = (typeof STEPS)[number];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) =>
  Object.assign(document.createElement(tag), props);

function paint(canvas: HTMLCanvasElement, species: string, o: RenderOptions, emote?: 'heart'): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const top = canvas.height - 32;
  const draw = (pixels: (string | null)[][], x0: number, y0: number) =>
    pixels.forEach((row, y) =>
      row.forEach((colour, x) => {
        if (!colour) return;
        ctx.fillStyle = colour;
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }),
    );
  const sprite = render(species, o);
  draw(sprite.pixels, 0, top);
  if (emote) {
    const icon = emotePixels(emote);
    draw(icon, 32 - icon[0].length - 2, Math.max(0, top + sprite.box.y0 - icon.length - 1));
  }
}

async function start(): Promise<void> {
  let config = await bridge.getConfig();
  setCreations(await bridge.getCreations<Creation>());
  // Once seen, it doesn't open by itself again.
  if (!config.welcomed) config = await bridge.updateConfig({ welcomed: true });
  const change = async (patch: Partial<bridge.Config>) => {
    config = await bridge.updateConfig(patch);
    refresh();
  };
  const looks = (o: RenderOptions = {}): RenderOptions => ({
    palette: config.palette === 'default' ? undefined : config.palette,
    accessory: config.accessory === 'none' ? undefined : config.accessory,
    ...o,
  });

  // The buddy on stage: breathing, blinking, looking around, with a heart when it says hello.
  let step: Step = 'hello';
  const stage = document.getElementById('buddy') as HTMLCanvasElement;
  let blinkUntil = 0;
  setInterval(() => {
    const t = performance.now();
    if (Math.random() < 0.04) blinkUntil = t + 160;
    const happy = step === 'hello' || step === 'done';
    paint(
      stage,
      config.species,
      looks({
        frame: Math.floor(t / 550) % 2 ? 'B' : 'A',
        tick: Math.floor(t / 650) % 4,
        blink: t < blinkUntil,
        faceDx: [0, 0, -1, 0, 0, 1][Math.floor(t / 1700) % 6],
      }),
      happy && Math.floor(t / 1400) % 3 !== 2 ? 'heart' : undefined,
    );
  }, 60);

  // Pick: buddy, colour, character.
  const speciesBox = document.getElementById('species')!;
  const speciesCards = allSpecies().map((sp) => {
    const button = el('button', { type: 'button', className: 'card' });
    const canvas = el('canvas', { width: 32, height: 32 });
    button.append(canvas, el('span', { textContent: sp.name }));
    button.addEventListener('click', () => void change({ species: sp.id }));
    speciesBox.append(button);
    return { id: sp.id, button, canvas };
  });
  const paletteBox = document.getElementById('palettes')!;
  const paletteButtons = catalog().palettes.map((p) => {
    const button = el('button', { type: 'button', className: 'swatch', title: p.name });
    button.setAttribute('aria-label', p.name);
    button.addEventListener('click', () => void change({ palette: p.id }));
    paletteBox.append(button);
    return { id: p.id, button };
  });
  const characterBox = document.getElementById('characters')!;
  const characterButtons = Object.entries(PERSONALITIES).map(([id, p]) => {
    const button = el('button', { type: 'button', className: 'character' });
    button.append(el('strong', { textContent: p.name }), el('span', { textContent: p.description }));
    button.addEventListener('click', () => void change({ character: id }));
    characterBox.append(button);
    return { id, button };
  });

  // Find: the menu is in the menu bar on a Mac and in the system tray on Windows.
  if (/Windows/i.test(navigator.userAgent)) {
    document.getElementById('menu-place')!.textContent = 'System tray';
    document.getElementById('menu-tip')!.textContent = 'My icon near the clock (maybe behind the little arrow) opens my menu.';
  }

  // Extras: town, birthday, habits.
  const placeStatus = document.getElementById('place-status')!;
  const placeResults = document.getElementById('place-results')!;
  const showPlace = () => {
    placeStatus.textContent = config.place ? `Weather for ${config.place.name}.` : '';
  };
  document.getElementById('place-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('place-name') as HTMLInputElement).value.trim();
    if (!name) return;
    placeResults.replaceChildren();
    placeStatus.textContent = 'Looking…';
    try {
      const places = parsePlaces(await bridge.findPlace(name));
      placeStatus.textContent = places.length ? 'Which one?' : 'No town with that name found.';
      for (const p of places) {
        const button = el('button', { type: 'button', className: 'pill', textContent: p.name });
        button.addEventListener('click', async () => {
          placeResults.replaceChildren();
          await change({ place: p, weather: true });
          showPlace();
        });
        placeResults.append(button);
      }
    } catch (err) {
      placeStatus.textContent = String(err).replace(/^Error: /, '');
    }
  });
  const birthday = document.getElementById('birthday') as HTMLInputElement;
  birthday.addEventListener('change', () => void change({ birthday: birthday.value ? birthday.value.slice(5) : null }));
  const autostart = document.getElementById('autostart') as HTMLInputElement;
  autostart.checked = await bridge.getAutostart();
  autostart.addEventListener('change', async () => {
    await bridge.setAutostart(autostart.checked);
    autostart.checked = await bridge.getAutostart();
  });
  const updates = document.getElementById('updates') as HTMLInputElement;
  updates.addEventListener('change', () => void change({ checkUpdates: updates.checked }));

  function refresh(): void {
    for (const card of speciesCards) {
      paint(card.canvas, card.id, looks());
      card.button.setAttribute('aria-pressed', String(card.id === config.species));
    }
    for (const { id, button } of paletteButtons) {
      const p = PALETTES[id] ?? ownPalette(config.species);
      button.style.background = id === 'default' ? `linear-gradient(135deg, ${p.b} 50%, ${p.s} 50%)` : p.b;
      button.setAttribute('aria-pressed', String(id === config.palette));
    }
    for (const { id, button } of characterButtons) button.setAttribute('aria-pressed', String(id === config.character));
    updates.checked = config.checkUpdates;
    birthday.value = config.birthday ? `2000-${config.birthday}` : '';
    showPlace();
  }
  bridge.onConfigChanged((c) => {
    config = c;
    refresh();
  });
  refresh();

  // Moving through the steps.
  const back = document.getElementById('back') as HTMLButtonElement;
  const next = document.getElementById('next') as HTMLButtonElement;
  const dots = document.getElementById('dots')!;
  const dotList = STEPS.map(() => dots.appendChild(el('span')));
  const show = (s: Step) => {
    step = s;
    const i = STEPS.indexOf(s);
    for (const section of document.querySelectorAll<HTMLElement>('.step')) section.hidden = section.dataset.step !== s;
    document.querySelector<HTMLElement>('.welcome')!.dataset.step = s;
    dotList.forEach((d, j) => d.classList.toggle('on', j === i));
    back.style.visibility = i === 0 || s === 'done' ? 'hidden' : 'visible';
    next.textContent = s === 'hello' ? 'Let’s go' : s === 'done' ? 'Start' : 'Next';
    next.focus();
  };
  next.addEventListener('click', () => {
    const i = STEPS.indexOf(step);
    if (step === 'done') void bridge.closeWindow();
    else show(STEPS[i + 1]);
  });
  back.addEventListener('click', () => show(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]));
  show('hello');
}

start().catch((e) => bridge.log(`welcome: ${String(e)}`));
