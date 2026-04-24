# bv2url-proxy

🚀 一个基于 **Hono + Node.js** 构建的极简 Bilibili API 反向代理服务。

专为解决在 Serverless 边缘网络（如 Cloudflare Workers）请求 B 站接口时遭遇的严苛 WAF 风控（412 Precondition Failed）而生。通过在 IP 纯净的云平台（如 Render）进行中转，实现物理级风控绕过。

---

## ✨ 核心特性

- 🛡️ **极致指纹伪装**：自动补全全套真实的浏览器 Headers（`User-Agent`, `Referer`, `sec-ch-ua` 等），完美模拟真实用户侧请求。
- 🔒 **纵深安全防御**：
  - **来源限制**：强制校验自定义暗号（`x-proxy-token`），拒绝任何未授权的白嫖调用。
  - **路径白名单**：仅放行视频解析相关的安全前缀（如 `/x/player/`），防止节点被恶意用作 SSRF 扫描跳板。
- ⚡ **原生 Fetch 驱动**：摒弃沉重的传统代理中间件，底层基于 Web Standard Fetch API，支持流式传输（Stream）。
- 💓 **防休眠机制**：内置 `/healthcheck` 接口，完美配合外部 Cron 触发器（定时任务）实现 0 延迟冷启动保活。

---

## ⚙️ 环境变量配置 (.env)

在本地开发或部署到生产环境时，服务依赖以下环境变量。请在项目根目录创建 `.env` 文件（**注意：千万不要将 `.env` 提交到公开的 Git 仓库！**）

```env
PORT=3000
PROXY_TOKEN=your-super-secret-token-here
```
