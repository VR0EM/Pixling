import { describe, expect, it } from 'vitest';
import { occurrences, parseIcs } from './calendar.ts';

// Shaped like Google Calendar's secret iCal address: CRLF line ends, folded lines, a time zone.
const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-WR-CALNAME:Work',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Brussels',
  'END:VTIMEZONE',
  // Standup: every weekday at 9:30 Brussels time, not on Wednesday the 11th, moved on Thursday the 12th.
  'BEGIN:VEVENT',
  'UID:standup@google.com',
  'DTSTART;TZID=Europe/Brussels:20261109T093000',
  'DTEND;TZID=Europe/Brussels:20261109T094500',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  'EXDATE;TZID=Europe/Brussels:20261111T093000',
  'SUMMARY:Standup',
  'DESCRIPTION:Join with Google Meet: https://meet.google.com/abc-defg-hij\\nOr dial in',
  'BEGIN:VALARM',
  'TRIGGER:-PT10M',
  'DESCRIPTION:This is an alarm',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:standup@google.com',
  'RECURRENCE-ID;TZID=Europe/Brussels:20261112T093000',
  'DTSTART;TZID=Europe/Brussels:20261112T110000',
  'DTEND;TZID=Europe/Brussels:20261112T111500',
  'SUMMARY:Standup (later today)',
  'END:VEVENT',
  // A one-off in UTC with a long folded title and escaped characters.
  'BEGIN:VEVENT',
  'UID:lunch@google.com',
  'DTSTART:20261110T113000Z',
  'DURATION:PT1H',
  'SUMMARY:Lunch with Sam\\, Alex',
  '  and Kim',
  'LOCATION:Café',
  'END:VEVENT',
  // Cancelled.
  'BEGIN:VEVENT',
  'UID:gone@google.com',
  'DTSTART:20261110T150000Z',
  'DTEND:20261110T160000Z',
  'STATUS:CANCELLED',
  'SUMMARY:Cancelled thing',
  'END:VEVENT',
  // A birthday, every year, all day.
  'BEGIN:VEVENT',
  'UID:bday@google.com',
  'DTSTART;VALUE=DATE:20201113',
  'DTEND;VALUE=DATE:20201114',
  'RRULE:FREQ=YEARLY',
  'SUMMARY:Birthday Sam',
  'END:VEVENT',
  // The second Tuesday of every month, three times.
  'BEGIN:VEVENT',
  'UID:review@google.com',
  'DTSTART:20261013T130000Z',
  'DTEND:20261013T140000Z',
  'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3',
  'SUMMARY:Review',
  'LOCATION:https://zoom.us/j/123',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const from = new Date(2026, 10, 9).getTime(); // Monday 9 November, local midnight
const to = new Date(2026, 10, 16).getTime(); // a week later

describe('calendar', () => {
  const cal = parseIcs(ICS);
  const week = occurrences(cal.events, from, to);
  const titled = (t: string) => week.filter((o) => o.title === t);

  it('reads the name, the events and their details', () => {
    expect(cal.name).toBe('Work');
    expect(cal.events).toHaveLength(6);
    expect(titled('Lunch with Sam, Alex and Kim')[0].start.toISOString()).toBe('2026-11-10T11:30:00.000Z');
    expect(titled('Lunch with Sam, Alex and Kim')[0].end.toISOString()).toBe('2026-11-10T12:30:00.000Z');
  });

  it('converts time zones', () => {
    // 9:30 in Brussels in November is 8:30 UTC.
    expect(titled('Standup')[0].start.toISOString()).toBe('2026-11-09T08:30:00.000Z');
  });

  it('repeats, skips excluded days and uses moved occurrences', () => {
    const standups = titled('Standup').map((o) => o.start.getDate());
    expect(standups).toEqual([9, 10, 13]);
    expect(titled('Standup (later today)')[0].start.toISOString()).toBe('2026-11-12T10:00:00.000Z');
  });

  it('spots video calls, and leaves out cancelled events', () => {
    expect(titled('Standup')[0].video).toBe(true);
    expect(titled('Review')[0].video).toBe(true);
    expect(titled('Lunch with Sam, Alex and Kim')[0].video).toBe(false);
    expect(titled('Cancelled thing')).toHaveLength(0);
  });

  it('handles all-day yearly events and monthly positions', () => {
    const bday = titled('Birthday Sam')[0];
    expect(bday.allDay).toBe(true);
    expect(bday.start.getTime()).toBe(new Date(2026, 10, 13).getTime());
    const reviews = occurrences(cal.events, new Date(2026, 9, 1).getTime(), new Date(2027, 2, 1).getTime()).filter((o) => o.title === 'Review');
    expect(reviews.map((o) => o.start.toISOString().slice(0, 10))).toEqual(['2026-10-13', '2026-11-10', '2026-12-08']);
  });

  it('skips what it does not understand instead of failing', () => {
    expect(parseIcs('nonsense').events).toEqual([]);
    expect(parseIcs('BEGIN:VEVENT\r\nSUMMARY:No start\r\nEND:VEVENT').events).toEqual([]);
  });
});
