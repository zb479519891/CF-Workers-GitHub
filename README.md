<div align="center">

# 🚀 CF-Workers-GitHub

### GitHub Proxy / 镜像代理 · Cloudflare Workers

<p>
  <a href="https://github.com/zb479519891/CF-Workers-GitHub">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://workers.cloudflare.com/">
    <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare" alt="Cloudflare Workers">
  </a>
  <img src="https://img.shields.io/badge/JavaScript-Worker-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <a href="https://github.com/zb479519891/CF-Workers-GitHub/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/zb479519891/CF-Workers-GitHub?style=for-the-badge" alt="License">
  </a>
</p>

<p>
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/zb479519891/CF-Workers-GitHub">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare">
  </a>
</p>

<p>
  <b>中文</b> · <a href="#-english">English</a>
</p>

</div>

---

> **项目说明**
>
> 本 README 按当前仓库实际文件编写。当前仓库核心运行文件只有 `_worker.js`，没有额外的 Node.js 服务、数据库、Token 管理、缓存配置文件或 `wrangler.toml`。

# 🇨🇳 中文

## 📖 项目简介

**CF-Workers-GitHub** 是一个运行在 **Cloudflare Workers** 上的 GitHub 请求代理。

项目通过 Worker 接收请求，根据路径中的 GitHub URL 类型进行匹配，然后：

1. 识别 Release / Archive / Blob / Raw / Gist / Git / Tags 等请求；
2. 对 Blob 请求默认将 `/blob/` 转换为 `/raw/`；
3. 可选使用 **jsDelivr** 作为 Blob / Raw 内容的 CDN 跳转目标；
4. 对代理响应补充 CORS 相关响应头；
5. 对部分安全策略响应头进行删除；
6. 未命中 GitHub 代理规则时，回退到项目代码中的 `ASSET_URL`；
7. 发生 Worker 异常时返回 `502`。

核心逻辑全部位于：

`_worker.js`

---

## ✨ 功能概览

| 功能 | 支持 | 说明 |
|:---|:---:|:---|
| GitHub Release | ✅ | 匹配 `github.com/.../releases/...` |
| GitHub Archive | ✅ | 匹配 `github.com/.../archive/...` |
| GitHub Blob | ✅ | 默认把 `/blob/` 转换为 `/raw/` |
| GitHub Raw | ✅ | 支持 `raw.githubusercontent.com` / `raw.github.com` |
| GitHub Gist | ✅ | 支持 `gist.githubusercontent.com` / `gist.github.com` |
| Git 请求 | ✅ | 匹配 `info` / `git-*` 类型路径 |
| Tags | ✅ | 匹配 `/tags...` |
| jsDelivr | ⚙️ | `Config.jsdelivr = 1` 时启用，默认关闭 |
| CORS | ✅ | 代理响应默认设置 `Access-Control-Allow-Origin: *` |
| URL 前缀 | ⚙️ | 可通过 `PREFIX` 修改 |
| 路径白名单 | ⚙️ | 可通过 `whiteList` 限制路径 |
| 静态资源回退 | ✅ | 未匹配请求交给 `ASSET_URL` |
| Query 跳转 | ✅ | 支持 `?q=...` 转换为 Worker 路径 |

---

## 🧩 工作原理

整体请求流程可以理解为：

```text
┌──────────────────────────────┐
│        Client / Browser      │
└──────────────┬───────────────┘
               │ HTTPS Request
               ▼
┌──────────────────────────────┐
│       Cloudflare Worker      │
│          _worker.js          │
└──────────────┬───────────────┘
               │
               ▼
       ┌─────────────────┐
       │  fetchHandler() │
       └────────┬────────┘
                │
       ┌────────┴──────────────────────────┐
       │                                   │
       ▼                                   ▼
 GitHub URL 类型匹配                 未命中代理规则
       │                                   │
       ▼                                   ▼
┌─────────────────┐              ┌──────────────────┐
│ httpHandler()   │              │     ASSET_URL    │
│ 请求预处理       │              │ 静态资源回退      │
└────────┬────────┘              └──────────────────┘
         │
         ▼
┌─────────────────┐
│    proxy()      │
│  fetch 目标地址  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 修改响应 Headers │
│ CORS / Location │
│ CSP / ClearSite │
└────────┬────────┘
         │
         ▼
       Client
```

