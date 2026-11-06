import { describe, expect, it } from 'vitest';
import { Brain, type Input } from './brain.ts';
import { Games, resting, stepBall, type Ball, type GameEvent } from './games.ts';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const screen = { width: 1200, height: 700, scale: 3 };
const awake: Input = { cursor: { x: 900, y: 650 }, idleMs: 0 };

describe('games', () => {
  it('the ball bounces, rolls and comes to rest on the floor', () => {
    const ball: Ball = { x: 600, y: 200, vx: 300, vy: 0, held: false, carried: false };
    for (let i = 0; i < 60 * 6; i++) stepBall(ball, 1 / 60, screen);
    expect(resting(ball, screen)).toBe(true);
    expect(ball.x).toBeGreaterThan(600);
    expect(ball.x).toBeLessThanOrEqual(1200);
  });

  it('fetch: the buddy runs after a thrown ball and brings it back to the cursor', () => {
    const brain = new Brain(screen.width, screen.height, seeded(1));
    brain.stayPut = true;
    const games = new Games(seeded(2));
    const events: GameEvent[] = [games.start('fetch', 0, brain, screen)];
    // Throw the ball to the left.
    games.grabBall(500, 600, 0, brain);
    games.dragBall(420, 560, 50);
    games.releaseBall(60);
    let now = 60;
    for (let i = 0; i < 60 * 20; i++) {
      now += 1000 / 60;
      brain.update(1 / 60, awake);
      const e = games.update(now, 1 / 60, brain, screen, [], awake.cursor!.x);
      if (e) events.push(e);
    }
    expect(events.map((e) => e.count).filter(Boolean)).toEqual(['fetches']);
    expect(Math.abs(brain.x - 900)).toBeLessThan(10);
    expect(games.ball!.carried).toBe(false);
  });

  it('hide and seek: hides, can be found with a click, or gives up', () => {
    const brain = new Brain(screen.width, screen.height, seeded(3));
    const games = new Games(seeded(4));
    games.start('hide', 0, brain, screen);
    expect(games.update(1000, 1 / 60, brain, screen, [], null)).toBeUndefined();
    expect(games.update(3500, 1 / 60, brain, screen, [], null)?.emote).toBe('puff');
    expect(brain.mode).toBe('hide');
    expect(games.buddyClicked(brain)).toMatchObject({ count: 'finds', say: { key: 'hideFound' } });
    expect(games.active).toBe(false);
    expect(brain.mode).toBe('fall'); // jumps out

    const other = new Brain(screen.width, screen.height, seeded(5));
    const g2 = new Games(seeded(6));
    g2.start('hide', 0, other, screen);
    g2.update(3500, 1 / 60, other, screen, [], null);
    expect(g2.update(30_000, 1 / 60, other, screen, [], null)?.say?.key).toBe('hideHint');
    expect(g2.update(80_000, 1 / 60, other, screen, [], null)?.say?.key).toBe('hideGiveUp');
    expect(other.mode).not.toBe('hide');
  });

  it('hides behind a window edge with only the top showing', () => {
    const games = new Games(() => 0.99); // picks the last spot: the window
    const brain = new Brain(screen.width, screen.height, seeded(7));
    games.start('hide', 0, brain, screen);
    games.update(3500, 1 / 60, brain, screen, [{ id: 1, x: 200, y: 300, w: 600, h: 300 }], null);
    expect(games.clipY).toBe(300);
    expect(brain.y).toBeGreaterThan(300);
  });

  it('basket: dropping through the hoop scores', () => {
    const brain = new Brain(screen.width, screen.height, seeded(8));
    const games = new Games(seeded(9));
    games.start('basket', 0, brain, screen);
    const hoop = games.hoop!;
    // Hold the buddy above the rim and let go.
    brain.grab(brain.x, brain.y, 0);
    brain.dragTo(hoop.x + hoop.w / 2, hoop.y - 60, 0.2);
    brain.dragTo(hoop.x + hoop.w / 2, hoop.y - 60, 0.35);
    brain.release();
    let scored: GameEvent | undefined;
    for (let i = 0; i < 60 && !scored; i++) {
      const before = brain.y;
      brain.update(1 / 60, awake);
      scored = games.checkBasket(before, brain, 1000);
    }
    expect(scored).toMatchObject({ count: 'baskets', say: { key: 'basketScore' } });
  });
});
