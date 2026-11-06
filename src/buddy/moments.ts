/**
 * Little things that depend on the clock and the calendar: coffee in the morning, a nightcap at night,
 * a party hat on Friday evening and New Year's Eve, a mitre in the Sinterklaas season. Hats only show
 * when the user hasn't picked one.
 */
export interface Moment {
  hat?: string;
  item?: string;
}

export function momentFor(date: Date): Moment {
  const hour = date.getHours() + date.getMinutes() / 60;
  const day = date.getDay(); // 0 = Sunday
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();

  if (hour >= 23 || hour < 6) return { hat: 'slaapmuts' };
  const newYear = (month === 12 && dayOfMonth === 31 && hour >= 18) || (month === 1 && dayOfMonth === 1);
  const fridayEvening = day === 5 && hour >= 17;
  const moment: Moment = {};
  if (newYear || fridayEvening) moment.hat = 'feesthoed';
  else if ((month === 11 && dayOfMonth >= 11) || (month === 12 && dayOfMonth <= 6)) moment.hat = 'mijter';
  if (hour >= 7 && hour < 10) moment.item = 'koffie';
  return moment;
}
