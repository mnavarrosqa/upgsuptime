import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const orbit = JSON.parse(readFileSync(join(root, "src/lib/brand-orbit.json"), "utf8"));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1c1917"/>
  <g transform="translate(3.2 3.2) scale(0.8)">
    <path d="${orbit.path}" fill="none" stroke="#f4f1ee" stroke-width="${orbit.strokeWidth}"/>
    <circle cx="${orbit.dot.cx}" cy="${orbit.dot.cy}" r="${orbit.dot.r}" fill="${orbit.color}"/>
  </g>
</svg>
`;
writeFileSync(join(root, "src/app/icon.svg"), svg);
const svgBuffer = Buffer.from(svg);

/** Single PNG (e.g. 32×32) embedded in a minimal .ico (Vista+ PNG-in-ICO). */
function pngBufferToIco(pngBuffer) {
  const width = pngBuffer.readUInt32BE(16);
  const height = pngBuffer.readUInt32BE(20);
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);
  iconDir.writeUInt16LE(1, 2);
  iconDir.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([iconDir, entry, pngBuffer]);
}

const sizes = [
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

for (const { size, file } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(root, "public", file));
  console.log(`Generated public/${file}`);
}

const faviconPng = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
const faviconIco = pngBufferToIco(faviconPng);
writeFileSync(join(root, "public", "favicon.ico"), faviconIco);
console.log("Generated public/favicon.ico");
