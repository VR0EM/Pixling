import { describe, expect, it } from 'vitest';
import { Brain, SLEEP_AFTER_MS, type Input, type Rect } from './brain.ts';

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

  describe('on windows', () => {
    const win: Rect = { id: 1, x: 200, y: 300, w: 400, h: 250 };

    /** Puts the buddy at (x, y) without any speed, as if it was dropped there. */
    function dropAt(brain: Brain, x: number, y: number) {
      brain.grab(brain.x, brain.y, 0);
      brain.dragTo(x, y, 0.05);
      brain.dragTo(x, y, 0.2);
      brain.release();
    }

    it('lands on a window that is below it', () => {
      const brain = new Brain(800, 600, seeded(8));
      brain.setWindows([win]);
      dropAt(brain, 400, 150);
      run(brain, 1);
      expect(brain.standingOn).toBe(1);
      expect(brain.y).toBe(300);
    });

    it('rides along when the window moves and falls when it closes', () => {
      const brain = new Brain(800, 600, seeded(9));
      brain.setWindows([win]);
      dropAt(brain, 400, 150);
      run(brain, 1);
      const x = brain.x;
      brain.setWindows([{ ...win, x: 250, y: 320 }]);
      expect(brain.x).toBe(x + 50);
      expect(brain.y).toBe(320);
      brain.setWindows([]);
      expect(brain.mode).toBe('fall');
      run(brain, 2);
      expect(brain.standingOn).toBeNull();
      expect(brain.y).toBe(600);
    });

    it('loses its grip when the window is yanked sideways', () => {
      const brain = new Brain(800, 600, seeded(10));
      brain.setWindows([win]);
      dropAt(brain, 400, 150);
      run(brain, 1);
      brain.setWindows([{ ...win, x: 400 }]);
      expect(brain.mode).toBe('fall');
      expect(brain.vx).toBeGreaterThan(0);
    });

    it('ignores an edge that is hidden behind a window in front', () => {
      const brain = new Brain(800, 600, seeded(11));
      const front: Rect = { id: 2, x: 300, y: 50, w: 300, h: 500 };
      brain.setWindows([front, win]);
      dropAt(brain, 400, 150);
      run(brain, 2);
      expect(brain.standingOn).toBeNull();
      expect(brain.y).toBe(600);
    });

    it('can jump up onto a window', () => {
      const brain = new Brain(800, 600, seeded(12));
      brain.setWindows([win]);
      run(brain, 0.1);
      brain.jumpTo(450, win.y);
      run(brain, 2);
      expect(brain.standingOn).toBe(1);
      // Frame-by-frame physics drifts a little from the exact arc; climb() aims well inside the window.
      expect(Math.abs(brain.x - 450)).toBeLessThan(30);
    });

    it('climbs onto windows by itself now and then', () => {
      const brain = new Brain(800, 600, seeded(13));
      let climbed = false;
      for (let i = 0; i < 30 * 180 && !climbed; i++) {
        brain.setWindows([win]);
        brain.update(1 / 30, awake);
        if (brain.standingOn === 1) climbed = true;
      }
      expect(climbed).toBe(true);
    });
  });

  describe('watching along', () => {
    it('sits still and watches while a video app is in front', () => {
      const brain = new Brain(800, 600, seeded(14));
      brain.context = 'video';
      for (let i = 0; i < 30 * 120; i++) {
        brain.update(1 / 30, awake);
        expect(brain.mode).not.toBe('walk');
      }
    });

    it('shows music notes while a music app is in front', () => {
      const brain = new Brain(800, 600, seeded(15));
      brain.context = 'muziek';
      let notes = false;
      for (let i = 0; i < 30 * 10; i++) {
        brain.update(1 / 30, awake);
        if (brain.pose(awake).emote === 'noot') notes = true;
      }
      expect(notes).toBe(true);
    });
  });
});

