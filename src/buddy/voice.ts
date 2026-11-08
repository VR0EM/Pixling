import { SPECIES_VOICES } from './species-voice.ts';

/**
 * The buddy's voice: what it says in each situation, depending on its character. Placeholders in
 * {braces} are filled in by `line()`.
 */

export type Character = 'sweet' | 'hyper' | 'calm' | 'cheeky';

/** Situations every buddy can be in. */
export type BasicSituation =
  | 'greeting'
  | 'petted'
  | 'thrown'
  | 'woke'
  | 'onWindow'
  | 'noted'
  | 'nom'
  | 'water'
  | 'cheers'
  | 'focusStart'
  | 'focusStop'
  | 'breakStart'
  | 'breakOver'
  | 'tired'
  | 'snooze'
  | 'battery20'
  | 'battery10'
  | 'charging'
  | 'chat'
  | 'chatCode'
  | 'chatMusic'
  | 'chatVideo'
  | 'chatGame'
  | 'chatNight'
  | 'newFriend'
  | 'newThing'
  | 'meetingSoon'
  | 'meetingNow'
  | 'meetingDone'
  | 'agenda'
  | 'birthday'
  | 'dayFree'
  | 'weatherRain'
  | 'weatherSnow'
  | 'weatherStorm'
  | 'weatherCold'
  | 'weatherHot'
  | 'weatherSun'
  | 'birthdayYou'
  | 'anniversary'
  | 'daysTogether'
  | 'halloween'
  | 'christmas'
  | 'newYear'
  | 'valentine'
  | 'easter'
  | 'eggFound'
  | 'eggsAll'
  | 'fetchStart'
  | 'fetchAgain'
  | 'fetchBored'
  | 'hideStart'
  | 'hideHint'
  | 'hideFound'
  | 'hideGiveUp'
  | 'basketStart'
  | 'basketScore'
  | 'playInvite'
  | 'updateReady'
  | 'updateNone'
  | 'updateDownloading'
  | 'updateRestart'
  | 'updateFailed'
  | 'updateCheckFailed'
  | 'callOver'
  | 'newSticker';

/** Situations only one species gets into; their lines are in species-voice.ts. */
export type SpeciesSituation =
  | 'mugCold'
  | 'mugEmpty'
  | 'mugRefilled'
  | 'robotLow'
  | 'robotCharging'
  | 'robotCharged'
  | 'sproutThirsty'
  | 'sproutWatered'
  | 'sproutGrew'
  | 'sproutBloomed'
  | 'shroomSpores'
  | 'shroomBounce'
  | 'dragonTakeoff'
  | 'dragonLanded'
  | 'ghostVanish'
  | 'ghostAppear';

export type Situation = BasicSituation | SpeciesSituation;

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
  sweet: { name: 'Sweet', description: 'Gentle and encouraging', speed: 30, walkiness: 0.65, chatter: [8, 14], talksWhenPetted: 0.4 },
  hyper: { name: 'Hyper', description: 'Runs around and talks a lot', speed: 46, walkiness: 0.85, chatter: [3, 6], talksWhenPetted: 0.7 },
  calm: { name: 'Calm', description: 'Easygoing, says little', speed: 20, walkiness: 0.4, chatter: [15, 25], talksWhenPetted: 0.2 },
  cheeky: { name: 'Cheeky', description: 'Big mouth, soft heart', speed: 32, walkiness: 0.6, chatter: [6, 11], talksWhenPetted: 0.5 },
};

type Lines = Partial<Record<BasicSituation, string[]>>;

