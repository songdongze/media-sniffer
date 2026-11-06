# 🎯 资源嗅探器 · Media Sniffer

一个纯前端运行的油猴（Userscript）脚本，自动嗅探当前网页里的 **视频 / 音频 / 图片** 资源，并提供分类、搜索、预览、复制链接、下载和批量导出。

> 所有逻辑都在你的浏览器里本地执行，**不上传、不统计、不回传任何数据**。

---

## ✨ 功能

| 能力 | 说明 |
| --- | --- |
| 多源嗅探 | `fetch` / `XMLHttpRequest` 请求、Performance 资源条目、DOM 媒体标签、懒加载属性、CSS 背景图、`srcset`、接口响应正文里的媒体链接 |
| 自动分类 | 视频（mp4 / webm / m3u8 / mpd / ts …）、音频（mp3 / m4a / flac / ogg …）、图片（jpg / png / webp / gif / svg / avif …）、流媒体（MSE blob 提示） |
| 悬浮面板 | 右下角圆钮唤出，实时显示捕获数量，支持分类切换、关键词搜索 |
| 单条操作 | 👁 预览 · ⧉ 复制链接 · ⬇ 下载 · ↗ 新标签打开 |
| 批量操作 | 一键复制当前筛选结果的全部链接、导出 JSON、清空列表 |
| iframe 汇总 | 子框架里捕获到的资源会自动汇总到顶层面板 |
| 隔离渲染 | 使用 Shadow DOM，不会被网页自身 CSS 污染，也不会泄漏页面样式 |
| 自动更新 | 通过 `@updateURL` 随仓库版本自动更新 |

---

## 🔧 安装

### 1. 安装脚本管理器（Edge）

任选其一，在 Edge 扩展商店搜索安装：

- [Tampermonkey（篡改猴）](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Violentmonkey（暴力猴）](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenkkddmbcliamhepcepdkf)

### 2. 安装脚本

**方式 A · 一键安装（推荐）**

打开 [安装页](https://songdongze.github.io/media-sniffer/)，点击「一键安装」，或直接点下面的链接：

👉 **[点此安装 media-sniffer.user.js](https://raw.githubusercontent.com/songdongze/media-sniffer/main/media-sniffer.user.js)**

脚本管理器会弹出安装确认页，点「安装」即可。

**方式 B · 手动**

1. 点击脚本管理器图标 → 「添加新脚本」/「新建」
2. 把本仓库的 [`media-sniffer.user.js`](./media-sniffer.user.js) 全部内容粘贴进去
3. `Ctrl + S` 保存

---

## 🎮 使用

1. 打开任意包含视频、音乐或图片的网页
2. 右下角出现 🎯 圆钮，角标数字 = 已捕获资源数
3. 点击圆钮（或按 `Alt + S`）展开面板
4. 播放视频 / 滚动页面 / 切换内容，列表会实时增长
5. 用分类页签和搜索框缩小范围，然后预览、复制或下载

| 快捷键 | 作用 |
| --- | --- |
| `Alt + S` | 打开 / 收起面板 |
| `Esc` | 关闭预览，或收起面板 |

> 也可以从脚本管理器的菜单里选「🎯 打开 / 关闭资源嗅探器」。

---

## 🧠 工作原理

```
network hooks ─┐
fetch / XHR   ─┤
performance   ─┼─→ 归一化 URL → 扩展名 / MIME 规则分类 → 去重 → 面板渲染
DOM + CSS     ─┤        ↑
iframe 汇总   ─┘   postMessage 桥接
```

- **网络层**：在页面上下文 hook `fetch` 与 `XMLHttpRequest.prototype.open`，并对 JSON / 文本响应做一次 URL 正则提取，能抓到藏在接口返回里的播放地址。
- **性能层**：定时读取 `performance.getEntriesByType('resource')`，补上直接由浏览器加载的资源（含体积信息）。
- **DOM 层**：`MutationObserver` 监听节点与属性变化，读取 `src` / `currentSrc` / `srcset` / `poster` / `data-*` / 内联 `background-image`。
- **样式层**：遍历 `document.styleSheets` 提取 `url(...)`。
- **iframe**：子框架只负责采集，通过 `postMessage` 把结果上报给顶层页面统一展示。

---

## 🔒 隐私与安全

- 无网络上报、无埋点、无远程代码加载，脚本全部逻辑都在本文件里。
- 不使用 `eval`、不注入外部脚本、不修改页面业务逻辑。
- 只 hook 了 `fetch` / `XHR.open` / `XHR.send` / `URL.createObjectURL`，且都原样调用原函数，不改变请求结果。
- 面板使用 `textContent` 渲染链接，避免页面内容造成 XSS。

---

## ❓ 常见问题

**Q：面板一直是 0？**
先播放一下视频、滚动页面或点开图片，很多资源是懒加载的。另外确认脚本管理器里脚本处于「已启用」，且当前网址命中 `*://*/*`。

**Q：m3u8 / mpd 点下载没反应？**
这是流媒体清单，不是单个文件。请复制链接，用 `yt-dlp`、`N_m3u8DL-RE` 等支持 HLS/DASH 的工具下载。面板的「📡 流」页签会给出同样提示。

**Q：预览失败 / 下载 403？**
站点可能有防盗链（Referer 校验）、登录态或签名过期。试试「复制链接」后在原站已登录的会话中打开，或用下载器带上 `Referer` 请求头。

**Q：图片列表里有很多小图标？**
用搜索框过滤，或在「图片」页签里按文件名查找。脚本默认会跳过 favicon、统计埋点等明显无关的请求。

**Q：会影响网页速度吗？**
采集是轻量级的（2.5 秒一次 Performance 扫描 + 7 秒一次 DOM 扫描），最多保留 800 条记录，超出后自动淘汰最旧的。

---

## ⚠️ 免责声明

本工具仅用于**下载你有权访问和保存的内容**。请遵守目标网站的服务条款与所在地法律法规，尊重版权，不要用于抓取、传播受版权保护或未经授权的内容。作者不对使用者的行为承担责任。

---

## 📁 目录结构

```
media-sniffer/
├── media-sniffer.user.js        # 油猴脚本本体
├── index.html                   # GitHub Pages 安装页
├── README.md                    # 本文档
├── LICENSE                      # MIT
├── .gitignore
└── .github/workflows/check.yml  # 推送时自动做 JS 语法校验
```

## 🛠 本地校验

```bash
node --check media-sniffer.user.js
```

## 📄 许可

[MIT](./LICENSE) © 2026 songdongze
