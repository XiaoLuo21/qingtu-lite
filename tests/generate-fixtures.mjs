import { mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

export const fixtureDir = fileURLToPath(new URL("./fixtures/", import.meta.url));

const FIXTURE_FILES = {
  jpeg: "sample.jpg",
  png: "transparent.png",
  webp: "sample.webp",
  tiny: "tiny.png",
  corrupt: "corrupt.jpg",
  text: "not-image.txt",
  big: "big.jpg",
  wide: "wide.png",
};

function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Buffer.from(base64, "base64");
}

async function drawAssets() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    const assets = await page.evaluate(() => {
      let seed = 20261022;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const makeCanvas = (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      };

      // 不透明 JPEG：渐变 + 图形 + 文字，保证编码后体积可观。
      const jpegCanvas = makeCanvas(1600, 1000);
      const jpegCtx = jpegCanvas.getContext("2d");
      const gradient = jpegCtx.createLinearGradient(0, 0, 1600, 1000);
      gradient.addColorStop(0, "#0b9474");
      gradient.addColorStop(0.45, "#1f6f9a");
      gradient.addColorStop(1, "#f2b544");
      jpegCtx.fillStyle = gradient;
      jpegCtx.fillRect(0, 0, 1600, 1000);
      for (let i = 0; i < 220; i += 1) {
        const radius = 20 + random() * 120;
        jpegCtx.beginPath();
        jpegCtx.arc(random() * 1600, random() * 1000, radius, 0, Math.PI * 2);
        const alpha = 0.06 + random() * 0.22;
        jpegCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        jpegCtx.fill();
      }
      jpegCtx.fillStyle = "rgba(8,40,36,0.82)";
      jpegCtx.font = "bold 128px sans-serif";
      jpegCtx.fillText("QINGTU TEST", 96, 260);
      jpegCtx.font = "48px sans-serif";
      jpegCtx.fillText("local compression fixture 1600x1000", 100, 340);

      // 含透明背景 PNG：不填充底色，保留 alpha。
      const pngCanvas = makeCanvas(900, 700);
      const pngCtx = pngCanvas.getContext("2d");
      pngCtx.clearRect(0, 0, 900, 700);
      const blobGradient = pngCtx.createRadialGradient(430, 330, 40, 430, 330, 360);
      blobGradient.addColorStop(0, "rgba(11,148,116,0.95)");
      blobGradient.addColorStop(0.55, "rgba(242,181,68,0.8)");
      blobGradient.addColorStop(1, "rgba(31,111,154,0)");
      pngCtx.fillStyle = blobGradient;
      pngCtx.beginPath();
      pngCtx.arc(430, 330, 250, 0, Math.PI * 2);
      pngCtx.fill();
      pngCtx.strokeStyle = "rgba(255,255,255,0.9)";
      pngCtx.lineWidth = 18;
      pngCtx.beginPath();
      pngCtx.moveTo(150, 560);
      pngCtx.lineTo(760, 140);
      pngCtx.stroke();
      pngCtx.fillStyle = "rgba(255,255,255,0.85)";
      pngCtx.font = "bold 64px sans-serif";
      pngCtx.fillText("透明背景", 250, 380);

      // WebP 输入样例。
      const webpCanvas = makeCanvas(1200, 800);
      const webpCtx = webpCanvas.getContext("2d");
      const webpGradient = webpCtx.createLinearGradient(0, 0, 1200, 800);
      webpGradient.addColorStop(0, "#102f3a");
      webpGradient.addColorStop(0.5, "#137c68");
      webpGradient.addColorStop(1, "#e9c46a");
      webpCtx.fillStyle = webpGradient;
      webpCtx.fillRect(0, 0, 1200, 800);
      webpCtx.strokeStyle = "rgba(255,255,255,0.18)";
      webpCtx.lineWidth = 2;
      for (let x = 0; x <= 1200; x += 60) {
        webpCtx.beginPath();
        webpCtx.moveTo(x, 0);
        webpCtx.lineTo(x, 800);
        webpCtx.stroke();
      }
      for (let y = 0; y <= 800; y += 60) {
        webpCtx.beginPath();
        webpCtx.moveTo(0, y);
        webpCtx.lineTo(1200, y);
        webpCtx.stroke();
      }
      webpCtx.fillStyle = "#fff";
      webpCtx.font = "bold 96px sans-serif";
      webpCtx.fillText("WEBP INPUT", 120, 430);

      // 超长边 PNG：验证 maxWidth/maxHeight 4096 的缩放与提示。
      const wideCanvas = makeCanvas(5000, 600);
      const wideCtx = wideCanvas.getContext("2d");
      const wideGradient = wideCtx.createLinearGradient(0, 0, 5000, 0);
      wideGradient.addColorStop(0, "#0b9474");
      wideGradient.addColorStop(0.5, "#1f6f9a");
      wideGradient.addColorStop(1, "#f2b544");
      wideCtx.fillStyle = wideGradient;
      wideCtx.fillRect(0, 0, 5000, 600);
      wideCtx.fillStyle = "rgba(255,255,255,0.9)";
      wideCtx.font = "bold 180px sans-serif";
      wideCtx.fillText("5000 x 600", 180, 340);

      // 1x1 透明 PNG，用于观察“体积变大”文案。
      const tinyCanvas = makeCanvas(1, 1);
      tinyCanvas.getContext("2d").clearRect(0, 0, 1, 1);

      return {
        jpeg: jpegCanvas.toDataURL("image/jpeg", 0.92),
        png: pngCanvas.toDataURL("image/png"),
        webp: webpCanvas.toDataURL("image/webp", 0.9),
        tiny: tinyCanvas.toDataURL("image/png"),
        wide: wideCanvas.toDataURL("image/png"),
      };
    });
    return {
      jpeg: dataUrlToBuffer(assets.jpeg),
      png: dataUrlToBuffer(assets.png),
      webp: dataUrlToBuffer(assets.webp),
      tiny: dataUrlToBuffer(assets.tiny),
      wide: dataUrlToBuffer(assets.wide),
    };
  } finally {
    await browser.close();
  }
}

/**
 * 生成 E2E 需要的真实图片样例（由 Chrome Canvas 编码）。
 * 文件名与测试一一对应，避免把用户个人图片提交进仓库。
 */
export async function generateFixtures({ force = false } = {}) {
  await mkdir(fixtureDir, { recursive: true });

  if (!force) {
    try {
      const results = await Promise.all(
        Object.values(FIXTURE_FILES).map((name) => stat(path.join(fixtureDir, name))),
      );
      if (results.every((info) => info.size > 0)) {
        return fixtureDir;
      }
    } catch {
      /* 有缺失则重新生成 */
    }
  }

  const assets = await drawAssets();

  await writeFile(path.join(fixtureDir, FIXTURE_FILES.jpeg), assets.jpeg);
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.png), assets.png);
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.webp), assets.webp);
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.tiny), assets.tiny);
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.wide), assets.wide);
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.corrupt), assets.jpeg.subarray(0, 600));
  await writeFile(
    path.join(fixtureDir, FIXTURE_FILES.text),
    "这不是图片文件，仅用于验证前端的类型拒绝逻辑。\n",
  );

  const big = Buffer.alloc(15 * 1024 * 1024 + 1024, 0x42);
  big[0] = 0xff;
  big[1] = 0xd8;
  big[2] = 0xff;
  await writeFile(path.join(fixtureDir, FIXTURE_FILES.big), big);

  return fixtureDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateFixtures({ force: process.argv.includes("--force") })
    .then((dir) => {
      console.log(`fixtures ready: ${dir}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
