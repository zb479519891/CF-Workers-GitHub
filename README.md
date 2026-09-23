# 📦 CF-Workers-GitHub

> 基于 Cloudflare Workers / Pages 的 GitHub 文件、Release、Archive、Raw 与 Gist 代理加速。

将 GitHub 请求交给 Cloudflare Workers 转发，无需自建服务器即可部署自己的 GitHub 资源代理。

## ✨ 特性

- 🔒 **GitHub Host 白名单**：仅允许代理受支持的 GitHub 官方域名，避免 Worker 成为任意 URL 代理。
- 📦 **Release / Archive / Blob / Raw / Gist**：覆盖常见 GitHub 资源访问场景。
- 🔁 **Release 重定向跟随**：自动处理 GitHub Release Asset 的内部重定向。
- ⚡ **Cloudflare Cache API**：GET / HEAD 默认缓存 1 小时，减少重复请求。
- 🧠 **缓存校验**：支持 ETag / Last-Modified 等缓存相关响应头。
- 📥 **Range 请求**：保留下载相关 Range 响应能力。
- 🛡️ **请求方法限制**：仅允许 GET / HEAD / OPTIONS，其余方法返回 405。
- 🔄 **重定向保护**：最多跟随 5 次 GitHub 内部重定向，避免循环跳转。
- 🔀 **Blob → Raw**：自动将 GitHub Blob 文件转换为 Raw 文件请求。
- 🚀 **可选 JSDelivr**：可通过环境变量启用符合条件的 JSDelivr 跳转。
- 🌐 **CORS 可配置**：支持自定义 `Access-Control-Allow-Origin`。
- 🚫 **UA 黑名单**：可按需限制指定 User-Agent。
- 🔧 **兼容旧配置**：保留 `URL` / `URL302` 配置。

> **建议：** 生产环境请部署到自己的 Cloudflare 账号，并绑定自己的域名，不要依赖公共演示服务。

---

## 🚀 快速使用

假设你的 Worker 域名为：

`https://github.example.com/`

### 代理完整 GitHub URL

原始地址：

`https://github.com/OWNER/REPO/releases/download/v1.0.0/file.zip`

代理地址：

`https://github.example.com/https://github.com/OWNER/REPO/releases/download/v1.0.0/file.zip`

### 也支持省略协议

`https://github.example.com/github.com/OWNER/REPO/archive/refs/heads/main.zip`

---

## 📚 支持的资源

### 分支源码

```
https://github.com/OWNER/REPO/archive/refs/heads/main.zip
```

### Tag 源码

```
https://github.com/OWNER/REPO/archive/refs/tags/v1.0.0.tar.gz
```

### Release 文件

```
https://github.com/OWNER/REPO/releases/download/v1.0.0/example.zip
```

### Blob 文件

```
https://github.com/OWNER/REPO/blob/main/file.txt
```

Blob 请求会自动转换为对应的 Raw 文件请求。

### Raw 文件

```
https://raw.githubusercontent.com/OWNER/REPO/main/file.txt
```

### Gist

```
https://gist.githubusercontent.com/USER/GIST_ID/raw/file.txt
```

---

## ☁️ Cloudflare Pages 部署

### 1. Fork 项目

Fork 本项目到自己的 GitHub 账号。

### 2. 创建 Pages 项目

进入 Cloudflare Dashboard → **Workers & Pages**，创建 Pages 项目并连接 GitHub 仓库。

### 3. 构建配置

本项目无需构建，可以使用：

```
Build command: echo "No build required"
```

然后完成部署。

### 4. 绑定自定义域名

部署完成后，在 Pages 项目中绑定自己的域名，例如：

```
github.example.com
```

之后即可使用：

```
https://github.example.com/https://github.com/OWNER/REPO
```

---

## 👷 Cloudflare Workers 部署

### 方式一：直接粘贴代码

1. 在 Cloudflare 创建一个新的 Worker。
2. 打开本项目的 [`_worker.js`](./_worker.js)。
3. 将文件内容复制到 Worker 编辑器。
4. 保存并部署。
5. 根据需要绑定自定义域名。

### 方式二：Wrangler

如果使用 Wrangler，可以将 `_worker.js` 作为 Worker 入口，再按照自己的 Cloudflare 账号、域名和路由配置进行部署。

