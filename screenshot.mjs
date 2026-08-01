import puppeteer from "puppeteer";
import { mkdir, readdir } from "node:fs/promises";

const url = process.argv[2];
const label = process.argv[3];

if (!url) {
  console.error("Usage: node screenshot.mjs <url> [label]");
  process.exit(1);
}

const projectMatch = url.match(/\/projects\/([^/]+)\//);
const outDir = projectMatch
  ? `./projects/${projectMatch[1]}/temporary screenshots`
  : "./temporary screenshots";
await mkdir(outDir, { recursive: true });

const existing = await readdir(outDir).catch(() => []);
const nums = existing
  .map((f) => f.match(/^screenshot-(\d+)/))
  .filter(Boolean)
  .map((m) => parseInt(m[1], 10));
const next = nums.length ? Math.max(...nums) + 1 : 1;
const fileName = label ? `screenshot-${next}-${label}.png` : `screenshot-${next}.png`;
const outPath = `${outDir}/${fileName}`;

const browser = await puppeteer.launch();
const timeout = setTimeout(async () => {
  console.error("Timed out after 45s — closing browser.");
  await browser.close();
  process.exit(1);
}, 45000);

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0" });

// Scroll through the full page first so native lazy-loaded images
// (loading="lazy") actually fire before the full-page capture — a
// straight resize-and-shoot never enters their viewport threshold.
// Then wait for every <img> to actually finish decoding, not just
// respond to the network request, before capturing.
await page.evaluate(async () => {
  const step = Math.max(window.innerHeight, 400);
  const height = document.body.scrollHeight;
  const maxSteps = 60;
  for (let y = 0, i = 0; y < height && i < maxSteps; y += step, i++) {
    window.scrollTo({ top: y, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 150));
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  await new Promise((r) => setTimeout(r, 150));
  const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((res) => setTimeout(res, ms))]);
  await Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : withTimeout(
            new Promise((res) => {
              img.addEventListener("load", res, { once: true });
              img.addEventListener("error", res, { once: true });
            }),
            5000
          )
    )
  );
});

await page.screenshot({ path: outPath, fullPage: true });
clearTimeout(timeout);
await browser.close();

console.log(`Saved ${outPath}`);
