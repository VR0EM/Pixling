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
