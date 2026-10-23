import Compressor from "compressorjs";
import "./style.css";
import {
  MAX_EDGE,
  buildDownloadName,
  computeDelta,
  extensionForMime,
  formatBytes,
  formatDimensions,
  isDownloadNameConsistent,
  isWebpDataUrl,
  normalizeQuality,
  resolveOutputMime,
  typeLabel,
  validateFileMeta,
  wasDownscaled,
} from "./lib.js";

const els = {
  dropZone: document.querySelector("#drop-zone"),
  fileInput: document.querySelector("#file-input"),
  originalPanel: document.querySelector("#original-panel"),
  originalPreview: document.querySelector("#original-preview"),
  originalName: document.querySelector("#original-name"),
  originalSize: document.querySelector("#original-size"),
  originalDims: document.querySelector("#original-dims"),
  originalFormat: document.querySelector("#original-format"),
  qualityRange: document.querySelector("#quality-range"),
  qualityValue: document.querySelector("#quality-value"),
  formatSelect: document.querySelector("#format-select"),
  compressButton: document.querySelector("#compress-button"),
  status: document.querySelector("#status-message"),
  webpNote: document.querySelector("#webp-support-note"),
  resultSection: document.querySelector("#result-section"),
  resultNote: document.querySelector("#result-note"),
  resultFormat: document.querySelector("#result-format"),
  compareOriginal: document.querySelector("#compare-original"),
  compareOriginalSize: document.querySelector("#compare-original-size"),
  compareOriginalType: document.querySelector("#compare-original-type"),
  resultPreview: document.querySelector("#result-preview"),
  resultSize: document.querySelector("#result-size"),
  resultTypeLabel: document.querySelector("#result-type-label"),
  metricOriginal: document.querySelector("#metric-original"),
  metricResult: document.querySelector("#metric-result"),
  metricDelta: document.querySelector("#metric-delta"),
  downloadButton: document.querySelector("#download-button"),
  resetButton: document.querySelector("#reset-button"),
};

const state = {
  file: null,
  originalUrl: null,
  originalDimensions: null,
  originalHasAlpha: false,
  result: null,
  requestId: 0,
  compressing: false,
  webpSupported: false,
};

/* ------------------------------ 基础工具 ------------------------------ */

function revokeUrl(url) {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* 忽略释放失败 */
    }
  }
}

function setStatus(message, kind = "info") {
  els.status.textContent = message;
  els.status.className = "status";
  if (kind === "error" || kind === "success" || kind === "busy") {
    els.status.classList.add(`is-${kind}`);
  }
  if (kind === "error") {
    els.status.setAttribute("role", "alert");
    els.status.setAttribute("aria-live", "assertive");
  } else {
    els.status.setAttribute("role", "status");
    els.status.setAttribute("aria-live", "polite");
  }
}

function setCompressLabel(text) {
  els.compressButton.textContent = text;
}

function updateQualityUI() {
  const value = normalizeQuality(els.qualityRange.value);
  els.qualityValue.textContent = `${value}%`;
  const min = Number(els.qualityRange.min);
  const max = Number(els.qualityRange.max);
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 60;
  els.qualityRange.style.setProperty("--fill", `${fill}%`);
}

/** 当前选择的输出格式对应的实际目标 MIME（选 WebP 但浏览器不支持时降级 JPG）。 */
function selectedTargetMime() {
  return resolveOutputMime(els.formatSelect.value, state.webpSupported);
}

/** 用浏览器真实解码能力获取尺寸，损坏文件会抛错。 */
async function decodeDimensions(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      if (typeof bitmap.close === "function") bitmap.close();
      return dims;
    } catch {
      /* 继续尝试 <img> 路径 */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      revokeUrl(url);
    };
    image.onerror = () => {
      revokeUrl(url);
      reject(new Error("DECODE_FAILED"));
    };
    image.src = url;
  });
}

/** 采样检查图片是否存在真实透明像素，用于如实说明透明背景是否保留。 */
async function detectTransparency(blob) {
  if (typeof createImageBitmap !== "function") return false;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === "function") bitmap.close();
    const data = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function detectWebpSupport() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return isWebpDataUrl(canvas.toDataURL("image/webp"));
  } catch {
    return false;
  }
}

