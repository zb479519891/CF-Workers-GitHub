<div align="center">

# 📦 CF-Workers-GitHub

### GitHub Proxy for Cloudflare Workers

**Release · Archive · Blob · Raw · Gist · Git**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/zb479519891/CF-Workers-GitHub)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare)](https://workers.cloudflare.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Worker-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](./_worker.js)
[![License](https://img.shields.io/github/license/zb479519891/CF-Workers-GitHub?style=for-the-badge)](./LICENSE)

<br>

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zb479519891/CF-Workers-GitHub)

<br>

**中文** · [English](#-english)

</div>

---

<div align="center">

<img src="./img.png" alt="CF-Workers-GitHub" width="860">

</div>

# 🇨🇳 中文

## 📖 项目简介

**CF-Workers-GitHub** 是一个运行在 **Cloudflare Workers** 上的 GitHub 代理。

项目核心为 [_worker.js](./_worker.js)，通过正则规则识别 GitHub Release、Archive、Blob、Raw、Gist、Git 相关请求，并将请求转发到对应目标；Blob / Raw 请求还可以选择跳转到 JSDelivr。

> 以下说明以当前仓库中的 [_worker.js](./_worker.js) 实际代码为准，不描述代码中不存在的缓存、Token 或环境变量功能。

## ✨ 当前版本支持

| 类型 | 状态 | 实现 |
|:---|:---:|:---|
| Release | ✅ | github.com/.../releases/... |
| Archive | ✅ | github.com/.../archive/... |
| Blob | ✅ | 默认转换 /blob/ → /raw/ |
| Raw | ✅ | raw.githubusercontent.com / raw.github.com |
| Gist | ✅ | gist.githubusercontent.com / gist.github.com |
| Git | ✅ | info / git-* 路径 |
| Tags | ✅ | /tags... 路径 |
| JSDelivr | ⚙️ | 默认关闭，可设置 Config.jsdelivr = 1 |
| CORS | ✅ | 默认允许 * |
| URL 前缀 | ⚙️ | PREFIX |
| 路径白名单 | ⚙️ | whiteList |
| 静态资源回退 | ✅ | 未匹配时使用 ASSET_URL |

---


