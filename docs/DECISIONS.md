# Decisions

Why it's built the way it is. New decisions go at the bottom.

## Tauri 2 instead of Electron or native Swift

Light (no bundled Chromium), runs on macOS, Windows and Linux, and the wardrobe and editor are easy to build with web technology. Native Swift would be even lighter on the Mac, but then Windows starts from zero.

## One transparent window over the whole screen

The buddy lives in one transparent window that covers the work area of the main screen, instead of a small window that moves along. Moving and throwing are then just drawing in another place: smooth, without moving windows, and with room for speech bubbles, emotes and later several buddies.

The downside: the window lies over everything. So it ignores the mouse by default (clicks go through), and the web page asks Rust about 30 times a second where the cursor is. When the cursor is on the buddy, the window catches the mouse again, so you can click and drag. Far from the buddy it asks less often.

## Drawing buddies in code

Every buddy is a few little text maps of pixels, in layers that each get an outline automatically. Colours are keys (`b` body, `s` shade, `o` outline, …) that a palette fills in. That way:

- every buddy comes in every colour, without extra drawing;
- every species has anchors where hats and glasses fit;
- animations are small variations (a frame with the head a pixel lower, a foot up), not separate drawings;
- the app icon and the overview in `docs/sprites.png` are made with the same code.

## Front view and stylised

A first version had side views and realistic animals. That was rejected: the Robot, the Ghost and the Sprout (front view, stylised, each with its own silhouette) are the reference. The Cat and the Rabbit stayed too much animal even after a redraw; they made way for the Shroom (a mushroom with its face on the stem) and the Mug (a mug with coffee and steam). The Dragon got a big round head with small horns, folded wings and a curly tail.

## Things made to measure per buddy

An accessory or item has one general drawing, and may have its own version per species (`variants` in `accessories.ts` and `items.ts`). A version has a fixed place in the grid and moves with the breathing when it's on the head or face; `null` leaves the thing off that species.

- The headphones are drawn for every built-in head: over the Robot's bolts, between the Dragon's horns, under the Shroom's cap. The general version is a boombox next to the buddy, so buddies without their own drawing, like home-made ones, can listen to music too. The Mug gets the boombox as well.
- For code, a laptop stands next to the buddy instead of reading glasses. The code appears line by line (an item may have a drawing per tick, `frames`) and the buddy looks at the screen while it isn't walking (`gaze`). A laptop with its back to you, in front of the belly, looked too much like a sign. While you code the buddy stays put instead of wandering off with it.
- The Robot's sunglasses light up on its screen, because black glasses disappear on the dark screen.
- A hat that would stick out above the grid sinks into the head as far as needed, so tall hats fit tall buddies (Shroom, Dragon).

## The web page owns the looks

The list of species, colours and accessories lives only in TypeScript. At startup the web page sends that list to Rust, which builds the menu bar menu from it. That keeps the names in one place.

## Settings in a JSON file

`config.json` in the app's config folder (on macOS `~/Library/Application Support/com.pixling.desktop/`). Rust reads and writes it; the web page gets changes through the `config-changed` event.

## Windows through CoreGraphics, without screen recording permission

On macOS, Rust asks for the window list with `CGWindowListCopyWindowInfo`: only normal windows (layer 0) on screen, front to back. Positions and sizes need no extra permission; window titles would need screen recording permission and are never read. The web page asks for the list about 30 times a second while the buddy stands on a window (so it rides along smoothly), and two or three times a second when it's on the ground.

The buddy only lands on a top edge that's visible: if a window in front covers that spot, it falls through. If the window disappears, or moves more than 80 pixels at once, it falls off.

## A non-activating panel

Clicking a window of another app normally makes that app active, so a click on the buddy took the focus away from your own app. So right after it's made, the overlay window on macOS becomes a non-activating `NSPanel` (like Spotlight): the window's class becomes `NSPanel`, it gets the `NonactivatingPanel` style, it doesn't hide when Pixling isn't active, and the private `_setPreventsActivation:` switch makes macOS respect that style after creation. Clicking, dragging and right-clicking leave your own app active.

As a safety net Pixling still calls `NSApplication.deactivate()` after a click; if the app didn't become active, that does nothing.

## Watching along by app, not by content

Every 0.7 seconds Rust checks which app is in front (`NSWorkspace.frontmostApplication`) and only reports changes; Pixling itself doesn't count. The web page maps the bundle id and name to a context (code, music, video, game) with a few regular expressions in `src/buddy/context.ts`. What happens inside the app is never read. Watching is on, but can be switched off in the menu.

