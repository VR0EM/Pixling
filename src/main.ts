import './styles.css';
import { Brain, type Input } from './buddy/brain.ts';
import { View } from './buddy/view.ts';
import * as bridge from './platform/bridge.ts';
import { catalog } from './sprites/index.ts';

const GREETINGS = ['Hoi! Ik ben je Pixling.', 'Daar ben ik weer!', 'Hallo hallo!'];

async function start(): Promise<void> {
  const canvas = document.getElementById('buddy') as HTMLCanvasElement;
  const bubble = document.getElementById('bubble') as HTMLElement;
  const view = new View(canvas, bubble);
  const brain = new Brain(window.innerWidth, window.innerHeight);

  let look = await bridge.getConfig();
  await bridge.setCatalog(catalog());
  bridge.onConfigChanged((config) => {
    look = config;
    brain.pet();
  });
  window.addEventListener('resize', () => brain.resize(window.innerWidth, window.innerHeight));

  // Where the cursor is and when it last moved. The overlay usually lets clicks through, so it can't
  // rely on mouse events; it asks the app instead, more often when the cursor is close.
  let cursor: Input['cursor'] = null;
  let lastMove = performance.now();
  let clickThrough = true;
  let pressed: { x: number; y: number } | null = null;
  let dragging = false;

  const poll = async () => {
    let near = false;
    try {
      const c = await bridge.cursor();
      const now = performance.now();
      if (c && (!cursor || Math.abs(c.x - cursor.x) + Math.abs(c.y - cursor.y) > 0.5)) lastMove = now;
      cursor = c;
      const over = c !== null && view.hit(c.x, c.y);
      const through = !(over || pressed || brain.mode === 'drag');
      if (through !== clickThrough) {
        await bridge.setClickThrough(through);
        clickThrough = through;
      }
      near = c !== null && Math.abs(c.x - brain.x) < 300 && Math.abs(c.y - brain.y) < 300;
    } catch (e) {
      bridge.log(`cursor opvragen mislukt: ${String(e)}`);
    } finally {
      setTimeout(() => void poll(), near ? 33 : 120);
    }
  };
  void poll();

  // Right-click opens the same menu as the menu bar icon; the browser's own menu never shows.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('contextmenu', () => void bridge.showMenu());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    pressed = { x: e.clientX, y: e.clientY };
    dragging = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    if (!dragging && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 4) {
      dragging = true;
      brain.grab(pressed.x, pressed.y, e.timeStamp / 1000);
      canvas.classList.add('dragging');
    }
    if (dragging) brain.dragTo(e.clientX, e.clientY, e.timeStamp / 1000);
  });
  const letGo = () => {
    if (!pressed) return;
    if (dragging) brain.release();
    else brain.pet();
    pressed = null;
    dragging = false;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);

  // The loop runs every frame while the buddy flies or is dragged, and at about 20 fps otherwise.
  let last = performance.now();
  let lastDraw = 0;
  const frame = (now: number) => {
    const busy = brain.mode === 'fall' || brain.mode === 'drag';
    if (busy || now - lastDraw >= 50) {
      const input: Input = { cursor, idleMs: now - lastMove };
      brain.update((now - last) / 1000, input);
      last = now;
      lastDraw = now;
      view.draw(look, brain.pose(input), brain.x, brain.y, now);
      brain.margin = view.halfWidth;
      brain.tall = view.height;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  view.say(GREETINGS[Math.floor(Math.random() * GREETINGS.length)], 4000, performance.now());
}

window.addEventListener('error', (e) => bridge.log(`fout: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => bridge.log(`fout: ${String(e.reason)}`));

start().catch((e) => bridge.log(`starten mislukt: ${String(e)}`));
