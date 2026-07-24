#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  acpPortFromHealthUrl,
  buildNpxLaunch,
  buildTrustedHostLaunch,
  ensureAcpUiRunning,
} from './acp-native-host.mjs';

const healthUrl = process.env.AXHUB_ACP_HEALTH_URL || 'http://localhost:32124/api/health';
const startupTimeoutMs = Number(process.env.AXHUB_ACP_STARTUP_TIMEOUT_MS || 30_000);
const retryDelayMs = Number(process.env.AXHUB_ACP_RETRY_DELAY_MS || 500);

function exactOrigin() {
  const id = String(process.env.AXHUB_EXTENSION_ID || '').trim();
  return /^[a-p]{32}$/u.test(id) ? `chrome-extension://${id}` : '';
}

export { buildNpxLaunch, buildTrustedHostLaunch };

function appendTrustedHost(origin) {
  if (!origin) return Promise.resolve(true);
  const launch = buildTrustedHostLaunch(
    process.platform,
    process.env,
    origin,
    acpPortFromHealthUrl(healthUrl),
  );
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(launch.command, launch.args, {
        cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: { ...process.env },
        detached: false,
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (error) {
      process.stderr.write(`Failed to append ACP trusted host: ${error.message}\n`);
      resolve(false);
      return;
    }
    child.once('error', (error) => {
      process.stderr.write(`Failed to append ACP trusted host: ${error.message}\n`);
      resolve(false);
    });
    child.once('close', (code) => resolve(code === 0));
  });
}

export async function main() {
  const origin = exactOrigin();
  try {
    const result = await ensureAcpUiRunning(origin, {
      healthUrl,
      startupTimeoutMs,
      retryDelayMs,
    });
    if (!(await appendTrustedHost(origin))) {
      process.stderr.write('ACP UI is healthy, but trusted host append failed.\n');
      return 1;
    }
    if (result.state === 'already_healthy') {
      process.stdout.write('ACP UI is already healthy; no start was requested.\n');
    } else if (result.state === 'startup_in_progress') {
      process.stdout.write('ACP UI startup was already in progress; reused the existing request.\n');
    } else {
      process.stdout.write(`ACP UI started and health is ready (pid=${result.pid ?? 'unknown'}).\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
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
