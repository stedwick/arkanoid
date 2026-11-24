export const WIDTH = 320;
export const HEIGHT = 200;
export const PADDLE_Y = 193;
export const PADDLE_WIDTH = 20;
export const TICK_MS = 1000 / 30;

const BALL_SIZE = 5;
const BRICK_WIDTH = 10;
const BRICK_HEIGHT = 5;
const COLUMNS = 30;
const ROWS = 5;
const BRICK_COUNT = COLUMNS * ROWS;
const LONG_POWER_TICKS = 900;
const POWERS = [
  "Sticky Paddle", "Fastball", "Lasers", "Ball Control", "More Score",
  "Long Paddle", "Extra Lives", "Warp", "Teleport",
] as const;

export type Power = (typeof POWERS)[number];
type TimedPower = "Sticky Paddle" | "Lasers" | "Ball Control" | "Long Paddle";
type Phase = "demo" | "playing" | "serve" | "gameover";

export interface Game {
  phase: Phase;
  score: number;
  level: number;
  lives: number;
  ball: { x: number; y: number; vx: number; vy: number };
  paddleX: number;
  paddleWidth: number;
  bricks: readonly boolean[];
  capsule: { x: number; y: number; power: Power } | null;
  firstCapsule: boolean;
  effect: { power: TimedPower; ticks: number } | null;
  notice: { power: Power; ticks: number } | null;
  stuck: boolean;
  laserY: number | null;
  tone: 300 | 400 | 500 | null;
}

interface Input {
  paddleX?: number;
  action?: boolean;
  fire?: boolean;
  quit?: boolean;
}

export function createGame(phase: Phase = "demo"): Game {
  return {
    phase, score: 0, level: 1, lives: 5,
    ball: createBall(3),
    paddleX: 140, paddleWidth: PADDLE_WIDTH,
    bricks: Array<boolean>(BRICK_COUNT).fill(true),
    capsule: null, firstCapsule: true, effect: null, notice: null,
    stuck: false, laserY: null, tone: null,
  };
}

function createBall(vx: number): Game["ball"] {
  return { x: 160, y: 100, vx, vy: -5 };
}

export function brickX(index: number): number {
  return 10 + (index % COLUMNS) * BRICK_WIDTH;
}

export function brickY(index: number, level: number): number {
  return Math.min(20 * level, 150) + Math.floor(index / COLUMNS) * BRICK_HEIGHT;
}

function brickAtBall(x: number, y: number, level: number): number {
  const column = Math.floor((x + 2 - brickX(0)) / BRICK_WIDTH);
  const row = Math.floor((y + 2 - brickY(0, level)) / BRICK_HEIGHT);
  if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return -1;
  return row * COLUMNS + column;
}

function removeBrick(game: Game, index: number) {
  const bricks = game.bricks.slice();
  bricks[index] = false;
  game.bricks = bricks;
  game.score += 7;
  game.tone = 400;
}

function nextLevel(game: Game): Game {
  const level = game.level + 1;
  return {
    ...createGame(game.phase), level,
    score: game.score + 2000 * level,
    lives: game.lives + 3,
    firstCapsule: game.firstCapsule,
    tone: game.tone,
  };
}

function movePaddle(game: Game, x: number) {
  game.paddleX = Math.max(0, Math.min(WIDTH - game.paddleWidth, x));
}

function releaseBall(game: Game) {
  game.stuck = false;
  game.ball.vy = -6;
}

function centerBallOnPaddle(game: Game) {
  game.ball.x = game.paddleX + (game.paddleWidth - BALL_SIZE) / 2;
}

function maybeDropCapsule(game: Game, random: readonly [number, number]) {
  if (game.phase !== "playing" || Math.floor(random[0] * 25) !== 1) return;
  game.capsule = {
    x: game.ball.x, y: game.ball.y,
    power: game.firstCapsule ? "Teleport" : POWERS[Math.floor(random[1] * POWERS.length)],
  };
  game.firstCapsule = false;
}

function bounceOffBrick(game: Game, brick: number, oldX: number, oldY: number) {
  const ball = game.ball;
  const crossedSide = brickAtBall(ball.x, oldY, game.level) === brick
    && brickAtBall(oldX, ball.y, game.level) !== brick;
  if (crossedSide) {
    ball.x = oldX;
    ball.vx *= -1;
  } else {
    ball.y = oldY;
    ball.vy *= -1;
  }
}

function moveBall(game: Game, action: boolean, random: readonly [number, number]) {
  const ball = game.ball;
  if (game.stuck) {
    centerBallOnPaddle(game);
    if (action) releaseBall(game);
    return;
  }

  const controlled = game.effect?.power === "Ball Control";
  if (controlled) centerBallOnPaddle(game);
  const pixelSteps = Math.max(1, Math.ceil(Math.abs(ball.vx)), Math.ceil(Math.abs(ball.vy)));
  let hitBrick = false;
  for (let step = 0; step < pixelSteps; step += 1) {
    const oldX = ball.x;
    const oldY = ball.y;
    if (!controlled) ball.x += ball.vx / pixelSteps;
    ball.y += ball.vy / pixelSteps;

    if (!controlled && (ball.x < 9 || ball.x > 305)) {
      ball.x = Math.max(9, Math.min(305, ball.x));
      ball.vx *= -1;
      game.tone = 300;
    }
    if (ball.y <= 0 && ball.vy < 0) {
      ball.y = 0;
      ball.vy *= -1;
    }

    const brick = hitBrick ? -1 : brickAtBall(ball.x, ball.y, game.level);
    if (game.bricks[brick]) {
      removeBrick(game, brick);
      hitBrick = true;
      maybeDropCapsule(game, random);
      if (!controlled) bounceOffBrick(game, brick, oldX, oldY);
    }

    if (ball.y >= PADDLE_Y - BALL_SIZE && ball.vy > 0) {
      bounceOffPaddle(game);
      return;
    }
  }
}