/* ------------------------------ 状态清理 ------------------------------ */

function clearSelection() {
  revokeUrl(state.originalUrl);
  state.originalUrl = null;
  state.file = null;
  state.originalDimensions = null;
  state.originalHasAlpha = false;
  els.originalPreview.removeAttribute("src");
  els.compareOriginal.removeAttribute("src");
  els.originalPanel.hidden = true;
  els.dropZone.classList.remove("is-dragging");
  els.compressButton.disabled = true;
  setCompressLabel("开始压缩");
}

function clearResult() {
  if (state.result) {
    revokeUrl(state.result.url);
  }
  state.result = null;
  els.resultSection.hidden = true;
  els.resultPreview.removeAttribute("src");
  els.metricOriginal.textContent = "—";
  els.metricResult.textContent = "—";
  els.metricDelta.textContent = "—";
  els.metricDelta.className = "delta";
  els.downloadButton.disabled = true;
  els.resultNote.textContent = "";
  els.resultFormat.textContent = "—";
}

function finishCompressing() {
  state.compressing = false;
  els.compressButton.removeAttribute("aria-busy");
  els.compressButton.disabled = !state.file;
  setCompressLabel(state.result ? "重新压缩" : "开始压缩");
}

/* ------------------------------ 选择与压缩 ------------------------------ */

async function selectFile(file) {
  if (!file) return;

  const meta = validateFileMeta(file);
  if (!meta.ok) {
    setStatus(meta.message, "error");
    return;
  }

  const token = ++state.requestId;
  state.compressing = false;
  els.compressButton.removeAttribute("aria-busy");
  els.compressButton.disabled = true;
  setStatus("正在读取图片信息…", "busy");

  let dimensions;
  try {
    dimensions = await decodeDimensions(file);
  } catch {
    if (token !== state.requestId) return;
    finishCompressing();
    setStatus("无法读取这张图片，文件可能已损坏或不是有效的图片格式。", "error");
    return;
  }
  if (token !== state.requestId) return;

  const hasAlpha = file.type === "image/jpeg" ? false : await detectTransparency(file);
  if (token !== state.requestId) return;

  clearResult();
  revokeUrl(state.originalUrl);

  state.file = file;
  state.originalDimensions = dimensions;
  state.originalHasAlpha = hasAlpha;
  state.originalUrl = URL.createObjectURL(file);

  els.originalPreview.src = state.originalUrl;
  els.originalPreview.alt = `原图预览：${file.name}`;
  els.compareOriginal.src = state.originalUrl;
  els.compareOriginal.alt = `原图预览：${file.name}`;
  els.originalName.textContent = file.name;
  els.originalSize.textContent = formatBytes(file.size);
  els.originalDims.textContent = formatDimensions(dimensions.width, dimensions.height);
  els.originalFormat.textContent = typeLabel(file.type);
  els.originalPanel.hidden = false;

  els.compressButton.disabled = false;
  setCompressLabel("开始压缩");
  const target = typeLabel(selectedTargetMime());
  setStatus(`已选择「${file.name}」，点击“开始压缩”生成 ${target} 结果。`, "info");
}

function compressWithCompressor(file, targetMime, quality) {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      mimeType: targetMime,
      maxWidth: MAX_EDGE,
      maxHeight: MAX_EDGE,
      strict: false,
      retainExif: false,
      checkOrientation: true,
      // compressorjs 默认会把超过 5MB 的 PNG 强制转成 JPEG；
      // 这里关闭该行为，格式策略统一由本应用决定并校验。
      convertSize: Infinity,
      beforeDraw(context, canvas) {
        if (targetMime === "image/jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
      },
      success: resolve,
      error: reject,
    });
  });
}

