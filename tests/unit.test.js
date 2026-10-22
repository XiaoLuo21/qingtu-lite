import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_BYTES,
  buildDownloadName,
  computeDelta,
  extensionForMime,
  formatBytes,
  formatDimensions,
  isDownloadNameConsistent,
  isWebpDataUrl,
  normalizeQuality,
  sanitizeStem,
  typeLabel,
  validateFileMeta,
  wasDownscaled,
} from "../src/lib.js";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("formatBytes 统一使用 B / KiB / MiB", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(999), "999 B");
  assert.equal(formatBytes(1024), "1.0 KiB");
  assert.equal(formatBytes(517_000), "504.9 KiB");
  assert.equal(formatBytes(15 * 1024 * 1024), "15.00 MiB");
  assert.equal(formatBytes(Number.NaN), "—");
});

test("formatDimensions 拒绝非法值", () => {
  assert.equal(formatDimensions(1600, 1000), "1600 × 1000");
  assert.equal(formatDimensions(0, 100), "—");
  assert.equal(formatDimensions(undefined, 100), "—");
});

test("typeLabel 与扩展名映射", () => {
  assert.equal(typeLabel("image/jpeg"), "JPG");
  assert.equal(typeLabel("image/png"), "PNG");
  assert.equal(typeLabel("image/webp"), "WebP");
  assert.equal(typeLabel("image/gif"), "未知");
  assert.equal(extensionForMime("image/webp"), "webp");
  assert.equal(extensionForMime("image/gif"), "");
});

test("computeDelta 如实表达缩小、变大与基本不变", () => {
  const down = computeDelta(1000, 400);
  assert.equal(down.kind, "down");
  assert.equal(down.text, "体积减少 60.0%");
  assert.ok(Math.abs(down.ratio - 60) < 0.001);

  const up = computeDelta(1000, 1200);
  assert.equal(up.kind, "up");
  assert.equal(up.text, "体积增加 20.0%");
  assert.ok(!up.text.includes("减少"));
  assert.ok(!up.text.includes("节省"));

  const flat = computeDelta(1000, 1000);
  assert.equal(flat.kind, "flat");
  assert.equal(flat.text, "体积基本不变");

  assert.equal(computeDelta(0, 100).text, "—");
});

test("sanitizeStem 生成安全文件名", () => {
  assert.equal(sanitizeStem("我的 照片.JPG"), "我的 照片");
  assert.equal(sanitizeStem("../../etc/passwd"), "etc-passwd");
  assert.equal(sanitizeStem('a:b*c?d"e<f>g|h.png'), "a-b-c-d-e-f-g-h");
  assert.equal(sanitizeStem("..."), "image");
  assert.equal(sanitizeStem(""), "image");
  assert.equal(sanitizeStem("x".repeat(200)).length, 60);
});

test("buildDownloadName 与真实 MIME 对齐", () => {
  assert.equal(buildDownloadName("photo.JPG", "image/webp"), "photo-qingtu.webp");
  assert.equal(buildDownloadName("证件照.png", "image/jpeg"), "证件照-qingtu.jpg");
  assert.equal(buildDownloadName("a.webp", "image/png"), "a-qingtu.png");
  assert.equal(buildDownloadName("a.webp", "image/gif"), "");
});

test("isDownloadNameConsistent 阻止错误后缀", () => {
  assert.equal(isDownloadNameConsistent("photo-qingtu.webp", "image/webp"), true);
  assert.equal(isDownloadNameConsistent("photo-qingtu.jpg", "image/webp"), false);
  assert.equal(isDownloadNameConsistent("photo-qingtu.", "image/webp"), false);
});

test("validateFileMeta 覆盖空文件、类型与大小上限", () => {
  assert.deepEqual(validateFileMeta({ type: "image/jpeg", size: 1024 }), { ok: true });

  const empty = validateFileMeta({ type: "image/jpeg", size: 0 });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "EMPTY");

  const wrongType = validateFileMeta({ type: "text/plain", size: 100 });
  assert.equal(wrongType.ok, false);
  assert.equal(wrongType.code, "TYPE");
  assert.match(wrongType.message, /仅支持 JPG、PNG、WebP/);

  const tooBig = validateFileMeta({ type: "image/png", size: MAX_BYTES + 1 });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.code, "SIZE");
  assert.match(tooBig.message, /15 MiB/);

  assert.equal(validateFileMeta({ type: "image/png", size: MAX_BYTES }).ok, true);
});

test("isWebpDataUrl 只认真实前缀", () => {
  assert.equal(isWebpDataUrl("data:image/webp;base64,AAAA"), true);
  assert.equal(isWebpDataUrl("data:image/png;base64,AAAA"), false);
  assert.equal(isWebpDataUrl(undefined), false);
});

test("normalizeQuality 规范到 40–90 步进 5", () => {
  assert.equal(normalizeQuality("40"), 40);
  assert.equal(normalizeQuality("90"), 90);
  assert.equal(normalizeQuality("70"), 70);
  assert.equal(normalizeQuality("42"), 40);
  assert.equal(normalizeQuality("88"), 90);
  assert.equal(normalizeQuality("100"), 90);
  assert.equal(normalizeQuality("abc"), 70);
});

test("wasDownscaled 依据真实宽高判断", () => {
  assert.equal(wasDownscaled({ width: 8000, height: 4000 }, { width: 4096, height: 2048 }), true);
  assert.equal(wasDownscaled({ width: 1600, height: 1000 }, { width: 1600, height: 1000 }), false);
  assert.equal(wasDownscaled(null, { width: 1, height: 1 }), false);
});

test("页面结构与必需 DOM 契约存在", () => {
  const html = read("../index.html");
  const requiredIds = [
    "file-input",
    "drop-zone",
    "original-preview",
    "original-name",
    "original-size",
    "quality-range",
    "quality-value",
    "compress-button",
    "status-message",
    "result-section",
    "result-preview",
    "result-format",
    "download-button",
    "reset-button",
  ];
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id}`);
  }
  assert.match(html, /min="40"/);
  assert.match(html, /max="90"/);
  assert.match(html, /step="5"/);
  assert.match(html, /value="70"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("源码不得包含上传或追踪调用（隐私回归测试）", () => {
  const sources = [read("../src/main.js"), read("../src/lib.js"), read("../index.html")].join("\n");
  const forbidden = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bFormData\b/,
    /navigator\.sendBeacon/,
    /\bgtag\s*\(/,
    /\bgoogletagmanager\b/,
    /\banalytics\b/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(sources, pattern, `不应出现 ${pattern}`);
  }
});
