const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");
const candidates = [
  path.join(publicDir, "site-ledger-icon-source.png"),
  path.join(publicDir, "site-ledger-icon-source.jpg"),
];
const sizes = [192, 512];

function resolveSource() {
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

async function generate() {
  const sourcePath = resolveSource();
  if (!sourcePath) {
    console.error(
      "Missing public/site-ledger-icon-source.png (or .jpg) — add the Site Ledger icon image first."
    );
    process.exit(1);
  }

  console.log(`Using source: ${path.basename(sourcePath)}`);

  for (const size of sizes) {
    await sharp(sourcePath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  await sharp(sourcePath)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
