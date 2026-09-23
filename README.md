# 📦 CF-Workers-GitHub

GitHub 文件 / Release / Archive / Raw / Gist 的 Cloudflare Workers / Pages 代理加速。

## ✨ 当前版本特性

- GitHub Host 白名单校验，避免把 Worker 变成任意 URL 代理。
- Release 下载自动跟随 GitHub 资产重定向。
- 支持 Range / ETag / Last-Modified 等下载相关响应头。
- GET / HEAD 使用 Cloudflare Cache API，默认缓存 1 小时。
- 仅允许 GET / HEAD / OPTIONS，其他方法返回 405，降低误用风险。
- 命中缓存时返回 `x-cf-github-cache: HIT`。
- 最多跟随 5 次 GitHub 内部重定向，避免循环跳转。
- Blob 链接自动转换为 Raw。
- 可选 JSDelivr 跳转。
- 支持自定义 CORS、缓存时间、URL 前缀和 UA 黑名单。
- 保留 `URL` / `URL302` 兼容配置。

> 建议使用自己的 Cloudflare Worker / Pages 域名，不要依赖公共演示域名。

## 🚀 使用

假设你的 Worker 域名是：

`https://your-worker.example.com/`

直接在 GitHub URL 前加 Worker 地址：

`https://your-worker.example.com/https://github.com/OWNER/REPO/releases/download/TAG/file.zip`

也可以使用不带协议的形式：

`https://your-worker.example.com/github.com/OWNER/REPO/archive/refs/heads/main.zip`

### 支持示例

- 分支源码：`https://github.com/OWNER/REPO/archive/refs/heads/main.zip`
- Tag 源码：`https://github.com/OWNER/REPO/archive/refs/tags/v1.0.0.tar.gz`
- Release 文件：`https://github.com/OWNER/REPO/releases/download/v1.0.0/example.zip`
- Blob 文件：`https://github.com/OWNER/REPO/blob/main/file.txt`
- Raw 文件：`https://raw.githubusercontent.com/OWNER/REPO/main/file.txt`
- Gist：`https://gist.githubusercontent.com/USER/GIST_ID/raw/file.txt`

## 📄 Cloudflare Pages 部署

1. Fork 本项目。
2. 在 Cloudflare Pages 中连接 GitHub 仓库。
3. 构建命令填写：echo "No build required"
4. 选择本仓库并部署。
5. 绑定自己的自定义域名。

如果直接使用 Worker 编辑器，也可以把 `_worker.js` 内容部署到 Worker。

## 👷 Cloudflare Worker 部署

创建 Worker 后，将 [_worker.js](./_worker.js) 内容粘贴到编辑器并部署即可。

如果使用 Wrangler，可将该文件作为 Worker 入口，再按你的账号和域名配置路由。

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `PREFIX` | `/` | URL 前缀，例如 `/gh/` |
| `CACHE_TTL` | `3600` | Cache API 缓存秒数；设为 `0` 可关闭 Worker Cache |
| `ALLOW_ORIGIN` | `*` | CORS 的 `Access-Control-Allow-Origin` |
| `JSDELIVR` | `false` | 设为 `true` 时，符合条件的 Blob/Raw 请求跳转 JSDelivr |
| `UA` | 空 | 额外 UA 黑名单，多个值可用空格、逗号或换行分隔 |
| `URL` | 空 | 根路径备用页面；设为 `nginx` 返回 Nginx 风格页面 |
| `URL302` | 空 | 根路径 302 跳转地址 |

### 推荐配置

公开文件代理可以使用：

- `CACHE_TTL=3600`
- `ALLOW_ORIGIN=*`
- `JSDELIVR=false`

如果只给自己的前端应用使用，可以把 `ALLOW_ORIGIN` 设置为你的站点 Origin。

## ⚡ 下载与缓存说明

Release 文件通常会经历 GitHub 到 Release Asset 存储节点的重定向。当前版本会继续代理 GitHub 官方资产域名；Release Asset 存储域名只能作为 GitHub 内部重定向后的目标，不能作为普通用户的初始代理目标。

普通 GET / HEAD 请求会尝试使用 Cache API。带 `Authorization`、`Cookie` 或 `Range` 的请求不会进入 Worker Cache，以避免缓存私有内容或 206 响应。源站明确返回 `private` / `no-store`、Set-Cookie 或不适合共享缓存的 `Vary: *` 时，也不会写入 Worker Cache。

Cloudflare 的 Cache API 支持根据 ETag / Last-Modified 进行条件匹配，并可以处理缓存对象的 Range 请求；Worker 本身不会人为生成 206 缓存响应。

## ⚠️ 注意事项

- 本项目主要用于公开 GitHub 内容代理。
- 不建议把用户提交的任意 URL 当作代理目标；当前版本只允许白名单 GitHub 域名。
- 如果你需要私有仓库代理，请谨慎处理 Token，并关闭相关请求的缓存。
- 大量流量请使用自己的 Cloudflare 账号和域名，并根据实际流量调整缓存策略。

## 🙏 致谢

- [gh-proxy](https://github.com/hunshcn/gh-proxy)
- [jsproxy](https://github.com/EtherDream/jsproxy)
