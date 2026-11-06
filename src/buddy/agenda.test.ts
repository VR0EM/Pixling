import { describe, expect, it } from 'vitest';
import { Agenda, type AgendaSettings } from './agenda.ts';
import type { Occurrence } from './calendar.ts';

const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m).getTime(); // Monday 9 November, local time
const event = (title: string, from: number, minutes: number, extra: Partial<Occurrence> = {}): Occurrence => ({
  id: `${title}@${from}`,
  title,
  start: new Date(from),
  end: new Date(from + minutes * MIN),
  allDay: false,
  video: false,
  ...extra,
});
const ON: AgendaSettings = { alerts: true, hideInCalls: true };

/** Runs the agenda a tick per second from `from` to `to` and collects what it said. */
function run(agenda: Agenda, events: Occurrence[], from: number, to: number, settings = ON): string[] {
  const said: string[] = [];
  for (let t = from; t < to; t += 1000) {
    const a = agenda.update(events, t, settings, true);
    if (a.say) said.push(a.say.key);
  }
  return said;
}

describe('agenda', () => {
  const standup = event('Standup', at(9, 30), 15, { video: true });
  const lunch = event('Lunch', at(12), 60);

  it('tells what is on in the morning, gives a heads-up and asks how it went', () => {
    const agenda = new Agenda();
    const said = run(agenda, [standup, lunch], at(8), at(13, 10));
    expect(said).toEqual(['agenda', 'meetingSoon', 'meetingDone', 'meetingSoon', 'meetingNow', 'meetingDone', 'dayFree']);
  });

  it('fills in the details', () => {
    const agenda = new Agenda();
    const first = agenda.update([standup, lunch], at(8), ON, true);
    expect(first.say).toEqual({ key: 'agenda', vars: { things: '2 things', title: 'Standup', time: '09:30' } });
    const soon = agenda.update([standup, lunch], at(9, 22), ON, true);
    expect(soon.say).toEqual({ key: 'meetingSoon', vars: { title: 'Standup', min: 8 } });
    expect(soon.item).toBe('calendar');
    expect(soon.next).toBe('Next: Standup, 09:30');
  });

  it('keeps quiet in meetings and steps aside during video calls', () => {
    const agenda = new Agenda();
    const inCall = agenda.update([standup, lunch], at(9, 35), ON, true);
    expect(inCall).toMatchObject({ quiet: true, away: true });
    expect(inCall.say).toBeUndefined();
    const atLunch = agenda.update([standup, lunch], at(12, 30), ON, true);
    expect(atLunch).toMatchObject({ quiet: true, away: false });
    const noHiding = new Agenda().update([standup], at(9, 35), { ...ON, hideInCalls: false }, true);
    expect(noHiding.away).toBe(false);
  });

  it('says nothing about meetings when alerts are off, but still counts them', () => {
    const agenda = new Agenda();
    expect(run(agenda, [lunch], at(11), at(13, 10), { ...ON, alerts: false })).toEqual([]);
    const ended = new Agenda().update([lunch], at(13, 1), { ...ON, alerts: false }, true);
    expect(ended.ended).toBe(true);
  });

  it('only talks when someone is there', () => {
    const agenda = new Agenda();
    expect(agenda.update([lunch], at(11, 55), ON, false).say).toBeUndefined();
    // It hasn't been said yet, so it comes when you're back.
    expect(agenda.update([lunch], at(11, 56), ON, true).say?.key).toBe('meetingSoon');
  });

  it('wears a party hat on a birthday, and mentions tomorrow in the menu', () => {
    const bday = event('Birthday Sam', new Date(2026, 10, 9).getTime(), 24 * 60, { allDay: true });
    const tomorrow = event('Planning', at(9) + 24 * 60 * MIN, 60);
    const a = new Agenda().update([bday, tomorrow], at(15), ON, true);
    expect(a.hat).toBe('partyhat');
    expect(a.say).toEqual({ key: 'birthday', vars: { title: 'Birthday Sam' } });
    expect(a.next).toBe('Tomorrow: Planning, 09:00');
  });
});
