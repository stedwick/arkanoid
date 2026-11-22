import backgroundUrl from "../BACKG.BMP?url";
import ballUrl from "../BALL.BMP?url";
import blockUrl from "../BLOCK.BMP?url";
import capsuleUrl from "../CAPSULE.BMP?url";
import paddleUrl from "../PADDLE.BMP?url";
import { HEIGHT, PADDLE_WIDTH, PADDLE_Y, brickX, brickY, type Game } from "./game";

interface Bitmap {
  width: number;
  height: number;
  stride: number;
  indices: Uint8Array;
  palette: Uint8Array;
}

async function loadBitmap(url: string): Promise<Bitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load game artwork");
  const bytes = await response.arrayBuffer();
  const header = new DataView(bytes);
  if (header.getUint16(0, true) !== 0x4d42 || header.getUint16(28, true) !== 8 || header.getUint32(30, true) !== 0) {
    throw new Error("Expected an 8-bit bitmap");
  }
  const width = header.getInt32(18, true);
  return {
    width,
    height: header.getInt32(22, true),
    stride: Math.ceil(width / 4) * 4,
    indices: new Uint8Array(bytes, header.getUint32(10, true)),
    palette: new Uint8Array(bytes, 54, 256 * 4),
  };
}

function paintBitmap(bitmap: Bitmap, level: number, transparent = true): HTMLCanvasElement {
  const { width, height, stride, indices, palette } = bitmap;
  const sprite = document.createElement("canvas");
  sprite.width = width;
  sprite.height = height;
  const context = sprite.getContext("2d")!;
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = indices[(height - 1 - y) * stride + x];
      if (transparent && index === 0) continue;
      // The DOS game shifts the first 17 palette entries at each new level.
      const color = (index <= 16 ? (index + level - 1) % 17 : index) * 4;
      const pixel = (y * width + x) * 4;
      image.data[pixel] = palette[color + 2];
      image.data[pixel + 1] = palette[color + 1];
      image.data[pixel + 2] = palette[color];
      image.data[pixel + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return sprite;
}

export async function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const [background, ball, block, capsule, paddle] = await Promise.all(
    [backgroundUrl, ballUrl, blockUrl, capsuleUrl, paddleUrl].map(loadBitmap),
  );

  function artwork(level: number) {
    return {
      level,
      background: paintBitmap(background, level, false),
      ball: paintBitmap(ball, level),
      block: paintBitmap(block, level),
      capsule: paintBitmap(capsule, level),
      paddle: paintBitmap(paddle, level),
    };
  }

  let sprites = artwork(1);
  context.font = "bold 8px monospace";
  context.textAlign = "center";
  return (game: Game) => {
    if (sprites.level !== game.level) sprites = artwork(game.level);
    context.drawImage(sprites.background, 0, 0);
    game.bricks.forEach((exists, index) => {
      if (exists) context.drawImage(sprites.block, brickX(index), brickY(index, game.level));
    });

    const x = Math.round(game.paddleX);
    if (game.laserY !== null) {
      context.fillStyle = "#ffe75d";
      context.fillRect(x + game.paddleWidth / 2, game.laserY, 1, PADDLE_Y - game.laserY);
    }
    for (let offset = 0; offset < game.paddleWidth; offset += PADDLE_WIDTH) {
      context.drawImage(sprites.paddle, x + offset, PADDLE_Y);
    }
    if (game.capsule) context.drawImage(sprites.capsule, Math.round(game.capsule.x), game.capsule.y);
    context.drawImage(sprites.ball, Math.round(game.ball.x), Math.round(game.ball.y));

    if (game.notice) {
      const y = HEIGHT - game.notice.ticks + 8;
      const text = game.notice.power.toUpperCase();
      context.strokeStyle = "#17101b";
      context.lineWidth = 2;
      context.fillStyle = "#fff1b5";
      context.strokeText(text, canvas.width / 2, y);
      context.fillText(text, canvas.width / 2, y);
    }
  };
}
