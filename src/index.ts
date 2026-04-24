import { serve } from "@hono/node-server";
import { Hono } from "hono";
import "dotenv/config";

const app = new Hono();

// 测试提交

app.get("/", (c) => {
  return c.text("Hello bv2url-proxy!");
});

// 保活接口
app.get("/healthcheck", (c) => {
  const now = new Date();
  const beijingTime = now.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false, // 使用 24 小时制
  });
  return c.text(`Time: ${beijingTime}`);
});

// 鉴权拦截器 (针对来源做限制)
const SECRET_TOKEN = process.env.PROXY_TOKEN || "";
app.use("*", async (c, next) => {
  const clientToken = c.req.header("x-proxy-token");

  if (clientToken !== SECRET_TOKEN) {
    console.warn(`[拦截] 非法请求来源 IP: ${c.req.header("x-forwarded-for")}`);
    return c.json(
      { code: -401, message: "Unauthorized: 凭证无效或未授权" },
      401,
    );
  }

  await next();
});

// 拦截所有请求并代理到 B 站
app.all("*", async (c) => {
  // 1. 解析原始请求，把目标域名换成 B 站
  const url = new URL(c.req.url);
  url.host = "api.bilibili.com";
  url.protocol = "https:";
  url.port = "";

  // 路径白名单 (只对 B 站特定接口反代)
  const allowedPrefixes = ["/x/player/pagelist", "/x/player/playurl"];
  const isAllowedPath = allowedPrefixes.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
  if (!isAllowedPath) {
    console.warn(`[拦截] 尝试访问非白名单路径: ${url.pathname}`);
    return c.json(
      { code: -403, message: "Forbidden: 该 B 站接口不允许被代理" },
      403,
    );
  }

  // 2. 复制原始请求头，并强行注入我们的伪装头
  const headers = new Headers(c.req.header());
  headers.set("Host", "api.bilibili.com");
  headers.set("Referer", "https://www.bilibili.com/");
  headers.set("Origin", "https://www.bilibili.com");
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );
  headers.set(
    "sec-ch-ua",
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  );
  headers.set("Sec-Fetch-Site", "same-site");
  headers.set("Sec-Fetch-Mode", "cors");
  headers.set("Sec-Fetch-Dest", "empty");

  // 把验证用的暗号从 Header 里摘除
  headers.delete("x-proxy-token");

  // 3. 构建新的请求并发送 (这就是原生 Fetch 的魅力)
  const proxyReq = new Request(url.toString(), {
    method: c.req.method,
    headers: headers,
    body: c.req.raw.body,
    // Node.js 中使用 fetch 转发 body 需要加上这个属性
    // @ts-ignore
    duplex: "half",
  });

  const res = await fetch(proxyReq);

  // 1. 克隆 B 站返回的响应头
  const responseHeaders = new Headers(res.headers);

  // 2. 核心修复：删掉压缩声明和旧的长度声明，因为 body 已经被 Node.js 解压成明文了
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  // CORS 相关的头也可以加上，防止跨域报错
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  // 3. 组装一个干净的、全新的 Response 返回给你的 CF Worker
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
});

const port = Number(process.env.PORT) || 3000;
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
