import '@fontsource/pixelify-sans/500.css';
import './wardrobe.css';
import './diary-page.css';
import { dayKey, daysTogether, emptyDay, sentence, type Diary } from './buddy/diary.ts';
import { isCharacter } from './buddy/voice.ts';
import * as bridge from './platform/bridge.ts';
import { render } from './sprites/index.ts';

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

draw().catch((e) => bridge.log(`diary: ${String(e)}`));
// The buddy saves a few seconds after something happens; keep the page fresh while it's open.
setInterval(() => void draw(), 5000);
bridge.onConfigChanged(() => void draw());
