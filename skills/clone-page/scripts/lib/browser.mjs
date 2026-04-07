/**
 * browser.mjs — Playwright 浏览器生命周期管理
 * 从 extract-page-data 改编，共享同一缓存目录避免重复下载 Chromium。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const RUNNER_DIR = path.join(os.homedir(), '.cache', 'axure-extractor');

export function getRunnerDir() { return RUNNER_DIR; }

// ── Auto-install ─────────────────────────────────────────────
export async function ensureDependencies() {
  const pkgPath = path.join(RUNNER_DIR, 'node_modules', 'playwright');
  if (fs.existsSync(pkgPath)) return;

  console.log('📦 首次运行 — 正在安装 Playwright（约 1-2 分钟）…');
  fs.mkdirSync(RUNNER_DIR, { recursive: true });

  const pkgJsonPath = path.join(RUNNER_DIR, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ type: 'module', private: true }, null, 2));
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  try {
    execSync(`${npmCmd} install playwright`, { cwd: RUNNER_DIR, stdio: 'inherit' });
  } catch {
    console.error('❌ npm install 失败，尝试 --prefix…');
    try {
      execSync(`${npmCmd} install playwright --prefix "${RUNNER_DIR}"`, { stdio: 'inherit' });
    } catch {
      console.error(`❌ Playwright 安装失败。手动安装: cd "${RUNNER_DIR}" && ${npmCmd} install playwright && ${npxCmd} playwright install chromium`);
      return;
    }
  }

  console.log('🌐 正在安装 Chromium…');
  try {
    execSync(`${npxCmd} playwright install chromium`, { cwd: RUNNER_DIR, stdio: 'inherit' });
  } catch {
    console.log('⚠️  官方下载失败，尝试 npmmirror…');
    try {
      execSync(`${npxCmd} playwright install chromium`, {
        cwd: RUNNER_DIR, stdio: 'inherit',
        env: { ...process.env, PLAYWRIGHT_DOWNLOAD_HOST: 'https://npmmirror.com/mirrors/playwright' },
      });
    } catch {
      console.warn('⚠️  Chromium 安装失败 — 将尝试使用系统浏览器。');
    }
  }
  console.log('✅ Playwright + Chromium 已安装。');
}

export function isPlaywrightAvailable() {
  return fs.existsSync(path.join(RUNNER_DIR, 'node_modules', 'playwright'));
}

export async function loadPlaywright() {
  const pwPath = path.join(RUNNER_DIR, 'node_modules', 'playwright', 'index.mjs');
  if (!fs.existsSync(pwPath)) return null;
  return import(pwPath);
}

// ── Browser singleton ────────────────────────────────────────
let _browser = null;

export async function getBrowser(playwright, options = {}) {
  if (_browser) return _browser;
  const { headless = true, connectCdp } = options;

  if (connectCdp) {
    console.log(`🔗 连接 Chrome: ${connectCdp}`);
    _browser = await playwright.chromium.connectOverCDP(connectCdp);
  } else {
    _browser = await playwright.chromium.launch({
      headless,
      args: ['--allow-file-access-from-files', '--disable-web-security', '--no-sandbox'],
    });
  }
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

/**
 * 打开页面并等待加载完成
 * @returns {{ page, context }}
 */
export async function openPage(playwright, url, options = {}) {
  const {
    headless = true,
    connectCdp,
    viewport = { width: 1440, height: 900 },
    waitMs = 0,
  } = options;

  const browser = await getBrowser(playwright, { headless, connectCdp });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  if (waitMs > 0) await page.waitForTimeout(waitMs);

  return { page, context };
}
