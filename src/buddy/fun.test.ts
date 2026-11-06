import { describe, expect, it } from 'vitest';
import { emptyDay } from './diary.ts';
import { easter, seasonFor } from './seasons.ts';
import { STICKERS, earned, totals } from './stickers.ts';
import { WeatherWatch, dress, parsePlaces, parseWeather, skyFor } from './weather.ts';
import { ACCESSORIES, accessory, catalog, setUnlocked } from '../sprites/index.ts';

describe('weather', () => {
  it('reads Open-Meteo', () => {
    const json = '{"current":{"time":"2026-11-06T13:15","temperature_2m":6.8,"weather_code":61,"is_day":1}}';
    expect(parseWeather(json)).toEqual({ sky: 'rain', temp: 6.8, day: true });
    expect(parseWeather('{"error":true}')).toBeNull();
    expect(parseWeather('nope')).toBeNull();
    const places = '{"results":[{"name":"Ghent","latitude":51.05,"longitude":3.72,"admin1":"Flanders","country":"Belgium"}]}';
    expect(parsePlaces(places)).toEqual([{ name: 'Ghent, Flanders, Belgium', lat: 51.05, lon: 3.72 }]);
    expect(parsePlaces('{}')).toEqual([]);
  });

  it('maps weather codes', () => {
    expect([0, 2, 45, 63, 73, 81, 95].map(skyFor)).toEqual(['clear', 'cloudy', 'fog', 'rain', 'snow', 'rain', 'storm']);
  });

  it('dresses for it', () => {
    expect(dress({ sky: 'rain', temp: 12, day: true })).toEqual({ item: 'umbrella', particles: 'rain' });
    expect(dress({ sky: 'snow', temp: -2, day: true })).toEqual({ hat: 'beanie', particles: 'snow' });
    expect(dress({ sky: 'cloudy', temp: 1, day: true }).hat).toBe('beanie');
    expect(dress({ sky: 'clear', temp: 24, day: true }).hat).toBe('sunglasses');
    expect(dress({ sky: 'clear', temp: 24, day: false }).hat).toBeUndefined();
    expect(dress(null)).toEqual({ particles: null });
  });

  it('only talks about a change in the weather', () => {
    const watch = new WeatherWatch();
    expect(watch.update({ sky: 'rain', temp: 10, day: true })?.key).toBe('weatherRain');
    expect(watch.update({ sky: 'rain', temp: 9, day: true })).toBeUndefined();
    expect(watch.update({ sky: 'cloudy', temp: 10, day: true })).toBeUndefined(); // grey: nothing to say
    expect(watch.update({ sky: 'clear', temp: 27, day: true })).toEqual({ key: 'weatherHot', vars: { temp: 27 } });
  });
});

describe('seasons', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

  it('knows when Easter is', () => {
    expect([2025, 2026, 2027].map((y) => easter(y).toDateString())).toEqual([
      new Date(2025, 3, 20).toDateString(),
      new Date(2026, 3, 5).toDateString(),
      new Date(2027, 2, 28).toDateString(),
    ]);
    expect(seasonFor(at(2026, 4, 4)).eggHunt).toBe(true);
    expect(seasonFor(at(2026, 4, 5)).say?.key).toBe('easter');
    expect(seasonFor(at(2026, 4, 8)).eggHunt).toBe(false);
  });

  it('dresses up for holidays and lets it snow in winter', () => {
    expect(seasonFor(at(2026, 10, 28)).hat).toBe('pumpkin');
    expect(seasonFor(at(2026, 10, 31)).say?.key).toBe('halloween');
    expect(seasonFor(at(2026, 12, 10)).hat).toBe('santahat');
    expect(seasonFor(at(2026, 12, 25)).say?.key).toBe('christmas');
    expect(seasonFor(at(2027, 1, 10)).snow).toBe(true);
    expect(seasonFor(at(2026, 6, 10))).toEqual({ snow: false, eggHunt: false });
  });

  it('celebrates your birthday and the day you met', () => {
    expect(seasonFor(at(2026, 3, 8), { birthday: '03-08' })).toMatchObject({ hat: 'partyhat', item: 'cake', say: { key: 'birthdayYou' } });
    expect(seasonFor(at(2027, 11, 6), { metOn: '2026-11-06' }).say).toEqual({ key: 'anniversary', vars: { years: 'one year' } });
    expect(seasonFor(at(2026, 11, 6), { metOn: '2026-11-06' }).say).toBeUndefined(); // not on the very first day
    expect(seasonFor(at(2027, 2, 13), { metOn: '2026-11-06' }).say).toEqual({ key: 'daysTogether', vars: { days: 100 } });
  });
});

describe('stickers', () => {
  it('adds up the diary and earns stickers', () => {
    const diary = {
      days: {
        '2026-11-06': { ...emptyDay(), pets: 60, focus: 4, baskets: 2 },
        '2026-11-07': { ...emptyDay(), pets: 45, focus: 6, baskets: 3 },
      },
      sprout: { growth: 3, wateredOn: '2026-11-07' },
    };
    const t = totals(diary, '2026-11-01', '2026-11-07');
    expect(t).toMatchObject({ pets: 105, focus: 10, baskets: 5, days: 7, bloomed: 1 });
    expect(earned(t)).toEqual(['pets1', 'pets100', 'focus1', 'focus10', 'basket5', 'bloom', 'days7']);
  });

  it('every reward accessory belongs to a sticker', () => {
    const ids = new Set(STICKERS.map((s) => s.id));
    const rewards = Object.values(ACCESSORIES).filter((a) => a.reward);
    expect(rewards.length).toBeGreaterThan(0);
    for (const a of rewards) expect(ids).toContain(a.reward);
  });

  it('keeps reward accessories out of the menu until they are earned', () => {
    setUnlocked([]);
    expect(catalog().accessories.map((a) => a.id)).not.toContain('wizardhat');
    setUnlocked(['focus10']);
    expect(catalog().accessories.map((a) => a.id)).toContain('wizardhat');
    expect(catalog().accessories.map((a) => a.id)).not.toContain('halo');
    setUnlocked('all');
    expect(catalog().accessories.map((a) => a.id)).toContain('halo');
    // Holiday hats are never in the menu; the buddy puts them on itself.
    expect(catalog().accessories.map((a) => a.id)).not.toContain('pumpkin');
    expect(accessory('pumpkin')).not.toBeNull();
    setUnlocked([]);
  });
});