const SWEET: Record<BasicSituation, string[]> = {
  greeting: ['{greeting}! So glad you’re here.', '{greeting}! I missed you.', 'There you are! {greeting}.'],
  petted: ['Hehe, that tickles.', 'You’re sweet.', 'Again?'],
  thrown: ['Wheee!', 'Whoa, that was fast!'],
  woke: ['Oh! I drifted off.', 'I was dreaming about pixels.'],
  onWindow: ['Nice view up here.', 'Hi down there!'],
  noted: ['Noted!', 'Got it!'],
  nom: ['Nom!', 'Yum, a file!'],
  water: ['Sip of water?', 'Shall we have some water?'],
  cheers: ['Cheers!', 'To us!'],
  focusStart: ['Focus! {min} minutes, I’ll read a bit.', 'You work, I read. {min} minutes.'],
  focusStop: ['Stopped. Well done!'],
  breakStart: ['Break! Time for a stretch.', 'Well done! Take a break.'],
  breakOver: ['Break’s over. Another round?'],
  tired: ['Maybe take a break? I’m getting tired.'],
  snooze: ['Okay, a little longer then.'],
  battery20: ['My battery is running low... and so is yours: {pct}%.'],
  battery10: ['Only {pct}% left! Plug in?'],
  charging: ['Mmm, power!'],
  chat: ['I like sitting next to you.', 'Don’t forget to blink.', 'Are you doing okay?'],
  chatCode: ['You’re doing great!', 'Nice code, if you ask me.'],
  chatMusic: ['What a tune!', 'I’m dancing along.'],
  chatVideo: ['Exciting!', 'Can I have some popcorn too?'],
  chatGame: ['You’ve got this!', 'Fingers crossed for you.'],
  chatNight: ['It’s getting late, you know.', 'Not too much longer, okay?'],
  newFriend: ['A new friend! Hi {name}!', 'Welcome, {name}!'],
  newThing: ['Ooh, {name}! For me?', 'I got {name}!'],
  meetingSoon: ['{title} in {min} minutes!', 'Heads up: {title} starts in {min} minutes.'],
  meetingNow: ['{title} starts now. Good luck!', 'Time for {title}. You’ve got this!'],
  meetingDone: ['How did {title} go?', '{title} is done. Well done!'],
  agenda: ['{things} on the calendar today. First up: {title} at {time}.'],
  birthday: ['{title} today! 🎉', 'It’s a birthday! {title}!'],
  dayFree: ['That was the last meeting of the day!', 'No more meetings today. Phew!'],
  weatherRain: ['It’s raining! Good thing I brought my umbrella.', 'Rain! Stay dry, okay?'],
  weatherSnow: ['It’s snowing! Look!', 'Snow! Everything is so pretty.'],
  weatherStorm: ['Thunder! I’ll hold my umbrella tight.'],
  weatherCold: ['Brr, it’s {temp}° out there. Beanie on!'],
  weatherHot: ['Phew, {temp}°! Drink some water, okay?'],
  weatherSun: ['The sun is out! Sunglasses on.'],
  birthdayYou: ['Happy birthday!! 🎂 I baked you a cake!', 'It’s your birthday! Happy birthday!'],
  anniversary: ['We’ve been buddies for {years} today! 🎂', 'Happy buddy-versary! {years} together!'],
  daysTogether: ['{days} days of being buddies! I brought cake.'],
  halloween: ['Happy Halloween! Boo!', 'Trick or treat!'],
  christmas: ['Merry Christmas! 🎄', 'Happy holidays! I got you a hug.'],
  newYear: ['Happy New Year! Let’s make it a good one.'],
  valentine: ['Happy Valentine’s Day! You’re my favourite.'],
  easter: ['Happy Easter! I hid some eggs on your windows...'],
  eggFound: ['You found an egg! {left} to go.', 'An egg! {left} more somewhere...'],
  eggsAll: ['You found all the eggs! Hooray!'],
  fetchStart: ['Throw the ball! Throw it!', 'Wanna play fetch? Throw the ball!'],
  fetchAgain: ['Again! Again!', 'Got it! One more?'],
  fetchBored: ['Okay, no more fetch. That was fun!'],
  hideStart: ['Let’s play hide and seek! Count to ten...', 'Close your eyes! I’m hiding!'],
  hideHint: ['Hehe...', 'Psst... I’m not far.'],
  hideFound: ['You found me!', 'Aww, found me! Again?'],
  hideGiveUp: ['Here I am! I was right here.', 'Okay, okay, I’ll come out!'],
  basketStart: ['Throw me in the hoop!', 'Basket time! Aim well.'],
  basketScore: ['SCORE!', 'Swish! Nothing but net!', 'Two points!'],
  playInvite: ['Wanna play? Pick a game under Play in the menu.', 'I’m bored... fetch? Hide and seek? It’s under Play!'],
  updateReady: ['There’s a new Pixling: {version}! Pick “Update” in the menu when you like.'],
  updateNone: ['You have the newest Pixling!'],
  updateDownloading: ['Getting the new version...'],
  updateRestart: ['Back in a second, with something new!'],
  updateFailed: ['The update didn’t work. Let’s try again later.'],
  updateCheckFailed: ['I couldn’t look for updates just now. Maybe later?'],
  callOver: ['Call over? I kept quiet!', 'How was the call?', 'Back! I stayed out of sight.'],
  newSticker: ['New sticker: {name}!', 'We earned a sticker: {name}!'],
};

