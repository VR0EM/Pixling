/**
 * The buddy's voice: what it says in each situation, depending on its character. Placeholders in
 * {braces} are filled in by `line()`.
 */

export type Character = 'lief' | 'druk' | 'rustig' | 'brutaal';

export type Situation =
  | 'groet'
  | 'aai'
  | 'gegooid'
  | 'wakker'
  | 'venster'
  | 'genoteerd'
  | 'nom'
  | 'water'
  | 'proost'
  | 'focusStart'
  | 'focusStop'
  | 'pauze'
  | 'pauzeKlaar'
  | 'moe'
  | 'snooze'
  | 'batterij20'
  | 'batterij10'
  | 'stroom'
  | 'kletsen'
  | 'kletsenCode'
  | 'kletsenMuziek'
  | 'kletsenVideo'
  | 'kletsenGame'
  | 'kletsenNacht';

/** Something to say: a situation plus the values for its placeholders. */
export interface Line {
  key: Situation;
  vars?: Record<string, string | number>;
}

export interface Personality {
  name: string;
  description: string;
  /** Walking speed in pixels per second. */
  speed: number;
  /** Chance it goes for a walk instead of resting. */
  walkiness: number;
  /** Minutes between remarks it makes by itself (from, to). */
  chatter: [number, number];
  /** Chance a pat on the head gets a reply in words. */
  talksWhenPetted: number;
}

export const PERSONALITIES: Record<Character, Personality> = {
  lief: { name: 'Lief', description: 'Zacht en bemoedigend', speed: 30, walkiness: 0.65, chatter: [8, 14], talksWhenPetted: 0.4 },
  druk: { name: 'Druk', description: 'Rent rond en praat veel', speed: 46, walkiness: 0.85, chatter: [3, 6], talksWhenPetted: 0.7 },
  rustig: { name: 'Rustig', description: 'Kalm, zegt weinig', speed: 20, walkiness: 0.4, chatter: [15, 25], talksWhenPetted: 0.2 },
  brutaal: { name: 'Brutaal', description: 'Grote mond, klein hartje', speed: 32, walkiness: 0.6, chatter: [6, 11], talksWhenPetted: 0.5 },
};

type Lines = Partial<Record<Situation, string[]>>;

const LIEF: Record<Situation, string[]> = {
  groet: ['{dagdeel}! Fijn dat je er bent.', '{dagdeel}! Ik heb je gemist.', 'Daar ben je! {dagdeel}.'],
  aai: ['Hihi, dat kriebelt.', 'Jij bent lief.', 'Nog eens?'],
  gegooid: ['Wieee!', 'Oei, dat ging snel!'],
  wakker: ['Oh! Ik was even weg.', 'Ik droomde over pixels.'],
  venster: ['Mooi uitzicht hier.', 'Hoi daarboven!'],
  genoteerd: ['Genoteerd!', 'Staat erin!'],
  nom: ['Nom!', 'Mmm, een bestand!'],
  water: ['Slokje water?', 'Samen een slokje water?'],
  proost: ['Proost!', 'Op ons!'],
  focusStart: ['Focus! {min} minuten, ik lees wel even.', 'Jij werkt, ik lees. {min} minuten.'],
  focusStop: ['Gestopt. Goed gedaan!'],
  pauze: ['Pauze! Even rekken en strekken.', 'Goed gedaan! Even pauze.'],
  pauzeKlaar: ['Pauze voorbij. Nog een ronde?'],
  moe: ['Even pauze nemen? Ik word er moe van.'],
  snooze: ['Oké, nog even dan.'],
  batterij20: ['Mijn batterij raakt op... die van jou ook: {pct}%.'],
  batterij10: ['Nog maar {pct}%! Stekker erin?'],
  stroom: ['Mmm, stroom!'],
  kletsen: ['Ik vind het fijn om naast je te zitten.', 'Vergeet niet te knipperen.', 'Alles goed met je?'],
  kletsenCode: ['Je bent goed bezig!', 'Mooie code, volgens mij.'],
  kletsenMuziek: ['Wat een plaatje!', 'Ik dans mee.'],
  kletsenVideo: ['Spannend!', 'Mag ik ook wat popcorn?'],
  kletsenGame: ['Jij kan dit!', 'Ik duim voor je.'],
  kletsenNacht: ['Het is al laat, hoor.', 'Niet te lang meer, oké?'],
};

const DRUK: Lines = {
  groet: ['{dagdeel}!! Wat gaan we doen?', 'JAAA je bent er! {dagdeel}!', '{dagdeel}! Ik heb zó veel energie!'],
  aai: ['Hahaha! Nog eens! Nog eens!', 'Jaaa!', 'Meer aaien!'],
  gegooid: ['WIEEEE!', 'Nog een keer!!', 'Ik kan vliegen!'],
  wakker: ['Wat? Wie? Ik ben wakker!', 'Ik sliep niet hoor!'],
  venster: ['Ik ben de koning van dit venster!', 'Uitzicht! Wauw!'],
  genoteerd: ['Opgeschreven! Snel he?', 'Genoteerd! Volgende!'],
  nom: ['NOM NOM NOM!', 'Lekker bestand!'],
  water: ['Water! Water! Drinken!', 'Slokje? Slokje? Slokje?'],
  proost: ['PROOST!', 'Gezondheid! Nee wacht. Proost!'],
  focusStart: ['Focus! {min} minuten! Ik ben heel stil! Echt!', 'Gaan! {min} minuten!'],
  focusStop: ['Klaar?! Oké!'],
  pauze: ['PAUZE! Springen! Rekken! Dansen!', 'Pauze! Kom, even bewegen!'],
  pauzeKlaar: ['Nog een ronde? Ja toch?!'],
  moe: ['Ik ben moe... en jij ook! Pauze!'],
  snooze: ['Oké oké oké, nog eventjes!'],
  batterij20: ['Help! Nog maar {pct}% batterij!'],
  batterij10: ['{pct}%!!! STEKKER!!!'],
  stroom: ['Stroom! Ik voel me SUPER!'],
  kletsen: ['Weet je wat leuk is? Alles!', 'Zullen we iets doen?', 'Ik verveel me een heel klein beetje!'],
  kletsenCode: ['Tik tik tik! Je bent snel!', 'Is het al af? Is het al af?'],
  kletsenMuziek: ['DANSEN!', 'Harder! Harder!'],
  kletsenVideo: ['Ooooh! Wat gebeurt er?!', 'Popcorn!!'],
  kletsenGame: ['Winnen! Winnen!', 'Pas op! Achter je!'],
  kletsenNacht: ['Het is nacht! Spannend!', 'Slapen? Nee joh!'],
};