---

## 🔍 URL 匹配规则

当前 `_worker.js` 使用正则表达式判断请求类型，核心规则如下。

### 1. Release / Archive

匹配：

```text
github.com/<owner>/<repo>/releases/...
github.com/<owner>/<repo>/archive/...
```

这些请求会进入统一代理处理流程。

### 2. Blob

匹配：

```text
github.com/<owner>/<repo>/blob/...
```

默认行为：

```text
/blob/  →  /raw/
```

例如：

```text
https://github.com/user/repo/blob/main/file.txt
```

会转换为对应的 Raw 请求进行代理。

如果打开 jsDelivr：

```js
const Config = {
    jsdelivr: 1
}
```

Blob 请求会改为跳转到 jsDelivr。

### 3. Raw

支持：

```text
raw.githubusercontent.com/<owner>/<repo>/<branch>/<file>
raw.github.com/<owner>/<repo>/<branch>/<file>
```

默认直接代理目标地址。

启用 jsDelivr 后，可以跳转到 jsDelivr 对应地址。

### 4. Gist

支持：

```text
gist.githubusercontent.com/...
gist.github.com/...
```

请求会进入代理处理。

### 5. Git 相关请求

代码会匹配：

```text
github.com/<owner>/<repo>/info...
github.com/<owner>/<repo>/git-...
```

然后交给代理函数处理。

> 这里的“Git 支持”指当前正则和代理逻辑能够处理这些 Git 相关路径，并不意味着 Worker 内置实现了一个完整的 Git 服务端。

### 6. Tags

匹配：

```text
github.com/<owner>/<repo>/tags...
```

同样进入代理流程。

---

# 🚀 部署教程

## 方式一：Deploy to Cloudflare 一键部署

这是最简单的方式。

点击仓库顶部的：

**Deploy to Cloudflare**

或者：

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/zb479519891/CF-Workers-GitHub
```

然后按照 Cloudflare 页面提示完成授权和部署。

### 部署步骤

1. 打开项目仓库；
2. 点击 **Deploy to Cloudflare**；
3. 登录 Cloudflare；
4. 选择要部署的 Cloudflare 账户；
5. 创建 / 选择对应的 Worker；
6. 检查项目配置；
7. 点击部署；
8. 等待 Cloudflare 完成发布；
9. 获得类似下面的 Worker 地址：

```text
https://your-worker.your-subdomain.workers.dev
```

之后即可使用该域名访问 Worker。

> 一键部署入口依赖 Cloudflare 当前的部署流程。如果页面没有自动识别仓库，也可以直接使用下面的 Dashboard 手动部署方式。

---

## 方式二：Cloudflare Dashboard 手动部署

如果你不想使用一键部署，推荐直接通过 Cloudflare Dashboard 创建 Worker。

### 第一步：进入 Cloudflare

打开：

```text
https://dash.cloudflare.com/
```

登录你的 Cloudflare 账户。

---

### 第二步：进入 Workers & Pages

在 Cloudflare 控制台找到：

```text
Workers & Pages
```

然后创建一个新的 Worker。

不同版本的 Cloudflare 控制台按钮名称可能略有不同，一般会看到类似：

```text
Create application
Create Worker
Workers
```

选择创建 Worker。

---

### 第三步：创建 Worker

输入一个 Worker 名称，例如：

```text
github-proxy
```

然后创建。

Cloudflare 会为你生成一个默认 Worker。

---

### 第四步：替换 Worker 代码

进入 Worker 的代码编辑器。

把仓库：

```text
_worker.js
```

中的**全部代码**复制进去，替换 Cloudflare 默认生成的代码。

也就是说，最终运行代码就是：

```text
CF-Workers-GitHub
└── _worker.js
```

---

### 第五步：保存并部署

点击：

```text
Save and deploy
```

或者当前 Cloudflare 控制台对应的部署按钮。

部署完成后，你会得到一个：

```text
*.workers.dev
```

形式的访问地址。

例如：

```text
https://github-proxy.example.workers.dev
```

---

## 方式三：绑定自己的域名

如果不想使用 `workers.dev`，可以给 Worker 绑定自己的域名。

### 操作流程

进入：

```text
Cloudflare Dashboard
    ↓