const HYPER: Lines = {
  greeting: ['{greeting}!! What are we doing?', 'YESSS you’re here! {greeting}!', '{greeting}! I have SO much energy!'],
  petted: ['Hahaha! Again! Again!', 'Yesss!', 'More pets!'],
  thrown: ['WHEEEE!', 'One more time!!', 'I can fly!'],
  woke: ['What? Who? I’m awake!', 'I wasn’t sleeping!'],
  onWindow: ['I’m the king of this window!', 'A view! Wow!'],
  noted: ['Written down! Fast, huh?', 'Noted! Next!'],
  nom: ['NOM NOM NOM!', 'Tasty file!'],
  water: ['Water! Water! Drink!', 'Sip? Sip? Sip?'],
  cheers: ['CHEERS!', 'Bless you! No wait. Cheers!'],
  focusStart: ['Focus! {min} minutes! I’ll be super quiet! Really!', 'Go! {min} minutes!'],
  focusStop: ['Done?! Okay!'],
  breakStart: ['BREAK! Jump! Stretch! Dance!', 'Break! Come on, move a bit!'],
  breakOver: ['Another round? Right?!'],
  tired: ['I’m tired... and so are you! Break!'],
  snooze: ['Okay okay okay, a little longer!'],
  battery20: ['Help! Only {pct}% battery!'],
  battery10: ['{pct}%!!! PLUG IN!!!'],
  charging: ['Power! I feel SUPER!'],
  chat: ['You know what’s fun? Everything!', 'Shall we do something?', 'I’m a tiny little bit bored!'],
  chatCode: ['Tap tap tap! You’re fast!', 'Is it done yet? Is it done yet?'],
  chatMusic: ['DANCE!', 'Louder! Louder!'],
  chatVideo: ['Ooooh! What’s happening?!', 'Popcorn!!'],
  chatGame: ['Win! Win!', 'Watch out! Behind you!'],
  chatNight: ['It’s night! Exciting!', 'Sleep? No way!'],
  newFriend: ['NEW FRIEND! HI {name}!!'],
  newThing: ['{name}! I LOVE IT!'],
  meetingSoon: ['{title} in {min} minutes! Quick, quick!', '{min} minutes till {title}! Go go go!'],
  meetingNow: ['{title}! NOW! Go!'],
  meetingDone: ['{title} survived! Woohoo!'],
  agenda: ['{things} today!! First: {title} at {time}! Busy busy!'],
  birthday: ['{title}!!! PARTY!!!'],
  dayFree: ['NO MORE MEETINGS! Dance break!'],
  weatherRain: ['RAIN! Puddles! Can we jump in puddles?!'],
  weatherSnow: ['SNOW!!! SNOWBALL FIGHT!'],
  weatherHot: ['{temp}°! I’m melting! Is it ice cream time?'],
  birthdayYou: ['HAPPY BIRTHDAY!!! CAKE!!! PARTY!!!'],
  halloween: ['BOO! Haha! Happy Halloween!'],
  fetchStart: ['BALL! BALL! THROW THE BALL!'],
  fetchAgain: ['AGAIN!! AGAIN!!', 'Faster! Higher!'],
  hideStart: ['Hide and seek! Don’t peek!'],
  hideFound: ['NOOO you found me! Again!'],
  basketStart: ['THROW ME! I’m ready!'],
  basketScore: ['SLAM DUNK!!!', 'WOOO! Did you see that?!'],
  playInvite: ['PLAY WITH ME! Menu, Play, any game! Please?!'],
  newSticker: ['STICKER!! {name}!!'],
};