const RUSTIG: Lines = {
  groet: ['{dagdeel}.', 'Hoi. {dagdeel}.', '{dagdeel}. Rustig aan.'],
  aai: ['Mm.', 'Fijn.', '...'],
  gegooid: ['Oh.', 'Zo.'],
  wakker: ['Hm? Oh, jij.', 'Ik rustte even.'],
  venster: ['Mooi hier.', 'Rustig plekje.'],
  genoteerd: ['Genoteerd.'],
  nom: ['Nom.'],
  water: ['Water?'],
  proost: ['Proost.'],
  focusStart: ['{min} minuten. Ik lees.'],
  focusStop: ['Goed.'],
  pauze: ['Pauze. Adem even.'],
  pauzeKlaar: ['Verder?'],
  moe: ['Misschien even pauze.'],
  snooze: ['Goed.'],
  batterij20: ['Batterij: {pct}%.'],
  batterij10: ['{pct}%. Stekker?'],
  stroom: ['Fijn, stroom.'],
  kletsen: ['...', 'Stil hier. Fijn.', 'Alles op zijn tijd.'],
  kletsenCode: ['Stap voor stap.', 'Je komt er wel.'],
  kletsenMuziek: ['Mooi nummer.'],
  kletsenVideo: ['Hm. Spannend.'],
  kletsenGame: ['Rustig blijven.'],
  kletsenNacht: ['Het is laat.'],
};

const BRUTAAL: Lines = {
  groet: ['{dagdeel}. Je bent laat.', 'Ah, daar ben je eindelijk. {dagdeel}.', '{dagdeel}! Wat heb je voor me meegebracht?'],
  aai: ['Ja ja, ik weet dat ik schattig ben.', 'Oké, nog één keer. Meer niet.', 'Pff. Ga maar door.'],
  gegooid: ['Hé! Voorzichtig!', 'Wat was DAT?!', 'Ik zie je wel, hoor.'],
  wakker: ['Ik sliep niet. Ik dacht na.', 'Moest dat nou?'],
  venster: ['Ik zit hier hoger dan jij.', 'Dit venster is nu van mij.'],
  genoteerd: ['Genoteerd. Vergeet het nu niet weer.', 'Staat erin. Graag gedaan.'],
  nom: ['Nom. Kon wel wat meer saus op.', 'Nom! Wat is dit, een rapport?'],
  water: ['Drink eens wat. Je ziet er droog uit.', 'Water. Nu. Toe maar.'],
  proost: ['Proost. Was dat nou zo moeilijk?'],
  focusStart: ['{min} minuten focus. Niet stiekem scrollen.', 'Ik hou je in de gaten. {min} minuten.'],
  focusStop: ['Nu al opgeven? Oké dan.'],
  pauze: ['Pauze. Sta op, je zit krom.', 'Pauze! En niet op je telefoon.'],
  pauzeKlaar: ['Pauze voorbij. Aan de slag.'],
  moe: ['Jij moet echt even pauze nemen. Ik zie het.'],
  snooze: ['Prima. Maar ik zei het wel.'],
  batterij20: ['{pct}%. Zoek eens een stopcontact.'],
  batterij10: ['{pct}%! Ik ga zo dood, weet je dat?'],
  stroom: ['Eindelijk. Stroom.'],
  kletsen: ['Verveel je je ook zo?', 'Ik zou dit anders doen.', 'Wanneer krijg ik eigenlijk een koekje?'],
  kletsenCode: ['Weer een bug? Typisch.', 'Heb je dat al getest? Ik dacht het niet.'],
  kletsenMuziek: ['Dit nummer weer?', 'Oké, deze is goed. Toegegeven.'],
  kletsenVideo: ['Nog één aflevering, zeker?'],
  kletsenGame: ['Dat kon beter.', 'Ik had hem al lang verslagen.'],
  kletsenNacht: ['Ga slapen. Serieus.', 'Morgen ben je moe. Zeg ik alvast.'],
};

const VOICES: Record<Character, Lines> = { lief: LIEF, druk: DRUK, rustig: RUSTIG, brutaal: BRUTAAL };

/** The greeting for this time of day. */
export function dagdeel(date: Date): string {
  const h = date.getHours();
  if (h < 6) return 'Hallo nachtuil';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/** Picks something to say. Missing lines fall back to the 'lief' voice, which has them all. */
export function line(character: Character, { key, vars = {} }: Line, random: () => number = Math.random): string {
  const options = VOICES[character]?.[key] ?? LIEF[key];
  const text = options[Math.floor(random() * options.length)] ?? LIEF[key][0];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

export function isCharacter(value: string): value is Character {
  return value in PERSONALITIES;
}
