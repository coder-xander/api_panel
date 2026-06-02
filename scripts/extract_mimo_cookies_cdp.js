#!/usr/bin/env node

/**
 * 通过 CDP 从 Brave 浏览器提取小米 MiMo Cookie。
 *
 * 绕过 pycookiecheat 的 Linux keyring 解密问题 —— 直接通过 CDP
 * 从运行的浏览器进程中获取 session cookie。
 *
 * 流程：
 *   1) 检查 9222 端口是否有 Brave CDP 在监听
 *   2) 否 → 启动 Brave headless（默认 profile），等待就绪
 *   3) 通过 /json 获取最新页面 WebSocket URL
 *   4) 发送 Network.getAllCookies → 过滤目标域名 cookie
 *
 * 输出: {"cookie":"...", "browser":"Brave", "error":null}
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const CDP_PORT = 9222;
const TARGET_DOMAIN = 'platform.xiaomimimo.com';
const TARGET_URL = `https://${TARGET_DOMAIN}/console/plan-manage`;
// 使用默认 profile 路径，确保用户已有的持久 cookie 可访问
const DEFAULT_PROFILE = `${require('os').homedir()}/.config/BraveSoftware/Brave-Browser`;

// ─── HTTP GET → JSON ───
function httpGetJSON(host, port, path, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: host, port, path, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from ${path}: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${path}`)); });
  });
}

// ─── 获取最新页面 WS URL（每次调用都重新请求 /json，避免 stale target）───
async function getTargetWsUrl() {
  const targets = await httpGetJSON('127.0.0.1', CDP_PORT, '/json');
  let target = targets.find(
    (t) => t.webSocketDebuggerUrl && t.url && t.url.startsWith('http'),
  );

  if (!target) {
    // 没有 HTTP 页面 → 新建一个
    const newPage = await httpGetJSON(
      '127.0.0.1',
      CDP_PORT,
      `/json/new?url=${encodeURIComponent(TARGET_URL)}`,
    );
    target = Array.isArray(newPage) ? newPage[0] : newPage;
  }

  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error('无法获取 CDP WebSocket 调试 URL');
  }
  return target.webSocketDebuggerUrl;
}

// ─── CDP 命令：用最新 WS URL 发送命令并等待匹配 id 的响应 ───
let _cdpId = 0; // CDP 要求 id 为 32-bit 整数，不能用 Date.now()
async function cdpCommand(method, params = {}) {
  const wsUrl = await getTargetWsUrl();

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = ++_cdpId; // 递增计数器，确保 32-bit 安全
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        ws.close();
        reject(new Error(`CDP ${method} 超时`));
      }
    }, 20000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id, method, params }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          responded = true;
          clearTimeout(timeout);
          ws.close();
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
        // 忽略 CDP 事件（无 id 或 id 不匹配）
      } catch {
        // 忽略解析错误
      }
    });

    ws.on('error', (err) => {
      if (!responded) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

async function main() {
  let braveProcess = null;
  let usingExisting = false;

  try {
    // ─── 1) 检查是否已有 Brave CDP 实例 ───
    let cdpReady = false;
    try {
      await httpGetJSON('127.0.0.1', CDP_PORT, '/json/version', 2000);
      cdpReady = true;
      usingExisting = true;
    } catch {
      // 没有已有实例，启动一个
    }

    if (!cdpReady) {
      // ─── 2) 启动 Brave headless（默认 profile，保留持久 cookie） ───
      braveProcess = spawn('brave-browser', [
        `--remote-debugging-port=${CDP_PORT}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--headless=new',
        '--disable-gpu',
        '--disable-software-rasterizer',
        `--user-data-dir=${DEFAULT_PROFILE}`,
        TARGET_URL,
      ], {
        stdio: 'ignore',
        detached: true,
      });
      braveProcess.unref();

      // 等 CDP 端口就绪（最多 20 秒）
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          await httpGetJSON('127.0.0.1', CDP_PORT, '/json/version', 1000);
          cdpReady = true;
          break;
        } catch {
          /* retry */
        }
      }
      if (!cdpReady) {
        throw new Error('Brave 启动超时（20s），未能暴露 CDP 端口 9222');
      }
    }

    // ─── 3) 通过 CDP 获取所有 cookie ───
    // 每次调用 cdpCommand 内部都会重新获取 WS URL，避免 stale target
    const result = await cdpCommand('Network.getAllCookies');
    const allCookies = result.cookies || [];

    // ─── 4) 过滤目标域名 ───
    const mimoCookies = allCookies.filter(
      (c) => c.domain && c.domain.includes(TARGET_DOMAIN),
    );

    if (mimoCookies.length === 0) {
      return {
        cookie: null,
        browser: 'Brave',
        error: `CDP 未找到 ${TARGET_DOMAIN} 的 Cookie，请先在 Brave 中登录后再试`,
      };
    }

    const cookieStr = mimoCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    return { cookie: cookieStr, browser: 'Brave', error: null };
  } finally {
    // 如果是我们启动的 Brave 且出错，清理
    if (!usingExisting && braveProcess) {
      try {
        spawn('kill', [String(braveProcess.pid)], { stdio: 'ignore', detached: true }).unref();
      } catch {
        /* ignore */
      }
    }
  }
}

main()
  .then((result) => {
    process.stdout.write(JSON.stringify(result));
    process.exit(result.cookie ? 0 : 1);
  })
  .catch((err) => {
    const result = {
      cookie: null,
      browser: 'Brave',
      error: `CDP 提取失败: ${err.message}`,
    };
    process.stdout.write(JSON.stringify(result));
    process.exit(1);
  });
