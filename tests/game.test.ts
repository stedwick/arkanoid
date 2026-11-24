import { describe, expect, test } from "bun:test";
import { createGame, stepGame, type Game, type Power } from "../src/game";

function playing(): Game {
  return stepGame(createGame(), { action: true });
}

function catchCapsule(power: Power, game = playing()): Game {
  return stepGame({ ...game, capsule: { x: game.paddleX, y: 190, power } }, {});
}

describe("a run", () => {
  test("starts from the demo, waits after a miss, and ends at zero lives", () => {
    expect(createGame().phase).toBe("demo");
    const game = playing();
    expect([game.phase, game.score, game.level, game.lives]).toEqual(["playing", 0, 1, 5]);

    const missed = { ...game, ball: { x: 60, y: 185, vx: 3, vy: 5 } };
    const serve = stepGame(missed, {});
    expect([serve.phase, serve.lives]).toEqual(["serve", 4]);
    expect(stepGame(serve, { paddleX: 240 }).ball).toEqual(serve.ball);
    expect(stepGame(serve, { action: true }).phase).toBe("playing");

    const over = stepGame({ ...missed, lives: 1 }, {});
    expect([over.phase, over.lives]).toEqual(["gameover", 0]);
    expect(stepGame(over, { action: true }).lives).toBe(5);
    expect(stepGame(game, { quit: true }).phase).toBe("demo");
  });

  test("advances with five bricks left and carries the score and lives forward", () => {
    const game = playing();
    const bricks = game.bricks.map((_, index) => index >= 144);
    const advanced = stepGame({ ...game, bricks,
      ball: { x: 248, y: 46, vx: 0, vy: -5 },
    }, {});

    expect([advanced.level, advanced.score, advanced.lives]).toEqual([2, 4007, 8]);
    expect(advanced.bricks.filter(Boolean)).toHaveLength(150);
    expect(bricks.filter(Boolean)).toHaveLength(6);
  });
});

describe("ball collisions", () => {
  test("a fast ball hits the first row it crosses and scores once", () => {
    const game = playing();
    const hit = stepGame({ ...game, ball: { x: 20, y: 55, vx: 0, vy: -35 } }, {});

    expect(hit.score).toBe(7);
    expect(hit.bricks[121]).toBe(false);
    expect(hit.bricks[91]).toBe(true);
    expect(hit.ball.vy).toBeGreaterThan(0);
    expect(game.bricks[121]).toBe(true);
  });

  test("the paddle turns the ball away and changes its angle at the edge", () => {
    const game = playing();
    const hit = stepGame({ ...game, ball: { x: 140, y: 186, vx: 0, vy: 5 } }, {});

    expect(hit.ball.vx).toBe(-1);
    expect(hit.ball.vy).toBe(-5);
    expect(hit.lives).toBe(5);
  });

  test("hitting the side of a brick reverses horizontal travel", () => {
    const game = playing();
    const bricks = game.bricks.map((exists, index) => index === 0 ? false : exists);
    const hit = stepGame({ ...game, bricks, ball: { x: 16, y: 20, vx: 4, vy: 0 } }, {});
    expect([hit.score, hit.bricks[1], hit.bricks[2], hit.ball.vx, hit.ball.vy]).toEqual([7, false, true, -4, 0]);
  });
});

describe("capsules", () => {
  test("the first drop is Teleport, and a missed capsule leaves the field", () => {
    const game = playing();
    const dropped = stepGame({ ...game, ball: { x: 20, y: 46, vx: 0, vy: -5 } }, {}, [0.05, 0]);
    expect(dropped.capsule?.power).toBe("Teleport");
    expect(stepGame({ ...dropped, capsule: { x: 20, y: 199, power: "Teleport" } }, {}).capsule).toBeNull();
  });

  test("later drops use the random power-up roll", () => {
    const game = { ...playing(), firstCapsule: false, ball: { x: 20, y: 46, vx: 0, vy: -5 } };
    expect(stepGame(game, {}, [0.05, 0.25]).capsule?.power).toBe("Lasers");
    expect(stepGame(game, {}, [0.05, 0.99]).capsule?.power).toBe("Teleport");
  });

  test("awards the catch score and applies the five immediate effects", () => {
    expect(catchCapsule("Fastball").ball.vx).toBe(9);
    expect(catchCapsule("Extra Lives").lives).toBe(8);
    expect(catchCapsule("More Score").score).toBe(1020);
    expect(catchCapsule("Teleport").ball.y).toBe(10);
    const warped = catchCapsule("Warp");
    expect([warped.level, warped.score, warped.lives]).toEqual([2, 4020, 8]);
  });

  test("Sticky Paddle holds, follows, releases, and also releases on expiry", () => {
    const sticky = catchCapsule("Sticky Paddle");
    const caught = stepGame({ ...sticky, ball: { x: 145, y: 185, vx: 0, vy: 5 } }, {});
    expect(caught.stuck).toBe(true);
    expect(stepGame(caught, { paddleX: 200 }).ball.x).toBe(207.5);
    expect(stepGame(caught, { action: true }).ball.vy).toBe(-6);
    const expired = stepGame({ ...caught, effect: { power: "Sticky Paddle", ticks: 1 } }, {});
    expect(expired.stuck).toBe(false);
    expect(expired.ball.vy).toBeLessThan(0);
  });

  test("Long Paddle doubles the width and expires", () => {
    const long = catchCapsule("Long Paddle");
    expect(long.paddleWidth).toBe(40);
    const expired = stepGame({ ...long, effect: { power: "Long Paddle", ticks: 1 } }, { paddleX: 320 });
    expect([expired.paddleWidth, expired.paddleX]).toEqual([20, 300]);
  });

  test("immediate powers refresh a long paddle, and a second extension adds width", () => {
    const long = catchCapsule("Long Paddle");
    const scored = catchCapsule("More Score", { ...long, effect: { power: "Long Paddle", ticks: 31 } });
    expect([scored.score, scored.paddleWidth, scored.effect?.ticks]).toEqual([1040, 40, 900]);
    const wider = catchCapsule("Long Paddle", scored);
    expect(wider.paddleWidth).toBe(60);
    expect(catchCapsule("Lasers", wider).paddleWidth).toBe(20);
  });

  test("Lasers score one brick per tick from the lowest row in their path", () => {
    const laser = catchCapsule("Lasers");
    const shot = stepGame(laser, { paddleX: 130, fire: true });
    expect([shot.score, shot.bricks[133], shot.bricks[103], shot.laserY]).toEqual([27, false, true, 40]);
    expect(stepGame(shot, {}).laserY).toBeNull();
  });

  test("Ball Control follows the paddle and passes through a brick", () => {
    const control = catchCapsule("Ball Control");
    const hit = stepGame({ ...control, ball: { x: 50, y: 46, vx: 3, vy: -5 } }, { paddleX: 14 });
    expect(hit.ball.x).toBe(21.5);
    expect(hit.ball.vy).toBe(-5);
    expect(hit.score).toBe(27);
  });
});
