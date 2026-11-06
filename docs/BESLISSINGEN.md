# Beslissingen

Waarom het gebouwd is zoals het gebouwd is. Nieuwe beslissingen komen onderaan.

## Tauri 2 in plaats van Electron of native Swift

Licht (geen meegeleverde Chromium), werkt op macOS, Windows en Linux, en de kleerkast en editor van later zijn met webtechniek makkelijk te bouwen. Native Swift zou op de Mac nog lichter zijn, maar dan begint Windows van nul. Milo gebruikt dezelfde basis.

## Eén doorzichtig venster over het hele scherm

Het maatje leeft in één doorzichtig venster dat het werkgebied van het hoofdscherm bedekt, in plaats van in een klein venster dat meeschuift. Bewegen en gooien is dan gewoon tekenen op een andere plek: vloeiend, zonder vensters te verplaatsen, en er is ruimte voor tekstballonnen, emotes en later meerdere maatjes of zitten op titelbalken.

Het nadeel: het venster ligt over alles heen. Daarom negeert het standaard de muis (klikken gaan erdoor), en vraagt de webpagina zo'n 30 keer per seconde aan Rust waar de cursor is. Staat de cursor op het maatje, dan vangt het venster de muis weer op, zodat je kan klikken en slepen. Ver van het maatje vraagt het minder vaak.

## Maatjes tekenen in code

Elk maatje is een paar tekstkaartjes van pixels, met lagen die elk automatisch een omlijning krijgen. Kleuren zijn sleutels (`b` lichaam, `s` schaduw, `o` omlijning, …) die een palet invult. Daardoor:

- kan elk maatje in elke kleur, zonder extra tekenwerk;
- heeft elke soort ankerpunten waar hoedjes en brillen op passen;
- zijn animaties kleine variaties (een frame met de kop een pixel lager, een voet omhoog), geen aparte tekeningen;
- worden het app-icoon en het overzicht in `docs/sprites.png` met dezelfde code gemaakt.

## Vooraanzicht en gestileerd

Een eerste versie had zijaanzicht en realistische dieren. Dat werd afgekeurd: het Robotje, het Spookje en het Boontje (vooraanzicht, gestileerd, elk een eigen silhouet) zijn de referentie. De Kat, het Konijn en het Draakje zijn in die stijl hertekend.

## De webpagina is de baas over het uiterlijk

De lijst met soorten, kleuren en accessoires staat alleen in TypeScript. Bij het opstarten stuurt de webpagina die lijst naar Rust, dat er het menubalkmenu mee bouwt. Zo staan de namen op één plek.

## Instellingen in een JSON-bestand

`config.json` in de configmap van de app (op macOS `~/Library/Application Support/com.pixling.desktop/`). Rust leest en schrijft het; de webpagina krijgt wijzigingen via het event `config-changed`.

## Vensters via CoreGraphics, zonder schermopname-toestemming

Op macOS vraagt Rust de vensterlijst op met `CGWindowListCopyWindowInfo`: alleen gewone vensters (laag 0) die op het scherm staan, van voor naar achter. Posities en groottes mogen zonder extra toestemming; vensternamen zouden schermopname-toestemming vragen en worden dus niet gelezen. De webpagina vraagt de lijst zo'n 30 keer per seconde op terwijl het maatje op een venster staat (dan rijdt het vloeiend mee), en twee à drie keer per seconde als het op de grond staat.

Het maatje landt alleen op een bovenrand die zichtbaar is: als een venster ervoor die plek bedekt, valt het erdoor. Verdwijnt het venster, of schuift het in één keer meer dan 80 pixels opzij, dan valt het eraf.

## Focus teruggeven in plaats van een niet-activerend paneel

Op een venster van een andere app klikken maakt die app actief; dus ook bij een klik op het maatje verliest je eigen app de focus. De nette oplossing is een niet-activerend `NSPanel`, maar dat vraagt het venster om te bouwen tot een ander soort venster. Voorlopig roept Pixling na elke klik, sleep of menukeuze `NSApplication.deactivate()` aan, waardoor macOS de vorige app weer actief maakt. Je ziet de titelbalk van je app heel even grijs worden; verder merk je er niets van.

## Meekijken op basis van de app, niet de inhoud

Rust kijkt elke 0,7 seconde welke app vooraan staat (`NSWorkspace.frontmostApplication`) en meldt alleen wijzigingen; Pixling zelf telt niet mee. De webpagina koppelt bundle-id en naam aan een context (code, muziek, video, game) met een paar reguliere expressies in `src/buddy/context.ts`. Wat er in die app gebeurt, wordt nooit gelezen. Meekijken staat aan, maar kan uit in het menu.

## Nederlands voor gebruikers, Engels in de code

Alles wat je op het scherm ziet is Nederlands. Code, namen en commentaar zijn Engels; ids van maatjes, kleuren en accessoires zijn de Nederlandse namen in kleine letters (`robotje`, `hemel`, `kroon`).
