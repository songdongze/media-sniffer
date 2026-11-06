# 📝 更新日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

所有 notable 变更都会记录在这里。版本号与 `media-sniffer.user.js` 头部的 `@version` 保持一致。

## [1.0.0] - 2026-11-06

首个正式版本 🎉

### 新增

- 油猴用户脚本 `media-sniffer.user.js`，自动嗅探网页中的视频 / 音频 / 图片资源
- 多源采集：页面上下文 `fetch` / `XMLHttpRequest` hook、接口响应正文 URL 提取、Performance 资源条目、DOM 媒体标签与懒加载属性、`srcset`、CSS 背景图
- iframe 内采集结果通过 `postMessage` 汇总到顶层面板
- MSE / blob 流媒体识别与 HLS、DASH 清单提示
- Shadow DOM 悬浮面板：分类页签、关键词搜索、缩略图、预览、复制链接、下载、批量导出 JSON、清空
- 快捷键 `Alt + S` 开关面板、`Esc` 关闭，脚本管理器菜单命令
- `@downloadURL` / `@updateURL` 自动更新
- GitHub Pages 一键安装页 `index.html`
- README、MIT 许可、`.gitignore`
- GitHub Actions 语法与元数据校验、Dependabot 依赖更新
- Issue / PR 模板、贡献指南、安全政策、行为准则

[1.0.0]: https://github.com/songdongze/media-sniffer/releases/tag/v1.0.0
