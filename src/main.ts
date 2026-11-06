import '@fontsource/pixelify-sans/500.css';
import './styles.css';
import { Backpack } from './buddy/backpack.ts';
import { Brain, type BrainEvent, type Input, type Mode } from './buddy/brain.ts';
import { ITEM_FOR, contextFor } from './buddy/context.ts';
import { dayKey, emptyDay, sentence, type DayStats, type Diary } from './buddy/diary.ts';
import { momentFor } from './buddy/moments.ts';
import { SystemWatch, type SystemReaction } from './buddy/system-watch.ts';
import { Traits, type Reaction, type TraitLook } from './buddy/traits.ts';
import { View } from './buddy/view.ts';
import { PERSONALITIES, greetingFor, isCharacter, line, type Character, type Line, type Situation } from './buddy/voice.ts';
import { migrateConfig, migrateCreations, migrateDiary } from './legacy.ts';
import * as bridge from './platform/bridge.ts';
import { parsePixling } from './sprites/format.ts';
import { catalog, setCreations, type Creation } from './sprites/index.ts';

const MIN = 60_000;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

async function start(): Promise<void> {
  const canvas = document.getElementById('buddy') as HTMLCanvasElement;
  const bubble = document.getElementById('bubble') as HTMLElement;
  const view = new View(canvas, bubble);
  const brain = new Brain(window.innerWidth, window.innerHeight);

  let look = await bridge.getConfig();
  // Settings saved while Pixling was still in Dutch.
  const fixes = migrateConfig(look);
  if (fixes) look = await bridge.updateConfig(fixes);
  // Remember the day you met, the first time.
  if (!look.metOn) look = await bridge.updateConfig({ metOn: dayKey(new Date()) });

  const character = (): Character => (isCharacter(look.character) ? look.character : 'sweet');
  const personality = () => PERSONALITIES[character()];
  /** Says something in the buddy's own voice: its character, and for a built-in buddy its species. */
  const say = (what: Line | Situation, ms = 4500) => {
    const text = line(character(), typeof what === 'string' ? { key: what } : what, Math.random, look.species);
    if (text) view.say(text, ms, performance.now());
  };

  let front = await bridge.activeApp();
  const applyLook = () => {
    brain.context = look.watchApps ? contextFor(front) : null;
    brain.speed = personality().speed;
    brain.walkiness = personality().walkiness;
    // What only some buddies can do.
    brain.canFly = look.species === 'dragon';
    brain.canPhase = look.species === 'ghost';
    brain.hovers = look.species === 'ghost';
    brain.bouncy = look.species === 'shroom';
  };
  applyLook();
  // Home-made accessories and buddies from the studio, and the menu that lists them.
  let creations = await bridge.getCreations<Creation>();
  const renamed = migrateCreations(creations);
  if (renamed) {
    creations = renamed;
    await bridge.setCreations(creations);
  }
  setCreations(creations);
  const sendCatalog = () =>
    bridge.setCatalog({
      ...catalog(),
      characters: Object.entries(PERSONALITIES).map(([id, p]) => ({ id, name: p.name })),
    });
  await sendCatalog();
  bridge.onCreationsChanged<Creation>((list) => {
    creations = list;
    setCreations(list);
    void sendCatalog();
  });
  bridge.onConfigChanged((config) => {
    look = config;
    applyLook();
    brain.pet();
  });
  bridge.onActiveApp((app) => {
    front = app;
    applyLook();
  });
  window.addEventListener('resize', () => brain.resize(window.innerWidth, window.innerHeight));

  // The diary: today's counts, saved a few seconds after something happened. Finished days get their
  // sentence once, in the character the buddy had that evening.
  const diary = await bridge.getDiary<Diary>();
  diary.days ??= {};
  const oldDiary = migrateDiary(diary as never);
  let today = dayKey(new Date());
  let saveTimer: number | undefined;
  const saveDiary = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void bridge.setDiary(diary), 3000);
  };
  const closeOldDays = () => {
    let changed = false;
    for (const [key, day] of Object.entries(diary.days)) {
      if (key < today && !day.sentence) {
        day.sentence = sentence(day, character());
        changed = true;
      }
    }
    if (changed) saveDiary();
  };
  const count = (what: keyof DayStats, n = 1) => {
    const day = (diary.days[today] ??= emptyDay());
    day[what] += n;
    saveDiary();
  };
  closeOldDays();
  if (oldDiary) saveDiary();

  // The backpack: focus timer and reminders, checked once a second.
  const backpack = new Backpack(Date.now());
  const backpackSettings = () => ({
    water: look.water,
    breaks: look.breaks,
    focusMinutes: look.focusMinutes,
    breakMinutes: look.breakMinutes,
  });
  let advice = backpack.update(Date.now(), 0, backpackSettings());

  // What makes each built-in buddy itself: coffee, a battery, thirst, glowing spots. The sprout's growth
  // is kept in the diary.
  let traits = new Traits(look.species, diary.sprout);
  let traitLook: TraitLook = traits.look(Date.now(), new Date().getHours());
  const keepSprout = () => {
    if (JSON.stringify(diary.sprout) === JSON.stringify(traits.sprout)) return;
    diary.sprout = { ...traits.sprout };
    saveDiary();
  };
  /** Shows what a trait wants to say or show. */
  const react = (r: Reaction | undefined, ms = 4000) => {
    if (!r) return;
    if (r.emote) brain.notice(r.emote, 1.4);
    if (r.say) say(r.say, ms);
    keepSprout();
  };

  // Battery and processor; the app reports changes every half minute.
  const systemWatch = new SystemWatch();
  let reaction: SystemReaction = systemWatch.react(await bridge.systemInfo(), look.watchSystem);
  bridge.onSystem((info) => {
    reaction = systemWatch.react(info, look.watchSystem);
    if (reaction.say) say(reaction.say, 6000);
    // Plugging in the computer charges the robot too.
    if (reaction.say?.key === 'charging') react(traits.powered());
  });

  // Now and then it says something by itself, fitting what you're doing.
  let nextChat = performance.now() + between(...personality().chatter) * MIN;
  const chatter = (now: number) => {
    if (now < nextChat) return;
    nextChat = now + between(...personality().chatter) * MIN;
    const quiet = brain.stayPut || brain.mode === 'sleep' || now - lastMove > 2 * MIN || !bubble.hidden;
    if (quiet) return;
    const hour = new Date().getHours();
    const specific: Record<string, Situation> = { code: 'chatCode', music: 'chatMusic', video: 'chatVideo', game: 'chatGame' };
    let key: Situation = 'chat';
    if (hour >= 23 || hour < 5) key = 'chatNight';
    else if (brain.context && Math.random() < 0.6) key = specific[brain.context];
    say(key, 5000);
  };

  let trayTitle: string | null = null;
  const checkBackpack = () => {
    const now = new Date();
    if (dayKey(now) !== today) {
      today = dayKey(now);
      closeOldDays();
    }
    advice = backpack.update(now.getTime(), performance.now() - lastMove, backpackSettings());
    if (traits.species !== look.species) traits = new Traits(look.species, diary.sprout);
    const active = performance.now() - lastMove < 2 * MIN && brain.mode !== 'sleep';
    react(traits.tick(now.getTime(), active, today, now.getHours()), 5000);
    traitLook = traits.look(now.getTime(), now.getHours());
    brain.stayPut = advice.stayPut || traitLook.stayPut;
    brain.speed = personality().speed * traitLook.speed;
    if (!look.watchSystem) reaction = { tired: false, sweaty: false };
    brain.tired = advice.tired || reaction.tired;
    brain.sweaty = reaction.sweaty;
    if (advice.say) {
      if (advice.say.key === 'breakStart') count('focus');
      if (advice.say.key === 'cheers') count('water');
      say(advice.say, 5000);
      // Drinking water together waters the sprout.
      if (advice.say.key === 'cheers') react(traits.watered(today));
    }
    if (advice.trayTitle !== trayTitle) {
      trayTitle = advice.trayTitle;
      void bridge.setTrayTitle(trayTitle);
    }
    chatter(performance.now());
  };
  bridge.onBackpack((command) => {
    if (command === 'start') backpack.startFocus(Date.now(), backpackSettings());
    else backpack.stopFocus();
    checkBackpack();
  });

  // Where the cursor is and when it last moved. The overlay usually lets clicks through, so it can't
  // rely on mouse events; it asks the app instead, more often when the cursor is close.
  let cursor: Input['cursor'] = null;
  let fileDrag = false; // something (a file) is being dragged somewhere on screen
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
      cursor = c ? { x: c.x, y: c.y } : null;
      fileDrag = c?.dragging ?? false;
      // While a file is dragged, catch it on a wide area around the buddy so the drop lands here.
      const over = c !== null && view.hit(c.x, c.y, fileDrag ? 60 : 6);
      const through = !(over || pressed || brain.mode === 'drag');
      if (through !== clickThrough) {
        await bridge.setClickThrough(through);
        clickThrough = through;
      }
      near = fileDrag || (c !== null && Math.abs(c.x - brain.x) < 300 && Math.abs(c.y - brain.y) < 300);
    } catch (e) {
      bridge.log(`reading the cursor failed: ${String(e)}`);
    } finally {
      setTimeout(() => void pollCursor(), near ? 33 : 120);
    }
  };
  void pollCursor();
  setInterval(checkBackpack, 1000);

  bridge.log(`started; app in front: ${front?.name ?? 'unknown'}; character: ${character()}`);

  // The windows of other apps, as places to stand. Often while riding one, rarely otherwise.
  let firstLook = true;
  const pollWindows = async () => {
    try {
      const list = look.climbWindows ? await bridge.windows() : [];
      if (firstLook && look.climbWindows) bridge.log(`windows seen: ${list.length}`);
      firstLook = false;
      brain.setWindows(list);
    } catch (e) {
      bridge.log(`reading the windows failed: ${String(e)}`);
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
    if (dragging) {
      brain.release();
      if (Math.hypot(brain.vx, brain.vy) > 900) {
        count('throws');
        say('thrown', 2000);
      }
    } else {
      // A click answers a reminder (water, a break) as well as being a pat on the head.
      const answered = backpack.answer(Date.now());
      if (answered) checkBackpack();
      brain.pet();
      count('pets');
      // Or it refills the mug, plugs in the robot, waters the sprout...
      const wanted = answered ? undefined : traits.click(today);
      if (wanted) {
        react(wanted, 3500);
        traitLook = traits.look(Date.now(), new Date().getHours());
      } else if (!answered && Math.random() < personality().talksWhenPetted) say('petted', 2500);
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
      count('notes', open - openNotes);
      say('noted', 2500);
      brain.pet();
    }
    openNotes = open;
  });

  // Files dragged onto the buddy get eaten; then a menu asks what to do with them.
  let tasting = false;
  bridge.onFileDrop((kind, paths, x, y) => {
    // The cursor we track ourselves is the most reliable place of the drop; the event's own position
    // is only a fallback.
    const onBuddy = cursor ? view.hit(cursor.x, cursor.y, 60) : view.hit(x, y, 60);
    if (kind === 'drop') bridge.log(`file dropped (${paths.length}); on the buddy: ${onBuddy}`);
    if (kind === 'over' && onBuddy && !tasting) brain.notice('exclaim');
    tasting = kind === 'over' && onBuddy;
    if (kind === 'drop' && onBuddy && paths.length > 0) {
      brain.pet();
      void adopt(paths).then((added) => {
        if (added) return;
        count('files', paths.length);
        say('nom', 1500);
        void bridge.fileMenu(paths);
      });
    }
  });

  /** Pixling files dropped on the buddy are added right away: a new friend, or a new thing to wear. */
  const adopt = async (paths: string[]): Promise<boolean> => {
    if (!paths.every((p) => p.toLowerCase().endsWith('.json'))) return false;
    const found: Creation[] = [];
    for (const path of paths) {
      const result = parsePixling(await bridge.readTextFile(path).catch(() => ''));
      if (!result.ok) return false;
      found.push(...result.creations);
    }
    creations = [...creations, ...found];
    await bridge.setCreations(creations);
    const first = found[0];
    look = await bridge.updateConfig(first.slot === 'buddy' ? { species: first.id } : { accessory: first.id });
    say({ key: first.slot === 'buddy' ? 'newFriend' : 'newThing', vars: { name: first.name } }, 4000);
    bridge.log(`added ${found.length} Pixling file(s)`);
    return true;
  };
  bridge.onFileDone((message) => view.say(message, 4000, performance.now()));

  // Every frame while flying, being dragged or riding a window; about 20 fps otherwise.
  let last = performance.now();
  let lastDraw = 0;
  let lastStand: number | null = null;
  let lastMode: Mode = brain.mode;
  const frame = (now: number) => {
    const busy = brain.mode === 'fall' || brain.mode === 'drag' || brain.mode === 'fly' || brain.mode === 'phase' || brain.standingOn !== null;
    if (busy || now - lastDraw >= 50) {
      const input: Input = { cursor, idleMs: now - lastMove, dragging: fileDrag };
      brain.update((now - last) / 1000, input);
      last = now;
      lastDraw = now;
      // Priority: the backpack, then the app in front, then the time of day.
      const moment = momentFor(new Date());
      const item = advice.item ?? (brain.context ? ITEM_FOR[brain.context] : undefined) ?? moment.item;
      const shown = look.accessory === 'none' && moment.hat ? { ...look, accessory: moment.hat } : look;
      view.draw(shown, brain.pose(input), brain.x, brain.y, now, item, traitLook.render);
      // The dragon announces its flights, the ghost its tricks, the shroom its bounces (not every time).
      for (const event of brain.events.splice(0)) {
        const said: Partial<Record<BrainEvent, [Situation, number]>> = {
          takeoff: ['dragonTakeoff', 0.5],
          landed: ['dragonLanded', 0.3],
          vanish: ['ghostVanish', 0.35],
          appear: ['ghostAppear', 0.5],
          bounce: ['shroomBounce', 0.3],
        };
        const [key, chance] = said[event] ?? [];
        if (key && bubble.hidden && Math.random() < chance!) say(key, 2200);
      }
      if (brain.standingOn !== lastStand) {
        if (brain.standingOn !== null) {
          count('climbs');
          if (Math.random() < 0.3) say('onWindow', 2500);
        }
        lastStand = brain.standingOn;
      }
      if (lastMode === 'sleep' && brain.mode !== 'sleep' && Math.random() < 0.6) say('woke', 2500);
      lastMode = brain.mode;
      brain.margin = view.halfWidth;
      brain.tall = view.height;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  say({ key: 'greeting', vars: { greeting: greetingFor(new Date()) } }, 4500);
}

window.addEventListener('error', (e) => bridge.log(`error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => bridge.log(`error: ${String(e.reason)}`));

start().catch((e) => bridge.log(`starting failed: ${String(e)}`));
