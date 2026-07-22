#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const healthUrl = process.env.AXHUB_ACP_HEALTH_URL || 'http://localhost:32124/api/health';
const startupTimeoutMs = Number(process.env.AXHUB_ACP_STARTUP_TIMEOUT_MS || 30_000);
const retryDelayMs = Number(process.env.AXHUB_ACP_RETRY_DELAY_MS || 500);

async function probeHealth() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return response.ok && body?.status === 'ok' && body?.service === 'acp-ui';
  } catch {
    return false;
  }
}

function exactOrigin() {
  const id = String(process.env.AXHUB_EXTENSION_ID || '').trim();
  return /^[a-p]{32}$/u.test(id) ? `chrome-extension://${id}` : '';
}

export function buildNpxLaunch(platform, environment) {
  const args = ['-y', '@axhub/acp@latest'];
  if (platform === 'win32') {
    return {
      command: environment.ComSpec || environment.COMSPEC || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx.cmd', ...args],
    };
  }
  return { command: 'npx', args };
}

function startNpx() {
  const launch = buildNpxLaunch(process.platform, process.env);
  const origin = exactOrigin();
  const env = { ...process.env };
  delete env.ACP_UI_TRUSTED_HOST_ORIGINS;
  delete env.ACP_UI_CORS_ORIGINS;
  if (origin) {
    env.ACP_UI_TRUSTED_HOST_ORIGINS = origin;
    env.ACP_UI_CORS_ORIGINS = origin;
  }
  const child = spawn(launch.command, launch.args, {
    cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
    detached: true,
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
    env,
  });
  child.on('error', (error) => {
    process.stderr.write(`Failed to spawn ACP UI: ${error.message}\n`);
  });
  child.unref();
  return child;
}

export async function main() {
  if (await probeHealth()) {
    process.stdout.write('ACP UI is already healthy; no start was requested.\n');
    return 0;
  }

  const child = startNpx();
  process.stdout.write(`Requested ACP UI start (pid=${child.pid ?? 'unknown'}); waiting for health.\n`);
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    if (await probeHealth()) {
      process.stdout.write('ACP UI health is ready.\n');
      return 0;
    }
  }

  process.stderr.write(`ACP UI did not become healthy within ${startupTimeoutMs}ms.\n`);
  return 1;
}

function realFilePath(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

const isDirectRun =
  process.argv[1] &&
  realFilePath(process.argv[1]) === realFilePath(fileURLToPath(import.meta.url));
if (isDirectRun) process.exitCode = await main();
