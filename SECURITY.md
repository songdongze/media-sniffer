# 🔒 安全政策

## 支持版本

| 版本 | 是否支持 |
| --- | --- |
| 1.0.x | ✅ |
| < 1.0 | ❌ |

脚本通过 `@updateURL` 自动更新，请始终使用最新版。

## 报告漏洞

**请不要把安全问题发在公开 Issue 里。** 优先使用：

- 仓库的 [私密漏洞报告](https://github.com/songdongze/media-sniffer/security/advisories/new)（GitHub Security Advisories）
- 若不方便，可在 Issue 里只留一句「有安全问题需要私下沟通」，不要写细节

通常会在 7 天内回复；确认后会在修复版本里注明，并记入 `CHANGELOG.md`。

## 本项目的安全设计

- **零数据上报**：脚本不发起任何上报请求，捕获的资源列表只存在于当前页面内存，刷新即清空。
- **无远程代码**：不使用 `eval`、`Function`、动态 `import`，也不加载任何 CDN 脚本。
- **最小 hook**：只包装 `fetch`、`XMLHttpRequest.open/send`、`URL.createObjectURL`，且都原样调用原函数、返回原结果，不改变页面请求。
- **XSS 防护**：面板用 `textContent` 渲染不可信的 URL / 文件名，样式隔离在 Shadow DOM。
- **权限克制**：只申请 `GM_setClipboard`、`GM_download`、`GM_registerMenuCommand` 等必要的 GM API。

## 使用边界

本工具只用于下载你有权保存的内容。遇到站点防盗链、DRM 或付费内容时，请遵守其服务条款与适用法律；作者不支持也不鼓励绕过版权保护措施。

> 注意：脚本命中 `*://*/*`，会读取当前页面产生的资源 URL。虽然脚本本身不上传数据，也不建议在含敏感信息的后台系统里开启它。