## Home-made buddies as data

Built-in buddies are code, with hand-made animation. Home-made buddies are data: a few 32×32 layers (`back`, `top`, `body`, `feet`, `face`) and colours. `src/sprites/buddy.ts` brings them to life with rules that work for any drawing: the body, face, top and back breathe a pixel down, the two halves of the feet layer take turns lifting, the face shifts to look, and eye pixels with an eye pixel below them disappear to blink. Anchors for hats and glasses follow from the drawing (the top of the body, the eyes) unless the file sets them. The drawing is moved to stand on the ground, so a file that's a few rows off still works.

That keeps a buddy easy to draw in the studio and easy for an AI assistant to write: one still pose, no frames.

## Pixling files

Creations are shared as `.pixling.json`: plain JSON with a version (`"pixling": 1`), a type and the drawing as strings, one per row. Text is easy to paste into a chat, to read and to fix, and an AI assistant can write it. `parsePixling()` in `src/sprites/format.ts` is forgiving about what's around the JSON (a code fence, a sentence) and strict about the drawing, with errors that say where the problem is, so a person or an assistant can fix it. Extra colours get a private key of their own when they're loaded, so two files using `"1"` for different colours never clash.

The studio's **Copy AI prompt** gives an assistant the format, the style rules and an example; [Creating buddies](CREATING-BUDDIES.md) says the same for people. Both follow what the parser accepts, and a test checks that the prompt's example is a valid file.

Files dropped on the buddy are added when they're Pixling files; other files still get eaten.

## English everywhere

Pixling started in Dutch. Everything is English now: the app, the docs, ids and code. Settings, creations and diaries saved with the old Dutch ids are translated once at startup (`src/legacy.ts`); buddies and hats that no longer exist fall back to the Robot and no accessory.

## Windows through the Win32 API

`src-tauri/src/win.rs` is the Windows counterpart of `macos.rs`, written against the same `windows` crate version Tauri uses, so nothing is compiled twice.

