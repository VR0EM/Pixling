import './wardrobe.css';
import { occurrences, parseIcs } from './buddy/calendar.ts';
import { PERSONALITIES } from './buddy/voice.ts';
import * as bridge from './platform/bridge.ts';
import { PALETTES, accessory, allSpecies, catalog, ownPalette, render, setCreations, species, type Creation, type RenderOptions } from './sprites/index.ts';

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
  setCreations(await bridge.getCreations<Creation>());
  const list = catalog();

  const change = async (patch: Partial<Config>) => {
    config = await bridge.updateConfig(patch);
    refresh();
  };

  const looks = (o: RenderOptions = {}): RenderOptions => ({
    palette: config.palette === 'default' ? undefined : config.palette,
    accessory: config.accessory === 'none' ? undefined : config.accessory,
    ...o,
  });

  /** Opens the studio on a particular kind of drawing; both pages share the same storage. */
  const openStudio = (slot: 'buddy' | 'hat') => {
    try {
      localStorage.setItem('pixling.studio.start', slot);
    } catch {
      // Without storage the studio simply starts with a buddy.
    }
    void bridge.openStudio();
  };

  // Species cards, each showing the species in the chosen colour and accessory; home-made ones included.
  const speciesBox = document.getElementById('species')!;
  let speciesCards: { id: string; button: HTMLButtonElement; canvas: HTMLCanvasElement }[] = [];
  const buildSpecies = () => {
    speciesBox.replaceChildren();
    speciesCards = allSpecies().map((sp) => {
      const button = el('button', { type: 'button', className: 'card' });
      const canvas = el('canvas', { width: 32, height: 32 });
      button.append(canvas, el('span', { textContent: sp.name }));
      button.addEventListener('click', () => void change({ species: sp.id }));
      speciesBox.append(button);
      return { id: sp.id, button, canvas };
    });
    const draw = el('button', { type: 'button', className: 'card new' });
    draw.append(el('span', { className: 'plus', textContent: '+' }), el('span', { textContent: 'Draw your own…' }));
    draw.addEventListener('click', () => openStudio('buddy'));
    speciesBox.append(draw);
  };
  buildSpecies();

  const paletteBox = document.getElementById('palettes')!;
  const paletteButtons = list.palettes.map((p) => {
    const button = choice(paletteBox, '', 'swatch', () => void change({ palette: p.id }));
    button.title = p.name;
    button.setAttribute('aria-label', p.name);
    return { id: p.id, button };
  });

  // Accessories, including home-made ones; rebuilt when the studio saves something.
  const accessoryBox = document.getElementById('accessories')!;
  let accessoryButtons: { id: string; button: HTMLButtonElement }[] = [];
  const buildAccessories = () => {
    accessoryBox.replaceChildren();
    accessoryButtons = catalog().accessories.map((a) => ({
      id: a.id,
      button: choice(accessoryBox, a.name, 'pill', () => void change({ accessory: a.id })),
    }));
    choice(accessoryBox, 'Draw your own…', 'pill', () => openStudio('hat'));
  };
  buildAccessories();
  bridge.onCreationsChanged<Creation>((creations) => {
    setCreations(creations);
    buildSpecies();
    buildAccessories();
    refresh();
  });

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

  const characterBox = document.getElementById('characters')!;
  const characterButtons = Object.entries(PERSONALITIES).map(([id, p]) => {
    const button = el('button', { type: 'button', className: 'character' });
    button.append(el('strong', { textContent: p.name }), el('span', { textContent: p.description }));
    button.addEventListener('click', () => void change({ character: id }));
    characterBox.append(button);
    return { id, button };
  });

  const habits: [keyof Config | 'autostart', string][] = [
    ['watchApps', 'Watches your apps'],
    ['climbWindows', 'Climbs windows'],
    ['quirks', 'Buddy quirks (charging, coffee, flying, …)'],
    ['water', 'Water reminder'],
    ['breaks', 'Break reminder'],
    ['watchSystem', 'Watches battery and load'],
    ['autostart', 'Start at login'],
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

  // The calendar: secret iCal addresses, each shown with its name and what's coming up.
  const calendarToggles: [keyof Config, string][] = [
    ['meetingAlerts', 'Heads-up before meetings, and what’s on in the morning'],
    ['hideInCalls', 'Fades into the background during video calls'],
  ];
  const calendarToggleBox = document.getElementById('calendar-toggles')!;
  const calendarInputs = calendarToggles.map(([key, label]) => {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => void change({ [key]: input.checked } as Partial<Config>));
    const row = el('label', { className: 'toggle' });
    row.append(input, el('span', { textContent: label }));
    calendarToggleBox.append(row);
    return { key, input };
  });
  const calendarStatus = document.getElementById('calendar-status')!;
  const calendarUrl = document.getElementById('calendar-url') as HTMLInputElement;
  const service = (url: string) => {
    if (/google\.com/i.test(url)) return 'Google Calendar';
    if (/icloud\.com/i.test(url)) return 'iCloud';
    if (/outlook|office365|live\.com/i.test(url)) return 'Outlook';
    try {
      return new URL(url.replace(/^webcal:/i, 'https:')).hostname;
    } catch {
      return 'Calendar';
    }
  };
  /** Reads a calendar to show its name and what's in the coming week. */
  const describe = async (url: string): Promise<{ name: string; detail: string; ok: boolean }> => {
    try {
      const cal = parseIcs(await bridge.fetchCalendar(url));
      const now = Date.now();
      const week = occurrences(cal.events, now, now + 7 * 24 * 3_600_000).length;
      const name = cal.name ? `${cal.name} · ${service(url)}` : service(url);
      if (!cal.events.length && !cal.name) return { name, detail: 'That address didn’t give a calendar.', ok: false };
      return { name, detail: week === 1 ? '1 thing in the next 7 days' : `${week} things in the next 7 days`, ok: true };
    } catch (e) {
      return { name: service(url), detail: String(e).replace(/^Error: /, ''), ok: false };
    }
  };
  const calendarList = document.getElementById('calendar-list')!;
  let drawnCalendars = '';
  const drawCalendars = () => {
    if (drawnCalendars === JSON.stringify(config.calendars)) return;
    drawnCalendars = JSON.stringify(config.calendars);
    calendarList.replaceChildren();
    for (const url of config.calendars) {
      const label = el('span');
      const name = el('strong', { textContent: service(url) });
      const detail = el('small', { textContent: 'Reading…' });
      label.append(name, detail);
      const remove = el('button', { type: 'button', textContent: 'Remove' });
      remove.addEventListener('click', () => void change({ calendars: config.calendars.filter((u) => u !== url) }));
      const li = el('li');
      li.append(label, remove);
      calendarList.append(li);
      void describe(url).then((d) => {
        name.textContent = d.name;
        detail.textContent = d.detail;
        detail.classList.toggle('error', !d.ok);
      });
    }
  };
  document.getElementById('calendar-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = calendarUrl.value.trim();
    calendarStatus.classList.remove('error');
    if (!url) return;
    if (config.calendars.includes(url)) {
      calendarStatus.textContent = 'That calendar is already there.';
      return;
    }
    calendarStatus.textContent = 'Reading the calendar…';
    const d = await describe(url);
    if (!d.ok) {
      calendarStatus.textContent = d.detail;
      calendarStatus.classList.add('error');
      return;
    }
    calendarUrl.value = '';
    calendarStatus.textContent = `Added ${d.name}: ${d.detail}.`;
    await change({ calendars: [...config.calendars, url] });
  });

  const summary = document.getElementById('summary')!;
  const preview = document.getElementById('preview') as HTMLCanvasElement;

  function refresh(): void {
    const sp = species(config.species);
    const paletteName = PALETTES[config.palette]?.name ?? 'own colours';
    const accessoryName = accessory(config.accessory)?.name.toLowerCase() ?? 'no accessory';
    summary.textContent = `${sp.name} · ${paletteName.toLowerCase()} · ${accessoryName}`;

    for (const card of speciesCards) {
      paint(card.canvas, card.id, looks());
      card.button.setAttribute('aria-pressed', String(card.id === config.species));
    }
    for (const { id, button } of paletteButtons) {
      const p = PALETTES[id] ?? ownPalette(sp.id);
      button.style.background = id === 'default' ? `linear-gradient(135deg, ${p.b} 50%, ${p.s} 50%)` : p.b;
      button.setAttribute('aria-pressed', String(id === config.palette));
    }
    for (const { id, button } of accessoryButtons) button.setAttribute('aria-pressed', String(id === config.accessory));
    for (const { id, button } of scaleButtons) button.setAttribute('aria-pressed', String(id === config.scale));
    for (const { id, button } of characterButtons) button.setAttribute('aria-pressed', String(id === config.character));
    for (const { id, button } of focusButtons) button.setAttribute('aria-pressed', String(id === config.focusMinutes));
    for (const { key, input } of habitInputs) input.checked = key === 'autostart' ? autostart : Boolean(config[key]);
    for (const { key, input } of calendarInputs) input.checked = Boolean(config[key]);
    drawCalendars();
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

start().catch((e) => bridge.log(`wardrobe: ${String(e)}`));
