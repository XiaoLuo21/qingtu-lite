import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fixtureDir } from "./generate-fixtures.mjs";

// 7.7 MiB 高熵大图在 Canvas 编码时会被 Playwright 的 trace 录屏显著拖慢
// （实测开启 trace 57s，关闭后约 10–14s），因此本文件单独关闭 trace。
test.use({ trace: "off", screenshot: "off" });

function parseBytes(text) {
  const match = text.match(/([\d.]+)\s*(B|KiB|MiB)/);
  if (!match) throw new Error(`无法解析大小: ${text}`);
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "MiB") return value * 1024 * 1024;
  if (unit === "KiB") return value * 1024;
  return value;
}

function isJpegBuffer(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

test("T17 接近上限的大图（7.7 MiB）可成功压缩且下载可解码", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto("/");
  const startedAt = Date.now();
  await page.setInputFiles("#file-input", path.join(fixtureDir, "heavy.jpg"));
  await expect(page.locator("#original-panel")).toBeVisible();
  await expect(page.locator("#original-name")).toHaveText("heavy.jpg");

  await page.locator("#compress-button").click();
  await expect(page.locator("#result-section")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("#download-button")).toBeEnabled({ timeout: 120_000 });
  const elapsed = Date.now() - startedAt;
  testInfo.annotations.push({ type: "compression-ms", description: String(elapsed) });

  const original = parseBytes(await page.locator("#metric-original").innerText());
  const result = parseBytes(await page.locator("#metric-result").innerText());
  const deltaText = (await page.locator("#metric-delta").innerText()).trim();
  const ratio = ((original - result) / original) * 100;
  const expected = Math.abs(ratio) < 0.05 ? "体积基本不变" : ratio > 0 ? "体积减少" : "体积增加";
  expect(deltaText).toContain(expected);
  expect(original).toBeGreaterThan(7 * 1024 * 1024);
  expect(result).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(120_000);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download-button").click(),
  ]);
  expect(download.suggestedFilename()).toBe("heavy-qingtu.jpg");
  const buffer = await readFile(await download.path());
  expect(isJpegBuffer(buffer)).toBe(true);

  const decodable = await page.evaluate(async (data) => {
    const response = await fetch(`data:image/jpeg;base64,${data}`);
    const bitmap = await createImageBitmap(await response.blob());
    const ok = bitmap.width > 0 && bitmap.height > 0;
    if (typeof bitmap.close === "function") bitmap.close();
    return ok;
  }, buffer.toString("base64"));
  expect(decodable).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});