const CALM: Lines = {
  greeting: ['{greeting}.', 'Hi. {greeting}.', '{greeting}. Take it easy.'],
  petted: ['Mm.', 'Nice.', '...'],
  thrown: ['Oh.', 'Well.'],
  woke: ['Hm? Oh, you.', 'I was resting.'],
  onWindow: ['Nice up here.', 'Quiet spot.'],
  noted: ['Noted.'],
  nom: ['Nom.'],
  water: ['Water?'],
  cheers: ['Cheers.'],
  focusStart: ['{min} minutes. I’ll read.'],
  focusStop: ['Good.'],
  breakStart: ['Break. Breathe a little.'],
  breakOver: ['Carry on?'],
  tired: ['Maybe a short break.'],
  snooze: ['Fine.'],
  battery20: ['Battery: {pct}%.'],
  battery10: ['{pct}%. Charger?'],
  charging: ['Good, power.'],
  chat: ['...', 'Quiet here. Nice.', 'All in good time.'],
  chatCode: ['Step by step.', 'You’ll get there.'],
  chatMusic: ['Nice song.'],
  chatVideo: ['Hm. Exciting.'],
  chatGame: ['Stay calm.'],
  chatNight: ['It’s late.'],
  newFriend: ['Hello, {name}.'],
  newThing: ['{name}. Nice.'],
  meetingSoon: ['{title} in {min} minutes.'],
  meetingNow: ['{title}. Breathe.'],
  meetingDone: ['{title}, done.'],
  agenda: ['{things} today. First, {title} at {time}.'],
  birthday: ['{title}. How nice.'],
  dayFree: ['Meetings are over. Good.'],
  weatherRain: ['Rain. Nice sound.'],
  weatherSnow: ['Snow. Quiet and pretty.'],
  weatherCold: ['{temp}°. Cold.'],
  weatherHot: ['{temp}°. Warm.'],
  birthdayYou: ['Happy birthday.'],
  fetchStart: ['Fetch? Alright.'],
  fetchAgain: ['Again.'],
  hideStart: ['I’ll hide. Take your time.'],
  hideFound: ['Found me.'],
  basketStart: ['A hoop. Go on.'],
  basketScore: ['In.'],
  playInvite: ['A game, maybe? It’s under Play.'],
  newSticker: ['A sticker. {name}.'],
};

