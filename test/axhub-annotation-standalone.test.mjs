import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const skillRoot = path.resolve(testDir, '../skills/axhub-annotation-standalone');

function read(relativePath) {
  return readFileSync(path.join(skillRoot, relativePath), 'utf8');
}

function resolveExecutableCommand(command, platform = process.platform) {
  try {
    const lookup = platform === 'win32' ? 'where.exe' : 'which';
    const output = execFileSync(lookup, [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/u)
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate && existsSync(candidate)) ?? null;
  } catch {
    return null;
  }
}

function findChromeExecutable(options = {}) {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const resolveCommand = options.resolveCommand
    ?? ((command) => resolveExecutableCommand(command, platform));
  const platformPath = platform === 'win32' ? path.win32 : path;
  const environmentCandidates = [
    environment.CHROME_BIN,
    environment.GOOGLE_CHROME_BIN,
  ];
  const platformCandidates = platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ]
    : platform === 'win32'
      ? [
          environment.PROGRAMFILES && platformPath.join(
            environment.PROGRAMFILES,
            'Google/Chrome/Application/chrome.exe',
          ),
          environment.PROGRAMFILES && platformPath.join(
            environment.PROGRAMFILES,
            'Microsoft/Edge/Application/msedge.exe',
          ),
          environment['PROGRAMFILES(X86)'] && platformPath.join(
            environment['PROGRAMFILES(X86)'],
            'Google/Chrome/Application/chrome.exe',
          ),
          environment['PROGRAMFILES(X86)'] && platformPath.join(
            environment['PROGRAMFILES(X86)'],
            'Microsoft/Edge/Application/msedge.exe',
          ),
          environment.LOCALAPPDATA && platformPath.join(
            environment.LOCALAPPDATA,
            'Google/Chrome/Application/chrome.exe',
          ),
          environment.LOCALAPPDATA && platformPath.join(
            environment.LOCALAPPDATA,
            'Microsoft/Edge/Application/msedge.exe',
          ),
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge',
          '/usr/bin/microsoft-edge-stable',
          '/usr/bin/microsoft-edge-beta',
          '/usr/bin/microsoft-edge-dev',
          '/snap/bin/chromium',
        ];
  const commandCandidates = platform === 'win32'
    ? ['chrome', 'chrome.exe', 'msedge', 'msedge.exe', 'chromium', 'chromium.exe']
    : [
        'google-chrome',
        'google-chrome-stable',
        'chromium',
        'chromium-browser',
        'microsoft-edge',
        'microsoft-edge-stable',
        'microsoft-edge-beta',
        'microsoft-edge-dev',
      ];

  const installedPath = [...environmentCandidates, ...platformCandidates]
    .filter(Boolean)
    .find((candidate) => fileExists(candidate));
  if (installedPath) return installedPath;

  for (const command of [...environmentCandidates, ...commandCandidates].filter(Boolean)) {
    const resolved = resolveCommand(command);
    if (resolved && fileExists(resolved)) return resolved;
  }
  return undefined;
}

const closedProcesses = new WeakSet();

function waitForProcessExit(child, timeoutMs) {
  if (closedProcesses.has(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.off('close', onClose);
      child.off('error', onError);
      resolve(exited);
    };
    const onClose = () => {
      closedProcesses.add(child);
      finish(true);
    };
    const onError = () => {
      closedProcesses.add(child);
      finish(true);
    };
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once('close', onClose);
    child.once('error', onError);
  });
}

