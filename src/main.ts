import './styles.css';
import { Backpack } from './buddy/backpack.ts';
import { Brain, type Input } from './buddy/brain.ts';
import { ITEM_FOR, contextFor } from './buddy/context.ts';
import { momentFor } from './buddy/moments.ts';
import { SystemWatch, type SystemReaction } from './buddy/system-watch.ts';
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
  let front = await bridge.activeApp();
  const applyContext = () => {
    brain.context = look.watchApps ? contextFor(front) : null;
  };
  applyContext();
  await bridge.setCatalog(catalog());
  bridge.onConfigChanged((config) => {
    look = config;
    applyContext();
    brain.pet();
  });
  bridge.onActiveApp((app) => {
    front = app;
    applyContext();
  });
  window.addEventListener('resize', () => brain.resize(window.innerWidth, window.innerHeight));

  // The backpack: focus timer and reminders, checked once a second.
  const backpack = new Backpack(Date.now());
  const backpackSettings = () => ({
    water: look.water,
    breaks: look.breaks,
    focusMinutes: look.focusMinutes,
    breakMinutes: look.breakMinutes,
  });
  let advice = backpack.update(Date.now(), 0, backpackSettings());

  // Battery and processor; the app reports changes every half minute.
  const systemWatch = new SystemWatch();
  let system = await bridge.systemInfo();
  let reaction: SystemReaction = systemWatch.react(system, look.watchSystem);
  bridge.onSystem((info) => {
    system = info;
    reaction = systemWatch.react(info, look.watchSystem);
    if (reaction.say) view.say(reaction.say, 6000, performance.now());
  });
  let trayTitle: string | null = null;
  const checkBackpack = () => {
    advice = backpack.update(Date.now(), performance.now() - lastMove, backpackSettings());
    brain.stayPut = advice.stayPut;
    if (!look.watchSystem) reaction = { tired: false, sweaty: false };
    brain.tired = advice.tired || reaction.tired;
    brain.sweaty = reaction.sweaty;
    if (advice.say) view.say(advice.say, 5000, performance.now());
    if (advice.trayTitle !== trayTitle) {
      trayTitle = advice.trayTitle;
      void bridge.setTrayTitle(trayTitle);
    }
  };
  bridge.onBackpack((command) => {
    if (command === 'start') backpack.startFocus(Date.now(), backpackSettings());
    else backpack.stopFocus();
    checkBackpack();
  });

  // Where the cursor is and when it last moved. The overlay usually lets clicks through, so it can't
  // rely on mouse events; it asks the app instead, more often when the cursor is close.
  let cursor: Input['cursor'] = null;
  let lastMove = performance.now();
  let clickThrough = true;
  let pressed: { x: number; y: number } | null = null;
  let dragging = false;

  const pollCursor = async () => {
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
      setTimeout(() => void pollCursor(), near ? 33 : 120);
    }
  };
  void pollCursor();
  setInterval(checkBackpack, 1000);

  bridge.log(`gestart; app vooraan: ${front?.name ?? 'onbekend'}`);

  // The windows of other apps, as places to stand. Often while riding one, rarely otherwise.
  let firstLook = true;
  const pollWindows = async () => {
    try {
      const list = look.climbWindows ? await bridge.windows() : [];
      if (firstLook && look.climbWindows) bridge.log(`vensters gezien: ${list.length}`);
      firstLook = false;
      brain.setWindows(list);
    } catch (e) {
      bridge.log(`vensters opvragen mislukt: ${String(e)}`);
    } finally {
      const busy = brain.standingOn !== null || brain.mode === 'fall' || brain.mode === 'drag';
      setTimeout(() => void pollWindows(), busy ? 33 : 400);
    }
  };
  void pollWindows();

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
    else {
      // A click answers a reminder (water, a break) as well as being a pat on the head.
      if (backpack.answer(Date.now())) checkBackpack();
      brain.pet();
    }
    pressed = null;
    dragging = false;
    canvas.classList.remove('dragging');
    void bridge.giveBackFocus();
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);

  // Right-click opens the same menu as the menu bar icon; the browser's own menu never shows.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('contextmenu', () => void bridge.showMenu());
  canvas.addEventListener('dblclick', () => void bridge.openWardrobe());

  // Notes: say so when one is added.
  let openNotes = (await bridge.getNotes()).filter((n) => !n.done).length;
  bridge.onNotesChanged((open) => {
    if (open > openNotes) {
      view.say('Genoteerd!', 2500, performance.now());
      brain.pet();
    }
    openNotes = open;
  });

  // Files dragged onto the buddy get eaten; then a menu asks what to do with them.
  let tasting = false;
  bridge.onFileDrop((kind, paths, x, y) => {
    const onBuddy = view.hit(x, y, 24);
    if (kind === 'over' && onBuddy && !tasting) brain.notice('uitroep');
    tasting = kind === 'over' && onBuddy;
    if (kind === 'drop' && onBuddy && paths.length > 0) {
      brain.pet();
      view.say('Nom!', 1500, performance.now());
      void bridge.fileMenu(paths);
    }
  });
  bridge.onFileDone((message) => view.say(message, 4000, performance.now()));

  // Every frame while flying, being dragged or riding a window; about 20 fps otherwise.
  let last = performance.now();
  let lastDraw = 0;
  let lastStand: number | null = null;
  const frame = (now: number) => {
    const busy = brain.mode === 'fall' || brain.mode === 'drag' || brain.standingOn !== null;
    if (busy || now - lastDraw >= 50) {
      const input: Input = { cursor, idleMs: now - lastMove };
      brain.update((now - last) / 1000, input);
      last = now;
      lastDraw = now;
      // Priority: the backpack, then the app in front, then the time of day.
      const moment = momentFor(new Date());
      const item = advice.item ?? (brain.context ? ITEM_FOR[brain.context] : undefined) ?? moment.item;
      const shown = look.accessory === 'geen' && moment.hat ? { ...look, accessory: moment.hat } : look;
      view.draw(shown, brain.pose(input), brain.x, brain.y, now, item);
      if (brain.standingOn !== lastStand) {
        bridge.log(brain.standingOn === null ? 'van het venster af' : `op venster ${brain.standingOn}`);
        lastStand = brain.standingOn;
      }
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
