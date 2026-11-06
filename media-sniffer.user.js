// ==UserScript==
// @name         资源嗅探器 · Media Sniffer
// @name:en      Media Sniffer
// @namespace    https://github.com/songdongze/media-sniffer
// @version      1.0.0
// @description  自动嗅探当前网页里的视频、音频、图片资源，支持分类、预览、复制链接、下载与批量导出。纯本地运行，不上传任何数据。
// @author       songdongze
// @license      MIT
// @match        *://*/*
// @run-at       document-start
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @downloadURL  https://raw.githubusercontent.com/songdongze/media-sniffer/main/media-sniffer.user.js
// @updateURL    https://raw.githubusercontent.com/songdongze/media-sniffer/main/media-sniffer.user.js
// @homepageURL  https://github.com/songdongze/media-sniffer
// @supportURL   https://github.com/songdongze/media-sniffer/issues
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 0. 基础环境
   * ------------------------------------------------------------------ */
  var NS = '__MEDIA_SNIFFER_V1__';
  var PAGE = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  var IS_TOP = (function () {
    try { return window.top === window; } catch (e) { return false; }
  }());
  var MAX_ITEMS = 800;

  var TYPE_ICON = { video: '🎬', audio: '🎵', image: '🖼️', stream: '📡' };
  var TYPE_LABEL = { video: '视频', audio: '音频', image: '图片', stream: '流媒体' };

  /* ------------------------------------------------------------------ *
   * 1. 识别规则
   * ------------------------------------------------------------------ */
  var EXT_VIDEO = /\.(?:mp4|m4v|mov|webm|mkv|avi|flv|ogv|ts|m2ts|mts|3gp|wmv|f4v|m3u8|mpd)(?:[?#]|$)/i;
  var EXT_AUDIO = /\.(?:mp3|m4a|aac|flac|wav|wma|opus|ogg|oga|aiff|caf|amr|ape)(?:[?#]|$)/i;
  var EXT_IMAGE = /\.(?:jpe?g|png|gif|webp|bmp|svg|avif|heic|heif|ico|tiff?|apng|jfif)(?:[?#]|$)/i;
  var QUERY_HINT = /[?&](?:format|type|fmt|mime|ext)=(?:mp4|m3u8|mpd|video|mp3|m4a|audio|jpe?g|png|webp|image)/i;
  var SKIP = /(?:favicon|\/\.well-known\/|\/analytics|\/beacon|\/tracking|google-analytics|doubleclick)/i;
  var URL_IN_TEXT = /https?:\/\/[^\s"'<>\\\[\]{}]{8,600}/gi;

  function guessType(url, hint) {
    if (!url) return null;
    if (EXT_VIDEO.test(url)) return 'video';
    if (EXT_AUDIO.test(url)) return 'audio';
    if (EXT_IMAGE.test(url)) return 'image';
    if (hint === 'video' || hint === 'audio' || hint === 'image') return hint;
    if (/^video\//i.test(hint || '')) return 'video';
    if (/^audio\//i.test(hint || '')) return 'audio';
    if (/^image\//i.test(hint || '')) return 'image';
    if (QUERY_HINT.test(url)) {
      if (/mp4|m3u8|mpd|video/i.test(url)) return 'video';
      if (/mp3|m4a|audio/i.test(url)) return 'audio';
      if (/jpe?g|png|webp|image/i.test(url)) return 'image';
    }
    return null;
  }

  function normalize(raw, base) {
    if (typeof raw !== 'string') return null;
    var s = raw.trim().replace(/^['"]+|['"]+$/g, '');
    if (!s || s.length > 4000) return null;
    s = s.replace(/\\\//g, '/').replace(/\\u002F/gi, '/');
    if (/^(?:data|javascript|about|chrome|chrome-extension|moz-extension):/i.test(s)) return null;
    if (s.indexOf('blob:') === 0) return { url: s, blob: true };
    if (s.indexOf('//') === 0) {
      var proto = (PAGE.location && PAGE.location.protocol) || 'https:';
      s = proto + s;
    }
    try {
      var u = new URL(s, base || PAGE.location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      u.hash = '';
      return { url: u.href, blob: false };
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ *
   * 2. 数据仓（只在顶层页面保存）
   * ------------------------------------------------------------------ */
  var items = [];
  var keys = new Set();
  var localSeen = new Set();
  var listeners = [];

  function store(rec) {
    if (!rec || !rec.url) return;
    var k = rec.type + '|' + rec.url;
    if (keys.has(k)) return;
    keys.add(k);
    if (items.length >= MAX_ITEMS) {
      var dropped = items.shift();
      if (dropped) keys.delete(dropped.type + '|' + dropped.url);
    }
    items.push(rec);
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function add(raw, meta) {
    meta = meta || {};
    var n = normalize(raw, meta.base);
    if (!n) return;
    var type = n.blob ? 'stream' : guessType(n.url, meta.hint);
    if (!type || SKIP.test(n.url)) return;
    if (localSeen.has(n.url)) return;
    localSeen.add(n.url);
    if (localSeen.size > 5000) localSeen.clear();

    var rec = {
      url: n.url,
      type: type,
      via: meta.via || '',
      size: meta.size || 0,
      blob: !!n.blob,
      at: Date.now()
    };
    if (!IS_TOP) {
      try {
        window.top.postMessage((function () {
          var o = {}; o[NS] = rec; return o;
        }()), '*');
      } catch (e) {}
      return;
    }
    store(rec);
  }

  /* ------------------------------------------------------------------ *
   * 3. 采集层：网络请求
   * ------------------------------------------------------------------ */
  function scanText(text) {
    if (!text || typeof text !== 'string' || text.length > 2000000) return;
    var t = text.replace(/\\\//g, '/');
    var m, count = 0;
    URL_IN_TEXT.lastIndex = 0;
    while ((m = URL_IN_TEXT.exec(t)) !== null && count < 300) {
      var u = m[0].replace(/[)\],.;'"]+$/, '');
      if (guessType(u)) { add(u, { via: 'api' }); count++; }
    }
  }

  function hookNetwork() {
    // fetch
    try {
      if (typeof PAGE.fetch === 'function' && !PAGE.fetch[NS]) {
        var origFetch = PAGE.fetch;
        var wrappedFetch = function (input) {
          try {
            var u = typeof input === 'string'
              ? input
              : (input && (input.url || input.href)) || '';
            add(u, { via: 'fetch' });
          } catch (e) {}
          var p = Reflect.apply(origFetch, PAGE, arguments);
          try {
            if (p && typeof p.then === 'function') {
              p.then(function (resp) {
                try {
                  var ct = (resp.headers && resp.headers.get('content-type')) || '';
                  if (/json|text|javascript|mpegurl|dash|xml/i.test(ct)) {
                    resp.clone().text().then(scanText).catch(function () {});
                  }
                } catch (e) {}
              }).catch(function () {});
            }
          } catch (e) {}
          return p;
        };
        wrappedFetch[NS] = true;
        PAGE.fetch = wrappedFetch;
      }
    } catch (e) {}

    // XMLHttpRequest
    try {
      var XHR = PAGE.XMLHttpRequest;
      if (XHR && XHR.prototype && !XHR.prototype.open[NS]) {
        var origOpen = XHR.prototype.open;
        var origSend = XHR.prototype.send;
        XHR.prototype.open = function (method, url) {
          try { this.__msUrl = String(url); add(this.__msUrl, { via: 'xhr' }); } catch (e) {}
          return origOpen.apply(this, arguments);
        };
        XHR.prototype.open[NS] = true;
        XHR.prototype.send = function () {
          try {
            var self = this;
            this.addEventListener('readystatechange', function () {
              if (self.readyState === 4) {
                try {
                  var t = self.responseType === '' || self.responseType === 'text'
                    ? self.responseText : '';
                  if (t) scanText(t);
                } catch (e) {}
              }
            });
          } catch (e) {}
          return origSend.apply(this, arguments);
        };
      }
    } catch (e) {}

    // MediaSource / blob: 提示流媒体存在
    try {
      if (PAGE.URL && typeof PAGE.URL.createObjectURL === 'function' && !PAGE.URL.createObjectURL[NS]) {
        var origCreate = PAGE.URL.createObjectURL;
        var wrappedCreate = function (obj) {
          try {
            var ctor = obj && obj.constructor && obj.constructor.name;
            if (/MediaSource|MediaStream/i.test(ctor || '')) {
              noteStream();
            }
          } catch (e) {}
          return Reflect.apply(origCreate, this, arguments);
        };
        wrappedCreate[NS] = true;
        PAGE.URL.createObjectURL = wrappedCreate;
      }
    } catch (e) {}
  }

  var streamNoted = false;
  function noteStream() {
    if (streamNoted) return;
    streamNoted = true;
    add('blob:' + PAGE.location.href + '#' + Date.now(), { via: 'mse' });
  }

  /* ------------------------------------------------------------------ *
   * 4. 采集层：Performance / DOM / CSS
   * ------------------------------------------------------------------ */
  var INIT_HINT = { img: 'image', image: 'image', video: 'video', audio: 'audio' };

  function scanPerformance() {
    try {
      var entries = performance.getEntriesByType('resource');
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e || !e.name) continue;
        add(e.name, {
          via: 'perf',
          hint: INIT_HINT[e.initiatorType] || null,
          size: e.encodedBodySize || e.transferSize || 0
        });
      }
    } catch (e) {}
  }

  var SEL = [
    'video', 'audio', 'source', 'img', 'picture', 'track', 'a[href]',
    'link[href]', 'object[data]', 'embed[src]', '[style]', '[src]',
    '[srcset]', '[poster]', '[data-src]', '[data-original]',
    '[data-lazy-src]', '[data-url]', '[background]'
  ].join(',');

  function extractCssUrls(text) {
    var out = [], m;
    var re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
  }

  function readElement(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = (el.tagName || '').toLowerCase();
    var hint = tag === 'video' ? 'video'
      : tag === 'audio' ? 'audio'
      : (tag === 'img' || tag === 'picture' || tag === 'source') ? 'image'
      : null;
    var attrs = ['src', 'poster', 'href', 'data', 'data-src', 'data-original',
      'data-lazy-src', 'data-url', 'background', 'srcset', 'style'];
    try { if (el.currentSrc) add(el.currentSrc, { via: 'dom', hint: hint }); } catch (e) {}
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i], v;
      try { v = el.getAttribute(a); } catch (e) { continue; }
      if (!v) continue;
      if (a === 'srcset') {
        v.split(',').forEach(function (part) {
          add(part.trim().split(/\s+/)[0], { via: 'dom', hint: hint });
        });
      } else if (a === 'style') {
        extractCssUrls(v).forEach(function (u) { add(u, { via: 'css', hint: 'image' }); });
      } else {
        add(v, { via: 'dom', hint: hint });
      }
    }
  }

  function scanElement(node, deep) {
    if (!node || node.nodeType !== 1) return;
    var list = [];
    try { if (node.matches && node.matches(SEL)) list.push(node); } catch (e) {}
    if (deep && node.querySelectorAll) {
      try {
        var found = node.querySelectorAll(SEL);
        for (var j = 0; j < found.length && list.length < 400; j++) list.push(found[j]);
      } catch (e) {}
    }
    for (var i = 0; i < list.length; i++) readElement(list[i]);
  }

  function scanStyleSheets() {
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var rules;
        try { rules = sheets[i].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var j = 0; j < rules.length && j < 500; j++) {
          if (rules[j] && rules[j].cssText) {
            extractCssUrls(rules[j].cssText).forEach(function (u) {
              add(u, { via: 'css', hint: 'image' });
            });
          }
        }
      }
    } catch (e) {}
  }

  function startObserver() {
    try {
      var mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === 'childList') {
            for (var j = 0; j < r.addedNodes.length; j++) {
              if (r.addedNodes[j] && r.addedNodes[j].nodeType === 1) {
                scanElement(r.addedNodes[j], true);
              }
            }
          } else if (r.type === 'attributes') {
            scanElement(r.target, false);
          }
        }
      });
      mo.observe(document.documentElement || document, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'srcset', 'href', 'poster', 'data', 'style',
          'data-src', 'data-original', 'data-lazy-src', 'data-url', 'background']
      });
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * 5. 界面（Shadow DOM，避免被页面样式污染）
   * ------------------------------------------------------------------ */
  var CSS = [
    ':host{all:initial}',
    '.ms-root{all:initial;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#e6edf3}',
    '.ms-root *{box-sizing:border-box}',
    '.ms-fab{position:fixed;right:20px;bottom:20px;width:52px;height:52px;border-radius:50%;',
    'border:1px solid #30363d;background:#21262d;color:#e6edf3;font-size:22px;cursor:pointer;',
    'box-shadow:0 6px 24px rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center}',
    '.ms-fab:hover{background:#30363d;border-color:#58a6ff}',
    '.ms-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;',
    'border-radius:10px;background:#d29922;color:#0d1117;font-size:11px;font-weight:700;line-height:20px;text-align:center}',
    '.ms-panel{position:fixed;right:20px;bottom:84px;width:440px;max-width:calc(100vw - 40px);height:590px;',
    'max-height:calc(100vh - 110px);display:flex;flex-direction:column;background:#0d1117;',
    'border:1px solid #30363d;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.6);',
    'z-index:2147483647;overflow:hidden}',
    '.ms-panel[hidden],.ms-preview[hidden],.ms-toast[hidden]{display:none}',
    '.ms-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#161b22;border-bottom:1px solid #30363d;flex:none}',
    '.ms-title{font-weight:600;font-size:14px;flex:1}',
    '.ms-sub{color:#8b949e;font-size:11px}',
    '.ms-icon{border:0;background:transparent;color:#8b949e;font-size:18px;cursor:pointer;padding:0 6px;line-height:1}',
    '.ms-icon:hover{color:#e6edf3}',
    '.ms-bar{padding:8px 10px;border-bottom:1px solid #21262d;flex:none}',
    '.ms-search{width:100%;padding:7px 10px;border:1px solid #30363d;border-radius:6px;',
    'background:#0d1117;color:#e6edf3;outline:none;font-size:12px}',
    '.ms-search:focus{border-color:#58a6ff}',
    '.ms-tabs{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid #21262d;flex:none;flex-wrap:wrap}',
    '.ms-tabs button{border:1px solid transparent;background:transparent;color:#8b949e;',
    'border-radius:6px;padding:4px 9px;font-size:12px;cursor:pointer}',
    '.ms-tabs button:hover{background:#21262d}',
    '.ms-tabs button.active{background:#1f6feb22;border-color:#1f6feb88;color:#58a6ff}',
    '.ms-list{flex:1;overflow-y:auto;padding:6px;scrollbar-width:thin;scrollbar-color:#30363d transparent}',
    '.ms-empty{color:#8b949e;text-align:center;padding:48px 16px;font-size:12px;line-height:2}',
    '.ms-item{display:flex;gap:8px;align-items:center;padding:7px;border-radius:8px;border:1px solid transparent}',
    '.ms-item:hover{background:#161b22;border-color:#30363d}',
    '.ms-thumb{width:42px;height:42px;flex:none;border-radius:6px;background:#21262d;',
    'display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden}',
    '.ms-thumb img{width:100%;height:100%;object-fit:cover}',
    '.ms-info{flex:1;min-width:0}',
    '.ms-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ms-meta{font-size:10px;color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    '.ms-ops{display:flex;gap:2px;flex:none}',
    '.ms-ops button{border:0;background:transparent;color:#8b949e;cursor:pointer;',
    'font-size:13px;padding:4px 5px;border-radius:4px}',
    '.ms-ops button:hover{background:#30363d;color:#58a6ff}',
    '.ms-foot{display:flex;gap:6px;padding:8px 10px;border-top:1px solid #30363d;background:#161b22;flex:none;flex-wrap:wrap}',
    '.ms-foot button{flex:1;min-width:80px;border:1px solid #30363d;background:#21262d;color:#c9d1d9;',
    'border-radius:6px;padding:6px;font-size:11px;cursor:pointer}',
    '.ms-foot button:hover{border-color:#58a6ff;color:#58a6ff}',
    '.ms-preview{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:2147483647;',
    'display:flex;align-items:center;justify-content:center;padding:32px}',
    '.ms-pv-inner{position:relative;max-width:90vw;max-height:85vh;background:#161b22;',
    'border:1px solid #30363d;border-radius:10px;padding:20px;overflow:auto;text-align:center}',
    '.ms-pv-inner img,.ms-pv-inner video{max-width:100%;max-height:70vh;border-radius:6px}',
    '.ms-pv-inner audio{width:min(80vw,520px)}',
    '.ms-pv-close{position:absolute;top:6px;right:10px;border:0;background:transparent;',
    'color:#8b949e;font-size:22px;cursor:pointer}',
    '.ms-pv-tip{color:#8b949e;font-size:12px;line-height:2;max-width:420px;padding:16px}',
    '.ms-toast{position:fixed;right:20px;bottom:84px;background:#21262d;color:#e6edf3;',
    'border:1px solid #30363d;border-radius:8px;padding:10px 14px;font-size:12px;',
    'box-shadow:0 6px 24px rgba(0,0,0,.5);z-index:2147483647}'
  ].join('');

  var HTML = [
    '<button class="ms-fab" id="fab" title="资源嗅探器 (Alt+S)">🎯<span class="ms-badge" id="badge">0</span></button>',
    '<section class="ms-panel" id="panel" hidden>',
    '  <header class="ms-head"><span class="ms-title">🎯 资源嗅探器</span>',
    '  <span class="ms-sub" id="count">0 / 0</span>',
    '  <button class="ms-icon" id="btn-min" title="收起">−</button></header>',
    '  <div class="ms-bar"><input class="ms-search" id="search" type="search" placeholder="搜索文件名或链接…" /></div>',
    '  <nav class="ms-tabs" id="tabs">',
    '    <button data-cat="all" class="active">全部</button>',
    '    <button data-cat="video">🎬 视频</button>',
    '    <button data-cat="audio">🎵 音频</button>',
    '    <button data-cat="image">🖼 图片</button>',
    '    <button data-cat="stream">📡 流</button>',
    '  </nav>',
    '  <div class="ms-list" id="list"></div>',
    '  <footer class="ms-foot">',
    '    <button id="btn-copyall">复制全部</button>',
    '    <button id="btn-export">导出 JSON</button>',
    '    <button id="btn-clear">清空</button>',
    '  </footer>',
    '</section>',
    '<div class="ms-preview" id="preview" hidden><div class="ms-pv-inner">',
    '  <button class="ms-pv-close" id="pv-close">×</button><div id="pv-body"></div></div></div>',
    '<div class="ms-toast" id="toast" hidden></div>'
  ].join('');

  var ui = null;

  function nameOf(url) {
    try {
      var u = new URL(url);
      var n = decodeURIComponent(u.pathname.split('/').pop() || '');
      if (!n || n.length > 90) n = u.hostname + u.pathname.slice(0, 45);
      return n || u.hostname;
    } catch (e) { return String(url).slice(0, 90); }
  }
  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }
  function fmtSize(n) {
    if (!n || n < 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function toast(msg) {
    if (!ui) return;
    ui.toast.textContent = msg;
    ui.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { ui.toast.hidden = true; }, 1800);
  }
  function copy(text) {
    if (typeof GM_setClipboard === 'function') {
      try { GM_setClipboard(text); toast('已复制到剪贴板'); return; } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('已复制到剪贴板'); })
        .catch(function () { toast('复制失败，请手动选择'); });
    } else { toast('当前环境不支持剪贴板'); }
  }
  function openTab(url) { window.open(url, '_blank', 'noopener,noreferrer'); }
  function download(it) {
    if (it.blob) { toast('流媒体分片地址无法直接下载，请复制后用支持 HLS/DASH 的下载器'); return; }
    if (typeof GM_download === 'function') {
      try {
        GM_download({
          url: it.url, name: nameOf(it.url), saveAs: true,
          onerror: function () { openTab(it.url); }
        });
        toast('已开始下载（失败会退回新标签打开）');
        return;
      } catch (e) {}
    }
    openTab(it.url);
    toast('已在新标签打开，可右键另存为');
  }

  function makeBtn(label, title, fn) {
    var b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function makeRow(it) {
    var d = document.createElement('div'); d.className = 'ms-item';
    var thumb = document.createElement('div');
    thumb.className = 'ms-thumb ms-thumb-' + it.type;
    if (it.type === 'image' && !it.blob) {
      var im = document.createElement('img');
      im.src = it.url; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
      im.onerror = function () { im.remove(); thumb.textContent = TYPE_ICON.image; };
      thumb.appendChild(im);
    } else {
      thumb.textContent = TYPE_ICON[it.type] || '📄';
    }
    var info = document.createElement('div'); info.className = 'ms-info';
    var nm = document.createElement('div'); nm.className = 'ms-name';
    nm.textContent = nameOf(it.url); nm.title = it.url;
    var meta = document.createElement('div'); meta.className = 'ms-meta';
    meta.textContent = hostOf(it.url) + ' · ' + (it.size ? fmtSize(it.size) + ' · ' : '')
      + TYPE_LABEL[it.type] + (it.via ? ' · ' + it.via : '');
    meta.title = it.url;
    info.appendChild(nm); info.appendChild(meta);
    var ops = document.createElement('div'); ops.className = 'ms-ops';
    ops.appendChild(makeBtn('👁', '预览', function () { preview(it); }));
    ops.appendChild(makeBtn('⧉', '复制链接', function () { copy(it.url); }));
    ops.appendChild(makeBtn('⬇', '下载', function () { download(it); }));
    ops.appendChild(makeBtn('↗', '新标签打开', function () { openTab(it.url); }));
    d.appendChild(thumb); d.appendChild(info); d.appendChild(ops);
    return d;
  }

  function filtered() {
    if (!ui) return [];
    var q = (ui.search.value || '').toLowerCase();
    return items.filter(function (it) {
      if (ui.cat !== 'all' && it.type !== ui.cat) return false;
      if (!q) return true;
      return it.url.toLowerCase().indexOf(q) >= 0 || nameOf(it.url).toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    if (!ui) return;
    var list = filtered();
    ui.count.textContent = list.length + ' / ' + items.length;
    ui.badge.textContent = items.length > 999 ? '999+' : String(items.length);
    ui.badge.style.display = items.length ? '' : 'none';
    while (ui.list.firstChild) ui.list.removeChild(ui.list.firstChild);
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'ms-empty';
      empty.textContent = items.length
        ? '没有匹配的资源，换个关键词试试'
        : '还没嗅探到资源\n播放视频 / 打开图片 / 滚动页面后再看看\n按 Alt+S 可随时收起面板';
      empty.style.whiteSpace = 'pre-line';
      ui.list.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = list.length - 1; i >= 0; i--) frag.appendChild(makeRow(list[i]));
    ui.list.appendChild(frag);
  }

  function preview(it) {
    if (!ui) return;
    var body = ui.pvBody;
    while (body.firstChild) body.removeChild(body.firstChild);
    ui.preview.hidden = false;
    if (it.blob || it.type === 'stream' || /\.m3u8|\.mpd/i.test(it.url)) {
      var tip = document.createElement('div');
      tip.className = 'ms-pv-tip';
      tip.textContent = '这是 HLS / DASH 流媒体清单或 MSE 分片地址，浏览器不能直接播放。\n'
        + '请复制该链接，使用支持 m3u8 / mpd 的下载器（如 N_m3u8DL-RE、yt-dlp）处理。\n\n'
        + it.url;
      tip.style.whiteSpace = 'pre-wrap';
      body.appendChild(tip);
      return;
    }
    var media = document.createElement(
      it.type === 'image' ? 'img' : it.type === 'audio' ? 'audio' : 'video'
    );
    media.src = it.url;
    if (it.type !== 'image') media.controls = true;
    media.style.maxWidth = '100%';
    media.addEventListener('error', function () {
      while (body.firstChild) body.removeChild(body.firstChild);
      var t = document.createElement('div');
      t.className = 'ms-pv-tip';
      t.style.whiteSpace = 'pre-wrap';
      t.textContent = '无法直接预览（站点可能有防盗链 / 需要登录态 / 需要特定请求头）。\n建议复制链接后用下载器打开。\n\n' + it.url;
      body.appendChild(t);
    });
    body.appendChild(media);
  }

  function exportJSON() {
    var data = filtered().map(function (it) {
      return { type: it.type, url: it.url, size: it.size, via: it.via, capturedAt: new Date(it.at).toISOString() };
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'media-sniffer-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    toast('已导出 ' + data.length + ' 条记录');
  }

  function toggle(force) {
    if (!ui) return;
    ui.panel.hidden = (force === undefined) ? !ui.panel.hidden : !force;
    if (!ui.panel.hidden) render();
  }

  function initUI() {
    if (!IS_TOP || ui) return;
    if (!document.documentElement || !document.body) { setTimeout(initUI, 60); return; }
    var host = document.createElement('div');
    host.id = 'media-sniffer-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647';
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    var wrap = document.createElement('div');
    wrap.className = 'ms-root';
    wrap.innerHTML = HTML;
    root.appendChild(wrap);
    document.body.appendChild(host);

    var $ = function (id) { return root.getElementById(id); };
    ui = {
      root: root, host: host,
      fab: $('fab'), badge: $('badge'), panel: $('panel'), count: $('count'),
      search: $('search'), tabs: $('tabs'), list: $('list'),
      preview: $('preview'), pvBody: $('pv-body'), toast: $('toast'),
      cat: 'all'
    };

    ui.fab.addEventListener('click', function () { toggle(); });
    root.getElementById('btn-min').addEventListener('click', function () { toggle(false); });
    ui.search.addEventListener('input', render);
    ui.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cat]');
      if (!b) return;
      ui.cat = b.getAttribute('data-cat');
      Array.prototype.forEach.call(ui.tabs.querySelectorAll('button'), function (x) {
        x.classList.toggle('active', x === b);
      });
      render();
    });
    root.getElementById('btn-copyall').addEventListener('click', function () {
      var list = filtered();
      if (!list.length) { toast('当前没有可复制的资源'); return; }
      copy(list.map(function (x) { return x.url; }).join('\n'));
    });
    root.getElementById('btn-export').addEventListener('click', exportJSON);
    root.getElementById('btn-clear').addEventListener('click', function () {
      items.length = 0; keys.clear(); localSeen.clear(); render(); toast('已清空');
    });
    root.getElementById('pv-close').addEventListener('click', function () {
      ui.preview.hidden = true;
      while (ui.pvBody.firstChild) ui.pvBody.removeChild(ui.pvBody.firstChild);
    });
    ui.preview.addEventListener('click', function (e) {
      if (e.target === ui.preview) ui.preview.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape') {
        if (ui.preview && !ui.preview.hidden) ui.preview.hidden = true;
        else toggle(false);
      }
    }, true);

    if (typeof GM_registerMenuCommand === 'function') {
      try { GM_registerMenuCommand('🎯 打开 / 关闭资源嗅探器', function () { toggle(); }); } catch (e) {}
    }
    listeners.push(function () {
      if (!ui.panel.hidden) render();
      else { ui.badge.textContent = items.length > 999 ? '999+' : String(items.length); ui.badge.style.display = items.length ? '' : 'none'; }
    });
    render();
  }

  /* ------------------------------------------------------------------ *
   * 6. 启动
   * ------------------------------------------------------------------ */
  hookNetwork();

  if (IS_TOP) {
    window.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || typeof d !== 'object') return;
      var rec = d[NS];
      if (rec && rec.url && rec.type) store(rec);
    }, false);
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    scanPerformance();
    scanElement(document.documentElement || document.body, true);
    scanStyleSheets();
    startObserver();
    initUI();
    setInterval(scanPerformance, 2500);
    setInterval(function () {
      scanElement(document.documentElement || document.body, true);
      scanStyleSheets();
    }, 7000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  setTimeout(boot, 1200);
}());