function readBrowserBundle() {
  const revision = process.env.AXHUB_ANNOTATION_BUNDLE_REV?.trim();
  if (!revision) {
    return read('references/axhub-annotation.global.js');
  }
  return execFileSync(
    'git',
    ['show', `${revision}:skills/axhub-annotation-standalone/references/axhub-annotation.global.js`],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
}

async function runChrome(chromeExecutable, fixtureUrl, userDataDir) {
  const child = spawn(chromeExecutable, [
    '--headless=new',
    '--allow-file-access-from-files',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-default-browser-check',
    '--no-first-run',
    '--no-sandbox',
    '--remote-debugging-pipe',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const commandInput = child.stdio[3];
  const commandOutput = child.stdio[4];
  assert.ok(commandInput && commandOutput, 'Chrome did not expose its DevTools pipe.');

  let stderr = '';
  let nextId = 1;
  let outputBuffer = Buffer.alloc(0);
  const pending = new Map();
  const rejectPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  };
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.once('error', (error) => {
    closedProcesses.add(child);
    rejectPending(error);
  });
  child.once('close', (code, signal) => {
    closedProcesses.add(child);
    if (pending.size === 0) return;
    rejectPending(new Error(`Chrome closed before CDP completed (${code ?? signal ?? 'unknown'}).`));
  });
  commandInput.once('error', (error) => rejectPending(error));
  commandOutput.once('error', (error) => rejectPending(error));
  commandOutput.on('data', (chunk) => {
    outputBuffer = Buffer.concat([outputBuffer, chunk]);
    let delimiterIndex = outputBuffer.indexOf(0);
    while (delimiterIndex >= 0) {
      const rawMessage = outputBuffer.subarray(0, delimiterIndex).toString('utf8');
      outputBuffer = outputBuffer.subarray(delimiterIndex + 1);
      delimiterIndex = outputBuffer.indexOf(0);
      if (!rawMessage) continue;
      const message = JSON.parse(rawMessage);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) {
        request.reject(new Error(`${request.method}: ${message.error.message}`));
      } else {
        request.resolve(message.result || {});
      }
    }
  });

  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out: ${stderr.trim()}`));
    }, 10_000);
    pending.set(id, { method, resolve, reject, timeout });
    commandInput.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
  });

  try {
    const { targetId } = await send('Target.createTarget', { url: fixtureUrl });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const evaluation = await send('Runtime.evaluate', {
        expression: "document.getElementById('test-result')?.textContent || null",
        returnByValue: true,
      }, sessionId);
      const value = evaluation.result?.value;
      if (typeof value === 'string' && value !== 'pending') {
        return value;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Browser fixture timed out: ${stderr.trim()}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([
        send('Browser.close').catch(() => {}),
        waitForProcessExit(child, 2_000),
      ]);
    }
    if (!await waitForProcessExit(child, 2_000)) {
      child.kill('SIGTERM');
    }
    if (!await waitForProcessExit(child, 2_000)) {
      child.kill('SIGKILL');
    }
    assert.equal(
      await waitForProcessExit(child, 2_000),
      true,
      'Headless browser did not exit after Browser.close and termination fallbacks.',
    );
  }
}

function createBrowserFixture() {
  return String.raw`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      [data-annotation-id] { position: fixed; width: 160px; height: 48px; }
      [data-annotation-id="background-target"] { left: 24px; top: 24px; }
      .test-modal-layer {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.4);
      }
      .test-modal-layer[hidden] { display: none; }
      .test-modal-layer [data-annotation-id] { position: static; }
    </style>
  </head>
  <body>
    <button data-annotation-id="background-target">Background</button>
    <div class="test-modal-layer" data-open="false" hidden>
      <button data-annotation-id="foreground-target">Foreground</button>
    </div>
    <pre id="test-result">pending</pre>
    <script src="./axhub-annotation.global.js"></script>
    <script>
      const source = {
        documentVersion: 1,
        format: 'axhub-annotation-source',
        presentation: {
          layerSelectors: ['.test-modal-layer[data-open="true"]'],
        },
        data: {
          version: 2,
          prototypeName: 'foreground-layer-browser-test',
          pageId: 'overview',
          nodes: [
            {
              id: 'background-node',
              index: 1,
              pageId: 'overview',
              locator: {
                selectors: ['[data-annotation-id="background-target"]'],
                fingerprint: 'button|background-target',
                path: [],
              },
              aiPrompt: '',
              annotationText: 'Background marker',
              hasMarkdown: false,
              color: '#0F766E',
              images: [],
            },
            {
              id: 'foreground-node',
              index: 2,
              pageId: 'overview',
              locator: {
                selectors: ['[data-annotation-id="foreground-target"]'],
                fingerprint: 'button|foreground-target',
                path: [],
              },
              aiPrompt: '',
              annotationText: 'Foreground marker',
              hasMarkdown: false,
              color: '#E11D48',
              images: [],
            },
          ],
        },
      };

      const viewer = AxhubAnnotation.createAnnotationViewer({
        source,
        options: {
          currentPageId: 'overview',
          showToolbar: false,
          showThemeToggle: false,
          showColorFilter: false,
          showBrandLink: false,
        },
      });
      const modal = document.querySelector('.test-modal-layer');
      const result = document.getElementById('test-result');
      const waitForMarkers = () => new Promise((resolve) => setTimeout(resolve, 250));
      const visibleMarkerIds = () => {
        const shadowRoot = document.getElementById('__axhub_annotation_host__')?.shadowRoot;
        if (!shadowRoot) return [];
        return Array.from(shadowRoot.querySelectorAll('[data-axhub-annotation-marker="true"]'))
          .filter((marker) => getComputedStyle(marker).display !== 'none')
          .map((marker) => marker.getAttribute('data-axhub-annotation-node-id'))
          .filter(Boolean)
          .sort();
      };

      void (async () => {
        await viewer.start();
        await waitForMarkers();
        const closed = visibleMarkerIds();

        modal.hidden = false;
        modal.dataset.open = 'true';
        viewer.refresh();
        await waitForMarkers();
        const open = visibleMarkerIds();

        modal.dataset.open = 'false';
        modal.hidden = true;
        viewer.refresh();
        await waitForMarkers();
        const reclosed = visibleMarkerIds();

        result.textContent = JSON.stringify({ closed, open, reclosed });
        viewer.stop();
      })().catch((error) => {
        result.textContent = JSON.stringify({ error: String(error?.stack || error) });
      });
    </script>
  </body>
</html>`;
}

test('standalone annotation skill demonstrates configurable foreground layers', () => {
  const skill = read('SKILL.md');
  const reactExample = read('references/react-example.tsx');
  const htmlExample = read('references/html-example.html');
  const source = JSON.parse(read('references/annotation-source.json'));

  assert.match(skill, /presentation\.layerSelectors/u);
  assert.deepEqual(source.presentation?.layerSelectors, [
    '.example-modal-layer[data-open="true"]',
  ]);
  assert.ok(source.data.nodes.some((node) => node.id === 'modal-background-target'));
  assert.ok(source.data.nodes.some((node) => node.id === 'modal-content-target'));
  assert.match(reactExample, /className="example-modal-layer"/u);
  assert.match(reactExample, /data-annotation-id="modal-content-target"/u);
  assert.match(reactExample, /position: 'fixed'/u);
  assert.match(reactExample, /background: 'rgba\(17, 24, 39, 0\.5\)'/u);
  assert.match(htmlExample, /class="example-modal-layer"/u);
  assert.match(htmlExample, /data-annotation-id="modal-content-target"/u);
});

test('browser discovery supports Edge installations and PATH commands', () => {
  const windowsEdge = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.equal(findChromeExecutable({
    platform: 'win32',
    environment: { PROGRAMFILES: 'C:\\Program Files' },
    fileExists: (candidate) => candidate === windowsEdge,
    resolveCommand: () => null,
  }), windowsEdge);

  assert.equal(findChromeExecutable({
    platform: 'linux',
    environment: { CHROME_BIN: 'microsoft-edge-stable' },
    fileExists: (candidate) => candidate === '/opt/microsoft/msedge',
    resolveCommand: (command) => (
      command === 'microsoft-edge-stable' ? '/opt/microsoft/msedge' : null
    ),
  }), '/opt/microsoft/msedge');
});

test('browser cleanup waits for process close and reports timeout', async () => {
  const closingProcess = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });
  const closing = waitForProcessExit(closingProcess, 50);
  queueMicrotask(() => {
    closingProcess.exitCode = 0;
    closingProcess.emit('close', 0, null);
  });
  assert.equal(await closing, true);

  const stuckProcess = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });
  assert.equal(await waitForProcessExit(stuckProcess, 5), false);
});

test('browser bundle filters markers to the active foreground layer', { timeout: 30_000 }, async () => {
  const chromeExecutable = findChromeExecutable();
  assert.ok(
    chromeExecutable,
    'Chrome, Chromium, or Edge is required for the annotation browser smoke test.',
  );

  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'axhub-annotation-browser-'));
  try {
    const htmlPath = path.join(fixtureDir, 'foreground-layer.html');
    const bundlePath = path.join(fixtureDir, 'axhub-annotation.global.js');
    writeFileSync(htmlPath, createBrowserFixture(), 'utf8');
    writeFileSync(bundlePath, readBrowserBundle(), 'utf8');

    const serializedResult = await runChrome(
      chromeExecutable,
      pathToFileURL(htmlPath).href,
      path.join(fixtureDir, 'chrome-profile'),
    );
    assert.deepEqual(JSON.parse(serializedResult), {
      closed: ['background-node'],
      open: ['foreground-node'],
      reclosed: ['background-node'],
    });
  } finally {
    rmSync(fixtureDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});
