/**
 * browser.mjs — Playwright browser lifecycle management
 *
 * Handles:
 *  - Auto-install of Playwright + Chromium on first run
 *  - Browser launch (headed / headless)
 *  - Connect to existing Chrome via CDP
 *  - Graceful shutdown
 *
 * Customisation points:
 *  - RUNNER_DIR: change the cache directory
 *  - Launch args in getBrowser(): add proxies, disable-gpu, etc.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

// ── Cache directory ──────────────────────────────────────────
// Share the same Playwright cache as extract-axure-data to avoid
// duplicate downloads (~300MB for Chromium).
const RUNNER_DIR = path.join(os.homedir(), '.cache', 'axure-extractor');

export function getRunnerDir() {
  return RUNNER_DIR;
}

// ── Auto-install ─────────────────────────────────────────────
export async function ensureDependencies() {
  const pkgPath = path.join(RUNNER_DIR, 'node_modules', 'playwright');
  if (fs.existsSync(pkgPath)) return;

  console.log('📦 First run — installing Playwright (~1-2 min)…');
  fs.mkdirSync(RUNNER_DIR, { recursive: true });

  // Ensure package.json exists
  const pkgJsonPath = path.join(RUNNER_DIR, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    fs.writeFileSync(
      pkgJsonPath,
      JSON.stringify({ type: 'module', private: true }, null, 2),
    );
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  try {
    execSync(`${npmCmd} install playwright`, { cwd: RUNNER_DIR, stdio: 'inherit' });
  } catch {
    console.error('❌ npm install failed, trying --prefix…');
    try {
      execSync(`${npmCmd} install playwright --prefix "${RUNNER_DIR}"`, { stdio: 'inherit' });
    } catch {
      console.error('❌ Playwright install failed.');
      console.error(`   Manual install: cd "${RUNNER_DIR}" && ${npmCmd} install playwright && ${npxCmd} playwright install chromium`);
      return;
    }
  }

  console.log('🌐 Installing Chromium…');
  // Try official download first, then npmmirror as fallback
  try {
    execSync(`${npxCmd} playwright install chromium`, { cwd: RUNNER_DIR, stdio: 'inherit' });
  } catch {
    console.log('⚠️  Official download failed, trying npmmirror…');
    const mirrorEnv = {
      ...process.env,
      PLAYWRIGHT_DOWNLOAD_HOST: 'https://npmmirror.com/mirrors/playwright',
    };
    try {
      execSync(`${npxCmd} playwright install chromium`, { cwd: RUNNER_DIR, stdio: 'inherit', env: mirrorEnv });
    } catch {
      console.warn('⚠️  Chromium install failed — will try system browser.');
    }
  }

  console.log('✅ Playwright + Chromium installed.');
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
    console.log(`🔗 Connecting to Chrome: ${connectCdp}`);
    _browser = await playwright.chromium.connectOverCDP(connectCdp);
  } else {
    _browser = await playwright.chromium.launch({
      headless,
      args: [
        '--allow-file-access-from-files',
        '--disable-web-security',
        '--no-sandbox',
      ],
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

// ── Page helper ──────────────────────────────────────────────
/**
 * Open a new page, navigate to url, and wait for load.
 * Returns { page, context } — caller should close context when done.
 */
export async function openPage(playwright, url, options = {}) {
  const {
    headless = true,
    connectCdp,
    viewport = { width: 1280, height: 720 },
    waitMs = 0,
  } = options;

  const browser = await getBrowser(playwright, { headless, connectCdp });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }

  return { page, context };
}
