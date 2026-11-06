/**
 * Reading calendars in the iCalendar format (.ics), as Google Calendar, iCloud and Outlook publish them on
 * their secret address. Only what the buddy needs: titles, times, repeats, and whether it's a video call.
 * Pure functions, so they can be tested without a calendar.
 */

export interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  /** Last possible start, in ms. */
  until?: number;
  /** Weekdays (0 Sunday … 6 Saturday), with an optional position for monthly rules (2nd Tuesday: [2, 2]). */
  byDay?: [number, number | null][];
  byMonthDay?: number[];
}

/** One VEVENT: a single event, a repeating one, or a changed occurrence of a repeating one. */
export interface CalEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** Has a link to Google Meet, Zoom, Teams and the like. */
  video: boolean;
  cancelled: boolean;
  rule?: Rule;
  /** Starts (ms) left out of a repeating event. */
  exdates: number[];
  /** For a changed occurrence: the start (ms) of the occurrence it replaces. */
  recurrenceId?: number;
}

export interface Calendar {
  name: string | null;
  events: CalEvent[];
}

/** One actual happening of an event, repeats worked out. */
export interface Occurrence {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  video: boolean;
}

const VIDEO = /meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|facetime\.apple\.com|jitsi/i;
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Outlook writes Windows zone names; these are the common ones. */
const WINDOWS_ZONES: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'UTC': 'UTC',
};

const zoneParts = new Map<string, Intl.DateTimeFormat | null>();

/** How many ms the zone is ahead of UTC at this moment, or null for a zone this computer doesn't know. */
function zoneOffset(ms: number, zone: string): number | null {
  let format = zoneParts.get(zone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat('en-US', {
        timeZone: WINDOWS_ZONES[zone] ?? zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } catch {
      format = null;
    }
    zoneParts.set(zone, format);
  }
  if (!format) return null;
  const p = Object.fromEntries(format.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** A wall-clock time in a zone, as a moment. Unknown zones are read as this computer's own time. */
function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): Date {
  const wall = Date.UTC(y, mo, d, h, mi, s);
  const first = zoneOffset(wall, zone);
  if (first === null) return new Date(y, mo, d, h, mi, s);
  const guess = wall - first;
  const second = zoneOffset(guess, zone) ?? first;
  return new Date(wall - second);
}

/** Reads a DATE or DATE-TIME value: all-day dates and floating times are this computer's local time. */
function parseTime(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (m[4] === undefined) return { date: new Date(y, mo, d), allDay: true };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (m[7]) return { date: new Date(Date.UTC(y, mo, d, h, mi, s)), allDay: false };
  if (params.TZID) return { date: zoned(y, mo, d, h, mi, s, params.TZID), allDay: false };
  return { date: new Date(y, mo, d, h, mi, s), allDay: false };
}

/** An ISO duration like PT30M, P1D or P1W, in ms. */
function parseDuration(value: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return 0;
  const [w, d, h, mi, s] = [m[2], m[3], m[4], m[5], m[6]].map((n) => Number(n ?? 0));
  return (m[1] === '-' ? -1 : 1) * (((w * 7 + d) * 24 + h) * HOUR + mi * 60_000 + s * 1000);
}

function parseRule(value: string, params: Record<string, string>): Rule | undefined {
  const parts = Object.fromEntries(value.split(';').map((p) => p.split('=') as [string, string]));
  const freq = parts.FREQ as Rule['freq'];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return undefined;
  const rule: Rule = { freq, interval: Math.max(1, Number(parts.INTERVAL ?? 1)) };
  if (parts.COUNT) rule.count = Number(parts.COUNT);
  if (parts.UNTIL) {
    const until = parseTime(parts.UNTIL, params);
    // A date-only UNTIL includes that whole day.
    if (until) rule.until = until.date.getTime() + (until.allDay ? DAY - 1 : 0);
  }
  if (parts.BYDAY) {
    rule.byDay = parts.BYDAY.split(',').flatMap((d) => {
      const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d.trim());
      return m ? [[DAYS.indexOf(m[2]), m[1] ? Number(m[1]) : null] as [number, number | null]] : [];
    });
  }
  if (parts.BYMONTHDAY) rule.byMonthDay = parts.BYMONTHDAY.split(',').map(Number);
  return rule;
}

const unescape = (text: string) => text.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Splits `NAME;KEY=VALUE;KEY="VALUE":content` into its name, parameters and content. */
function splitLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...rest] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Reads an .ics file. Anything it doesn't understand is skipped rather than failing the whole calendar. */
export function parseIcs(text: string): Calendar {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: CalEvent[] = [];
  let name: string | null = null;
  let props: { name: string; params: Record<string, string>; value: string }[] | null = null;
  let nested = 0;
  for (const raw of lines) {
    const line = splitLine(raw);
    if (!line) continue;
    if (line.name === 'BEGIN' && line.value.trim() === 'VEVENT') {
      props = [];
      nested = 0;
    } else if (line.name === 'BEGIN' && props) nested++;
    else if (line.name === 'END' && props && nested > 0) nested--;
    else if (line.name === 'END' && line.value.trim() === 'VEVENT' && props) {
      const event = toEvent(props);
      if (event) events.push(event);
      props = null;
    } else if (props && nested === 0) props.push(line);
    else if (!props && line.name === 'X-WR-CALNAME') name = unescape(line.value).trim() || null;
  }
  return { name, events };
}