Workers & Pages
    ↓
选择你的 Worker
    ↓
Settings / Domains & Routes
```

根据 Cloudflare 当前控制台提示添加：

- Custom Domain
- Route

例如你希望：

```text
https://gh.example.com
```

作为代理入口，就可以将该域名绑定到当前 Worker。

---

## ⚙️ 部署后的配置

当前项目没有 `.env`、`wrangler.toml` 或 Cloudflare Dashboard 环境变量依赖。

配置直接写在：

```text
_worker.js
```

顶部。

### 1. 修改 URL 前缀 PREFIX

默认：

```js
const PREFIX = '/'
```

如果你的 Worker 路由是：

```text
https://example.com/gh/
```

则需要修改：

```js
const PREFIX = '/gh/'
```

注意：

```text
/gh/     ✅
/gh      ❌
gh/      ❌
```

代码注释也特别提示了这里的斜杠要求。

---

### 2. 开启 jsDelivr

默认：

```js
const Config = {
    jsdelivr: 0
}
```

关闭 jsDelivr。

开启：

```js
const Config = {
    jsdelivr: 1
}
```

开启后，部分 Blob / Raw 请求会改为跳转到 jsDelivr。

修改代码后需要重新部署 Worker 才会生效。

---

### 3. whiteList 路径白名单

默认：

```js
const whiteList = []
```

为空时：

```text
不启用白名单限制
```

如果填写：

```js
const whiteList = [
    '/username/'
]
```

只有 URL 中包含指定字符串的请求才会继续处理，否则返回：

```text
403 blocked
```

> 注意：这里是代码中的**字符串包含匹配**，不是完整的域名 / Host 白名单系统。

---

### 4. 修改静态资源回退地址

代码中：

```js
const ASSET_URL = 'https://hunshcn.github.io/gh-proxy/'
```

当请求没有匹配 Release、Archive、Blob、Raw、Gist、Git、Tags 等规则时：

```text
ASSET_URL + path
```

会作为最终回退请求。

如果你修改这个地址，需要重新部署 Worker。

---

# 🧪 部署后测试

假设你的 Worker 地址是：

```text
https://github-proxy.example.workers.dev
```

可以先测试一个 GitHub Release / Archive / Blob / Raw 类型地址。

例如原始 GitHub 地址：

```text
https://github.com/OWNER/REPO/archive/refs/heads/main.zip
```

通过 Worker 时，可以按照当前 `PREFIX` 规则拼接：

```text
https://github-proxy.example.workers.dev/https://github.com/OWNER/REPO/archive/refs/heads/main.zip
```

如果使用默认：

```js
const PREFIX = '/'
```

则 Worker 会从域名后面的路径中提取目标 URL。

### 使用 `?q=` 方式

当前代码还支持：

```text
https://your-worker.example.workers.dev/?q=https://github.com/OWNER/REPO/releases/...
```

Worker 会将该请求 301 重定向到：

```text
https://your-worker.example.workers.dev/https://github.com/OWNER/REPO/releases/...
```

因此，`q` 更像是一个便捷的路径转换入口。

---

# 🌐 CORS 说明

代理响应会设置：

```http
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: *
```

因此适合浏览器跨域读取公开 GitHub 资源的场景。

对于预检请求，代码定义了：

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS
Access-Control-Max-Age: 1728000
```

但实际的 OPTIONS 快速返回只在请求包含：

```text
access-control-request-headers
```

时触发。

---

# 🔀 Redirect 重定向处理

代理收到目标服务器响应后，会检查：

```http
Location
```

如果 Location 本身仍然符合项目支持的 GitHub URL 规则，会将它重新加上：

```text
PREFIX
```

否则 Worker 会继续跟随重定向。

这意味着 GitHub Release 等场景下的多级跳转可以继续工作。

---

# 🧹 Response Header 处理

代理返回响应之前，会删除以下响应头：

```http
Content-Security-Policy
Content-Security-Policy-Report-Only
Clear-Site-Data
```

并重新设置 CORS 相关 Header。

---

