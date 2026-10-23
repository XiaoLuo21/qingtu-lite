# 轻图 Lite（Qingtu Lite）

**不上传服务器，在浏览器里压缩图片、对比真实体积并下载。**

轻图 Lite 是一个纯前端的一次性图片压缩小工具：选择或拖入一张 JPG / PNG / WebP 图片，在本地浏览器中完成压缩，查看压缩前后真实字节数，然后下载结果。没有账号、没有后端、不上传图片、没有统计脚本。

- 在线地址：https://xiaoluo21.github.io/qingtu-lite/（GitHub Pages 已上线）
- 产品定位：课程 HW08「B 路径：网页 MVP」
- 版本：1.0.0

## 功能

- 单张图片选择、拖拽上传、更换图片（JPG / PNG / WebP，≤ 15 MiB）
- 浏览器本地压缩，默认画质 **70%**，可调 **40%～90%**（步进 5%），调整后可重新压缩
- 输出格式可选 **JPG / WebP**，默认 **JPG**；选择 WebP 时若浏览器不支持 WebP 编码会自动改用 JPG（且 WebP 选项禁用），输出 JPG 时 PNG 透明区域填白并明确提示
- 压缩前后预览、原始/输出大小、真实体积变化率（结果变大时如实显示「体积增加 X%」）
- 下载安全文件名的结果（扩展名与实际 MIME 一致，如 `photo-qingtu.jpg`）
- 中文错误提示：非图片、损坏图片、超过 15 MiB、格式异常
- 手机（375px）与桌面（1440px）响应式布局，键盘可完成上传 / 压缩 / 下载
- 无 `fetch` / XHR / `FormData` 上传，无第三方统计；图片仅存在于浏览器内存

## 本地运行

要求 Node.js 22 LTS（或满足 Vite 要求的稳定 LTS）与 npm。

```bash
npm ci          # 首次可用 npm install
npm run dev     # 开发服务 http://127.0.0.1:5173
npm run build   # 产物输出到 dist/
npm run preview # 预览生产构建 http://127.0.0.1:4173
```

## 测试

```bash
npm test            # 13 个 Node 单元测试（纯函数与静态隐私扫描）
npm run fixtures    # 用本机 Chrome 生成测试图片到 tests/fixtures/
npm run test:e2e    # Playwright 端到端测试（17 条，含大文件用例）
```

端到端覆盖：JPG/PNG/WebP 压缩、透明背景处理、WebP 不支持时降级 JPEG、画质 40%/90% 对比、非图片 / 超大 / 损坏文件拒绝、快速换图、体积增大文案、最长边超过 4096px 的缩放、换图后清除旧结果、7.7 MiB 大图压缩、375px 与 1440px 布局、键盘操作、输出 MIME 不一致的失败路径、aria 与隐私文案。

> 测试夹具由脚本在本地生成，不含任何个人照片；`tests/fixtures/` 已被 `.gitignore` 排除。

## 部署到 GitHub Pages

仓库内已包含 `.github/workflows/deploy.yml`：

1. 在 GitHub 新建**公开**仓库并推送 `main` 分支。
2. 仓库 `Settings → Pages → Source` 选择 **GitHub Actions**。
3. 工作流会执行 `npm ci`、`npm run build`，并用官方 `configure-pages` / `upload-pages-artifact` / `deploy-pages` 发布 `dist/`。

Vite 使用 `base: './'`，静态资源为相对路径，本地 `/` 与 Pages 子路径均可加载。

## 隐私与限制

- 图片只在当前浏览器标签页内处理，**不会上传到任何服务器**；关闭页面后不保留。
- 图像格式转换可能让体积变大，界面按真实字节数展示，不承诺「一定变小」。
- 最长边超过 4096px 的图片会被缩放，压缩后体积可能反而增加。
- PNG 本身没有有损质量参数，本项目输出格式由用户在 JPG / WebP 间选择（默认 JPG）；选择 WebP 时可保留透明背景，输出 JPG 时透明区域填充为白色。
- 实际效果取决于浏览器版本、图片内容与格式，不同设备结果可能不同。

## 第三方库与许可

- [Compressor.js](https://github.com/fengyuanchen/compressorjs)（MIT License，作者 fengyuanchen）——浏览器端 Canvas 压缩。
- [Vite](https://vite.dev/)（MIT License）——构建工具。

压缩算法来自 Compressor.js，本项目未实现自研压缩算法；页面与交互为本项目原创。

## 目录结构

```text
qingtu-lite/
├─ index.html
├─ src/main.js          # 状态机、压缩流程、下载
├─ src/lib.js           # 纯函数（格式化、校验、文件名）
├─ src/style.css        # 设计系统与响应式
├─ tests/unit.test.js   # Node 单元测试
├─ tests/e2e.spec.js    # Playwright 端到端测试
├─ tests/generate-fixtures.mjs
├─ .github/workflows/deploy.yml
├─ vite.config.js
└─ package.json
```
