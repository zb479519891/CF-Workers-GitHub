'use strict';

/**
 * CF-Workers-GitHub v2
 * - 保持原有 URL 兼容格式
 * - 严格 GitHub Host 校验
 * - Cache API 缓存 GET/HEAD
 * - 限制重定向次数
 * - 不污染全局 UA 黑名单
 * - 保留 Range / ETag / Last-Modified 等响应头
 * - Release 下载跟随 GitHub 资产重定向，支持断点续传
 * - 支持环境变量：PREFIX / UA / URL / URL302 / CACHE_TTL / ALLOW_ORIGIN / JSDELIVR
 */

const DEFAULT_CONFIG = {
  prefix: '/',
  cacheTtl: 3600,
  allowOrigin: '*',
  jsdelivr: false,
  blockedUA: ['netcraft'],
};

const ALLOWED_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'raw.github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'clear-site-data',
]);

function getConfig(env) {
  const prefix = normalizePrefix(env.PREFIX || DEFAULT_CONFIG.prefix);
  const cacheTtl = Math.max(0, Number.parseInt(env.CACHE_TTL || DEFAULT_CONFIG.cacheTtl, 10) || 0);
  const allowOrigin = env.ALLOW_ORIGIN || DEFAULT_CONFIG.allowOrigin;
  const jsdelivr = /^(1|true|yes|on)$/i.test(env.JSDELIVR || '');
  const blockedUA = parseList(env.UA);

  return {
    prefix,
    cacheTtl,
    allowOrigin,
    jsdelivr,
    blockedUA: new Set([...DEFAULT_CONFIG.blockedUA, ...blockedUA].map(v => v.toLowerCase())),
  };
}