async function compress() {
  if (!state.file || state.compressing) return;

  const sourceFile = state.file;
  const sourceDimensions = state.originalDimensions;
  const sourceHasAlpha = state.originalHasAlpha;
  const token = ++state.requestId;

  state.compressing = true;
  els.compressButton.disabled = true;
  els.compressButton.setAttribute("aria-busy", "true");
  setCompressLabel("正在压缩…");
  clearResult();
  setStatus("正在浏览器本地压缩，请稍候…", "busy");

  const targetMime = selectedTargetMime();
  const quality = normalizeQuality(els.qualityRange.value) / 100;

  try {
    const blob = await compressWithCompressor(sourceFile, targetMime, quality);
    if (token !== state.requestId) return;

    const actualMime = typeof blob.type === "string" ? blob.type.trim().toLowerCase() : "";
    if (actualMime !== targetMime) {
      throw new Error(`FORMAT_MISMATCH:${actualMime || "EMPTY"}`);
    }
    if (!extensionForMime(actualMime)) {
      throw new Error(`FORMAT_MISMATCH:${actualMime || "EMPTY"}`);
    }

    let resultDimensions;
    try {
      resultDimensions = await decodeDimensions(blob);
    } catch {
      throw new Error("RESULT_UNREADABLE");
    }
    if (token !== state.requestId) return;

    const resultHasAlpha =
      sourceHasAlpha && actualMime === "image/webp" ? await detectTransparency(blob) : actualMime !== "image/jpeg";
    if (token !== state.requestId) return;

    const url = URL.createObjectURL(blob);
    state.result = {
      blob,
      url,
      mime: actualMime,
      dimensions: resultDimensions,
      hasAlpha: resultHasAlpha,
      downloadName: buildDownloadName(sourceFile.name, actualMime),
    };

    renderResult({ sourceFile, sourceDimensions, sourceHasAlpha });
    finishCompressing();

    const delta = computeDelta(sourceFile.size, blob.size);
    setStatus(
      `压缩完成：${formatBytes(sourceFile.size)} → ${formatBytes(blob.size)}，${delta.text}。`,
      "success",
    );
  } catch (error) {
    if (token !== state.requestId) return;
    finishCompressing();

    const reason = error && typeof error.message === "string" ? error.message : "";
    let message = "压缩失败，请更换图片或调整画质后重试。";
    if (reason.startsWith("FORMAT_MISMATCH:")) {
      const actual = reason.slice("FORMAT_MISMATCH:".length);
      message = `浏览器实际返回的格式是 ${actual === "EMPTY" ? "空类型" : actual}，与预期的 ${typeLabel(
        targetMime,
      )} 不一致，因此没有生成下载文件。请换一张图片或更新浏览器后重试。`;
    } else if (reason === "RESULT_UNREADABLE") {
      message = "压缩结果无法被浏览器重新解码，因此没有生成下载文件。请换一张图片重试。";
    } else if (reason === "DECODE_FAILED") {
      message = "无法读取这张图片，请确认文件没有损坏。";
    }
    setStatus(message, "error");
  }
}

/* ------------------------------ 结果渲染 ------------------------------ */

function buildResultNote(sourceFile, sourceHasAlpha, result) {
  const parts = [`原始 ${typeLabel(sourceFile.type)} → 输出 ${typeLabel(result.mime)}`];

  if (result.mime === "image/jpeg" && sourceFile.type !== "image/jpeg") {
    parts.push("JPEG 不支持透明背景，透明区域已填充为白色");
  } else if (sourceHasAlpha && result.mime === "image/webp") {
    parts.push(result.hasAlpha ? "原图透明背景已保留" : "检测到透明背景未完整保留，请谨慎使用该结果");
  }

  if (wasDownscaled(state.originalDimensions, result.dimensions)) {
    parts.push(
      `最长边超过 ${MAX_EDGE}px，已缩放至 ${formatDimensions(result.dimensions.width, result.dimensions.height)}`,
    );
  }
  if (result.blob.size > sourceFile.size) {
    parts.push("重新编码后体积变大，结果按真实字节数展示");
  }
  return `${parts.join(" · ")}。`;
}