---

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `PREFIX` | `/` | URL 前缀，例如 `/gh/` |
| `CACHE_TTL` | `3600` | Worker Cache 缓存时间，单位为秒；设置为 `0` 可关闭 Worker Cache |
| `ALLOW_ORIGIN` | `*` | CORS 的 `Access-Control-Allow-Origin` |
| `JSDELIVR` | `false` | 设置为 `true` 时，符合条件的 Blob / Raw 请求可跳转 JSDelivr |
| `UA` | 空 | User-Agent 黑名单，多个值可使用空格、逗号或换行分隔 |
| `URL` | 空 | 根路径备用页面；设置为 `nginx` 时返回 Nginx 风格页面 |
| `URL302` | 空 | 根路径 302 跳转地址 |

### 推荐配置

普通公开文件代理：

```
CACHE_TTL=3600
ALLOW_ORIGIN=*
JSDELIVR=false
```

如果只给自己的前端应用使用，可以将：

```
ALLOW_ORIGIN=https://example.com
```

设置为实际站点 Origin。

---

## ⚡ 缓存机制

普通 GET / HEAD 请求会尝试使用 Cloudflare Cache API。

为了避免缓存私有数据或不适合共享缓存的内容，以下请求不会进入 Worker Cache：

- 携带 `Authorization`
- 携带 `Cookie`
- 携带 `Range`
- 源站返回 `private`
- 源站返回 `no-store`
- 源站返回 `Set-Cookie`
- 源站返回不适合共享缓存的 `Vary: *`

命中缓存时会返回：

```
x-cf-github-cache: HIT
```

项目同时保留 ETag / Last-Modified 等响应头，以便利用 HTTP 缓存校验机制。

---

## 🔁 Release 下载说明

GitHub Release 文件通常会经历 GitHub 到 Release Asset 存储节点的重定向。

本项目会继续代理 GitHub 官方允许的内部资产重定向，但 Release Asset 存储域名仅作为 GitHub 内部重定向后的目标，不作为普通用户的初始代理目标。

这样可以在保证功能的同时，避免把 Worker 开放成任意第三方 URL 代理。

---

## 🔐 私有仓库

本项目主要面向公开 GitHub 内容。

如果需要代理私有仓库，请特别注意 Token 安全，并确保相关请求不会被缓存。

例如 Git Clone：

```bash
git clone https://用户名:TOKEN@你的域名/https://github.com/OWNER/PRIVATE-REPO.git
```

**不要：**

- 将 Token 提交到 GitHub
- 将包含 Token 的 URL 分享给其他人
- 将 Token 写入公开脚本
- 在日志、截图或 Issue 中暴露 Token

---

## 🛡️ 安全设计

当前版本默认只允许白名单 GitHub Host，避免用户通过 Worker 请求任意互联网地址。

同时：

- 仅允许 `GET` / `HEAD` / `OPTIONS`
- 其他 HTTP 方法返回 `405`
- GitHub 内部重定向最多跟随 5 次
- 带认证信息的请求不会进入 Worker Cache
- 私有数据不会因为普通缓存策略被共享缓存

如果你修改 Worker 代码，请不要随意移除 Host 校验和缓存安全限制。

---

## ⚠️ 注意事项

1. 本项目主要用于公开 GitHub 内容代理。
2. 大量下载或长期运行建议使用自己的 Cloudflare 账号和域名。
3. Cloudflare Workers / Pages、GitHub 均可能存在流量、请求频率及其他平台限制，请根据实际使用情况调整配置。
4. 私有仓库场景请妥善保管 GitHub Token。
5. 如果遇到下载失败，请先确认原始 GitHub URL 本身可以正常访问。
6. `CACHE_TTL` 设置过大可能导致公开资源更新存在缓存延迟。

---

## 📁 项目结构

```
CF-Workers-GitHub/
├── _worker.js    # Cloudflare Worker 核心代码
├── README.md     # 项目说明
├── img.png       # 项目图片资源
└── LICENSE       # MIT License
```

---

## 🙏 致谢

本项目参考并继承了相关开源项目的思路：

- [gh-proxy](https://github.com/hunshcn/gh-proxy)
- [jsproxy](https://github.com/EtherDream/jsproxy)

感谢所有开源项目及贡献者。

---

## 📄 License

本项目采用 **MIT License** 开源，详见 [LICENSE](./LICENSE)。

---

如果项目对你有帮助，欢迎 ⭐ Star、Fork 或提交 Issue。
