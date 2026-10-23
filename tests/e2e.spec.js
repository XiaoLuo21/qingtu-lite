import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fixtureDir } from "./generate-fixtures.mjs";

const fx = (name) => path.join(fixtureDir, name);
const FIXTURES = {
  jpeg: fx("sample.jpg"),
  png: fx("transparent.png"),
  webp: fx("sample.webp"),
  tiny: fx("tiny.png"),
  wide: fx("wide.png"),
  heavy: fx("heavy.jpg"),
  corrupt: fx("corrupt.jpg"),
  text: fx("not-image.txt"),
  big: fx("big.jpg"),
};

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function upload(page, file) {
  await page.setInputFiles("#file-input", file);
  await expect(page.locator("#original-panel")).toBeVisible();
}

async function compress(page) {
  await page.locator("#compress-button").click();
  await expect(page.locator("#result-section")).toBeVisible();
  await expect(page.locator("#download-button")).toBeEnabled();
}

async function selectFormat(page, mime) {
  await page.selectOption("#format-select", mime);
  await expect(page.locator("#format-select")).toHaveValue(mime);
}

async function setQuality(page, value) {
  await page.locator("#quality-range").evaluate((element, next) => {
    element.value = String(next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await expect(page.locator("#quality-value")).toHaveText(`${value}%`);
}

function parseBytes(text) {
  const match = text.match(/([\d.]+)\s*(B|KiB|MiB)/);
  if (!match) throw new Error(`无法解析大小: ${text}`);
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "MiB") return value * 1024 * 1024;
  if (unit === "KiB") return value * 1024;
  return value;
}

function expectedDeltaText(originalBytes, resultBytes) {
  const ratio = ((originalBytes - resultBytes) / originalBytes) * 100;
  if (Math.abs(ratio) < 0.05) return "体积基本不变";
  return ratio > 0 ? "体积减少" : "体积增加";
}

async function expectHonestDelta(page) {
  const original = parseBytes(await page.locator("#metric-original").innerText());
  const result = parseBytes(await page.locator("#metric-result").innerText());
  const deltaText = (await page.locator("#metric-delta").innerText()).trim();
  expect(deltaText).toContain(expectedDeltaText(original, result));
  expect(deltaText).not.toContain("节省");
  return { original, result, deltaText };
}

function isWebpBuffer(buffer) {
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function isJpegBuffer(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

async function downloadResult(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download-button").click(),
  ]);
  const filePath = await download.path();
  const buffer = await readFile(filePath);
  return { name: download.suggestedFilename(), buffer };
}

async function assertDecodable(page, buffer, mime) {
  const base64 = buffer.toString("base64");
  const decodable = await page.evaluate(
    async ({ base64: data, mime: type }) => {
      try {
        const response = await fetch(`data:${type};base64,${data}`);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        const ok = bitmap.width > 0 && bitmap.height > 0;
        if (typeof bitmap.close === "function") bitmap.close();
        return ok;
      } catch {
        return false;
      }
    },
    { base64, mime },
  );
  expect(decodable).toBe(true);
}

test("T01 JPG 压缩：默认 JPG 输出、真实体积、可解码下载且无外部请求", async ({ page }) => {
  const errors = trackErrors(page);
  const externalRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const local = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (!local && url.protocol !== "data:" && url.protocol !== "blob:") {
      externalRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.locator("h1")).toContainText("把图片体积");
  await upload(page, FIXTURES.jpeg);
  await expect(page.locator("#original-name")).toHaveText("sample.jpg");
  await expect(page.locator("#original-dims")).toHaveText("1600 × 1000");
  await expect(page.locator("#original-format")).toHaveText("JPG");

  await compress(page);
  await expect(page.locator("#result-format")).toHaveText("JPG");
  await expect(page.locator("#result-type-label")).toContainText("1600 × 1000");
  await expect(page.locator("#result-note")).toContainText("原始 JPG → 输出 JPG");
  await expectHonestDelta(page);

  const { name, buffer } = await downloadResult(page);
  expect(name).toBe("sample-qingtu.jpg");
  expect(isJpegBuffer(buffer)).toBe(true);
  await assertDecodable(page, buffer, "image/jpeg");

  expect(externalRequests).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T02 透明 PNG 默认 JPG 输出，透明区域填白并给出提示", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.png);
  await expect(page.locator("#original-format")).toHaveText("PNG");
  await compress(page);

  await expect(page.locator("#result-format")).toHaveText("JPG");
  await expect(page.locator("#result-note")).toContainText("填充为白色");

  const { name, buffer } = await downloadResult(page);
  expect(name).toBe("transparent-qingtu.jpg");
  expect(isJpegBuffer(buffer)).toBe(true);
  await assertDecodable(page, buffer, "image/jpeg");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T02a 透明 PNG 选择 WebP 输出并保留透明背景", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.png);
  await expect(page.locator("#original-format")).toHaveText("PNG");
  await selectFormat(page, "image/webp");
  await compress(page);

  await expect(page.locator("#result-format")).toHaveText("WebP");
  await expect(page.locator("#result-note")).toContainText("原图透明背景已保留");
  await expect(page.locator("#result-note")).not.toContainText("填充为白色");

  const { name, buffer } = await downloadResult(page);
  expect(name).toBe("transparent-qingtu.webp");
  expect(isWebpBuffer(buffer)).toBe(true);
  await assertDecodable(page, buffer, "image/webp");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T02b 浏览器不支持 WebP 时禁用 WebP 选项，JPG 输出填白并给出提示", async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      if (type === "image/webp") return "data:image/png;base64,iVBORw0KGgo=";
      return original.call(this, type, quality);
    };
  });
  await page.goto("/");
  await expect(page.locator("#webp-support-note")).toBeVisible();
  await expect(page.locator("#webp-support-note")).toContainText("JPG");
  await expect(page.locator('#format-select option[value="image/webp"]')).toBeDisabled();
  await expect(page.locator("#format-select")).toHaveValue("image/jpeg");

  await upload(page, FIXTURES.png);
  await compress(page);
  await expect(page.locator("#result-format")).toHaveText("JPG");
  await expect(page.locator("#result-note")).toContainText("填充为白色");

  const { name, buffer } = await downloadResult(page);
  expect(name).toBe("transparent-qingtu.jpg");
  expect(isJpegBuffer(buffer)).toBe(true);
  await assertDecodable(page, buffer, "image/jpeg");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T03 WebP 输入并选择 WebP 输出：正常压缩、格式与扩展名一致", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.webp);
  await expect(page.locator("#original-format")).toHaveText("WebP");
  await selectFormat(page, "image/webp");
  await compress(page);
  await expect(page.locator("#result-format")).toHaveText("WebP");
  await expect(page.locator("#result-note")).toContainText("原始 WebP → 输出 WebP");

  const { name, buffer } = await downloadResult(page);
  expect(name).toBe("sample-qingtu.webp");
  expect(isWebpBuffer(buffer)).toBe(true);
  await assertDecodable(page, buffer, "image/webp");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T04 画质 40% 与 90% 分别压缩，输出取实际大小", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.jpeg);

  await setQuality(page, 90);
  await compress(page);
  const high = parseBytes(await page.locator("#metric-result").innerText());

  await setQuality(page, 40);
  await expect(page.locator("#status-message")).toContainText("画质已调整");
  await page.locator("#compress-button").click();
  await expect(page.locator("#compress-button")).toHaveText("重新压缩");
  const low = parseBytes(await page.locator("#metric-result").innerText());

  expect(low).toBeLessThan(high);
  await expectHonestDelta(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T05 非图片文件被拒绝并显示中文错误", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.setInputFiles("#file-input", FIXTURES.text);
  const status = page.locator("#status-message");
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).toContainText("仅支持 JPG、PNG、WebP");
  await expect(page.locator("#original-panel")).toBeHidden();
  await expect(page.locator("#compress-button")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T06 超过 15 MiB 的文件被拒绝", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.setInputFiles("#file-input", FIXTURES.big);
  const status = page.locator("#status-message");
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).toContainText("超过 15 MiB");
  await expect(page.locator("#original-panel")).toBeHidden();
  await expect(page.locator("#download-button")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T07 损坏的 JPG 明确报错且不激活下载", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.setInputFiles("#file-input", FIXTURES.corrupt);
  const status = page.locator("#status-message");
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).toContainText("无法读取这张图片");
  await expect(page.locator("#original-panel")).toBeHidden();
  await expect(page.locator("#compress-button")).toBeDisabled();
  await expect(page.locator("#download-button")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T08 快速切换两张图片，结果始终对应当前图片", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.setInputFiles("#file-input", FIXTURES.jpeg);
  await page.setInputFiles("#file-input", FIXTURES.png);
  await expect(page.locator("#original-name")).toHaveText("transparent.png");
  await expect(page.locator("#original-dims")).toHaveText("900 × 700");

  await compress(page);
  await expect(page.locator("#result-type-label")).toContainText("900 × 700");
  const { name } = await downloadResult(page);
  expect(name).toBe("transparent-qingtu.jpg");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T09 极小图片：体积变化文案如实（增大即写增加）", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.tiny);
  await compress(page);
  const { original, result, deltaText } = await expectHonestDelta(page);
  const expected = expectedDeltaText(original, result);
  if (expected === "体积增加") {
    await expect(page.locator("#metric-delta")).toHaveClass(/is-up/);
  }
  expect(deltaText).not.toMatch(/节省|缩小 -\d/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T10 375px 与 1440px 无横向溢出，上传/压缩/下载可操作", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await expect(page.locator("#drop-zone")).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#drop-zone").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(FIXTURES.jpeg);
  await expect(page.locator("#original-panel")).toBeVisible();
  await page.locator("#compress-button").click();
  await expect(page.locator("#result-section")).toBeVisible();
  await expect(page.locator("#download-button")).toBeVisible();

  const downloadButtonBox = await page.locator("#download-button").boundingBox();
  expect(downloadButtonBox.width).toBeGreaterThan(0);
  expect(downloadButtonBox.x + downloadButtonBox.width).toBeLessThanOrEqual(376);

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desktopOverflow).toBeLessThanOrEqual(1);
  await expect(page.locator("#result-preview")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T11 键盘可完成上传、压缩与下载", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.locator("#drop-zone").focus();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles(FIXTURES.jpeg);
  await expect(page.locator("#original-panel")).toBeVisible();

  await page.locator("#compress-button").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#result-section")).toBeVisible();

  await page.locator("#download-button").focus();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Enter"),
  ]);
  expect(download.suggestedFilename()).toBe("sample-qingtu.jpg");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T13 输出 MIME 与预期不一致时明确报错，不生成下载文件", async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      return original.call(this, callback, "image/png", quality);
    };
  });
  await page.goto("/");
  await upload(page, FIXTURES.jpeg);
  await page.locator("#compress-button").click();
  const status = page.locator("#status-message");
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).toContainText("不一致");
  await expect(page.locator("#result-section")).toBeHidden();
  await expect(page.locator("#download-button")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T14 aria 与隐私说明存在，且不被静态资源错误打断", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#status-message")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#drop-zone")).toHaveAttribute("role", "button");
  await expect(page.locator("#quality-range")).toHaveAttribute("min", "40");
  await expect(page.locator("body")).toContainText("不会上传服务器");
  await expect(page.locator('a[href*="compressorjs"]')).toHaveAttribute("rel", "noopener noreferrer");
});

test("T15 最长边超过 4096px 时缩放并在结果中说明", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.wide);
  await expect(page.locator("#original-dims")).toHaveText("5000 × 600");

  await compress(page);
  await expect(page.locator("#result-note")).toContainText("已缩放至 4096");
  await expect(page.locator("#result-type-label")).toContainText("4096 ×");

  const { buffer } = await downloadResult(page);
  const base64 = buffer.toString("base64");
  const decodedWidth = await page.evaluate(async (data) => {
    const response = await fetch(`data:image/jpeg;base64,${data}`);
    const bitmap = await createImageBitmap(await response.blob());
    const width = bitmap.width;
    if (typeof bitmap.close === "function") bitmap.close();
    return width;
  }, base64);
  expect(decodedWidth).toBe(4096);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("T16 选择新图片后立即清除上一张的结果", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await upload(page, FIXTURES.jpeg);
  await compress(page);
  await expect(page.locator("#result-section")).toBeVisible();

  await page.setInputFiles("#file-input", FIXTURES.png);
  await expect(page.locator("#original-name")).toHaveText("transparent.png");
  await expect(page.locator("#result-section")).toBeHidden();
  await expect(page.locator("#download-button")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});
