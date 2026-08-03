#!/usr/bin/env node

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const RUNTIME_PATH = join(SKILL_DIR, 'assets', 'webpage-to-figma-runtime.js');
const OFFICIAL_SCRIPT_CACHE_DIR = join(SKILL_DIR, '.cache', 'figma-official-capture');
const OFFICIAL_SCRIPT_FILENAME = 'capture.js';
const OFFICIAL_SCRIPT_METADATA_FILENAME = 'metadata.json';
const PLAYWRIGHT_VERSION = '1.62.1';
const PLAYWRIGHT_CACHE = join(tmpdir(), 'axhub-webpage-to-figma');
const AXHUB_EXTENSION_URL = 'https://axhub.im/chrome/';
const MIME_TYPES = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const MACOS_PASTEBOARD_JXA = `
ObjC.import('AppKit');
ObjC.import('Foundation');

const environment = $.NSProcessInfo.processInfo.environment;
const sourcePath = ObjC.unwrap(environment.objectForKey('AXHUB_FIGMA_HTML_SOURCE'));
const resultPath = ObjC.unwrap(environment.objectForKey('AXHUB_FIGMA_HTML_RESULT'));
if (!sourcePath || !resultPath) throw new Error('missing clipboard file paths');

const sourceData = $.NSData.dataWithContentsOfFile($(sourcePath));
if (!sourceData) throw new Error('unable to read clipboard source data');

const pasteboard = $.NSPasteboard.generalPasteboard;
pasteboard.clearContents;
if (!pasteboard.setDataForType(sourceData, $('public.html'))) {
  throw new Error('NSPasteboard rejected public.html');
}

const resultData = pasteboard.dataForType($('public.html'));
if (!resultData) throw new Error('public.html was not available after writing');
if (!resultData.writeToFileAtomically($(resultPath), true)) {
  throw new Error('unable to read public.html after writing');
}
`;

const bounded = (value, max = 300) => String(value || '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '').trim().slice(0, max);

function usage() {
  process.stdout.write(`网页 → Figma 剪贴板（不使用 MCP）

用法：
  webpage-to-figma.mjs --source <网页 URL|HTML 文件|HTML 字符串>
    [--selector <CSS 选择器>] [--timeout <毫秒>]
    [--browser-executable <浏览器路径>] [--manual]
    [--official-script <官方 capture.js URL|cached|本地 JS 文件>]

脚本把 Figma 官方 H2D 剪贴板数据写入系统剪贴板；用户随后在 Figma 中按 Cmd/Ctrl+V。
大载荷不会静默删除图片；结果会报告总资源、已嵌入资源和缺失资源数量。
自动写入失败时，会在网页中显示“复制到 Figma”按钮并等待用户点击。
React/Vue 等项目请先启动开发服务器，再把实际网页 URL 作为 --source。
只有用户明确提供 --official-script URL 时才会下载官方脚本；脚本会保存到本技能的 .cache 目录，后续可用 cached 复用。
`);
}

export function parseArgs(argv) {
  const args = { selector: 'body', timeout: 60_000, manual: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--manual') {
      args.manual = true;
      continue;
    }
    const key = token.startsWith('--') ? token.slice(2) : '';
    if (!key || !['source', 'selector', 'timeout', 'browser-executable', 'official-script'].includes(key)) {
      throw new Error(`未知参数：${token}`);
    }
    const value = argv[++index];
    if (!value) throw new Error(`${token} 需要参数值。`);
    if (key === 'timeout') args.timeout = Math.max(1_000, Number(value) || 60_000);
    else if (key === 'browser-executable') args.browserExecutable = value;
    else if (key === 'official-script') args.officialScript = value;
    else args[key] = value;
  }
  if (!args.source) throw new Error('--source 是必填参数。');
  return args;
}

function officialScriptCachePaths(cacheDir = OFFICIAL_SCRIPT_CACHE_DIR) {
  return {
    directory: cacheDir,
    script: join(cacheDir, OFFICIAL_SCRIPT_FILENAME),
    metadata: join(cacheDir, OFFICIAL_SCRIPT_METADATA_FILENAME),
  };
}