function bounceOffPaddle(game: Game) {
  const ball = game.ball;
  const contact = ball.x + BALL_SIZE / 2 - game.paddleX;
  if (contact < 0 || contact >= game.paddleWidth) {
    game.lives -= 1;
    game.phase = game.lives > 0 ? "serve" : "gameover";
    game.ball = createBall(ball.vx);
    return;
  }
  ball.y = PADDLE_Y - BALL_SIZE;
  if (game.effect?.power === "Sticky Paddle") {
    game.stuck = true;
    centerBallOnPaddle(game);
    ball.vy = 0;
    return;
  }
  if (contact < 5) ball.vx -= 1;
  if (contact > game.paddleWidth - 5) ball.vx += 1;
  ball.vy *= -1;
  game.tone = 500;
}

function fireLaser(game: Game) {
  const x = game.paddleX + game.paddleWidth / 2;
  game.laserY = 0;
  for (let index = BRICK_COUNT - 1; index >= 0; index -= 1) {
    if (game.bricks[index] && x >= brickX(index) && x < brickX(index) + BRICK_WIDTH) {
      removeBrick(game, index);
      game.laserY = brickY(index, game.level);
      return;
    }
  }
}

function moveCapsule(game: Game): Game {
  if (!game.capsule) return game;
  const capsule = { ...game.capsule, y: game.capsule.y + 1 };
  game.capsule = capsule.y < HEIGHT ? capsule : null;
  const contact = capsule.x + 5 - game.paddleX;
  if (capsule.y < PADDLE_Y - 5 || capsule.y >= HEIGHT || contact < 0 || contact > game.paddleWidth) {
    return game;
  }

  const { power } = capsule;
  game.capsule = null;
  game.score += 20;
  game.effect = game.effect?.power === "Long Paddle"
    ? { power: "Long Paddle", ticks: LONG_POWER_TICKS }
    : null;
  if (game.stuck && power !== "Sticky Paddle") releaseBall(game);

  switch (power) {
    case "Sticky Paddle":
    case "Lasers":
    case "Ball Control":
      game.paddleWidth = PADDLE_WIDTH;
      game.effect = { power, ticks: power === "Sticky Paddle" ? LONG_POWER_TICKS : 300 };
      break;
    case "Long Paddle":
      game.effect = { power, ticks: LONG_POWER_TICKS };
      game.paddleWidth = Math.min(WIDTH, game.paddleWidth + PADDLE_WIDTH);
      movePaddle(game, game.paddleX);
      break;
    case "Fastball":
      game.ball.vx *= 3;
      break;
    case "Extra Lives":
      game.lives += 3;
      break;
    case "More Score":
      game.score += 1000;
      break;
    case "Teleport":
      game.ball.y = 10;
      break;
    case "Warp":
      game = nextLevel(game);
      break;
  }
  game.notice = { power, ticks: HEIGHT };
  return game;
}

export function stepGame(previous: Game, input: Input, random: readonly [number, number] = [0, 0]): Game {
  if (input.quit) return createGame();
  if ((previous.phase === "demo" || previous.phase === "gameover") && input.action) {
    const game = createGame("playing");
    movePaddle(game, input.paddleX ?? game.paddleX);
    return game;
  }

  const game: Game = { ...previous, ball: { ...previous.ball }, laserY: null, tone: null };
  if (game.phase === "gameover") return game;
  if (game.phase === "playing" && game.effect) {
    const ticks = game.effect.ticks - 1;
    game.effect = ticks > 0 ? { ...game.effect, ticks } : null;
    if (!game.effect) {
      game.paddleWidth = PADDLE_WIDTH;
      if (game.stuck) releaseBall(game);
    }
  }
  movePaddle(game, game.phase === "demo" ? game.ball.x - 5 : input.paddleX ?? game.paddleX);
  if (game.phase === "serve") {
    if (input.action) game.phase = "playing";
    return game;
  }

  if (game.notice) game.notice = game.notice.ticks > 1 ? { ...game.notice, ticks: game.notice.ticks - 1 } : null;
  if (game.effect?.power === "Lasers" && (input.fire || input.action)) fireLaser(game);
  moveBall(game, Boolean(input.action), random);
  if (previous.phase === "demo" && game.phase !== "demo") return createGame();
  if (game.bricks !== previous.bricks && game.bricks.filter(Boolean).length <= 5) return nextLevel(game);
  return game.phase === "playing" ? moveCapsule(game) : game;
}
