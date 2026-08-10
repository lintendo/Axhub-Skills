#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { fetchArtifact } from './lib/fetch-artifact.mjs';
import { CONTRACT, search } from './lib/index.mjs';

export const DEFAULT_MANIFEST_URL = 'https://lintendo.github.io/Make-Template/knowledge/latest/manifest.json';
const DEFAULT_ALLOWED_ORIGIN = 'https://lintendo.github.io';
const DEFAULT_ALLOWED_BASE_PATH = '/Make-Template/knowledge/';

export function resolveSearchSource(options = {}) {
  if (options.indexPath || options.index) {
    return options.indexPath ? { indexPath: options.indexPath } : { index: options.index };
  }
  if (options.manifestUrl) return { manifestUrl: options.manifestUrl };
  return {
    manifestUrl: DEFAULT_MANIFEST_URL,
    allowedOrigin: DEFAULT_ALLOWED_ORIGIN,
    allowedBasePath: DEFAULT_ALLOWED_BASE_PATH,
  };
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'search';
  const options = { command };
  while (args.length > 0) {
    const flag = args.shift();
    if (flag === '--offline') options.offline = true;
    else if (flag === '--allow-stale-cache') options.allowStaleCache = true;
    else {
      const value = args.shift();
      if (value === undefined) throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST', details: { flag } });
      const key = {
        '--request': 'requestPath',
        '--index': 'indexPath',
        '--manifest': 'manifestUrl',
        '--cache': 'cacheDir',
        '--local-root': 'localRoot',
        '--allowed-origin': 'allowedOrigin',
        '--allowed-base-path': 'allowedBasePath',
        '--expected-hash': 'expectedHash',
        '--cached-index-hash': 'cachedIndexHash',
        '--kind': 'kind',
      }[flag];
      if (!key) throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST', details: { flag } });
      options[key] = value;
    }
  }
  return options;
}

async function stdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readInput(file) {
  return JSON.parse(file ? await fs.readFile(file, 'utf8') : await stdin());
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const input = await readInput(options.requestPath);
  if (options.command === 'search') return search(input, { ...options, ...resolveSearchSource(options) });
  if (options.command === 'fetch') return fetchArtifact(input, {
    ...(!options.allowedOrigin ? {
      allowedOrigin: DEFAULT_ALLOWED_ORIGIN,
      allowedBasePath: DEFAULT_ALLOWED_BASE_PATH,
    } : {}),
    ...options,
  });
  throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST', details: { command: options.command } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: CONTRACT.schemaVersion,
      taxonomyVersion: CONTRACT.taxonomyVersion,
      searchContractVersion: CONTRACT.searchContractVersion,
      results: [],
      error: { code: error?.code ?? 'INVALID_REQUEST', details: error?.details ?? {} },
    })}\n`);
    process.exitCode = 1;
  }
}

export { search, fetchArtifact };
