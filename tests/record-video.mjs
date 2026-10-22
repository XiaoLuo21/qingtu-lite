/**
 * 用 Playwright 原生录像录制真实操作演示（无剪辑、无特效）。
 * 用法：先启动 preview 服务，再 `node tests/record-video.mjs http://127.0.0.1:4173/`
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, copyFile, stat } from "node:fs/promises";
import { fixtureDir } from "./generate-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const deliverableDir = path.resolve(projectRoot, "..", "qingtu-lite-deliverables");
const videoDir = path.join(deliverableDir, "testing", "video-raw");
const baseURL = process.argv[2] || "http://127.0.0.1:4173/";

await mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  locale: "zh-CN",
  acceptDownloads: true,
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const beat = (ms) => page.waitForTimeout(ms);

const started = Date.now();
await page.goto(baseURL);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await beat(5000);

// 展示工作台
await page.locator("#workbench").scrollIntoViewIfNeeded();
await beat(2500);

// 通过拖拽区点击选择 JPG（真实文件选择流程）
const chooserPromise = page.waitForEvent("filechooser");
await page.locator("#drop-zone").click();
const chooser = await chooserPromise;
await chooser.setFiles(path.join(fixtureDir, "sample.jpg"));
await page.locator("#original-panel").waitFor({ state: "visible" });
await beat(4000);

// 键盘调整画质：Home(40%) 后按 4 次 ArrowUp -> 60%
await page.locator("#quality-range").focus();
await page.keyboard.press("Home");
await beat(600);
for (let index = 0; index < 4; index += 1) {
  await page.keyboard.press("ArrowUp");
  await beat(350);
}
await beat(1500);

// 压缩
await page.locator("#compress-button").click();
await page.locator("#result-section").waitFor({ state: "visible" });
await page.locator("#result-section").scrollIntoViewIfNeeded();
await beat(6000);

// 下载
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#download-button").click(),
]);
await beat(4000);

// 移动端响应式展示
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await beat(4000);
await page.locator("#result-section").scrollIntoViewIfNeeded();
await beat(4000);
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
await beat(4000);

await context.close();
await browser.close();

const video = await page.video()?.path?.();
const ended = Date.now();
console.log(
  JSON.stringify(
    {
      video: video || null,
      download: download.suggestedFilename(),
      wallClockSeconds: Math.round((ended - started) / 1000),
    },
    null,
    2,
  ),
);

if (!video) {
  throw new Error("未生成视频文件：Playwright recordVideo 不可用");
}
const target = path.join(deliverableDir, "qingtu-lite-demo.webm");
await copyFile(video, target);
console.log("saved:", target, (await stat(target)).size, "bytes");
