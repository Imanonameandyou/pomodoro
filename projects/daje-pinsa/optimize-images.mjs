import sharp from "sharp";
import { readdirSync } from "fs";
import path from "path";

const dir = path.resolve("projects/daje-pinsa/images");
const files = readdirSync(dir).filter(f => f.endsWith(".png"));

for (const f of files) {
  const inPath = path.join(dir, f);
  const outPath = path.join(dir, f.replace(".png", ".webp"));
  await sharp(inPath)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(outPath);
  console.log(f, "->", path.basename(outPath));
}
