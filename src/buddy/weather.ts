import type { Line } from './voice.ts';

/**
 * Dressing for the weather: an umbrella in the rain, a beanie when it's cold or snowing, sunglasses when
 * it's sunny and warm, and rain or snow falling around the buddy. The weather comes from Open-Meteo (free,
 * no account) for a place you pick by name; only that place's coordinates are sent.
 */

export type Sky = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Weather {
  sky: Sky;
  /** °C */
  temp: number;
  day: boolean;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** WMO weather codes, as Open-Meteo reports them. */
export function skyFor(code: number): Sky {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}

/** Reads Open-Meteo's forecast answer; null when it isn't one. */
export function parseWeather(json: string): Weather | null {
  try {
    const current = JSON.parse(json).current;
    if (typeof current?.weather_code !== 'number' || typeof current?.temperature_2m !== 'number') return null;
    return { sky: skyFor(current.weather_code), temp: current.temperature_2m, day: current.is_day !== 0 };
  } catch {
    return null;
  }
}

/** Reads Open-Meteo's place search: "Ghent, Flanders, Belgium" and its coordinates. */
export function parsePlaces(json: string): Place[] {
  try {
    const results: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[] = JSON.parse(json).results ?? [];
    return results.map((r) => ({
      name: [r.name, r.admin1, r.country].filter((p, i, all) => p && all.indexOf(p) === i).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }));
  } catch {
    return [];
  }
}

export interface WeatherLook {
  /** Held: the umbrella. */
  item?: string;
  /** Worn when you didn't pick an accessory: a beanie or sunglasses. */
  hat?: string;
  /** Falling around the buddy. */
  particles: 'rain' | 'snow' | null;
}

export function dress(w: Weather | null): WeatherLook {
  if (!w) return { particles: null };
  if (w.sky === 'rain' || w.sky === 'storm') return { item: 'umbrella', particles: 'rain' };
  if (w.sky === 'snow') return { hat: 'beanie', particles: 'snow' };
  if (w.temp <= 3) return { hat: 'beanie', particles: null };
  if (w.sky === 'clear' && w.day && w.temp >= 18) return { hat: 'sunglasses', particles: null };
  return { particles: null };
}

/** What kind of weather it is, for talking about it: changes in this are worth a remark. */
function mood(w: Weather): string {
  if (w.sky === 'rain' || w.sky === 'snow' || w.sky === 'storm') return w.sky;
  if (w.temp <= 3) return 'cold';
  if (w.temp >= 25) return 'hot';
  if (w.sky === 'clear' && w.day) return 'sun';
  return 'grey';
}

const LINES: Record<string, Line['key']> = {
  rain: 'weatherRain',
  snow: 'weatherSnow',
  storm: 'weatherStorm',
  cold: 'weatherCold',
  hot: 'weatherHot',
  sun: 'weatherSun',
};

/** Says something when the weather turns: rain starting, snow, a hot day. Not about grey skies. */
export class WeatherWatch {
  private last: string | null = null;

  update(w: Weather | null): Line | undefined {
    if (!w) return undefined;
    const now = mood(w);
    if (now === this.last) return undefined;
    this.last = now;
    const key = LINES[now];
    return key ? { key, vars: { temp: Math.round(w.temp) } } : undefined;
  }
}
