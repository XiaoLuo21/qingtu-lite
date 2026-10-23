/**
 * 采集真实页面截图（生产构建 preview 服务，非静态效果图）。
 * 用法：先 `npm run build && npm run preview`，再 `node tests/capture.mjs [baseURL]`
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, stat } from "node:fs/promises";
import { fixtureDir } from "./generate-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const outDir = path.resolve(projectRoot, "..", "qingtu-lite-deliverables", "screenshots");
const privateDir = path.resolve(projectRoot, "..", "qingtu-lite-deliverables", "testing");
const baseURL = process.argv[2] || "http://127.0.0.1:4173/";
const fixture = (name) => path.join(fixtureDir, name);

await mkdir(outDir, { recursive: true });
await mkdir(privateDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const summary = { baseURL, shots: [], checks: {} };

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

async function shot(page, name, { fullPage = true } = {}) {
  const target = path.join(outDir, name);
  await page.screenshot({ path: target, fullPage });
  summary.shots.push(name);
  return target;
}

/* ---------------- 桌面 1440 ---------------- */
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "zh-CN",
  acceptDownloads: true,
});
const page = await desktop.newPage();
const external = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(url.hostname)) {
    external.push(request.url());
  }
});

await page.goto(baseURL);
await settle(page);
await shot(page, "01-desktop-home-1440.png");

summary.checks.desktopOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

await page.setInputFiles("#file-input", fixture("sample.jpg"));
await page.locator("#original-panel").waitFor({ state: "visible" });
await settle(page);
await shot(page, "02-desktop-selected-1440.png");

await page.locator("#compress-button").click();
await page.locator("#result-section").waitFor({ state: "visible" });
await page.waitForTimeout(500);
await shot(page, "03-desktop-result-1440.png");

summary.checks.resultFormat = (await page.locator("#result-format").innerText()).trim();
summary.checks.metricOriginal = (await page.locator("#metric-original").innerText()).trim();
summary.checks.metricResult = (await page.locator("#metric-result").innerText()).trim();
summary.checks.metricDelta = (await page.locator("#metric-delta").innerText()).trim();
summary.checks.resultNote = (await page.locator("#result-note").innerText()).trim();

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#download-button").click(),
]);
const downloadPath = path.join(privateDir, download.suggestedFilename());
await download.saveAs(downloadPath);
const downloaded = await readFile(downloadPath);
summary.checks.download = {
  name: download.suggestedFilename(),
  bytes: (await stat(downloadPath)).size,
  jpegMagic: downloaded[0] === 0xff && downloaded[1] === 0xd8 && downloaded[2] === 0xff,
};

// 低画质重压缩
await page.locator("#quality-range").evaluate((element) => {
  element.value = "40";
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator("#compress-button").click();
await page.waitForFunction(
  () => document.querySelector("#compress-button")?.textContent.includes("重新压缩"),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(500);
await shot(page, "04-desktop-quality-40-1440.png");
summary.checks.metricResult40 = (await page.locator("#metric-result").innerText()).trim();

// 错误态
await page.setInputFiles("#file-input", fixture("not-image.txt"));
await page.waitForTimeout(350);
await shot(page, "05-desktop-error-1440.png");
summary.checks.errorText = (await page.locator("#status-message").innerText()).trim();

// 透明 PNG 结果
await page.locator("#reset-button").click();
await page.setInputFiles("#file-input", fixture("transparent.png"));
await page.locator("#original-panel").waitFor({ state: "visible" });
await page.locator("#compress-button").click();
await page.locator("#result-section").waitFor({ state: "visible" });
await page.waitForTimeout(500);
await shot(page, "06-desktop-png-result-1440.png");
summary.checks.pngNote = (await page.locator("#result-note").innerText()).trim();

/* ---------------- 手机 390 ---------------- */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
});
const mp = await mobile.newPage();
await mp.goto(baseURL);
await settle(mp);
await shot(mp, "07-mobile-home-390.png");
summary.checks.mobileOverflow390 = await mp.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

await mp.setInputFiles("#file-input", fixture("sample.webp"));
await mp.locator("#original-panel").waitFor({ state: "visible" });
await mp.locator("#compress-button").click();
await mp.locator("#result-section").waitFor({ state: "visible" });
await mp.waitForTimeout(500);
await shot(mp, "08-mobile-result-390.png");
summary.checks.mobileResultNote = (await mp.locator("#result-note").innerText()).trim();

/* ---------------- 375 窄屏 ---------------- */
const narrow = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "zh-CN" });
const np = await narrow.newPage();
await np.goto(baseURL);
await settle(np);
await shot(np, "09-mobile-home-375.png");
summary.checks.mobileOverflow375 = await np.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

summary.externalRequests = external;
console.log(JSON.stringify(summary, null, 2));

await desktop.close();
await mobile.close();
await narrow.close();
await browser.close();
