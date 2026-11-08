import { describe, expect, it } from 'vitest';
import { Brain, type Input } from './brain.ts';
import { Social, type SocialEvent } from './social.ts';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const awake: Input = { cursor: { x: 0, y: 0 }, idleMs: 0 };

/** Two buddies on an 1200×700 screen, at these x positions, standing still. */
function pair(ax: number, bx: number) {
  const a = new Brain(1200, 700, seeded(1));
  const b = new Brain(1200, 700, seeded(2));
  a.x = ax;
  b.x = bx;
  a.walkiness = 0;
  b.walkiness = 0;
  return { a, b };
}

/** Runs both brains and the social layer for a while; `start` and the result are in seconds. */
function run(social: Social, a: Brain, b: Brain, seconds: number, start = 0) {
  const events: SocialEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    a.update(1 / 30, awake);
    b.update(1 / 30, awake);
    events.push(...social.update(start + t, a, b, [], true));
  }
  return events;
}

describe('two buddies', () => {
  it('say hi when they meet, once until they have been apart', () => {
    const { a, b } = pair(500, 580);
    const social = new Social(0, seeded(3));
    const events = run(social, a, b, 2);
    expect(events.filter((e) => e.emote === 'heart')).toHaveLength(1);
    expect(a.pose(awake).faceDx).toBe(1); // looking at its friend, to the right
    expect(b.pose(awake).faceDx).toBe(-1);
  });

  it('play tag now and then: whoever is it catches the other, and it ends', () => {
    const { a, b } = pair(300, 800);
    const social = new Social(0, seeded(4));
    const events = run(social, a, b, 60, 20 * 60);
    expect(events.some((e) => e.say?.key === 'tagStart')).toBe(true);
    expect(events.filter((e) => e.emote === 'exclaim').length).toBeGreaterThan(0);
    expect(social.playingTag).toBe(false);
  });

  it('a ghost or a dragon stays in the game instead of phasing or flying off', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = new Brain(1200, 700, seeded(seed));
      const b = new Brain(1200, 700, seeded(seed + 100));
      a.x = 300;
      b.x = 800;
      a.canPhase = true;
      b.canFly = true;
      const social = new Social(0, seeded(seed));
      let started = false;
      for (let t = 20 * 60; t < 20 * 60 + 60; t += 1 / 30) {
        a.update(1 / 30, awake);
        b.update(1 / 30, awake);
        social.update(t, a, b, [], true);
        if (!social.playingTag) continue;
        started = true;
        expect([a.mode, b.mode]).not.toContain('phase');
        expect([a.mode, b.mode]).not.toContain('fly');
      }
      expect(started).toBe(true);
    }
  });

  it('a thrown buddy knocks the other over', () => {
    const { a, b } = pair(400, 600);
    const social = new Social(0, seeded(5));
    // Throw the first one hard towards the second.
    a.grab(400, 650, 0);
    a.dragTo(520, 640, 0.05);
    a.release();
    const events = run(social, a, b, 1.5);
    expect(events.some((e) => e.who === 1 && e.say?.key === 'friendBonk')).toBe(true);
  });

  it('leave each other alone while one is busy', () => {
    const { a, b } = pair(300, 800);
    a.stayPut = true; // coding, or in a meeting
    const social = new Social(0, seeded(6));
    const events = run(social, a, b, 30, 20 * 60);
    expect(events.some((e) => e.say?.key === 'tagStart')).toBe(false);
  });
});
