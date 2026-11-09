import './wardrobe.css';
import { occurrences, parseIcs } from './buddy/calendar.ts';
import type { Diary } from './buddy/diary.ts';
import { STICKERS, earned, totals } from './buddy/stickers.ts';
import { parsePlaces, parseWeather } from './buddy/weather.ts';
import { PERSONALITIES } from './buddy/voice.ts';
import * as bridge from './platform/bridge.ts';
import {
  ACCESSORIES,
  PALETTES,
  accessory,
  allSpecies,
  available,
  catalog,
  ownPalette,
  render,
  setCreations,
  setUnlocked,
  species,
  type Creation,
  type RenderOptions,
} from './sprites/index.ts';

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
  /** Everything below is built; until then refresh() leaves the fun section alone. */
  let ready = false;
  // Accessories you earn with stickers, unless everything is unlocked.
  const unlock = async () => {
    const diary = await bridge.getDiary<Diary>();
    const today = new Date().toISOString().slice(0, 10);
    setUnlocked(config.unlockAll ? 'all' : earned(totals(diary, config.metOn, today)));
  };
  await unlock();
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

  // A friend: none, or any buddy, in its own colour and character.
  const friendBox = document.getElementById('friends')!;
  let friendCards: { id: string; button: HTMLButtonElement; canvas: HTMLCanvasElement | null }[] = [];
  const buildFriends = () => {
    friendBox.replaceChildren();
    const none = el('button', { type: 'button', className: 'card none' });
    none.append(el('span', { className: 'plus', textContent: 'none' }), el('span', { textContent: 'No friend' }));
    none.addEventListener('click', () => void change({ friend: 'none' }));
    friendBox.append(none);
    friendCards = [{ id: 'none', button: none, canvas: null }];
    for (const sp of allSpecies()) {
      const button = el('button', { type: 'button', className: 'card' });
      const canvas = el('canvas', { width: 32, height: 32 });
      button.append(canvas, el('span', { textContent: sp.name }));
      button.addEventListener('click', () => void change({ friend: sp.id }));
      friendBox.append(button);
      friendCards.push({ id: sp.id, button, canvas });
    }
  };
  buildFriends();
  const friendPaletteBox = document.getElementById('friend-palettes')!;
  const friendPaletteButtons = list.palettes.map((p) => {
    const button = choice(friendPaletteBox, '', 'swatch', () => void change({ friendPalette: p.id }));
    button.title = `Friend: ${p.name}`;
    button.setAttribute('aria-label', `Friend: ${p.name}`);
    return { id: p.id, button };
  });
  const friendCharacterBox = document.getElementById('friend-characters')!;
  const friendCharacterButtons = Object.entries(PERSONALITIES).map(([id, p]) => ({
    id,
    button: choice(friendCharacterBox, p.name, 'pill', () => void change({ friendCharacter: id })),
  }));

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
    // Still to earn: shown with how.
    for (const a of Object.values(ACCESSORIES)) {
      if (a.hidden || available(a)) continue;
      const hint = STICKERS.find((st) => st.id === a.reward)?.hint ?? 'Earn it with a sticker';
      const button = choice(accessoryBox, `🔒 ${a.name}`, 'pill locked', () => {});
      button.title = hint;
      button.setAttribute('aria-disabled', 'true');
    }
    choice(accessoryBox, 'Draw your own…', 'pill', () => openStudio('hat'));
  };
  buildAccessories();
  bridge.onCreationsChanged<Creation>((creations) => {
    setCreations(creations);
    buildSpecies();
    buildFriends();
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
    ['hideFullscreen', 'Hides while an app fills the screen'],
    ['hideCalls', 'Hides during calls (while the microphone is on)'],
    // Only macOS's window screenshots trip over the overlay.
    ...(/Mac/i.test(navigator.userAgent)
      ? ([['skipWindowScreenshots', 'Window screenshots (⌘⇧4, then Space) look past it']] as [keyof Config, string][])
      : []),
    ['quirks', 'Buddy quirks (charging, coffee, flying, …)'],
    ['water', 'Water reminder'],
    ['breaks', 'Break reminder'],
    ['watchSystem', 'Watches battery and load'],
    ['autostart', 'Start at login'],
    ['checkUpdates', 'Looks for new versions'],
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
    const friendLooks: RenderOptions = { palette: config.friendPalette === 'default' ? undefined : config.friendPalette };
    for (const card of friendCards) {
      if (card.canvas) paint(card.canvas, card.id, friendLooks);
      card.button.setAttribute('aria-pressed', String(card.id === config.friend));
    }
    const friendOn = config.friend !== 'none';
    friendPaletteBox.parentElement!.hidden = !friendOn;
    for (const { id, button } of friendPaletteButtons) {
      const p = PALETTES[id] ?? ownPalette(friendOn ? config.friend : config.species);
      button.style.background = id === 'default' ? `linear-gradient(135deg, ${p.b} 50%, ${p.s} 50%)` : p.b;
      button.setAttribute('aria-pressed', String(id === config.friendPalette));
    }
    for (const { id, button } of friendCharacterButtons) button.setAttribute('aria-pressed', String(id === config.friendCharacter));
    for (const { id, button } of focusButtons) button.setAttribute('aria-pressed', String(id === config.focusMinutes));
    for (const { key, input } of habitInputs) input.checked = key === 'autostart' ? autostart : Boolean(config[key]);
    for (const { key, input } of calendarInputs) input.checked = Boolean(config[key]);
    drawCalendars();
    if (ready) refreshFun();
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

  // Fun: games, holidays, stickers, and your birthday.
  const funToggles: [keyof Config, string][] = [
    ['games', 'Asks to play now and then'],
    ['seasons', 'Holidays and birthdays: a pumpkin, a Santa hat, snow, Easter eggs, cake'],
    ['stickers', 'Celebrates new stickers'],
    ['unlockAll', 'Every accessory right away, without earning it'],
    ['weather', 'Dresses for the weather'],
  ];
  const funBox = document.getElementById('fun')!;
  const funInputs = funToggles.map(([key, label]) => {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => void change({ [key]: input.checked } as Partial<Config>));
    const row = el('label', { className: 'toggle' });
    row.append(input, el('span', { textContent: label }));
    funBox.append(row);
    return { key, input };
  });
  const birthday = document.getElementById('birthday') as HTMLInputElement;
  birthday.addEventListener('change', () => void change({ birthday: birthday.value ? birthday.value.slice(5) : null }));
  document.getElementById('birthday-clear')!.addEventListener('click', () => void change({ birthday: null }));

  // Weather: find your town by name, then pick it.
  const placeStatus = document.getElementById('place-status')!;
  const placeResults = document.getElementById('place-results')!;
  const showPlace = async () => {
    if (!config.place) {
      placeStatus.textContent = 'No town picked yet.';
      return;
    }
    placeStatus.textContent = config.place.name;
    try {
      const w = parseWeather(await bridge.fetchWeather(config.place.lat, config.place.lon));
      if (w) placeStatus.textContent = `${config.place.name} · ${Math.round(w.temp)}°, ${w.sky === 'clear' ? 'clear' : w.sky}`;
    } catch {
      // The name alone will do.
    }
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
        choice(placeResults, p.name, 'pill', async () => {
          placeResults.replaceChildren();
          await change({ place: p, weather: true });
          void showPlace();
        });
      }
    } catch (err) {
      placeStatus.textContent = String(err).replace(/^Error: /, '');
    }
  });
  void showPlace();

  let lastUnlock = config.unlockAll;
  bridge.onConfigChanged((c) => {
    config = c;
    if (c.unlockAll !== lastUnlock) {
      lastUnlock = c.unlockAll;
      void unlock().then(() => {
        buildAccessories();
        refresh();
      });
    }
    refresh();
  });
  function refreshFun(): void {
    for (const { key, input } of funInputs) input.checked = Boolean(config[key]);
    birthday.value = config.birthday ? `2000-${config.birthday}` : '';
  }
  ready = true;
  refresh();
}

start().catch((e) => bridge.log(`wardrobe: ${String(e)}`));