function toEvent(props: { name: string; params: Record<string, string>; value: string }[]): CalEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const start = get('DTSTART');
  const from = start && parseTime(start.value, start.params);
  if (!from) return null;
  const endProp = get('DTEND');
  const until = endProp && parseTime(endProp.value, endProp.params);
  const duration = get('DURATION');
  let end = until?.date ?? new Date(from.date.getTime() + (duration ? parseDuration(duration.value) : from.allDay ? DAY : 0));
  if (end < from.date) end = from.date;
  const text = ['LOCATION', 'DESCRIPTION', 'URL', 'X-GOOGLE-CONFERENCE'].map((n) => get(n)?.value ?? '').join(' ');
  const rrule = get('RRULE');
  const recurrence = get('RECURRENCE-ID');
  const recurrenceId = recurrence ? parseTime(recurrence.value, recurrence.params)?.date.getTime() : undefined;
  return {
    uid: get('UID')?.value.trim() ?? `${from.date.getTime()}`,
    title: unescape(get('SUMMARY')?.value ?? '').trim() || 'Something',
    start: from.date,
    end,
    allDay: from.allDay,
    video: VIDEO.test(text),
    cancelled: get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED',
    rule: rrule ? parseRule(rrule.value, start.params) : undefined,
    exdates: props
      .filter((p) => p.name === 'EXDATE')
      .flatMap((p) => p.value.split(',').map((v) => parseTime(v, p.params)?.date.getTime() ?? NaN))
      .filter((n) => !Number.isNaN(n)),
    ...(recurrenceId !== undefined ? { recurrenceId } : {}),
  };
}

/** Days in a month (month 0–11). */
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** The days (as dates at the event's time of day) a rule could hit in one period that starts at `base`. */
function candidates(rule: Rule, base: Date, first: Date): Date[] {
  const at = (y: number, m: number, d: number) =>
    new Date(y, m, d, first.getHours(), first.getMinutes(), first.getSeconds(), first.getMilliseconds());
  const y = base.getFullYear();
  const m = base.getMonth();
  switch (rule.freq) {
    case 'DAILY':
      return [at(y, m, base.getDate())];
    case 'WEEKLY': {
      // The week starting on the Monday of base.
      const monday = new Date(y, m, base.getDate() - ((base.getDay() + 6) % 7));
      const days = rule.byDay?.map(([d]) => d) ?? [first.getDay()];
      return days
        .map((d) => at(monday.getFullYear(), monday.getMonth(), monday.getDate() + ((d + 6) % 7)))
        .sort((a, b) => a.getTime() - b.getTime());
    }
    case 'MONTHLY': {
      if (rule.byDay?.length) {
        const out: Date[] = [];
        for (const [weekday, pos] of rule.byDay) {
          const matches: number[] = [];
          for (let d = 1; d <= daysIn(y, m); d++) if (new Date(y, m, d).getDay() === weekday) matches.push(d);
          const pick = pos === null ? matches : [pos > 0 ? matches[pos - 1] : matches[matches.length + pos]];
          for (const d of pick) if (d !== undefined) out.push(at(y, m, d));
        }
        return out.sort((a, b) => a.getTime() - b.getTime());
      }
      const days = rule.byMonthDay ?? [first.getDate()];
      return days
        .map((d) => (d < 0 ? daysIn(y, m) + d + 1 : d))
        .filter((d) => d >= 1 && d <= daysIn(y, m))
        .sort((a, b) => a - b)
        .map((d) => at(y, m, d));
    }
    case 'YEARLY': {
      const d = first.getDate();
      return d <= daysIn(y, first.getMonth()) ? [at(y, first.getMonth(), d)] : [];
    }
  }
}

/** The start of the next period: `interval` days, weeks, months or years later. */
function nextPeriod(rule: Rule, base: Date): Date {
  const n = rule.interval;
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  switch (rule.freq) {
    case 'DAILY':
      return new Date(y, m, d + n);
    case 'WEEKLY':
      return new Date(y, m, d + 7 * n);
    case 'MONTHLY':
      return new Date(y, m + n, 1);
    case 'YEARLY':
      return new Date(y + n, 0, 1);
  }
}

/** Every start of a repeating event, in order, until `to` (or the rule's own end). */
function* starts(event: CalEvent, to: number): Generator<Date> {
  const rule = event.rule!;
  const first = event.start;
  let base = rule.freq === 'MONTHLY' ? new Date(first.getFullYear(), first.getMonth(), 1) : rule.freq === 'YEARLY' ? new Date(first.getFullYear(), 0, 1) : first;
  let made = 0;
  for (let periods = 0; periods < 20_000; periods++) {
    for (const start of candidates(rule, base, first)) {
      if (start < first) continue;
      const t = start.getTime();
      if (t > to || (rule.until !== undefined && t > rule.until)) return;
      if (rule.count !== undefined && made >= rule.count) return;
      made++;
      yield start;
    }
    base = nextPeriod(rule, base);
  }
}

/** Everything that happens between `from` and `to` (ms), repeats worked out, sorted by start. */
export function occurrences(events: CalEvent[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  const changed = new Map<string, Set<number>>();
  for (const e of events) {
    if (e.recurrenceId === undefined) continue;
    if (!changed.has(e.uid)) changed.set(e.uid, new Set());
    changed.get(e.uid)!.add(e.recurrenceId);
  }
  const add = (e: CalEvent, start: Date) => {
    const end = new Date(start.getTime() + (e.end.getTime() - e.start.getTime()));
    if (end.getTime() <= from || start.getTime() > to) return;
    out.push({ id: `${e.uid}@${start.getTime()}`, title: e.title, start, end, allDay: e.allDay, video: e.video });
  };
  for (const e of events) {
    if (e.cancelled) continue;
    if (!e.rule || e.recurrenceId !== undefined) {
      add(e, e.start);
      continue;
    }
    const skip = new Set([...e.exdates, ...(changed.get(e.uid) ?? [])]);
    for (const start of starts(e, to)) if (!skip.has(start.getTime())) add(e, start);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