const CHEEKY: Lines = {
  greeting: ['{greeting}. You’re late.', 'Ah, there you are at last. {greeting}.', '{greeting}! What did you bring me?'],
  petted: ['Yes yes, I know I’m cute.', 'Okay, one more. That’s it.', 'Pff. Fine, keep going.'],
  thrown: ['Hey! Careful!', 'What was THAT?!', 'I saw that, you know.'],
  woke: ['I wasn’t sleeping. I was thinking.', 'Was that really necessary?'],
  onWindow: ['I’m higher up than you now.', 'This window is mine now.'],
  noted: ['Noted. Don’t forget it again.', 'Written down. You’re welcome.'],
  nom: ['Nom. Could use more sauce.', 'Nom! What is this, a report?'],
  water: ['Drink something. You look dry.', 'Water. Now. Go on.'],
  cheers: ['Cheers. Was that so hard?'],
  focusStart: ['{min} minutes of focus. No sneaky scrolling.', 'I’m watching you. {min} minutes.'],
  focusStop: ['Giving up already? Fine.'],
  breakStart: ['Break. Stand up, you’re all hunched.', 'Break! And not on your phone.'],
  breakOver: ['Break’s over. Back to work.'],
  tired: ['You really need a break. I can tell.'],
  snooze: ['Fine. But I did tell you.'],
  battery20: ['{pct}%. Go find a socket.'],
  battery10: ['{pct}%! I’m about to die, you know?'],
  charging: ['Finally. Power.'],
  chat: ['Are you bored too?', 'I’d do this differently.', 'When do I get a cookie, anyway?'],
  chatCode: ['Another bug? Typical.', 'Did you test that? Didn’t think so.'],
  chatMusic: ['This song again?', 'Okay, this one’s good. I admit it.'],
  chatVideo: ['Just one more episode, right?'],
  chatGame: ['Could be better.', 'I’d have beaten him ages ago.'],
  chatNight: ['Go to sleep. Seriously.', 'You’ll be tired tomorrow. Just saying.'],
  newFriend: ['Who’s {name}? Fine, they can stay.'],
  newThing: ['{name}? It suits me, obviously.'],
  meetingSoon: ['{title} in {min} minutes. Don’t be late this time.', '{min} minutes till {title}. Comb your hair.'],
  meetingNow: ['{title}. Try to look interested.'],
  meetingDone: ['{title} is over. Could’ve been an email.'],
  agenda: ['{things} today. Starting with {title} at {time}. Good luck.'],
  birthday: ['{title}. Is there cake? There should be cake.'],
  dayFree: ['Meetings over. Finally some peace.'],
  weatherRain: ['Rain again. You didn’t bring an umbrella, did you?'],
  weatherSnow: ['Snow. You’re not going out in that, are you?'],
  weatherCold: ['{temp}°. Wear a coat. I mean it.'],
  weatherHot: ['{temp}°. Don’t forget sunscreen.'],
  birthdayYou: ['Happy birthday. You don’t look a day older. Well. Maybe a day.'],
  halloween: ['Nice costume. Oh wait, that’s just you.'],
  fetchStart: ['Fine, throw the ball. I’ll pretend I’m not excited.'],
  fetchAgain: ['Is that all you’ve got?'],
  fetchBored: ['That’s enough fetch. I have dignity.'],
  hideStart: ['Hide and seek. You’ll never find me.'],
  hideFound: ['Lucky guess.', 'Okay, you’re good at this.'],
  hideGiveUp: ['Too hard? I’ll come out. Pathetic.'],
  basketStart: ['Throw me in that hoop. If you can aim.'],
  basketScore: ['Obviously. I’m a natural.'],
  playInvite: ['You work too much. Menu, Play. Go on.'],
  newSticker: ['A sticker: {name}. I earned that one.'],
};

const VOICES: Record<Character, Lines> = { sweet: SWEET, hyper: HYPER, calm: CALM, cheeky: CHEEKY };

/** The greeting for this time of day. */
export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 6) return 'Hello night owl';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** How often a built-in buddy speaks in its own voice rather than its character's. */
export const SPECIES_SHARE = 0.5;

/**
 * Picks something to say. Built-in buddies use their own lines about half the time (always, for their own
 * situations); otherwise the character speaks. Missing lines fall back to the sweet voice, which has them
 * all. Returns '' when there's nothing to say.
 */
export function line(character: Character, { key, vars = {} }: Line, random: () => number = Math.random, species?: string): string {
  const own = species ? SPECIES_VOICES[species]?.[key] : undefined;
  const basic = key in SWEET ? (VOICES[character]?.[key as BasicSituation] ?? SWEET[key as BasicSituation]) : undefined;
  const options = own?.length && (!basic || random() < SPECIES_SHARE) ? own : basic;
  if (!options?.length) return '';
  const text = options[Math.floor(random() * options.length)] ?? options[0];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

export function isCharacter(value: string): value is Character {
  return value in PERSONALITIES;
}