# 🛠️ 本地 / CLI 部署

如果你习惯使用命令行，可以使用 Cloudflare Wrangler。

首先准备：

- Node.js
- Cloudflare 账户
- Wrangler

进入项目目录：

```bash
git clone https://github.com/zb479519891/CF-Workers-GitHub.git
cd CF-Workers-GitHub
```

安装 Wrangler：

```bash
npm install -D wrangler
```

登录 Cloudflare：

```bash
npx wrangler login
```

然后部署 Worker：

```bash
npx wrangler deploy _worker.js
```

Wrangler 会根据命令行入口部署 Worker。

> 当前仓库没有提供 `wrangler.toml` / `wrangler.jsonc`，所以 CLI 部署时建议明确指定 `_worker.js`。如果你后续需要固定 Worker 名称、路由、兼容日期或其他 Wrangler 配置，可以再加入 Wrangler 配置文件。

---

# 📁 项目结构

当前仓库非常精简：

```text
CF-Workers-GitHub/
├── _worker.js    # Cloudflare Worker 核心代码
├── README.md     # 项目说明
└── LICENSE       # MIT License
```

核心代码入口：

```text
_worker.js
    │
    ├── ASSET_URL
    ├── PREFIX
    ├── Config.jsdelivr
    ├── whiteList
    │
    ├── checkUrl()
    ├── fetchHandler()
    ├── httpHandler()
    ├── proxy()
    └── makeRes()
```

---

# 🧭 核心函数说明

| 函数 | 作用 |
|:---|:---|
| `makeRes()` | 创建响应并统一添加 CORS |
| `newUrl()` | 安全地解析 URL，失败时返回 `null` |
| `checkUrl()` | 判断重定向地址是否属于支持的 GitHub URL |
| `fetchHandler()` | Worker 主入口，负责识别请求类型和路由 |
| `httpHandler()` | 处理预检、白名单和目标 URL 初始化 |
| `proxy()` | 真正请求目标地址并处理响应 Header |

---

# ⚠️ 注意事项

### 1. 这是公开 GitHub 代理

当前代码没有：

- GitHub Personal Access Token
- 私有仓库认证
- 用户登录系统
- API Key 管理
- 数据库存储

因此不要把它描述成一个带私有仓库权限管理的 GitHub API 网关。

### 2. 没有内置缓存系统

当前 `_worker.js` 没有：

```text
CACHE_TTL
Cache API
KV
R2
D1
Durable Objects
```

等缓存实现。

### 3. 没有环境变量配置

当前配置直接写在代码中：

```js
PREFIX
Config.jsdelivr
whiteList
ASSET_URL
```

不是通过：

```text
.env
环境变量
Secrets
```

读取。

### 4. 修改配置后需要重新部署

例如修改：

```js
Config.jsdelivr = 1
```

或：

```js
const PREFIX = '/gh/'
```

后，需要重新发布 Worker 才会生效。

### 5. 请遵守目标站点和 GitHub 的使用规则

部署代理并不改变 GitHub、Cloudflare 或目标资源本身的服务条款。请根据你的实际使用场景合理控制流量，并遵守相关法律法规及服务条款。

---

# ❓ 常见问题

### Q：部署需要服务器吗？

**不需要。**

Worker 代码运行在 Cloudflare Workers 上，不需要自己购买 VPS。

### Q：需要数据库吗？

**不需要。**

当前项目没有数据库依赖。

### Q：需要 Node.js 才能运行吗？

**Worker 运行时不需要 Node.js。**

Node.js + Wrangler 只是在你选择 CLI 部署时使用。

### Q：必须购买域名吗？

**不是必须。**

部署后可以直接使用 Cloudflare 提供的 `workers.dev` 地址。

如果需要更漂亮的入口，也可以绑定自己的域名。

### Q：可以代理私有仓库吗？

当前代码没有实现 GitHub Token / OAuth / 私有仓库认证机制，因此 README 不将私有仓库代理作为项目功能。

### Q：为什么有些 URL 不会被代理？

因为 Worker 不是对所有 URL 无条件代理。

它首先通过当前代码中的正则表达式检查 URL 类型。未匹配的请求会进入：

```text
ASSET_URL + path
```

回退流程。

