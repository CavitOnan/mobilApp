/*
 * Basit bir "performans göstergesi" (gauge) ikonu üretir ve PNG olarak kaydeder.
 * Harici bir görsel kütüphaneye ihtiyaç duymadan, ham PNG chunk'larını elle yazar.
 * Sadece geliştirme/derleme zamanında bir kez çalıştırılan bir yardımcı script'tir.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [37, 99, 235, 255]; // #2563eb
const FG = [255, 255, 255, 255];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function drawGauge(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.32;
  const dotR = size * 0.075;
  const needleLen = outerR * 0.85;
  const needleAngleDeg = -55; // yukarı-sağ
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleDx = Math.cos(needleAngleRad);
  const needleDy = Math.sin(needleAngleRad);
  const needleThickness = size * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;
      const inGaugeGap = angleDeg > 55 && angleDeg < 125; // alt kısımda boşluk

      let color = BG;

      const onRing = dist <= outerR && dist >= innerR && !inGaugeGap;
      const onDot = dist <= dotR;

      let onNeedle = false;
      if (!onRing && !onDot) {
        const t = dx * needleDx + dy * needleDy;
        if (t >= 0 && t <= needleLen) {
          const projX = t * needleDx;
          const projY = t * needleDy;
          const perpDist = Math.sqrt((dx - projX) ** 2 + (dy - projY) ** 2);
          const widthAtT = needleThickness * (1 - t / needleLen) + 1;
          if (perpDist <= widthAtT / 2) onNeedle = true;
        }
      }

      if (onRing || onDot || onNeedle) color = FG;

      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
  return pixels;
}

function encodePng(size) {
  const pixels = drawGauge(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function writeIcon(outPath, size) {
  const png = encodePng(size);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`Yazıldı: ${outPath} (${size}x${size}, ${png.length} bayt)`);
}

const root = path.join(__dirname, '..');
writeIcon(path.join(root, 'build', 'icon.png'), 256);
writeIcon(path.join(root, 'electron', 'assets', 'tray-icon.png'), 32);
writeIcon(path.join(root, 'electron', 'assets', 'app-icon.png'), 256);
