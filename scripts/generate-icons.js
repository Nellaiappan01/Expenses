const path = require("path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");
const sizes = [192, 512];

// Create green rounded square matching icon.svg (#059669, rx 96 at 512px)
async function generate() {
  for (const size of sizes) {
    const radius = Math.round((96 / 512) * size);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#059669"/>
      <text x="${size/2}" y="${size * 0.66}" font-size="${size * 0.55}" font-weight="bold" fill="white" text-anchor="middle" font-family="system-ui,sans-serif">1</text>
    </svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
}

generate().catch(console.error);
