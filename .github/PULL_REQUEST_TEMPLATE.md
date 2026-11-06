## 改了什么

<!-- 一句话说清这次改动；关联 Issue 可写 Closes #123 -->

## 为什么

<!-- 解决了什么问题 / 哪个网站因此受益 -->

## 怎么验证的

- [ ] `node --check media-sniffer.user.js` 通过，Actions 校验为绿
- [ ] 在 Tampermonkey 或 Violentmonkey 里实测过（请写明浏览器与网站）
- [ ] 没有引入外部依赖、远程代码或任何数据上报
- [ ] hook 的 `fetch` / `XHR` 仍原样返回原结果
- [ ] 用户可见行为有变化时，已同步更新 `README.md` 与 `CHANGELOG.md`
- [ ] 发新版时已同步 `@version`

## 其他说明

<!-- 截图、边界情况、对旧版管理器的兼容性影响等；没有可删掉这一节 -->