function renderResult({ sourceFile, sourceDimensions, sourceHasAlpha }) {
  const result = state.result;
  if (!result) return;

  const delta = computeDelta(sourceFile.size, result.blob.size);

  els.resultSection.hidden = false;
  els.resultFormat.textContent = typeLabel(result.mime);
  els.resultNote.textContent = buildResultNote(sourceFile, sourceHasAlpha, result);
  els.compareOriginalSize.textContent = formatBytes(sourceFile.size);
  els.compareOriginalType.textContent = `${typeLabel(sourceFile.type)} · ${formatDimensions(
    sourceDimensions.width,
    sourceDimensions.height,
  )}`;
  els.resultPreview.src = result.url;
  els.resultPreview.alt = `压缩后的图片预览：${result.downloadName}`;
  els.resultSize.textContent = formatBytes(result.blob.size);
  els.resultTypeLabel.textContent = `${typeLabel(result.mime)} · ${formatDimensions(
    result.dimensions.width,
    result.dimensions.height,
  )}`;
  els.metricOriginal.textContent = formatBytes(sourceFile.size);
  els.metricResult.textContent = formatBytes(result.blob.size);
  els.metricDelta.textContent = delta.text;
  els.metricDelta.className = `delta is-${delta.kind}`;
  els.downloadButton.disabled = false;
}

/* ------------------------------ 下载与重置 ------------------------------ */

function downloadResult() {
  const result = state.result;
  if (!result || !(result.blob instanceof Blob) || !result.blob.size) {
    setStatus("还没有可下载的压缩结果，请先压缩图片。", "error");
    return;
  }
  if (!isDownloadNameConsistent(result.downloadName, result.mime)) {
    setStatus("结果文件的格式校验未通过，已阻止下载。请重新压缩。", "error");
    return;
  }

  const link = document.createElement("a");
  link.href = result.url;
  link.download = result.downloadName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setStatus(`已开始下载 ${result.downloadName}（${formatBytes(result.blob.size)}）。`, "success");
}

function resetAll() {
  state.requestId += 1;
  state.compressing = false;
  els.compressButton.removeAttribute("aria-busy");
  clearResult();
  clearSelection();
  els.fileInput.value = "";
  els.qualityRange.value = "70";
  els.formatSelect.value = "image/jpeg";
  updateQualityUI();
  setStatus("已清空当前图片，重新上传一张开始吧。", "info");
  els.dropZone.focus();
}

/* ------------------------------ 事件绑定 ------------------------------ */

function bindEvents() {
  els.dropZone.addEventListener("click", (event) => {
    if (event.target === els.fileInput) return;
    els.fileInput.click();
  });

  els.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      els.fileInput.click();
    }
  });

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files && els.fileInput.files[0];
    els.fileInput.value = "";
    if (file) selectFile(file);
  });

  let dragDepth = 0;
  els.dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    els.dropZone.classList.add("is-dragging");
  });
  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    els.dropZone.classList.add("is-dragging");
  });
  els.dropZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) els.dropZone.classList.remove("is-dragging");
  });
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    els.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  els.qualityRange.addEventListener("input", () => {
    updateQualityUI();
    if (state.compressing) return;
    if (state.result) {
      setCompressLabel("重新压缩");
      setStatus("画质已调整，点击“重新压缩”获取新的结果。", "info");
    }
  });

  els.formatSelect.addEventListener("change", () => {
    if (state.compressing) return;
    if (state.result) {
      setCompressLabel("重新压缩");
      setStatus("输出格式已调整，点击“重新压缩”获取新的结果。", "info");
    } else if (state.file) {
      const target = typeLabel(selectedTargetMime());
      setStatus(`输出格式已调整为 ${target}，点击“开始压缩”生成结果。`, "info");
    }
  });

  els.compressButton.addEventListener("click", compress);
  els.downloadButton.addEventListener("click", downloadResult);
  els.resetButton.addEventListener("click", resetAll);

  window.addEventListener("beforeunload", () => {
    revokeUrl(state.originalUrl);
    if (state.result) revokeUrl(state.result.url);
  });
}

/* ------------------------------ 初始化 ------------------------------ */

function init() {
  state.webpSupported = detectWebpSupport();
  if (!state.webpSupported) {
    const webpOption = els.formatSelect.querySelector('option[value="image/webp"]');
    if (webpOption) webpOption.disabled = true;
    els.formatSelect.value = "image/jpeg";
    els.webpNote.hidden = false;
    els.webpNote.textContent =
      "当前浏览器不支持 WebP 编码，WebP 选项已禁用，将使用 JPG 输出；PNG 等透明图片的透明区域会被填充为白色。";
  }

  updateQualityUI();
  clearResult();
  bindEvents();
  setStatus("还没有选择图片，先上传一张吧。", "info");
}

init();
