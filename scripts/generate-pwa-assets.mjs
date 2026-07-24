import fs from "fs";
import path from "path";
import zlib from "zlib";

const rootDir = process.cwd();
const iconsDir = path.join(rootDir, "public", "icons");
const splashDir = path.join(rootDir, "public", "splash");

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(splashDir, { recursive: true });

const BLUE = [10, 132, 255, 255];
const BLUE_DARK = [6, 105, 210, 255];
const WHITE = [255, 255, 255, 255];
const SLATE = [15, 23, 42, 255];
const BG = [248, 250, 252, 255];

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createCanvas(width, height, fill = [0, 0, 0, 0]) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = fill[0];
    pixels[index * 4 + 1] = fill[1];
    pixels[index * 4 + 2] = fill[2];
    pixels[index * 4 + 3] = fill[3];
  }

  return { width, height, pixels };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }

  const offset = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.pixels[offset] = color[0];
  canvas.pixels[offset + 1] = color[1];
  canvas.pixels[offset + 2] = color[2];
  canvas.pixels[offset + 3] = color[3];
}

function fillRect(canvas, x, y, width, height, color) {
  for (let py = Math.max(0, y); py < Math.min(canvas.height, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(canvas.width, x + width); px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const right = x + width - 1;
  const bottom = y + height - 1;

  for (let py = y; py <= bottom; py += 1) {
    for (let px = x; px <= right; px += 1) {
      const cx = px < x + radius ? x + radius : px > right - radius ? right - radius : px;
      const cy = py < y + radius ? y + radius : py > bottom - radius ? bottom - radius : py;
      const dx = px - cx;
      const dy = py - cy;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function fillCircle(canvas, centerX, centerY, radius, color) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function drawLine(canvas, x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

  for (let index = 0; index <= steps; index += 1) {
    const progress = steps === 0 ? 0 : index / steps;
    const x = x1 + (x2 - x1) * progress;
    const y = y1 + (y2 - y1) * progress;
    fillCircle(canvas, x, y, width / 2, color);
  }
}

function drawIcon(canvas, x, y, size) {
  const radius = Math.round(size * 0.23);
  fillRoundedRect(canvas, x, y, size, size, radius, BLUE);

  const left = x + size * 0.25;
  const baseY = y + size * 0.66;
  const points = [
    [left, baseY],
    [x + size * 0.4, y + size * 0.58],
    [x + size * 0.53, y + size * 0.72],
    [x + size * 0.68, y + size * 0.4],
    [x + size * 0.83, y + size * 0.5]
  ];
  const lineWidth = Math.max(6, Math.round(size * 0.08));

  for (let index = 0; index < points.length - 1; index += 1) {
    drawLine(canvas, points[index][0], points[index][1], points[index + 1][0], points[index + 1][1], lineWidth, WHITE);
  }

  drawLine(canvas, x + size * 0.25, y + size * 0.78, x + size * 0.82, y + size * 0.78, lineWidth * 0.7, WHITE);
  fillCircle(canvas, x + size * 0.4, y + size * 0.58, size * 0.055, WHITE);
  fillCircle(canvas, x + size * 0.68, y + size * 0.4, size * 0.055, WHITE);
  fillCircle(canvas, x + size * 0.83, y + size * 0.5, size * 0.055, WHITE);
}

function encodePng(canvas) {
  const rowLength = canvas.width * 4 + 1;
  const raw = Buffer.alloc(rowLength * canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    raw[y * rowLength] = 0;
    canvas.pixels.copy(raw, y * rowLength + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function savePng(filePath, canvas) {
  fs.writeFileSync(filePath, encodePng(canvas));
}

function makeIcon(size, fileName) {
  const canvas = createCanvas(size, size, [0, 0, 0, 0]);
  drawIcon(canvas, 0, 0, size);
  savePng(path.join(iconsDir, fileName), canvas);
}

function makeAppleIcon() {
  const size = 180;
  const canvas = createCanvas(size, size, BG);
  drawIcon(canvas, 0, 0, size);
  savePng(path.join(rootDir, "public", "apple-touch-icon.png"), canvas);
}

function makeSplash(width, height, fileName) {
  const canvas = createCanvas(width, height, BG);
  const topHeight = Math.round(height * 0.45);

  for (let y = 0; y < topHeight; y += 1) {
    const mix = y / topHeight;
    const color = [
      Math.round(BLUE[0] * (1 - mix) + BLUE_DARK[0] * mix),
      Math.round(BLUE[1] * (1 - mix) + BLUE_DARK[1] * mix),
      Math.round(BLUE[2] * (1 - mix) + BLUE_DARK[2] * mix),
      255
    ];
    fillRect(canvas, 0, y, width, 1, color);
  }

  const iconSize = Math.round(Math.min(width, height) * 0.22);
  drawIcon(canvas, Math.round((width - iconSize) / 2), Math.round(height * 0.31), iconSize);
  fillRoundedRect(canvas, Math.round(width * 0.22), Math.round(height * 0.58), Math.round(width * 0.56), 10, 5, SLATE);
  fillRoundedRect(canvas, Math.round(width * 0.32), Math.round(height * 0.62), Math.round(width * 0.36), 8, 4, [100, 116, 139, 255]);
  savePng(path.join(splashDir, fileName), canvas);
}

makeIcon(192, "icon-192.png");
makeIcon(512, "icon-512.png");
makeAppleIcon();
makeSplash(1170, 2532, "apple-splash-1170-2532.png");
makeSplash(1290, 2796, "apple-splash-1290-2796.png");

console.log("PWA assets generated.");