function normalizePrefix(value) {
  let prefix = String(value || '/').trim();
  if (!prefix.startsWith('/')) prefix = '/' + prefix;
  if (!prefix.endsWith('/')) prefix += '/';
  return prefix;
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,|"'\r\n]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function corsHeaders(origin = '*') {
  return {
    'access-control-allow-origin': origin,
    'access-control-expose-headers': '*',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function errorResponse(message, status = 400, origin = '*') {
  return new Response(message, {
    status,
    headers: {
      ...corsHeaders(origin),
      'content-type': 'text/plain; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

function isAllowedTarget(url) {
  return url?.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

function isSupportedPath(url, allowAssetHost = false) {
  const host = url.hostname.toLowerCase();
  const p = url.pathname;

  if (!ALLOWED_HOSTS.has(host)) return false;

  if (host === 'github.com' || host === 'www.github.com') {
    return (
      /^\/[^/]+\/[^/]+\/(?:releases|archive|blob|raw|info|git-[^/]+|tags)(?:\/|$)/i.test(p)
    );
  }

  if (host === 'raw.githubusercontent.com' || host === 'raw.github.com') {
    return /^\/[^/]+\/[^/]+\/[^/]+\/.+/i.test(p);
  }

  if (host === 'gist.githubusercontent.com' || host === 'gist.github.com') {
    return /^\/[^/]+\/[^/]+\/.+/i.test(p);
  }

  // GitHub Release assets / object storage: only reached through GitHub redirects.
  if (host === 'release-assets.githubusercontent.com' ||
      host === 'objects.githubusercontent.com' ||
      host === 'github-releases.githubusercontent.com') {
    return allowAssetHost && p.startsWith('/');
  }

  return false;
}

function toTarget(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isBlockedUA(request, config) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  for (const item of config.blockedUA) {
    if (item && ua.includes(item)) return true;
  }
  return false;
}

function buildUpstreamRequest(request, target) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  const language = headers.get('accept-language');
  if (language) {
    headers.set('accept-language', language.replace(/zh-CN/gi, 'zh-SG'));
  }

  return new Request(target.href, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
}

function rewriteLocation(location, config) {
  const target = toTarget(location);
  if (!target || !isAllowedTarget(target)) return null;

  return config.prefix + target.href;
}

function makeResponse(upstream, config) {
  const headers = new Headers(upstream.headers);

  for (const name of STRIP_RESPONSE_HEADERS) headers.delete(name);

  const location = headers.get('location');
  if (location) {
    const rewritten = rewriteLocation(location, config);
    if (rewritten) headers.set('location', rewritten);
    else headers.delete('location');
  }

  const cors = corsHeaders(config.allowOrigin);
  for (const [key, value] of Object.entries(cors)) {
    if (key === 'vary' && headers.has('vary')) {
      headers.set('vary', headers.get('vary') + ', Origin');
    } else {
      headers.set(key, value);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function cacheable(request, config) {
  if (!config.cacheTtl) return false;
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  // Cache API cannot store 206 responses. Let the origin/Cloudflare handle Range directly.
  if (request.headers.has('range')) return false;
  if (request.headers.has('authorization')) return false;
  if (request.headers.has('cookie')) return false;
  return true;
}

async function proxy(request, target, config, ctx, redirectCount = 0, allowAssetHost = false) {
  if (!isAllowedTarget(target)) {
    return errorResponse('Target host is not allowed.', 403, config.allowOrigin);
  }

  if (!isSupportedPath(target, allowAssetHost)) {
    return errorResponse('Unsupported GitHub URL.', 400, config.allowOrigin);
  }

  const upstreamRequest = buildUpstreamRequest(request, target);
  const response = await fetch(upstreamRequest);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) return makeResponse(response, config);

    if (redirectCount >= 5) {
      return errorResponse('Too many redirects.', 508, config.allowOrigin);
    }

    const next = new URL(location, target);
    if (!isAllowedTarget(next)) {
      // GitHub release assets may redirect to dedicated GitHub-controlled asset hosts.
      // Other external hosts are returned to the client and are never proxied.
      const headers = new Headers(response.headers);
      headers.set('location', next.href);
      for (const [k, v] of Object.entries(corsHeaders(config.allowOrigin))) headers.set(k, v);
      return new Response(null, { status: response.status, headers });
    }

    return proxy(request, next, config, ctx, redirectCount + 1, next.hostname === 'release-assets.githubusercontent.com' || next.hostname === 'objects.githubusercontent.com' || next.hostname === 'github-releases.githubusercontent.com');
  }

  const result = makeResponse(response, config);
  const upstreamCacheControl = response.headers.get('cache-control') || '';
  const canStore = response.status === 200 &&
    !/\b(?:no-store|private)\b/i.test(upstreamCacheControl) &&
    !response.headers.has('set-cookie') &&
    !/\*/.test(response.headers.get('vary') || '');

  if (cacheable(request, config) && canStore) {
    const cache = caches.default;
    const cacheRequest = new Request(request.url, request);
    result.headers.set('cache-control', `public, max-age=${config.cacheTtl}`);
    result.headers.set('x-cf-github-cache', 'MISS');
    ctx.waitUntil(cache.put(cacheRequest, result.clone()).catch(() => {}));
  }

  return result;
}

async function handleTarget(request, target, config, ctx) {
  if (!isAllowedTarget(target)) {
    return errorResponse('Only HTTPS GitHub hosts are allowed.', 403, config.allowOrigin);
  }

  if (!isSupportedPath(target)) {
    return errorResponse('Unsupported GitHub URL.', 400, config.allowOrigin);
  }

  if (cacheable(request, config)) {
    const cached = await caches.default.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('x-cf-github-cache', 'HIT');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
  }

  return proxy(request, target, config, ctx);
}

function nginxPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Welcome to nginx!</title>
<style>body{width:35em;margin:2em auto;font-family:Tahoma,Verdana,Arial,sans-serif}</style>
</head><body><h1>Welcome to nginx!</h1><p>If you see this page, the nginx web server is successfully installed and working.</p>
</body></html>`;
}

function homePage(config) {
  const prefix = config.prefix;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GitHub 文件加速</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d1117;color:#f0f6fc;padding:20px}
main{width:min(760px,100%);padding:32px;border:1px solid #30363d;border-radius:18px;background:#161b22}
h1{margin-top:0}input{width:100%;height:52px;padding:0 16px;border-radius:10px;border:1px solid #30363d;font-size:16px}
button{margin-top:12px;width:100%;height:48px;border:0;border-radius:10px;background:#238636;color:#fff;font-size:16px;cursor:pointer}
code{color:#58a6ff;word-break:break-all}li{margin:10px 0}
</style></head><body><main>
<h1>📦 GitHub 文件加速</h1>
<form id="f"><input id="q" placeholder="粘贴 GitHub 文件链接" required><button>开始加速</button></form>
<ul>
<li>支持 Release / Archive / Blob / Raw / Gist</li>
<li>支持缓存，重复请求可直接命中 Cloudflare Cache</li>
<li>当前前缀：<code>${prefix}</code></li>
</ul>
<p>示例：<code>github.com/user/repo/releases/download/v1.0/a.zip</code></p>
<script>
document.getElementById('f').onsubmit=e=>{e.preventDefault();const v=document.getElementById('q').value.trim();
if(v) location.href='${prefix}'+v.replace(/^https?:\\/\\//,'');};
</script></main></body></html>`;
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    const requestUrl = new URL(request.url);

    if (isBlockedUA(request, config)) {
      return new Response(nginxPage(), {
        status: 200,
        headers: {'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store'},
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: corsHeaders(config.allowOrigin)});
    }

    // 兼容旧版 ?q=xxx
    const queryTarget = requestUrl.searchParams.get('q');
    if (queryTarget) {
      const encoded = config.prefix + queryTarget.replace(/^\/+/, '');
      return Response.redirect(new URL(encoded, requestUrl.origin).href, 301);
    }

    if (requestUrl.pathname.toLowerCase() === '/favicon.ico') {
      return new Response(null, {
        status: 204,
        headers: {'cache-control': 'public, max-age=86400'},
      });
    }

    let rawPath = requestUrl.pathname;
    if (config.prefix !== '/' && rawPath.startsWith(config.prefix)) {
      rawPath = rawPath.slice(config.prefix.length);
    } else if (config.prefix === '/') {
      rawPath = rawPath.slice(1);
    } else {
      // 访问 Worker 根路径时显示首页；其他非前缀路径不做代理。
      return new Response(homePage(config), {
        headers: {'content-type': 'text/html; charset=UTF-8', ...corsHeaders(config.allowOrigin)},
      });
    }

    const target = toTarget(rawPath);
    if (target) {
      // Blob -> Raw：保持原项目行为
      if ((target.hostname === 'github.com' || target.hostname === 'www.github.com') &&
          /^\/[^/]+\/[^/]+\/blob\//i.test(target.pathname)) {
        target.pathname = target.pathname.replace('/blob/', '/raw/');
      }

      // 可选 jsDelivr：只对明确的 github.com blob/raw 路径做跳转
      if (config.jsdelivr &&
          (target.hostname === 'github.com' || target.hostname === 'www.github.com') &&
          /^\/[^/]+\/[^/]+\/(?:blob|raw)\//i.test(target.pathname)) {
        const parts = target.pathname.split('/');
        const user = parts[1], repo = parts[2];
        const branch = parts[4];
        const file = parts.slice(5).join('/');
        if (user && repo && branch && file) {
          const cdn = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${file}`;
          return Response.redirect(cdn, 302);
        }
      }

      return handleTarget(request, target, config, ctx);
    }

    if (env.URL302) {
      return Response.redirect(env.URL302, 302);
    }

    if (env.URL) {
      if (String(env.URL).toLowerCase() === 'nginx') {
        return new Response(nginxPage(), {
          headers: {'content-type': 'text/html; charset=UTF-8'},
        });
      }
      return fetch(new Request(env.URL, request));
    }

    return new Response(homePage(config), {
      headers: {'content-type': 'text/html; charset=UTF-8', ...corsHeaders(config.allowOrigin)},
    });
  },
};
