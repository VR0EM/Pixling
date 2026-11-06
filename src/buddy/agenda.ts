import type { Occurrence } from './calendar.ts';
import type { Line } from './voice.ts';

/**
 * What the buddy does with your calendar: tells you what's on in the morning, gives a heads-up a few
 * minutes before something starts (holding a little calendar), keeps quiet during meetings and steps
 * aside during video calls, asks how it went, cheers when the day's meetings are done, and puts on a
 * party hat for birthdays. Pure logic with times in ms, so it can be tested without waiting.
 */

const MIN = 60_000;
/** How long before an event the heads-up comes. */
export const HEADS_UP = 10 * MIN;

export interface AgendaSettings {
  alerts: boolean;
  hideInCalls: boolean;
}

export interface AgendaAdvice {
  say?: Line;
  /** Holds the calendar item: something starts soon. */
  item?: string;
  /** In a meeting: sits still and doesn't chat. */
  quiet: boolean;
  /** In a video call: fades into the background. */
  away: boolean;
  /** A hat for the day, like a party hat on a birthday. */
  hat?: string;
  /** The next thing, for the menu, or null. */
  next: string | null;
  /** A meeting that just ended, to count in the diary. */
  ended?: boolean;
}

const BIRTHDAY = /birthday|verjaardag|anniversaire|geburtstag|cumpleaños|bday|🎂/i;

const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const short = (title: string) => (title.length > 40 ? `${title.slice(0, 39)}…` : title);
const dayOf = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export class Agenda {
  /** What has been said already, so nothing is said twice. */
  private told = new Set<string>();

  /** Called once a second with the events around now. `active`: someone is at the computer. */
  update(events: Occurrence[], now: number, settings: AgendaSettings, active: boolean): AgendaAdvice {
    const today = dayOf(now);
    const tomorrow = today + 24 * 60 * MIN;
    const timed = events.filter((e) => !e.allDay);
    const current = timed.find((e) => e.start.getTime() <= now && now < e.end.getTime());
    const soon = timed.find((e) => e.start.getTime() > now && e.start.getTime() - now <= HEADS_UP);
    const upcoming = timed.find((e) => e.start.getTime() > now && e.start.getTime() < tomorrow + 24 * 60 * MIN);
    const birthdays = events.filter((e) => e.allDay && BIRTHDAY.test(e.title) && e.start.getTime() <= now && now < e.end.getTime());
    const todays = timed.filter((e) => dayOf(e.start.getTime()) === today);

    const advice: AgendaAdvice = {
      quiet: !!current,
      away: !!current && current.video && settings.hideInCalls,
      next: upcoming ? `${dayOf(upcoming.start.getTime()) === today ? 'Next' : 'Tomorrow'}: ${short(upcoming.title)}, ${clock(upcoming.start)}` : null,
    };
    if (soon && settings.alerts) advice.item = 'calendar';
    if (birthdays.length) advice.hat = 'partyhat';

    /** Says something once; `key` makes sure it's only once. Only when someone is there to hear it. */
    const once = (key: string, line: Line) => {
      if (advice.say || this.told.has(key) || !active) return;
      this.told.add(key);
      advice.say = line;
    };

    // A meeting that just ended (counted even when nobody's there to hear about it).
    const ended = timed.find((e) => e.end.getTime() <= now && now - e.end.getTime() < 3 * MIN && e.end.getTime() - e.start.getTime() >= 10 * MIN);
    if (ended && !this.told.has(`ended:${ended.id}`)) {
      advice.ended = true;
      if (settings.alerts && active) once(`ended:${ended.id}`, { key: 'meetingDone', vars: { title: short(ended.title) } });
      else this.told.add(`ended:${ended.id}`);
    }
    if (current?.video && settings.hideInCalls) return advice; // not a word during a call

    for (const b of birthdays) once(`birthday:${b.id}`, { key: 'birthday', vars: { title: short(b.title) } });
    if (!settings.alerts) return advice;

    if (soon) {
      const min = Math.max(1, Math.round((soon.start.getTime() - now) / MIN));
      once(`soon:${soon.id}`, { key: 'meetingSoon', vars: { title: short(soon.title), min } });
    }
    if (current && now - current.start.getTime() < 2 * MIN) once(`now:${current.id}`, { key: 'meetingNow', vars: { title: short(current.title) } });

    // In the morning: what's on today.
    const left = todays.filter((e) => e.start.getTime() > now);
    const hour = new Date(now).getHours();
    if (hour >= 6 && hour < 12 && left.length) {
      const things = left.length === 1 ? 'One thing' : `${left.length} things`;
      once(`agenda:${today}`, { key: 'agenda', vars: { things, title: short(left[0].title), time: clock(left[0].start) } });
    }
    // The last meeting of a busy day is over.
    const last = todays[todays.length - 1];
    if (todays.length >= 2 && last && last.end.getTime() <= now && now - last.end.getTime() < 10 * MIN) {
      once(`free:${today}`, { key: 'dayFree', vars: { count: todays.length } });
    }
    return advice;
  }
}
