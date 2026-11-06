# 🤝 贡献指南

感谢你愿意改进「资源嗅探器」！这个项目只有一个用户脚本文件，参与门槛很低，一个 PR 就能让它变好用一点。

## 快速开始

1. Fork 本仓库并 clone 到本地
2. 用任意编辑器打开 `media-sniffer.user.js`
3. 改完后跑一遍语法检查：

   ```bash
   node --check media-sniffer.user.js
   ```

4. 提交 PR，说明改了什么、为什么改、在哪些网站验证过

推送到 `main` 或开 PR 时，GitHub Actions 会自动跑同样的语法校验，请确保它是绿的。

## 代码约定

- **保持单文件、零依赖**：整个脚本就是 `media-sniffer.user.js`，不引入外部库、CDN 或远程代码。
- **兼容三个管理器**：Tampermonkey / Violentmonkey / Greasemonkey。用到的 GM API 都要做 `typeof` 判断并留降级路径。
- **语法偏保守**：现有代码使用 ES5 风格变量声明 + 少量 ES6 能力（`Set`、`URL`、`MutationObserver`），别用可选链、顶层 `await` 等新语法，避免旧版管理器报错。
- **隐私红线**：不新增任何网络上报、埋点、远程配置；捕获的数据只留在当前页面内存里。
- **不改页面行为**：hook 的 `fetch` / `XHR` / `createObjectURL` 必须原样调用原函数并返回原结果。
- **安全第一**：渲染 URL 一律用 `textContent` / `title`，不要拼 `innerHTML`。
- **UI 隔离**：面板样式继续放在 Shadow DOM 内，不污染宿主页面。

## 常见改动位置

| 想改什么 | 改哪里 |
| --- | --- |
| 新增支持的媒体格式 | `EXT_VIDEO` / `EXT_AUDIO` / `EXT_IMAGE` 正则 |
| 新增嗅探来源 | `hookNetwork()` / `scanPerformance()` / `scanElement()` |
| 面板样式与交互 | `CSS` / `HTML` 常量与 `initUI()` |
| 过滤无关请求 | `SKIP` 正则 |
| 上限与轮询频率 | `MAX_ITEMS`、`boot()` 里的 `setInterval` |

## 提交规范

- commit message 简短说清改动即可，中英文都行
- 改了用户可见行为，请顺手更新 `README.md` 和 `CHANGELOG.md`
- 发新版时同步改脚本头部的 `@version`，并在 GitHub 打对应 tag / Release（`@updateURL` 指向 `main`，脚本管理器会自动拉新版）

## 报告问题

- Bug 请用「🐛 Bug 反馈」模板，尽量附上网页地址、浏览器 / 管理器版本、控制台报错
- 新想法用「✨ 功能建议」模板，或直接去 Discussions 聊
- **安全漏洞不要公开提 Issue**，见 [SECURITY.md](./SECURITY.md)

## 行为准则

参与本项目即表示同意遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

再次感谢 🙌
