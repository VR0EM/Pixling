# Pixling

Een klein pixelmaatje dat op je bureaublad woont. Het wandelt over de onderkant van je scherm, kijkt naar je muis, valt in slaap als je even weg bent en laat zich oppakken en weggooien. Je past het aan via het icoontje in de menubalk.

![Alle maatjes in een paar houdingen](docs/sprites.png)

## Wat het nu kan (v0.6)

- Zes maatjes: Robotje, Spookje, Boontje, Kat, Konijn en Draakje
- Zeven kleuren, vier accessoires (feesthoedje, kroontje, mijter, zonnebril) en drie groottes
- Wandelt rond, ademt, knippert en kijkt naar je cursor
- Valt na een minuut zonder muisbeweging in slaap en wordt wakker zodra je de muis beweegt
- Laat zich oppakken en slepen; laat je los terwijl je beweegt, dan gooi je hem, met zwaartekracht en stuiteren
- Een klik is een aai: hij springt op en er verschijnt een hartje; daarna krijgt je eigen app de focus terug
- **Klimt op je vensters:** zet je een venster vooraan, dan springt hij op de bovenrand; laat je hem los voor een venster, dan springt hij erop. Hij rijdt mee als je het venster sleept en valt eraf als je het sluit of hard opzij rukt. Gemaximaliseerde vensters laten boven zich geen ruimte, daar blijft hij af
- **Kijkt mee met je apps:** een leesbril bij je code-editor of terminal, een koptelefoon (en meewiebelen) bij Spotify of Muziek, popcorn bij video, een controller bij Steam. Hij kijkt alleen wélke app vooraan staat, nooit wat erin gebeurt
- **Rugzak** (in het menu): een focustimer waarbij hij naast je zit te lezen en de resterende tijd naast het menubalkicoon staat, met daarna een pauze; af en toe een glas water; en na een uur doorwerken wordt hij moe en gaapt hij, pas later zegt hij het. Klik op hem om een herinnering te beantwoorden
- **Notities** (in het menu): typ, druk op Enter, klaar; vink af of gooi weg. Je maatje zegt "Genoteerd!"
- **Batterij en drukte:** onder 20% wordt hij slap en zegt hij het (en nog eens onder 10%), met de stekker erin is hij blij, en als je computer hard werkt zweet hij
- **Bestanden voeren:** sleep een bestand op je maatje en hij eet het op ("Nom!"); kies dan: zip maken, omzetten naar PNG of JPG, pad kopiëren of tonen in Finder. Het resultaat komt naast het origineel
- **Karakter:** lief, druk, rustig of brutaal (in de kleerkast of het menu). Het bepaalt wat hij zegt, hoe vaak hij uit zichzelf iets zegt, en hoe snel en graag hij rondloopt. Tekstballonnen in een pixel-lettertype
- **Dagboek** (in het menu): hoe lang jullie al maatjes zijn, en elke dag één zinnetje over jullie dag, in zijn eigen karakter
- **Kleerkast:** een venster met een levend voorbeeld waarin je soort, kleur, accessoire, grootte, focusduur en gewoontes kiest. Open het via het menu of met een dubbelklik op het maatje
- **Tijd van de dag:** koffie 's ochtends, een slaapmuts 's nachts, een feesthoedje op vrijdagavond en oudejaarsavond, een mijter rond Sinterklaas. Hoedjes alleen als je zelf geen accessoire koos
- Klikken gaan dwars door het venster heen, behalve op het maatje zelf
- Leeft in de menubalk, zonder Dock-icoon; rechtsklik op het maatje opent hetzelfde menu. Daar zet je ook meekijken, klimmen en starten bij inloggen aan of uit

Het standaardmaatje is het Robotje in hemelblauw.

## Starten

Nodig: Node.js 22 of nieuwer, Rust (via rustup) en de Xcode Command Line Tools.

| Commando | Wat het doet |
| --- | --- |
| `npm install` | Pakketten installeren (één keer) |
| `npm run tauri dev` | Pixling starten in ontwikkelmodus |
| `npm run tauri build` | Een `.app` en `.dmg` bouwen |
| `npm run install-mac` | De releaseversie bouwen en in Programma's zetten |
| `npm run check` | Typecheck en tests; moet slagen voor elke commit |
| `npm run sprites` | Alle maatjes tekenen naar `docs/sprites.png`, om tekenwerk na te kijken |
| `npm run icons` | App-icoon en menubalkicoon opnieuw maken |
| `npm run dev` | Alleen de webpagina in je browser, handig voor tekenwerk |

## Hoe het in elkaar zit

| Map | Inhoud |
| --- | --- |
| `src/sprites/` | De maatjes, in code getekend: één bestand per soort, plus kleuren, accessoires en emotes |
| `src/buddy/brain.ts` | Het gedrag: rondlopen, slapen, slepen, gooien, aaien en op vensters klimmen, los van het scherm zodat het testbaar is |
| `src/buddy/backpack.ts` | De rugzak: focustimer, water- en pauzeherinnering, los van het scherm zodat het testbaar is |
| `src/buddy/moments.ts` | Wat er bij welk uur of welke dag hoort (koffie, slaapmuts, feest, Sinterklaas) |
| `src/wardrobe.ts`, `src/notes.ts` | Het kleerkast- en het notitievenster |
| `src/buddy/voice.ts` | Wat hij zegt, per karakter en situatie |
| `src/buddy/diary.ts`, `src/diary-page.ts` | Het dagboek: tellingen per dag en de zin die erbij hoort |
| `src/buddy/system-watch.ts` | Hoe hij reageert op batterij en drukte |
| `src/buddy/context.ts` | Welke app bij welke context hoort (code, muziek, video, game) |
| `src/buddy/view.ts` | Tekent het maatje en zijn tekstballon op het canvas |
| `src/main.ts` | Verbindt alles: cursor en vensters opvragen, klikken doorlaten, de tekenlus |
| `src-tauri/` | De Rust-kant: het doorzichtige venster, de menubalk en de instellingen; `macos.rs` haalt de vensterlijst en de app vooraan op |
| `scripts/` | Bouwhulpjes: sprite-overzicht en iconen, getekend met dezelfde engine |
| `docs/` | Visie, roadmap en beslissingen |

Meer uitleg: [visie](docs/VISIE.md), [roadmap](docs/ROADMAP.md), [beslissingen](docs/BESLISSINGEN.md).

## Platformen

Eerst macOS, daarna Windows, als laatste Linux. Tauri draait op alle drie, maar doorzichtige vensters en klikken doorlaten gedragen zich per systeem anders, dus Windows en Linux moeten nog getest en bijgestuurd worden.
