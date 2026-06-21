import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createInjectedFunction, createInjectedFunctionBody } from './injected-function.mjs';
import { runAssets } from './assets.mjs';
import { runSectionStyles } from './section-styles.mjs';
import { runSkeleton } from './skeleton.mjs';

test('creates functions from commented IIFE inject scripts', () => {
  const script = `/**
 * comment
 */
(function sample() {
  return 'ok';
})`;

  assert.equal(createInjectedFunctionBody(script), `return (${script})`);
  assert.equal(createInjectedFunction(script)(), 'ok');
});

test('runSkeleton passes script and selector as one evaluate argument', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-page-skeleton-'));
  const calls = [];
  const page = {
    async evaluate(pageFunction, arg) {
      calls.push({ pageFunction, arg, argCount: arguments.length });
      if (calls.length === 1) {
        return { root: 'n1', nodeCount: 1, nodes: { n1: { tag: 'main' } } };
      }
      return { url: 'https://example.com/', title: 'Example' };
    },
  };

  try {
    await runSkeleton(page, outputDir, { rootSelector: 'main' });
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  assert.equal(calls[0].argCount, 2);
  assert.equal(typeof calls[0].arg.script, 'string');
  assert.match(calls[0].arg.script, /^return \(/);
  assert.equal(calls[0].arg.selector, 'main');
});

test('runSectionStyles passes script and selector as one evaluate argument', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-page-section-'));
  const calls = [];
  const page = {
    async evaluate(pageFunction, arg) {
      calls.push({ pageFunction, arg, argCount: arguments.length });
      return { selector: 'header', nodeCount: 0, nodes: {}, styleCount: 0, styles: {} };
    },
    locator() {
      return {
        first() {
          return {
            async screenshot() {},
          };
        },
      };
    },
  };

  try {
    await runSectionStyles(page, outputDir, { selector: 'header' });
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  assert.equal(calls[0].argCount, 2);
  assert.equal(typeof calls[0].arg.script, 'string');
  assert.match(calls[0].arg.script, /^return \(/);
  assert.equal(calls[0].arg.selector, 'header');
});

test('runAssets passes script as one evaluate argument', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-page-assets-'));
  const calls = [];
  const page = {
    async evaluate(pageFunction, arg) {
      calls.push({ pageFunction, arg, argCount: arguments.length });
      return { images: [], fonts: [], svgs: [] };
    },
  };

  try {
    await runAssets(page, outputDir);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  assert.equal(calls[0].argCount, 2);
  assert.equal(typeof calls[0].arg.script, 'string');
  assert.match(calls[0].arg.script, /^return \(/);
});