### Q：Blob 为什么会变成 Raw？

这是当前代码的明确逻辑：

```js
path = path.replace('/blob/', '/raw/')
```

目的是把 Blob 页面路径转换成文件内容路径，再进行代理。

---

# 🙏 致谢

本项目的实现思路和代码结构与开源项目 **gh-proxy** 有关联，感谢原作者及相关开源贡献者。

本仓库为独立部署版本，具体行为以本仓库当前 `_worker.js` 为准。

---

# 📄 License

本项目采用 **MIT License**，详见：

`LICENSE`

---

# 🇬🇧 English

## Overview

**CF-Workers-GitHub** is a lightweight GitHub proxy running on **Cloudflare Workers**.

The project is intentionally simple: the main runtime is a single `_worker.js` file. It matches supported GitHub URL patterns, proxies matching requests, optionally redirects Blob / Raw requests to jsDelivr, adds CORS headers, and falls back to the configured `ASSET_URL` for unmatched paths.

> This README describes the repository as it currently exists. It does not claim features that are not implemented in `_worker.js`.

## Supported Requests

- GitHub Releases
- GitHub Archives
- GitHub Blob URLs
- GitHub Raw URLs
- GitHub Gist URLs
- Git-related `info` / `git-*` paths
- GitHub Tags paths
- Optional jsDelivr redirect mode
- CORS response headers
- Custom URL prefix
- Path substring whitelist
- Static asset fallback
- `?q=` path redirect

## Deployment

### Option 1 — Deploy to Cloudflare

Use the **Deploy to Cloudflare** button at the top of this README and follow Cloudflare's deployment flow.

After deployment, Cloudflare will provide a Worker URL similar to:

```text
https://your-worker.your-subdomain.workers.dev
```

### Option 2 — Cloudflare Dashboard

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Create a new Worker.
4. Open the Worker code editor.
5. Copy the complete contents of `_worker.js` into the editor.
6. Save and deploy.
7. Test the generated `workers.dev` URL.
8. Optionally add a custom domain or route.

### Option 3 — Wrangler CLI

Clone the repository:

```bash
git clone https://github.com/zb479519891/CF-Workers-GitHub.git
cd CF-Workers-GitHub
```

Install Wrangler:

```bash
npm install -D wrangler
```

Authenticate:

```bash
npx wrangler login
```

Deploy:

```bash
npx wrangler deploy _worker.js
```

The repository currently does not include a Wrangler configuration file. If you need a fixed Worker name, route, compatibility date, or other deployment settings, you can add a Wrangler configuration later.

## Configuration

All current configuration lives in `_worker.js`:

```js
const ASSET_URL = 'https://hunshcn.github.io/gh-proxy/'
const PREFIX = '/'

const Config = {
    jsdelivr: 0
}

const whiteList = []
```

- Set `PREFIX` to change the Worker path prefix.
- Set `Config.jsdelivr = 1` to enable jsDelivr redirects.
- Add strings to `whiteList` to enable path substring filtering.
- Change `ASSET_URL` to change the fallback target.

After changing these values, redeploy the Worker.

## Architecture

```text
Client
  │
  ▼
Cloudflare Worker
  │
  ▼
fetchHandler()
  │
  ├── Release / Archive ──┐
  ├── Blob / Raw ─────────┤
  ├── Gist ───────────────┤
  ├── Git / Tags ─────────┤
  │                        ▼
  │                  httpHandler()
  │                        │
  │                        ▼
  │                     proxy()
  │                        │
  │                        ▼
  │                  Target Server
  │
  └── unmatched ───────► ASSET_URL
```

## Repository Structure

```text
CF-Workers-GitHub/
├── _worker.js
├── README.md
└── LICENSE
```

## Important Notes

The current implementation does **not** include:

- GitHub Personal Access Token management
- Private repository authentication
- OAuth
- Database storage
- KV / R2 / D1
- Built-in cache configuration
- Environment-variable based application settings

The source of truth for runtime behavior is `_worker.js`.

---

## ⭐ Star the project

If this project is useful to you, consider giving it a Star on GitHub.

<div align="center">

**CF-Workers-GitHub · Cloudflare Workers · GitHub Proxy**

</div>
