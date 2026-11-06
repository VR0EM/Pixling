/**
 * Little things that depend on the clock and the calendar: coffee in the morning, a nightcap at night,
 * a party hat on Friday evening and New Year's Eve, a beanie in winter. Hats only show
 * when the user hasn't picked one.
 */
export interface Moment {
  hat?: string;
  item?: string;
}

/** With `seasons` off there's no New Year's party hat and no winter beanie (seasons.ts does the rest). */
export function momentFor(date: Date, seasons = true): Moment {
  const hour = date.getHours() + date.getMinutes() / 60;
  const day = date.getDay(); // 0 = Sunday
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();

  if (hour >= 23 || hour < 6) return { hat: 'nightcap' };
  const newYear = (month === 12 && dayOfMonth === 31 && hour >= 18) || (month === 1 && dayOfMonth === 1);
  const fridayEvening = day === 5 && hour >= 17;
  const moment: Moment = {};
  if ((newYear && seasons) || fridayEvening) moment.hat = 'partyhat';
  else if (seasons && (month === 12 || month <= 2)) moment.hat = 'beanie';
  if (hour >= 7 && hour < 10) moment.item = 'coffee';
  return moment;
}