- **Windows to stand on:** `EnumWindows` front to back, skipping hidden, minimised and cloaked windows (other virtual desktops), tool windows, dialogs, the desktop and the taskbar. The size is the visible frame (`DWMWA_EXTENDED_FRAME_BOUNDS`), without the invisible resize border. Windows reports physical pixels; `lib.rs` divides by the overlay's scale (`PHYSICAL_PIXELS`).
- **The app in front:** the program behind `GetForegroundWindow`. Windows has no bundle ids, so the file name (`code.exe`) stands in, and `context.ts` has rules for Windows programs.
- **Dragging a file:** there is no permission-free "a drag is going on" signal, so it counts as dragging when the left button is held and the mouse moved more than 8 pixels.
- **Never taking the focus:** the overlay gets `WS_EX_NOACTIVATE` (and `WS_EX_TOOLWINDOW` to stay out of Alt+Tab), the Windows version of the non-activating panel.
- **Files and clipboard:** PowerShell (`Compress-Archive`, .NET's image classes, `Set-Clipboard`) and Explorer, without a console window. Paths go in through environment variables, so a file name can never change what runs.
- **Battery and load:** `GetSystemPowerStatus`, and the share of processor time that wasn't idle since the previous check (`GetSystemTimes`).
- **Tray:** the coloured app icon (the black template icon only works on macOS), and the focus timer in the tooltip because Windows has no text next to tray icons.

There's no Windows PC to test on yet, so the Windows side is checked by compiling it for Windows (`cargo check --target x86_64-pc-windows-msvc`) and by GitHub's Windows runners on every push.

## Releases built by GitHub

`.github/workflows/release.yml` builds a universal .dmg (Apple Silicon and Intel in one) on macOS, and an NSIS installer plus the plain program as a portable .exe on Windows, and publishes them as a GitHub release when a version tag is pushed or the workflow is started by hand. The files get fixed names (`Pixling-mac.dmg`, `Pixling-windows-setup.exe`, `Pixling-windows-portable.exe`), so `releases/latest/download/…` links in the README always point at the newest version.

The Mac app is ad-hoc signed (`signingIdentity: "-"`), because macOS calls an unsigned downloaded app "damaged". Real signing and notarisation (Apple) and code signing (Microsoft) need paid certificates; until then the README explains the one extra click on first start. The Windows installer installs for the current user only, so it needs no administrator rights.

## A personality per buddy

The character (sweet, hyper, calm, cheeky) decides how a buddy talks and how lively it is. On top of that every built-in buddy is a someone of its own:

- **Its own voice.** `src/buddy/species-voice.ts` has lines per species: the robot's beeps, the ghost's boos, the sprout's and shroom's puns, the mug's coffee jokes, the dragon's bravado. A built-in buddy uses them about half the time (`SPECIES_SHARE`), so its character still shows; situations only one species gets into (the mug running empty) only have its own lines.
- **Its own needs.** `src/buddy/traits.ts` counts time at the computer, never the clock, so nothing happens while you're away: the mug cools down and runs out in an hour, the robot's battery lasts about 45 minutes, the sprout gets thirsty after 40. A click answers them (refill, charge, water); drinking water together waters the sprout, and plugging in the computer charges the robot. The sprout grows once per day it's watered and blooms on the third; that's kept in the diary, so it lasts.
- **Its own moves.** The brain has abilities that only some buddies get: the dragon flies (an arc to a free window edge or another spot, and it glides when thrown), the ghost fades out and back in somewhere else and hovers, the shroom bounces from drops that wouldn't bounce anyone else. The brain reports these as events and the app says something about them now and then, not every time.
- **Its own looks for it.** Each species draws its states from render options: `charging` and `charge` for the robot, `fill` for the mug, `growth` and `wilt` for the sprout, `glow` for the shroom, `fly` for the dragon. `fade` works for any buddy: it leaves out a growing share of the pixels in a 2×2 pattern.

Home-made buddies stay simple on purpose: they speak with their character only, and can't fly or vanish. That keeps a Pixling file one still drawing.

**Buddy quirks** can be switched off (wardrobe and menu): the needs, flying, vanishing, hovering and bouncing stop, but the voices stay, because they're what makes the buddy itself even when it sits still. The ghost's vanishing act takes about four seconds (fading out in steps, moving while faint, fading back in) so it reads as a trick instead of a glitch.

## Calendars through their secret iCal address

Google Calendar, iCloud and Outlook can all publish a calendar as an iCal (.ics) address. Pixling reads that address, so:

- there's no sign-in with Google and no developer project with OAuth consent screens and app verification, which a small open-source app can't easily get for calendar access;
- it works the same for every calendar service, and on macOS and Windows alike;
- it can only read, never change anything, and everything stays on the computer.

The address is a secret (anyone with it can read the calendar), so it lives only in `config.json` and is never written to the log. Rust fetches it with the system's own `curl` (in macOS and Windows 10 and 11), https only, with a time limit, every ten minutes.

`src/buddy/calendar.ts` reads the iCalendar format itself: folded lines, escaped text, time zones (IANA names, and the Windows names Outlook uses), all-day events, durations, and repeats (daily, weekly on certain days, monthly on a date or "the 2nd Tuesday", yearly) with their exceptions and moved or cancelled occurrences. That covers what calendar services publish; anything it doesn't understand is skipped instead of breaking the calendar. `src/buddy/agenda.ts` decides what the buddy does with it, says everything only once, and only when someone is at the computer to hear it.

## Games, weather, holidays and stickers

- **A world layer.** The ball, the hoop, Easter eggs, snow on the windows, rain and confetti are drawn on one transparent canvas over the whole overlay (`src/buddy/world.ts`), in the same chunky pixels as the buddy. The overlay already lets clicks through except on the buddy; the ball and eggs simply count as "on the buddy" for that, so you can grab and click them.
- **Games use the brain's own moves.** Fetch gives the brain a spot to run to (`target`), hide and seek a spot to hide (`hide()`): partly past a side of the screen, below the bottom, or sunk behind a window's top edge with everything below that edge clipped away, so it looks like it's behind the window. Basket checks whether a thrown buddy drops through the rim. The game logic (`src/buddy/games.ts`) has no DOM, so it's tested with the real brain.
- **Weather from Open-Meteo**: free, no account, no key. You pick your town by name once; after that only its coordinates are sent, every half hour. Dressing for it only uses the hat slot when you haven't picked an accessory.
- **Holidays are dates, not settings**: Halloween week, December, winter, Easter (computed), Valentine's, New Year, plus your birthday and the day you met. What's worn follows a fixed order: the calendar's birthday party, your own celebration, the nightcap at night, the holiday, the weather, the time of day.
- **Stickers come from the diary's counts**, so nothing new is tracked. Rewards are accessories with a `reward` sticker id; they stay out of the menu until earned, and the wardrobe shows them locked with how to earn them. "Every accessory right away" unlocks them all for whoever doesn't want to earn them.
- **Everything has a switch** (quirks, games, weather, holidays, stickers), in the wardrobe and the menu's Fun submenu, because a buddy should be exactly as lively as you like. The Play menu always works, even with "asks to play" off.
- **You start every game.** The buddy may ask to play, but nothing appears on screen until you pick a game from the Play menu. A game that showed up by itself was hard to get rid of. The hoop can be dragged by its backboard and closed with its ×; the ball and hide and seek end by themselves when nobody plays.

## Updates through GitHub releases

Pixling uses Tauri's updater. Every release carries a `latest.json` next to the downloads (written by `scripts/updater-manifest.ts`), and installed copies read it from `releases/latest/download/latest.json` half a minute after starting and every six hours. When there's something newer, the buddy says so and **Update to Pixling x.y.z…** appears at the top of the menu; nothing is downloaded until you pick it. Then it downloads, installs and restarts. "Check for updates…" in the menu looks right away. "Looks for new versions" in the wardrobe switches the looking off.

- **Signed.** Updates are signed with the project's own key (minisign). The public half is in `tauri.conf.json`; the private half lives only with the maintainer (`~/.tauri/pixling.key`) and as the `TAURI_SIGNING_PRIVATE_KEY` secret on GitHub. The updater refuses anything not signed with it. Losing the key means installed copies can't update anymore and need one manual download, so it's backed up.
- **Only release builds are signed.** The update files are switched on by `src-tauri/tauri.release.conf.json`, which only the release workflow passes, so `npm run tauri build` and `npm run install-mac` work without the key.
- **The system's TLS** (`native-tls`) instead of rustls, so the Windows build has no C crypto library to compile and the app stays smaller.
- **What gets updated:** the macOS app as a whole (one universal `.app.tar.gz` for Apple Silicon and Intel) and on Windows the installer, which runs by itself (`passive`). The portable `.exe` can't replace itself; its users download the new one.

## A welcome tour

New users only see a little buddy appear, and nothing tells them the menu is in the menu bar (or the system tray) or that double-clicking opens the wardrobe. So the first start opens a short tour (`welcome.html`) a few seconds after the buddy says hello: hello, pick the buddy, colour and character with a live preview, where to find everything, a few optional extras (town, birthday, start at login, updates), done. Every choice is saved right away, so closing the window halfway loses nothing. It sets `welcomed` as soon as it opens, so it never opens by itself twice; "Welcome tour…" in the menu brings it back.

## Stepping aside for films, presentations and calls

Twice a second-ish (every 1.5 s) the page asks Rust for the screen state, and the buddy disappears (not drawn, not clickable, not talking, games put away) while:

- **an app fills the main screen.** The window in front covers the whole main display: CoreGraphics' window list against the main display's bounds on macOS, the foreground window against its monitor (only the primary one) on Windows. Maximised windows leave the menu bar or the taskbar free, so they don't count.
- **the microphone is on.** The operating systems don't say when the screen is being shared, but every call app uses the microphone, so that's the signal. macOS: CoreAudio's "is running somewhere" on the default input device. Windows: the microphone section of its privacy settings in the registry (an app that started and hasn't stopped). Neither needs a permission, and only *whether* it's on is read.

Both have a switch. The calendar's video calls still only fade the buddy, because those are known in advance; this is for everything else.

## A friend: a second buddy

The friend is a second `Brain` and `View` (its own canvas and speech bubble) in the same overlay, not a second window, so there's still one click-through window to manage. It shares what's around it: the windows to climb, the app in front (it sits still while you code or watch), the calendar's quiet times, fullscreen and calls. It doesn't carry things, and only wears the hats that come from the weather, holidays and time of day, so the two stay easy to tell apart. Its look and character are saved as `friend`, `friendPalette` and `friendCharacter`; `friend: "none"` is the switch.

What they do together lives in `src/buddy/social.ts`, which only nudges the two brains through their own moves (`target`, `jumpTo`, `look`, `bump`), so each keeps its own behaviour and the whole thing is tested with real brains and no DOM. Meeting (close together on the same floor) makes them look at each other and say hi. Tag, visiting and pushing are rare on purpose (minutes apart) and only happen while you're at the computer and neither is busy; picking one up ends any game.
