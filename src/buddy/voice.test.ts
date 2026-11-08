import { describe, expect, it } from 'vitest';
import { daysTogether, dayKey, emptyDay, sentence } from './diary.ts';
import { PERSONALITIES, greetingFor, line, type Character, type Situation } from './voice.ts';

const characters = Object.keys(PERSONALITIES) as Character[];
const situations: Situation[] = [
  'greeting', 'petted', 'thrown', 'woke', 'onWindow', 'noted', 'nom', 'water', 'cheers', 'focusStart',
  'focusStop', 'breakStart', 'breakOver', 'tired', 'snooze', 'battery20', 'battery10', 'charging', 'chat',
  'chatCode', 'chatMusic', 'chatVideo', 'chatGame', 'chatNight', 'newFriend', 'newThing', 'meetingSoon', 'meetingNow',
  'meetingDone', 'agenda', 'birthday', 'dayFree', 'weatherRain', 'weatherSnow', 'weatherStorm', 'weatherCold',
  'weatherHot', 'weatherSun', 'birthdayYou', 'anniversary', 'daysTogether', 'halloween', 'christmas', 'newYear',
  'valentine', 'easter', 'eggFound', 'eggsAll', 'fetchStart', 'fetchAgain', 'fetchBored', 'hideStart', 'hideHint',
  'hideFound', 'hideGiveUp', 'basketStart', 'basketScore', 'newSticker', 'playInvite',
];

describe('voice', () => {
  it('has something to say in every situation, for every character', () => {
    for (const c of characters) {
      for (const key of situations) {
        for (const r of [0, 0.5, 0.99]) {
          const text = line(c, { key, vars: { pct: 15, min: 25, greeting: 'Good morning', name: 'Cactus', title: 'Standup', things: '2 things', time: '09:30', count: 3, temp: 4, years: 'one year', days: 100, left: 2 } }, () => r);
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('fills in the placeholders', () => {
    expect(line('calm', { key: 'battery20', vars: { pct: 18 } })).toBe('Battery: 18%.');
    expect(line('sweet', { key: 'focusStart', vars: { min: 25 } }, () => 0)).toBe('Focus! 25 minutes, I’ll read a bit.');
  });

  it('sounds different per character', () => {
    const texts = new Set(characters.map((c) => line(c, { key: 'thrown' }, () => 0)));
    expect(texts.size).toBe(characters.length);
  });

  it('gives every built-in buddy its own voice, half of the time', () => {
    for (const species of ['robot', 'ghost', 'sprout', 'shroom', 'mug', 'dragon']) {
      const own = line('sweet', { key: 'chat' }, () => 0.1, species);
      const character = line('sweet', { key: 'chat' }, () => 0.9, species);
      expect(own).not.toBe(character);
    }
    // Home-made buddies just use their character.
    expect(line('sweet', { key: 'chat' }, () => 0.1, 'buddy-1')).toBe(line('sweet', { key: 'chat' }, () => 0.1));
  });

  it('has lines for every species-only situation', () => {
    const own: [string, Situation[]][] = [
      ['mug', ['mugCold', 'mugEmpty', 'mugRefilled']],
      ['robot', ['robotLow', 'robotCharging', 'robotCharged']],
      ['sprout', ['sproutThirsty', 'sproutWatered', 'sproutGrew', 'sproutBloomed']],
      ['shroom', ['shroomSpores', 'shroomBounce']],
      ['dragon', ['dragonTakeoff', 'dragonLanded']],
      ['ghost', ['ghostVanish', 'ghostAppear']],
    ];
    for (const [species, keys] of own) {
      for (const key of keys) {
        for (const c of characters) expect(line(c, { key }, () => 0.5, species)).not.toBe('');
      }
    }
    // Someone else's situation has nothing to say.
    expect(line('sweet', { key: 'mugEmpty' }, () => 0.5, 'robot')).toBe('');
  });

  it('greets by time of day', () => {
    expect(greetingFor(new Date('2026-03-10T08:00:00'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-03-10T14:00:00'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-03-10T20:00:00'))).toBe('Good evening');
    expect(greetingFor(new Date('2026-03-10T02:00:00'))).toBe('Hello night owl');
  });
});

describe('diary', () => {
  it('counts the days together, starting at day 1', () => {
    expect(daysTogether('2026-11-06', '2026-11-06')).toBe(1);
    expect(daysTogether('2026-11-06', '2026-12-06')).toBe(31);
    expect(dayKey(new Date('2026-03-05T23:00:00'))).toBe('2026-03-05');
  });

  it('writes a sentence about the most remarkable things', () => {
    const day = { ...emptyDay(), focus: 3, water: 2, pets: 5, notes: 1 };
    expect(sentence(day, 'sweet')).toBe('Today: 3 focus rounds, water twice and petted 5 times. What a lovely day!');
    expect(sentence(day, 'cheeky')).toMatch(/^3 focus rounds.*cookie\.$/);
    expect(sentence(emptyDay(), 'hyper')).toMatch(/NOTHING/);
    expect(sentence({ ...emptyDay(), pets: 1 }, 'calm')).toBe('Today: petted once.');
  });
});
