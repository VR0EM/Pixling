# Pixling

A little pixel buddy that lives on your desktop. It walks along the bottom of your screen, watches your mouse, falls asleep when you're away and lets you pick it up and throw it. You change it from the icon in the menu bar.

![Every buddy in a few poses](docs/sprites.png)

## What it does (v0.8)

- Six buddies: Robot, Ghost, Sprout, Shroom, Mug and Dragon, plus any you draw or add yourself
- Eight colours, five accessories (party hat, crown, bow, beanie, sunglasses) and three sizes
- Walks around, breathes, blinks and looks at your cursor
- Falls asleep after a minute without mouse movement and wakes up as soon as you move it
- Pick it up and drag it; let go while moving and you throw it, with gravity and bouncing
- A click is a pat on the head: it hops and a heart appears; your own app stays active
- **Climbs your windows:** bring a window to the front and it jumps onto the top edge; drop it in front of a window and it jumps on. It rides along when you drag the window and falls off when you close it or yank it aside. Maximised windows leave no room above them, so it stays off those
- **Watches your apps:** a laptop for your code editor or terminal (it sits still and watches the code appear), music for Spotify or Music (headphones made for each buddy, and bobbing along), popcorn for video, a controller for Steam. It only knows *which* app is in front, never what happens in it
- **Backpack** (in the menu): a focus timer where it sits reading next to you while the time left shows next to the menu bar icon, followed by a break; a glass of water now and then; and after an hour of work it gets tired and yawns, and only later says so. Click it to answer a reminder
- **Notes** (in the menu): type, press Enter, done; tick off or throw away. Your buddy says "Noted!"
- **Battery and load:** under 20% it goes limp and says so (and again under 10%), it's happy when you plug in, and it sweats when your computer works hard
- **Feed it files:** drag a file onto your buddy and it eats it ("Nom!"); then pick: make a zip, convert to PNG or JPG, copy the path or show in Finder. The result lands next to the original
- **Character:** sweet, hyper, calm or cheeky (in the wardrobe or the menu). It decides what it says, how often it talks by itself, and how fast and how much it walks. Speech bubbles in a pixel font
- **Diary** (in the menu): how long you've been buddies, and one sentence about each day, in its own character
- **Studio** (in the menu, or "Draw your own…" in the wardrobe): draw your own buddy in layers, or a hat, glasses or something to hold, with mirroring, your own colours and an automatic outline. You see it come alive right away
- **Share and add:** every creation is a small `.pixling.json` file. Share one with a click, add one by pasting it, picking it or dropping it on the studio or on your buddy. Ask an AI assistant to make one with "Copy AI prompt". See [Creating buddies](docs/CREATING-BUDDIES.md)
- **Wardrobe:** a window with a living preview where you pick the buddy, colour, accessory, size, focus length and habits. Open it from the menu or by double-clicking your buddy
- **Time of day:** coffee in the morning, a nightcap at night, a party hat on Friday evening and New Year's Eve, a beanie from December to February. Hats only when you didn't pick an accessory yourself
- Clicks go straight through the window, except on the buddy itself
- Lives in the menu bar, without a Dock icon; right-clicking the buddy opens the same menu. That's also where you switch watching, climbing and starting at login on or off

The default buddy is the sky-blue Robot.

## Getting started

You need Node.js 22 or newer, Rust (through rustup) and the Xcode Command Line Tools.

| Command | What it does |
| --- | --- |
| `npm install` | Install the packages (once) |
| `npm run tauri dev` | Start Pixling in development mode |
| `npm run tauri build` | Build a `.app` and a `.dmg` |
| `npm run install-mac` | Build the release and put it in Applications |
| `npm run check` | Typecheck and tests; must pass before every commit |
| `npm run sprites` | Draw every buddy to `docs/sprites.png`, to check art |
| `npm run icons` | Make the app icon and menu bar icon again |
| `npm run dev` | Only the web pages in your browser, handy for art |

## How it fits together

| Folder | Contents |
| --- | --- |
| `src/sprites/` | The buddies, drawn in code: one file per species, plus colours, accessories, items and emotes |
| `src/sprites/buddy.ts` | How a home-made buddy comes alive: breathing, walking, blinking, anchors |
| `src/sprites/format.ts` | Pixling files: reading, checking and writing them, and the AI prompt |
| `src/studio.ts`, `src/sprites/creations.ts` | The studio and the data behind home-made creations |
| `src/buddy/brain.ts` | Behaviour: walking, sleeping, dragging, throwing, petting and climbing windows, apart from the screen so it can be tested |
| `src/buddy/backpack.ts` | The backpack: focus timer, water and break reminders, apart from the screen so it can be tested |
| `src/buddy/moments.ts` | What goes with which hour or day (coffee, nightcap, party, winter) |
| `src/wardrobe.ts`, `src/notes.ts` | The wardrobe and notes windows |
| `src/buddy/voice.ts` | What it says, per character and situation |
| `src/buddy/diary.ts`, `src/diary-page.ts` | The diary: counts per day and the sentence that goes with them |
| `src/buddy/system-watch.ts` | How it reacts to the battery and load |
| `src/buddy/context.ts` | Which app belongs to which context (code, music, video, game) |
| `src/buddy/view.ts` | Draws the buddy and its speech bubble on the canvas |
| `src/main.ts` | Ties it all together: asks for the cursor and windows, lets clicks through, the draw loop |
| `src/legacy.ts` | Translates settings saved while Pixling was in Dutch |
| `src-tauri/` | The Rust side: the transparent window, the menu bar and the settings; `macos.rs` reads the window list and the app in front |
| `scripts/` | Build helpers: sprite sheet and icons, drawn with the same engine |
| `examples/` | Example Pixling files |
| `docs/` | Vision, roadmap, decisions and the guide to creating buddies |

More: [vision](docs/VISION.md), [roadmap](docs/ROADMAP.md), [decisions](docs/DECISIONS.md), [creating buddies](docs/CREATING-BUDDIES.md).

## Platforms

macOS first, then Windows, Linux last. Tauri runs on all three, but transparent windows and letting clicks through behave differently on each system, so Windows and Linux still need testing and tuning.