function readOfficialScriptMetadata(metadataPath) {
  if (!existsSync(metadataPath)) return null;
  try {
    return JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

function validateOfficialScript(source, origin) {
  if (typeof source !== 'string' || source.trim().length < 256) {
    throw new Error(`官方脚本内容为空或过短：${origin}`);
  }
  if (!/captureForDesign/u.test(source)) {
    throw new Error(`官方脚本未提供 captureForDesign：${origin}`);
  }
  return source;
}

export async function resolveOfficialScript(spec, dependencies = {}) {
  if (!spec) return null;

  const paths = officialScriptCachePaths(dependencies.officialScriptCacheDir);
  if (spec === 'cached') {
    if (!existsSync(paths.script)) {
      throw new Error(`找不到已缓存的官方脚本：${paths.script}；请先提供 --official-script <官方 URL>`);
    }
    validateOfficialScript(readFileSync(paths.script, 'utf8'), paths.script);
    const metadata = readOfficialScriptMetadata(paths.metadata);
    return {
      path: paths.script,
      source: metadata?.sourceUrl || 'cached',
      cached: true,
      downloaded: false,
    };
  }

  let sourceUrl;
  try {
    const url = new URL(spec);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    sourceUrl = url.toString();
  } catch {
    const localPath = resolve(spec);
    if (!existsSync(localPath) || !statSync(localPath).isFile()) {
      throw new Error(`官方脚本必须是 HTTP(S) URL、cached 或本地 JS 文件：${spec}`);
    }
    const source = validateOfficialScript(readFileSync(localPath, 'utf8'), localPath);
    mkdirSync(paths.directory, { recursive: true });
    writeFileSync(paths.script, source);
    writeFileSync(paths.metadata, JSON.stringify({ sourcePath: localPath, cachedAt: new Date().toISOString() }, null, 2));
    return { path: paths.script, source: localPath, cached: true, downloaded: false };
  }

  const metadata = readOfficialScriptMetadata(paths.metadata);
  if (metadata?.sourceUrl === sourceUrl && existsSync(paths.script)) {
    validateOfficialScript(readFileSync(paths.script, 'utf8'), paths.script);
    return { path: paths.script, source: sourceUrl, cached: true, downloaded: false };
  }

  const fetchImpl = dependencies.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('当前 Node.js 没有可用的 fetch，无法下载官方脚本。');
  let response;
  try {
    response = await fetchImpl(sourceUrl);
  } catch (error) {
    throw new Error(`下载官方脚本失败：${bounded(error.message || error)}`);
  }
  if (!response?.ok) throw new Error(`下载官方脚本失败：HTTP ${response?.status || 'unknown'}`);
  const source = validateOfficialScript(await response.text(), sourceUrl);
  mkdirSync(paths.directory, { recursive: true });
  writeFileSync(paths.script, source);
  writeFileSync(paths.metadata, JSON.stringify({ sourceUrl, cachedAt: new Date().toISOString() }, null, 2));
  return { path: paths.script, source: sourceUrl, cached: true, downloaded: true };
}

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const resolved = require.resolve(candidate);
      return await import(pathToFileURL(resolved).href);
    } catch {
      // Try the next locally available runtime.
    }
  }

  mkdirSync(PLAYWRIGHT_CACHE, { recursive: true });
  const packagePath = join(PLAYWRIGHT_CACHE, 'node_modules', 'playwright-core', 'index.mjs');
  if (!existsSync(packagePath)) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
      execFileSync(npm, [
        'install', '--no-save', '--no-package-lock', '--prefix', PLAYWRIGHT_CACHE,
        `playwright-core@${PLAYWRIGHT_VERSION}`,
      ], { stdio: 'ignore' });
    } catch (error) {
      throw new Error(`无法加载 Playwright。请安装 playwright-core，或设置 PLAYWRIGHT_MODULE：${bounded(error.message)}`);
    }
  }
  return import(pathToFileURL(packagePath).href);
}

