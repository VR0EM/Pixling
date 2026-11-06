# Pixling: werkafspraken

Pixling is een desktopmaatje in pixelart: Tauri 2 (Rust) met een TypeScript-webpagina zonder framework. Lees [docs/VISIE.md](docs/VISIE.md) voor het idee en [docs/BESLISSINGEN.md](docs/BESLISSINGEN.md) voor de opbouw.

## Afspraken

- Commits mogen, **pushen niet** tenzij de gebruiker het vraagt.
- Platformvolgorde: eerst macOS, dan Windows, dan Linux.
- `npm run check` (typecheck en tests) moet slagen voor elke commit.
- Wie een maatje of accessoire tekent, draait `npm run sprites` en kijkt `docs/sprites.png` na.
- Tekst op het scherm is Nederlands; code, namen en commentaar zijn Engels.

## Tekenstijl

- Vooraanzicht en gestileerd. Het Robotje, het Spookje en het Boontje zijn de referentie; geen realistische dieren en geen zijaanzicht.
- Elk maatje een eigen silhouet. Grid van 32×32, voeten op rij 28, omlijning op rij 29.
- Kleursleutels: `o` omlijning, `b` lichaam, `s` schaduw, `h` hooglicht, `a` accent, `c` neus of wangen, `e` ogen. Vaste kleuren staan in `src/sprites/palettes.ts`.
- Elke soort geeft een hoed-anker en een bril-anker terug, zodat elk accessoire past.

## Commando's

- `npm run tauri dev`: app starten
- `npm run tauri build -- --debug --bundles app`: snelle `.app` om te testen
- `npm run check`: typecheck en tests
- `npm run sprites`: sprite-overzicht
- `npm run icons`: iconen opnieuw maken
