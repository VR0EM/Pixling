# Pixling: working agreements

Pixling is a pixel-art desktop buddy: Tauri 2 (Rust) with a TypeScript web page and no framework. Read [docs/VISION.md](docs/VISION.md) for the idea and [docs/DECISIONS.md](docs/DECISIONS.md) for how it's built.

## Agreements

- Commits are fine; **never push** unless the user asks.
- Platform order: macOS first, then Windows, then Linux.
- The Rust side must also build for Windows (`src-tauri/src/win.rs` mirrors `macos.rs`). GitHub checks every push on macOS and Windows; locally `cargo check --target x86_64-pc-windows-msvc` needs `llvm-rc` on the PATH.
- Releases: push a version tag (`v0.10.0`) or run the Release workflow; it publishes the .dmg, the Windows .exe files and `latest.json` for the updater. Raise the version in `package.json`, `Cargo.toml` and `tauri.conf.json` together.
- Updates are signed with the key in `~/.tauri/pixling.key` (GitHub secret `TAURI_SIGNING_PRIVATE_KEY`). Never print, commit or move the private key; only the public key belongs in `tauri.conf.json`.
- `npm run check` (typecheck and tests) must pass before every commit.
- Whoever draws a buddy or accessory runs `npm run sprites` and checks `docs/sprites.png`.
- Everything is in English: the app, the docs, code, ids and comments. Old Dutch ids in saved files are translated in `src/legacy.ts`.

## Art style

- Front view and stylised. The Robot, the Ghost and the Sprout are the reference; no realistic animals and no side views.
- Every buddy has its own silhouette. 32×32 grid, feet on row 28, outline on row 29.
- Colour keys: `o` outline, `b` body, `s` shade, `h` highlight, `a` accent, `c` nose or cheeks, `e` eyes. Fixed colours are in `src/sprites/palettes.ts`.
- Every species returns a hat anchor and a glasses anchor, so every accessory fits.
- If an accessory or item doesn't fit a species well, draw it its own version under `variants` (see the headphones in `src/sprites/items.ts`). The general version must work on every buddy, home-made ones included.
- Home-made buddies and Pixling files are described in [docs/CREATING-BUDDIES.md](docs/CREATING-BUDDIES.md) and in `aiPrompt()` in `src/sprites/format.ts`. Change the format, the guide and the prompt together.

## Commands

- `npm run tauri dev`: start the app
- `npm run tauri build -- --debug --bundles app`: a quick `.app` to test
- `npm run check`: typecheck and tests
- `npm run sprites`: sprite sheet
- `npm run icons`: make the icons again
- `npm run install-mac`: build the release and copy it to /Applications
