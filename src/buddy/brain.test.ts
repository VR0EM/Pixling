import { describe, expect, it } from 'vitest';
import { Brain, SLEEP_AFTER_MS, type Input } from './brain.ts';

/** A repeatable random number generator, so the tests don't depend on luck. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const awake: Input = { cursor: { x: 100, y: 100 }, idleMs: 0 };

function run(brain: Brain, seconds: number, input: Input = awake, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) brain.update(step, input);
}

describe('Brain', () => {
  it('wanders but never leaves the screen', () => {
    const brain = new Brain(800, 600, seeded(1));
    let walked = false;
    for (let i = 0; i < 6000; i++) {
      brain.update(1 / 30, awake);
      if (brain.mode === 'walk') walked = true;
      expect(brain.x).toBeGreaterThanOrEqual(brain.margin);
      expect(brain.x).toBeLessThanOrEqual(800 - brain.margin);
      expect(brain.y).toBe(600);
    }
    expect(walked).toBe(true);
  });

  it('falls asleep when the cursor stays still and wakes up when it moves', () => {
    const brain = new Brain(800, 600, seeded(2));
    run(brain, 1, { cursor: null, idleMs: SLEEP_AFTER_MS + 1 });
    expect(brain.mode).toBe('sleep');
    expect(brain.pose(awake).blink).toBe(true);
    expect(brain.pose({ cursor: null, idleMs: SLEEP_AFTER_MS + 1 }).emote).toBe('slaap');
    run(brain, 0.1, awake);
    expect(brain.mode).toBe('idle');
  });

  it('can be thrown, bounces and lands on the ground', () => {
    const brain = new Brain(800, 600, seeded(3));
    brain.grab(600, 560, 0);
    brain.dragTo(500, 400, 0.05);
    brain.dragTo(400, 250, 0.1);
    expect(brain.mode).toBe('drag');
    brain.release();
    expect(brain.mode).toBe('fall');
    expect(brain.vx).toBeLessThan(0);
    expect(brain.vy).toBeLessThan(0);
    run(brain, 5);
    expect(['idle', 'walk']).toContain(brain.mode);
    expect(brain.y).toBe(600);
    expect(brain.x).toBeGreaterThanOrEqual(brain.margin);
  });

  it('stays on screen while dragged', () => {
    const brain = new Brain(800, 600, seeded(4));
    brain.grab(brain.x, brain.y, 0);
    brain.dragTo(-500, 2000, 0.05);
    expect(brain.x).toBe(brain.margin);
    expect(brain.y).toBe(600);
  });

  it('shows a heart when petted', () => {
    const brain = new Brain(800, 600, seeded(5));
    brain.pet();
    brain.update(0.05, awake);
    const pose = brain.pose(awake);
    expect(pose.emote).toBe('hart');
    expect(pose.lift).toBeGreaterThan(0);
  });

  it('looks at the cursor while standing still', () => {
    const brain = new Brain(800, 600, seeded(6));
    brain.update(0.01, awake);
    expect(brain.pose({ cursor: { x: 0, y: 0 }, idleMs: 0 }).faceDx).toBe(-1);
    expect(brain.pose({ cursor: { x: 800, y: 0 }, idleMs: 0 }).faceDx).toBe(1);
  });

  it('keeps standing on the ground when the screen shrinks', () => {
    const brain = new Brain(800, 600, seeded(7));
    brain.resize(500, 550);
    expect(brain.y).toBe(550);
    expect(brain.x).toBeLessThanOrEqual(500 - brain.margin);
  });
});
