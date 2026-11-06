import '@fontsource/pixelify-sans/500.css';
import './wardrobe.css';
import './diary-page.css';
import { dayKey, daysTogether, emptyDay, sentence, type Diary } from './buddy/diary.ts';
import { isCharacter } from './buddy/voice.ts';
import * as bridge from './platform/bridge.ts';
import { emotePixels } from './sprites/emotes.ts';
import { ACCESSORIES, ITEMS, colours, render } from './sprites/index.ts';
import { STICKERS, earned, totals, type Sticker } from './buddy/stickers.ts';

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fullDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const parse = (key: string) => new Date(`${key}T12:00:00`);

async function draw(): Promise<void> {
  const config = await bridge.getConfig();
  const diary = await bridge.getDiary<Diary>();
  const days = diary.days ?? {};
  const today = dayKey(new Date());
  const character = isCharacter(config.character) ? config.character : 'sweet';
  const metOn = config.metOn ?? today;

  const n = daysTogether(metOn, today);
  document.getElementById('together')!.textContent = n === 1 ? 'Our first day together!' : `Buddies for ${n} days`;
  document.getElementById('since')!.textContent = `Since ${fullDate.format(parse(metOn))}`;
  document.getElementById('today')!.textContent = sentence(days[today] ?? emptyDay(), character);

  const list = document.getElementById('days')!;
  list.replaceChildren();
  const past = Object.keys(days)
    .filter((k) => k < today)
    .sort()
    .reverse();
  for (const key of past) {
    const li = document.createElement('li');
    const time = Object.assign(document.createElement('time'), { textContent: longDate.format(parse(key)) });
    const text = Object.assign(document.createElement('span'), { textContent: days[key].sentence ?? sentence(days[key], character) });
    li.append(time, text);
    list.append(li);
  }
  document.getElementById('empty')!.hidden = past.length > 0;

  // The buddy itself, looking at you.
  const canvas = document.getElementById('preview') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  const sprite = render(config.species, {
    palette: config.palette === 'default' ? undefined : config.palette,
    accessory: config.accessory === 'none' ? undefined : config.accessory,
  });
  sprite.pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
}

/** A sticker's picture: an emote, an item, an accessory or a buddy, drawn 32×32 and centred. */
function paintIcon(canvas: HTMLCanvasElement, icon: Sticker['icon']): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  let pixels: (string | null)[][] = [];
  if (icon.species) pixels = render(icon.species).pixels;
  else if (icon.emote) pixels = emotePixels(icon.emote);
  else {
    const rows = icon.item ? ITEMS[icon.item]?.rows : ACCESSORIES[icon.accessory ?? '']?.rows;
    const pal = colours('robot');
    pixels = (rows ?? []).map((r) => [...r].map((k) => (k === '.' ? null : (pal[k] ?? null))));
  }
  const h = pixels.length;
  const w = Math.max(0, ...pixels.map((r) => r.length));
  const k = icon.species ? 1 : Math.max(1, Math.floor(26 / Math.max(w, h)));
  const ox = Math.floor((32 - w * k) / 2);
  const oy = Math.floor((32 - h * k) / 2);
  pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(ox + x * k, oy + y * k, k, k);
    }),
  );
}

async function drawStickers(): Promise<void> {
  const config = await bridge.getConfig();
  const diary = await bridge.getDiary<Diary>();
  const have = new Set(earned(totals(diary, config.metOn, dayKey(new Date()))));
  document.getElementById('stickers-title')!.textContent = `Stickers · ${have.size} of ${STICKERS.length}`;
  const list = document.getElementById('stickers')!;
  list.replaceChildren();
  for (const sticker of STICKERS) {
    const li = document.createElement('li');
    li.classList.toggle('locked', !have.has(sticker.id));
    const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
    paintIcon(canvas, sticker.icon);
    const name = Object.assign(document.createElement('strong'), { textContent: sticker.name });
    const hint = Object.assign(document.createElement('small'), { textContent: sticker.hint });
    li.append(canvas, name, hint);
    list.append(li);
  }
}

draw().catch((e) => bridge.log(`diary: ${String(e)}`));
drawStickers().catch((e) => bridge.log(`stickers: ${String(e)}`));
setInterval(() => void drawStickers(), 15_000);
// The buddy saves a few seconds after something happens; keep the page fresh while it's open.
setInterval(() => void draw(), 5000);
bridge.onConfigChanged(() => void draw());
