/**
 * 轻图 Lite｜纯函数工具模块
 * 不依赖 DOM，方便 Node 单测覆盖。
 */

export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_EDGE = 4096;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const TYPE_LABELS = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const DOWNLOAD_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 人类可读格式标签，未知类型返回“未知”。 */
export function typeLabel(mime) {
  return TYPE_LABELS[mime] || "未知";
}

/** 下载时使用的扩展名，必须与真实 MIME 对齐。 */
export function extensionForMime(mime) {
  return MIME_EXTENSIONS[mime] || "";
}

/** 文件大小统一使用 B / KiB / MiB，保留一致的展示规则。 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

/** 分辨率展示。 */
export function formatDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "—";
  }
  return `${Math.round(width)} × ${Math.round(height)}`;
}

/**
 * 计算真实体积变化。
 * ratio > 0 表示变小，ratio < 0 表示变大；文案绝不把变大说成节省。
 */
export function computeDelta(originalBytes, resultBytes) {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0 || !Number.isFinite(resultBytes)) {
    return { ratio: 0, text: "—", kind: "flat" };
  }
  const ratio = ((originalBytes - resultBytes) / originalBytes) * 100;
  const abs = Math.abs(ratio);
  if (abs < 0.05) {
    return { ratio, text: "体积基本不变", kind: "flat" };
  }
  if (ratio > 0) {
    return { ratio, text: `体积减少 ${abs.toFixed(1)}%`, kind: "down" };
  }
  return { ratio, text: `体积增加 ${abs.toFixed(1)}%`, kind: "up" };
}

/** 清洗原始文件名，生成安全、稳定的下载文件名。 */
export function sanitizeStem(fileName) {
  const raw = typeof fileName === "string" ? fileName : "";
  const withoutExt = raw.replace(/\.[^./\\]+$/, "");
  const cleaned = withoutExt
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 60);
  return cleaned || "image";
}

/** 生成形如 `photo-qingtu.webp` 的下载文件名。 */
export function buildDownloadName(fileName, mime) {
  const ext = DOWNLOAD_EXTENSIONS[mime];
  if (!ext) return "";
  return `${sanitizeStem(fileName)}-qingtu.${ext}`;
}

/**
 * 选择文件阶段的校验，只做纯元数据判断（解码校验在浏览器端完成）。
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
export function validateFileMeta({ type, size } = {}) {
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: "EMPTY", message: "文件是空的，请重新选择一张图片。" };
  }
  if (!ACCEPTED_TYPES.includes(type)) {
    return {
      ok: false,
      code: "TYPE",
      message: "仅支持 JPG、PNG、WebP 图片，请重新选择。",
    };
  }
  if (size > MAX_BYTES) {
    return {
      ok: false,
      code: "SIZE",
      message: `文件为 ${formatBytes(size)}，超过 15 MiB 上限，请换一张更小的图片。`,
    };
  }
  return { ok: true };
}

/** WebP 能力检测：toDataURL 返回的真实前缀才算支持。 */
export function isWebpDataUrl(dataUrl) {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/webp");
}

/** 把滑块的字符串值规范成 40–90 之间、步进 5 的整数。 */
export function normalizeQuality(value, fallback = 70) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(90, Math.max(40, parsed));
  return Math.round(clamped / 5) * 5;
}

/** 下载文件名是否与 MIME 一致（用于下载前守卫与测试）。 */
export function isDownloadNameConsistent(name, mime) {
  const ext = extensionForMime(mime);
  return Boolean(ext) && typeof name === "string" && name.toLowerCase().endsWith(`.${ext}`);
}

/** 根据 output/input 尺寸判断是否发生了最长边缩放，用于 UI 提示。 */
export function wasDownscaled(input, output) {
  if (!input || !output) return false;
  return (
    Number.isFinite(input.width) &&
    Number.isFinite(output.width) &&
    (input.width > output.width || input.height > output.height)
  );
}
