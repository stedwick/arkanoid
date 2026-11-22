import "./style.css";
import { createRenderer } from "./art";
import { createGame, stepGame, TICK_MS, WIDTH, type Game } from "./game";

const canvas = document.querySelector("canvas")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const prompt = document.querySelector<HTMLDivElement>("#prompt")!;
const title = document.querySelector<HTMLParagraphElement>("#prompt-title")!;
const score = document.querySelector("#score")!;
const level = document.querySelector("#level")!;
const lives = document.querySelector("#lives")!;

const prompts = {
  demo: { title: "Demo", action: "Play" },
  serve: { title: "Ball lost", action: "Launch ball" },
  gameover: { title: "Game over", action: "Play again" },
};

function updateDisplay(game: Game, previous?: Game) {
  if (previous?.score !== game.score) score.textContent = String(game.score).padStart(6, "0");
  if (previous?.level !== game.level) level.textContent = String(game.level).padStart(2, "0");
  if (previous?.lives !== game.lives) lives.textContent = String(game.lives).padStart(2, "0");
  if (previous?.phase === game.phase) return;
  prompt.hidden = game.phase === "playing";
  if (game.phase !== "playing") {
    title.textContent = prompts[game.phase].title;
    play.textContent = prompts[game.phase].action;
    play.hidden = false;
  }
}

function playTone(audio: AudioContext | undefined, frequency: NonNullable<Game["tone"]>) {
  if (audio?.state !== "running") return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(0.035, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  oscillator.connect(volume).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.05);
}

async function start() {
  const render = await createRenderer(canvas);
  let game = createGame();
  let queuedAction = false;
  let queuedQuit = false;
  let queuedDirection = 0;
  let mouseDown = false;
  let pointerX: number | undefined;
  let audio: AudioContext | undefined;
  const keys = new Set<string>();

  function action() {
    queuedAction = true;
    if (typeof AudioContext === "undefined") return;
    audio ??= new AudioContext();
    if (audio.state !== "running") void audio.resume().catch(() => {});
  }

  function movePointer(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    pointerX = Math.round((event.clientX - bounds.left) * WIDTH / bounds.width);
  }

  play.addEventListener("click", () => {
    canvas.focus({ preventScroll: true });
    action();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") movePointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    movePointer(event);
    mouseDown = true;
    action();
  });
  window.addEventListener("pointerup", () => { mouseDown = false; });
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Space", "KeyX"].includes(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === "ArrowLeft") queuedDirection = -1;
    if (event.code === "ArrowRight") queuedDirection = 1;
    if (event.code === "Space") action();
    if (event.code === "KeyX") queuedQuit = true;
  });
  canvas.addEventListener("keyup", (event) => keys.delete(event.code));
  canvas.addEventListener("blur", () => {
    keys.clear();
    queuedDirection = 0;
  });
  window.addEventListener("blur", () => {
    keys.clear();
    mouseDown = false;
    queuedDirection = 0;
  });

  let previousTime = performance.now();
  let elapsed = 0;
  document.addEventListener("visibilitychange", () => {
    previousTime = performance.now();
    elapsed = 0;
  });

  function frame(time: number) {
    elapsed += Math.max(0, Math.min(time - previousTime, 4 * TICK_MS));
    previousTime = time;
    const previous = game;
    while (elapsed >= TICK_MS) {
      const left = keys.has("ArrowLeft");
      const right = keys.has("ArrowRight");
      const direction = left || right ? Number(right) - Number(left) : queuedDirection;
      game = stepGame(game, {
        paddleX: direction ? game.paddleX + direction * 6 : pointerX,
        action: queuedAction,
        fire: mouseDown || keys.has("Space"),
        quit: queuedQuit,
      }, [Math.random(), Math.random()]);
      pointerX = undefined;
      queuedAction = false;
      queuedQuit = false;
      queuedDirection = 0;
      if (game.tone && game.phase !== "demo") playTone(audio, game.tone);
      elapsed -= TICK_MS;
    }
    if (previous !== game) {
      render(game);
      updateDisplay(game, previous);
    }
    requestAnimationFrame(frame);
  }

  render(game);
  updateDisplay(game);
  requestAnimationFrame(frame);
}

void start().catch(() => { title.textContent = "Could not load the game. Reload to try again."; });
