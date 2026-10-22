import { chromium } from "@playwright/test";
import path from "node:path";
import { fixtureDir } from "./generate-fixtures.mjs";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const failed = [];
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on("pageerror", (e) => failed.push(`pageerror ${e.message}`));
await page.goto("http://127.0.0.1:8099/qingtu-lite/");
await page.waitForLoadState("networkidle");
await page.setInputFiles("#file-input", path.join(fixtureDir, "sample.jpg"));
await page.locator("#original-panel").waitFor({ state: "visible" });
await page.locator("#compress-button").click();
await page.locator("#result-section").waitFor({ state: "visible" });
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#download-button").click(),
]);
console.log(JSON.stringify({
  title: await page.title(),
  format: (await page.locator("#result-format").innerText()).trim(),
  delta: (await page.locator("#metric-delta").innerText()).trim(),
  download: download.suggestedFilename(),
  failedRequests: failed,
}, null, 2));
await browser.close();
