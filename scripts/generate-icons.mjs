import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const center = size / 2;
  const radius = size * 0.38;
  const innerRadius = size * 0.16;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 4;
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const onFace = distance < radius;
      const onRing = Math.abs(distance - radius) < size * 0.025;
      const onInner = Math.abs(distance - innerRadius) < size * 0.018;
      const handVertical = Math.abs(dx) < size * 0.014 && dy < 0 && dy > -size * 0.19;
      const handDiagonal = Math.abs(dy - dx * 0.58) < size * 0.014 && dx > 0 && dx < size * 0.16;

      let r = 0x13;
      let g = 0x13;
      let b = 0x16;
      let a = 255;

      if (onFace) {
        r = 0x17;
        g = 0x19;
        b = 0x2e;
      }
      if (onRing || onInner || handVertical || handDiagonal) {
        r = 0x78;
        g = 0x88;
        b = 0xcc;
      }
      if (distance > size * 0.48) {
        a = 0;
      }

      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

await mkdir("public/icons", { recursive: true });
await writeFile("public/icons/icon-192.png", makePng(192));
await writeFile("public/icons/icon-512.png", makePng(512));
await writeFile("public/apple-touch-icon.png", makePng(180));