function browserExecutable(explicit) {
  if (explicit) return explicit;
  const candidates = process.platform === 'darwin'
    ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
    : process.platform === 'win32'
      ? [
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
        process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
      ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.filter(Boolean).find(existsSync) || null;
}

export function verifyClipboardPayload(expectedBytes, actualBytes) {
  const expected = Buffer.from(expectedBytes);
  const actual = Buffer.from(actualBytes);
  const expectedDigest = createHash('sha256').update(expected).digest('hex');
  const actualDigest = createHash('sha256').update(actual).digest('hex');
  const byteLengthMatch = expected.byteLength === actual.byteLength;
  const payloadDigestMatch = expectedDigest === actualDigest;
  return {
    expectedBytes: expected.byteLength,
    actualBytes: actual.byteLength,
    payloadDigestMatch,
    clipboardHtmlVerified: byteLengthMatch && payloadDigestMatch,
  };
}

export function writeMacOSClipboardHtml(htmlBase64, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'darwin') {
    return { supported: false, clipboardHtmlVerified: null };
  }
  if (typeof htmlBase64 !== 'string' || htmlBase64.length === 0) {
    throw new Error('网页剪贴板数据为空');
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'axhub-figma-clipboard-'));
  const sourcePath = join(temporaryDirectory, 'expected.html');
  const resultPath = join(temporaryDirectory, 'actual.html');
  const expectedBytes = Buffer.from(htmlBase64, 'base64');
  try {
    writeFileSync(sourcePath, expectedBytes);
    const execFile = options.execFile || execFileSync;
    execFile('osascript', ['-l', 'JavaScript', '-e', MACOS_PASTEBOARD_JXA], {
      env: {
        ...process.env,
        AXHUB_FIGMA_HTML_SOURCE: sourcePath,
        AXHUB_FIGMA_HTML_RESULT: resultPath,
      },
      encoding: 'utf8',
    });
    if (!existsSync(resultPath)) {
      throw new Error('NSPasteboard 未返回 public.html 数据');
    }
    const verification = verifyClipboardPayload(expectedBytes, readFileSync(resultPath));
    if (!verification.clipboardHtmlVerified) {
      throw new Error('NSPasteboard 回读的 public.html 与生成内容不一致');
    }
    return {
      supported: true,
      clipboardWriter: 'macos-native',
      ...verification,
    };
  } catch (error) {
    throw new Error(`macOS 原生剪贴板写入失败：${bounded(error.message || error)}`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function validateCaptureResult(result) {
  const normalized = result || { success: true };
  const missingAssetCount = Number(normalized.missingAssetCount || 0);
  if (normalized.success === false || missingAssetCount > 0) {
    const assetSummary = Number.isFinite(normalized.assetCount)
      ? `捕获 ${normalized.assetCount} 个资源，缺失 ${missingAssetCount} 个`
      : '网页资源未完整嵌入';
    const detail = normalized.error ? `：${normalized.error}` : '';
    throw new Error(`${assetSummary}，未写入可用的 Figma 剪贴板${detail}`);
  }
  return normalized;
}

function finalizeClipboardResult(result) {
  const validated = validateCaptureResult(result);
  return {
    ...validated,
    clipboardHtmlVerified: null,
  };
}

function closeServer(server) {
  return new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

async function serveLocalFile(filePath) {
  const absolutePath = resolve(filePath);
  const root = dirname(absolutePath);
  const filename = basename(absolutePath);
  const server = createServer((request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const requestedRelativePath = requestPath.startsWith('/__axhub__/')
        ? requestPath.slice('/__axhub__/'.length)
        : requestPath.replace(/^\/+/, '');
      const resolvedPath = resolve(root, requestedRelativePath);
      const isInsideRoot = relative(root, resolvedPath) && !relative(root, resolvedPath).startsWith('..');
      if (!isInsideRoot || !existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': MIME_TYPES[extname(resolvedPath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(readFileSync(resolvedPath));
    } catch {
      response.writeHead(400);
      response.end('Bad request');
    }
  });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}/__axhub__/${encodeURIComponent(filename)}`,
  };
}

export async function prepareSource(source) {
  try {
    const url = new URL(source);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { url: url.toString(), close: async () => {} };
    }
  } catch {
    // Treat non-URLs as a local file or inline HTML.
  }

  const localPath = resolve(source);
  if (existsSync(localPath) && statSync(localPath).isFile()) {
    if (!['.html', '.htm'].includes(extname(localPath).toLowerCase())) {
      throw new Error('本地源必须是 HTML 文件；React/Vue 等项目请先启动开发服务器并传入网页 URL。');
    }
    const served = await serveLocalFile(localPath);
    return { url: served.url, close: () => closeServer(served.server) };
  }

  if (/^\s*</u.test(source)) {
    const directory = join(tmpdir(), `axhub-webpage-${process.pid}-${Date.now()}`);
    mkdirSync(directory, { recursive: true });
    const htmlPath = join(directory, 'index.html');
    writeFileSync(htmlPath, source);
    const served = await serveLocalFile(htmlPath);
    return {
      url: served.url,
      close: async () => {
        await closeServer(served.server);
        rmSync(directory, { recursive: true, force: true });
      },
    };
  }

  throw new Error(`找不到网页源：${source}`);
}

async function waitForDomReady(page, timeout) {
  await page.evaluate(async (maximum) => Promise.race([
    (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
    })(),
    new Promise((resolvePromise) => setTimeout(resolvePromise, maximum)),
  ]), Math.min(timeout, 12_000));
  await page.evaluate(({ maximum, quiet }) => new Promise((resolvePromise) => {
    let quietTimer;
    let maximumTimer;
    const finish = () => {
      clearTimeout(quietTimer);
      clearTimeout(maximumTimer);
      observer.disconnect();
      resolvePromise();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quiet);
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    quietTimer = setTimeout(finish, quiet);
    maximumTimer = setTimeout(finish, maximum);
  }), { maximum: Math.min(timeout, 4_000), quiet: 500 });
}

async function openPage(playwright, args, sourceUrl, { headless, officialScriptPath }) {
  const executablePath = browserExecutable(args.browserExecutable);
  const launchOptions = {
    headless,
    args: ['--disable-web-security'],
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  else launchOptions.channel = 'chrome';
  const browser = await playwright.chromium.launch(launchOptions);
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(sourceUrl).origin }).catch(() => {});
    const page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: args.timeout });
    await waitForDomReady(page, args.timeout);
    await page.addScriptTag({ path: RUNTIME_PATH });
    if (officialScriptPath) await page.addScriptTag({ path: officialScriptPath });
    return { browser, context, page };
  } catch (error) {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

async function closeBrowser(browserState) {
  await browserState?.context?.close().catch(() => {});
  await browserState?.browser?.close().catch(() => {});
}

async function copyFromPage(page, selector) {
  const result = await page.evaluate(async (targetSelector) => {
    document.getElementById('__axhub_webpage_to_figma_fallback__')?.remove();
    const runtime = window.__AXHUB_WEBPAGE_TO_FIGMA__;
    if (!runtime || typeof runtime.copy !== 'function') {
      throw new Error('网页复制运行时未加载');
    }
    return runtime.copy({ selector: targetSelector });
  }, selector);
  return validateCaptureResult(result);
}

async function serializeFromPage(page, selector) {
  const result = await page.evaluate(async (targetSelector) => {
    document.getElementById('__axhub_webpage_to_figma_fallback__')?.remove();
    const runtime = window.__AXHUB_WEBPAGE_TO_FIGMA__;
    if (!runtime || typeof runtime.serialize !== 'function') {
      throw new Error('网页剪贴板序列化运行时未加载');
    }
    return runtime.serialize({ selector: targetSelector });
  }, selector);
  const validated = validateCaptureResult(result);
  if (typeof validated.htmlBase64 !== 'string' || validated.htmlBase64.length === 0) {
    throw new Error('网页剪贴板运行时没有返回 H2D HTML 数据');
  }
  return validated;
}

export async function copyFromOfficialPage(page, selector) {
  const result = await page.evaluate(async (targetSelector) => {
    document.getElementById('__axhub_webpage_to_figma_fallback__')?.remove();
    if (!window.figma || typeof window.figma.captureForDesign !== 'function') {
      throw new Error('Figma 官方 capture.js 未加载');
    }
    return window.figma.captureForDesign({ selector: targetSelector });
  }, selector);
  if (result?.success === false) {
    throw new Error(result.error || 'Figma 官方脚本未能写入剪贴板');
  }
  return validateCaptureResult(result || { success: true });
}

async function waitForOfficialUserCopy(page, timeout) {
  if (typeof page.waitForEvent !== 'function') return;
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, timeout);
    page.waitForEvent('close').then(
      () => {
        clearTimeout(timer);
        resolvePromise();
      },
      () => {
        clearTimeout(timer);
        resolvePromise();
      },
    );
  });
}

export function buildFallbackButtonMarkup(extensionUrl = AXHUB_EXTENSION_URL) {
  return `
    <aside id="__axhub_webpage_to_figma_fallback__" style="position:fixed;z-index:2147483647;right:24px;bottom:24px;width:320px;padding:16px;border:1px solid #d9d9d9;border-radius:10px;background:#fff;color:#171717;box-shadow:0 12px 36px rgba(0,0,0,.18);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <strong style="display:block;margin-bottom:8px">网页已准备好</strong>
      <p style="margin:0 0 12px">浏览器不允许自动写入剪贴板，请点击按钮后到 Figma 粘贴。</p>
      <button id="__axhub_webpage_to_figma_copy__" type="button" style="width:100%;padding:9px 12px;border:0;border-radius:6px;background:#18a058;color:#fff;cursor:pointer;font:inherit">复制到 Figma</button>
      <a href="${extensionUrl}" target="_blank" rel="noreferrer" style="display:block;margin-top:10px;color:#1677ff">使用 Axhub 扩展复制</a>
      <span id="__axhub_webpage_to_figma_status__" role="status" style="display:block;margin-top:8px;color:#666"></span>
    </aside>`;
}

async function waitForManualCopy(page, selector, timeout) {
  await page.evaluate((markup) => {
    document.getElementById('__axhub_webpage_to_figma_fallback__')?.remove();
    document.body.insertAdjacentHTML('beforeend', markup);
  }, buildFallbackButtonMarkup());
  await page.evaluate((targetSelector) => {
    const button = document.getElementById('__axhub_webpage_to_figma_copy__');
    const status = document.getElementById('__axhub_webpage_to_figma_status__');
    button?.addEventListener('click', async () => {
      if (button instanceof HTMLButtonElement) button.disabled = true;
      if (status) status.textContent = '正在写入剪贴板…';
      try {
        const result = await window.__AXHUB_WEBPAGE_TO_FIGMA__.copy({ selector: targetSelector });
        if (result?.success === false || Number(result?.missingAssetCount || 0) > 0) {
          throw new Error(result?.error || `有 ${result?.missingAssetCount || 0} 个网页资源未能嵌入。`);
        }
        window.__AXHUB_WEBPAGE_TO_FIGMA_STATUS__ = { status: 'copied', result };
        if (status) status.textContent = '已复制，请到 Figma 粘贴。';
      } catch (error) {
        window.__AXHUB_WEBPAGE_TO_FIGMA_STATUS__ = { status: 'error', message: String(error) };
        if (status) status.textContent = `复制失败：${String(error)}`;
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  }, selector);
  await page.waitForFunction(
    () => ['copied', 'error'].includes(window.__AXHUB_WEBPAGE_TO_FIGMA_STATUS__?.status),
    null,
    { timeout },
  );
  const status = await page.evaluate(() => window.__AXHUB_WEBPAGE_TO_FIGMA_STATUS__);
  if (status.status === 'error') throw new Error(status.message || '网页复制失败');
  return validateCaptureResult(status.result);
}

export async function run(args, dependencies = {}) {
  if (!existsSync(RUNTIME_PATH)) throw new Error(`缺少网页剪贴板运行时：${RUNTIME_PATH}`);
  const officialScript = await resolveOfficialScript(args.officialScript, dependencies);
  const playwright = dependencies.playwright || await loadPlaywright();
  const source = await prepareSource(args.source);
  let browserState;
  try {
    if (!args.manual) {
      try {
        browserState = await openPage(playwright, args, source.url, {
          headless: true,
          officialScriptPath: officialScript?.path,
        });
        let result;
        let clipboardResult = { clipboardHtmlVerified: null };
        if (officialScript) {
          result = await copyFromOfficialPage(browserState.page, args.selector);
        } else if ((dependencies.platform || process.platform) === 'darwin') {
          const serialized = await serializeFromPage(browserState.page, args.selector);
          const { htmlBase64, ...captureResult } = serialized;
          result = captureResult;
          clipboardResult = writeMacOSClipboardHtml(htmlBase64, {
            platform: dependencies.platform || process.platform,
            execFile: dependencies.execFile,
          });
        } else {
          result = await copyFromPage(browserState.page, args.selector);
        }
        const verifiedResult = {
          ...finalizeClipboardResult(result),
          ...clipboardResult,
        };
        return {
          mode: 'clipboard',
          interaction: 'automatic',
          method: officialScript ? 'official-script' : 'axhub-runtime',
          sourceUrl: source.url,
          selector: args.selector,
          ...verifiedResult,
        };
      } catch (error) {
        await closeBrowser(browserState);
        browserState = undefined;
        process.stderr.write(`[webpage-to-figma] 自动复制失败，将打开可见页面：${bounded(error.message)}\n`);
      }
    }

    browserState = await openPage(playwright, args, source.url, {
      headless: false,
      officialScriptPath: officialScript?.path,
    });
    if (officialScript) {
      try {
        const result = await copyFromOfficialPage(browserState.page, args.selector);
        const verifiedResult = finalizeClipboardResult(result);
        return {
          mode: 'clipboard',
          interaction: 'official-script',
          method: 'official-script',
          sourceUrl: source.url,
          selector: args.selector,
          ...verifiedResult,
        };
      } catch (error) {
        process.stderr.write(
          `[webpage-to-figma] 无法自动写入剪贴板。请在已打开页面使用 Figma 官方按钮复制，完成后关闭页面：${bounded(error.message)}\n`,
        );
        await waitForOfficialUserCopy(browserState.page, args.timeout);
        return {
          mode: 'clipboard',
          interaction: 'official-button',
          method: 'official-script',
          sourceUrl: source.url,
          selector: args.selector,
          success: false,
          requiresUserCopy: true,
        };
      }
    }
    const result = await waitForManualCopy(browserState.page, args.selector, args.timeout);
    const verifiedResult = finalizeClipboardResult(result);
    return {
      mode: 'clipboard',
      interaction: 'manual-button',
      method: 'axhub-runtime',
      sourceUrl: source.url,
      selector: args.selector,
      ...verifiedResult,
    };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}；也可以安装 Axhub 扩展后在网页中使用“复制到 Figma”：${AXHUB_EXTENSION_URL}`);
  } finally {
    await closeBrowser(browserState);
    await source.close();
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }
  try {
    process.stderr.write('注意：复制到 Figma 会覆盖当前系统剪贴板，请先粘贴或保存其中的重要内容。\n');
    const result = await run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.requiresUserCopy) {
      process.stderr.write('请使用页面上的 Figma 官方按钮复制，再到目标 Figma 文件中按 Cmd/Ctrl+V。\n');
    } else if (result.clipboardHtmlVerified === true) {
      process.stderr.write('已确认系统剪贴板保留 Figma HTML 数据，请在目标 Figma 文件中按 Cmd/Ctrl+V。\n');
    } else {
      process.stderr.write('浏览器已完成复制请求，但当前系统无法校验 HTML 剪贴板格式；请在目标 Figma 文件中按 Cmd/Ctrl+V。\n');
    }
  } catch (error) {
    process.stderr.write(`网页 → Figma 失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
