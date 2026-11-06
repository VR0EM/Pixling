import { describe, expect, it } from 'vitest';
import { MUG_COOLS, ROBOT_DRAIN, SPROUT_THIRSTY, Traits } from './traits.ts';

const DAY = '2026-11-06';

/** Runs the trait for a while, a tick per second, and collects what it said. */
function run(t: Traits, ms: number, { active = true, hour = 14, start = 0, today = DAY } = {}): string[] {
  const said: string[] = [];
  for (let at = start; at < start + ms; at += 1000) {
    const r = t.tick(at, active, today, hour);
    if (r?.say) said.push(r.say.key);
  }
  return said;
}

describe('traits', () => {
  it('the mug cools down, runs out, and gets refilled with a click', () => {
    const mug = new Traits('mug');
    expect(mug.look(0, 14).render.fill).toBe(3);
    expect(run(mug, 3 * MUG_COOLS)).toEqual(['mugCold', 'mugEmpty']);
    expect(mug.look(0, 14).render.fill).toBe(0);
    expect(mug.click(DAY)?.say?.key).toBe('mugRefilled');
    expect(mug.look(0, 14).render.fill).toBe(3);
    // A full mug is just patted.
    expect(mug.click(DAY)).toBeUndefined();
  });

  it('the mug only cools while someone is there, and is fresh in the morning', () => {
    const mug = new Traits('mug');
    run(mug, 2 * MUG_COOLS, { active: false });
    expect(mug.look(0, 14).render.fill).toBe(3);
    run(mug, MUG_COOLS + 1000);
    expect(mug.look(0, 14).render.fill).toBe(2);
    expect(mug.tick(0, true, '2026-11-07', 8)?.say?.key).toBe('mugRefilled');
    expect(mug.tick(1000, true, '2026-11-07', 8)).toBeUndefined();
  });

  it('the robot runs low, plugs itself in, and races around when full', () => {
    const robot = new Traits('robot');
    const said = run(robot, 90 * ROBOT_DRAIN);
    expect(said).toEqual(['robotLow', 'robotCharging']);
    let look = robot.look(0, 14);
    expect(look.render.charging).toBe(true);
    expect(look.stayPut).toBe(true);
    expect(run(robot, 60_000)).toEqual(['robotCharged']);
    look = robot.look(60_000, 14);
    expect(look.render.charge).toBe(1);
    expect(look.speed).toBeGreaterThan(1);
    expect(robot.look(10 * 60_000, 14).speed).toBe(1);
  });

  it('the robot can be plugged in early with a click, or by plugging in the computer', () => {
    const robot = new Traits('robot');
    expect(robot.click(DAY)).toBeUndefined(); // full: just a pat
    run(robot, 82 * ROBOT_DRAIN);
    expect(robot.look(0, 14).speed).toBeLessThan(1);
    expect(robot.click(DAY)?.say?.key).toBe('robotCharging');
    const other = new Traits('robot');
    run(other, 20 * ROBOT_DRAIN);
    expect(other.powered()?.say?.key).toBe('robotCharging');
  });

  it('the sprout gets thirsty, and grows once per day it is watered, until it blooms', () => {
    const sprout = new Traits('sprout');
    expect(run(sprout, SPROUT_THIRSTY + 1000)).toEqual(['sproutThirsty']);
    expect(sprout.look(0, 14).render.wilt).toBe(true);
    expect(sprout.click(DAY)?.say?.key).toBe('sproutGrew');
    expect(sprout.look(0, 14).render).toEqual({ growth: 1, wilt: false });
    // Watering again the same day doesn't grow it; when it isn't thirsty a click is just a pat.
    expect(sprout.click(DAY)).toBeUndefined();
    expect(sprout.watered(DAY)?.say?.key).toBe('sproutWatered');
    expect(sprout.watered('2026-11-07')?.say?.key).toBe('sproutGrew');
    expect(sprout.watered('2026-11-08')?.say?.key).toBe('sproutBloomed');
    expect(sprout.sprout).toEqual({ growth: 3, wateredOn: '2026-11-08' });
    expect(new Traits('sprout', sprout.sprout).look(0, 14).render.growth).toBe(3);
  });

  it('the shroom glows at night', () => {
    const shroom = new Traits('shroom');
    expect(shroom.look(0, 23).render.glow).toBe(true);
    expect(shroom.look(0, 14).render.glow).toBe(false);
    expect(shroom.click(DAY, () => 0.1)?.emote).toBe('spores');
  });

  it('leaves other buddies alone', () => {
    for (const id of ['ghost', 'dragon', 'buddy-123']) {
      const t = new Traits(id);
      expect(run(t, 3 * MUG_COOLS)).toEqual([]);
      expect(t.look(0, 14)).toEqual({ render: {}, stayPut: false, speed: 1 });
      expect(t.click(DAY)).toBeUndefined();
    }
  });
});
