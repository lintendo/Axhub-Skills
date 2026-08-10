import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { search, DesignKnowledgeSearchError } from '../skills/design-system-search/scripts/lib/index.mjs';
import { scoreRecord } from '../skills/design-system-search/scripts/lib/score.mjs';
import {
  cacheObject,
  readCachedObject,
  cacheKeyFor,
} from '../skills/design-system-search/scripts/lib/cache.mjs';
import { fetchArtifact } from '../skills/design-system-search/scripts/lib/fetch-artifact.mjs';

const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const execFileAsync = promisify(execFile);

function record({ id, platform = 'desktop', industries = [], styles = [], density = [], title = id, aliases = [], keywords = [], description = '', designMd = '', reviewStatus = 'deferred', publishable = false, avoid = [], packageUrl, packagePath, designMdPath, previewPath, previewImagePath }) {
  return {
    schemaVersion: 1,
    id,
    slug: id,
    platforms: [platform],
    searchable: true,
    reviewStatus,
    publishable,
    reasons: publishable ? [] : ['license-review-deferred'],
    title,
    aliases,
    keywords,
    description,
    designMd,
    semantic: {
      industries,
      productTypes: ['dashboard'],
      pageTypes: ['dashboard'],
      styles,
      brandTraits: ['precise'],
      density,
    },
    palette: { families: ['blue'], modes: ['dark'] },
    avoid,
    artifacts: {
      ...(designMdPath ? { designMdPath } : {}),
      ...(previewPath ? { previewPath } : {}),
      ...(previewImagePath ? { previewImagePath } : {}),
      ...(packageUrl ? { packageUrl } : {}),
      ...(packagePath ? { packagePath } : {}),
    },
  };
}

function indexWith(records, platform = 'desktop') {
  return {
    schemaVersion: 1,
    taxonomyVersion: '1.0.0',
    searchContractVersion: '1.0.0',
    tokenizationVersion: 'nfkc-intl-segmenter-v1',
    platform,
    records,
    postings: {},
  };
}

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    readerVersion: '1.0.0',
    platform: 'desktop',
    terms: [],
    hardFilters: {},
    softFilters: {},
    exclude: {},
    limit: 4,
    ...overrides,
  };
}

test('search applies hard filters, soft scoring, exclude, limits, and stable id sorting', async () => {
  const index = indexWith([
    record({ id: 'alpha', title: 'Alpha dashboard', industries: ['finance-payments'], styles: ['minimal'], density: ['medium'], keywords: ['blue', 'payments'] }),
    record({ id: 'beta', title: 'Beta dashboard', industries: ['finance-payments'], styles: ['professional'], density: ['high'], keywords: ['blue'] }),
    record({ id: 'gamma', title: 'Gamma dashboard', industries: ['health-fitness'], styles: ['minimal'], density: ['medium'], keywords: ['blue'] }),
    record({ id: 'delta', title: 'Delta dashboard', industries: ['finance-payments'], styles: ['playful'], density: ['medium'], avoid: ['playful'], keywords: ['blue'] }),
    record({ id: 'omega', title: 'Omega health', industries: ['health-fitness'], styles: ['professional'], density: ['low'] }),
    record({ id: 'zeta', title: 'Same dashboard', industries: ['finance-payments'], styles: ['minimal'], density: ['medium'], keywords: ['blue'] }),
  ]);
  const response = await search(request({
    terms: ['dashboard', 'blue'],
    hardFilters: { industries: ['finance-payments'] },
    softFilters: { styles: ['minimal'], density: ['medium'] },
    exclude: { styles: ['playful'] },
    limit: 3,
  }), { index });
  assert.equal(response.cacheVersion, sha256(JSON.stringify(index)));
  assert.deepEqual(response.resultSummary, { requested: 3, returned: 3 });
  assert.deepEqual(response.results.map((item) => item.id), ['alpha', 'zeta', 'beta']);
  assert.equal(response.results.length, 3);
  assert.deepEqual(response.results[0].matched.industries, ['finance-payments']);
  assert.deepEqual(response.results[0].unmatched.styles, []);
  assert.equal(response.results[0].scoreBreakdown.styles, 6);
  assert.equal(response.results[0].scoreBreakdown.title, 6);
  assert.equal(response.results[2].matched.styles.length, 0);
  assert.equal(response.results[2].unmatched.styles[0], 'minimal');

  for (const limit of [3, 4, 5, 6]) {
    const limited = await search(request({ limit }), { index });
    assert.equal(limited.results.length, limit);
  }
});

test('scoreRecord reports each requested field once and deduplicates query tokens', () => {
  const candidate = record({ id: 'demo', title: 'Demo dashboard', industries: ['finance-payments'], styles: ['minimal'], density: ['medium'], keywords: ['dashboard'] });
  const scored = scoreRecord(candidate, request({ terms: ['ＤＡＳＨＢＯＡＲＤ', 'dashboard'], softFilters: { styles: ['minimal'] } }));
  assert.equal(scored.scoreBreakdown.title, 6);
  assert.equal(scored.scoreBreakdown.keywords, 4);
  assert.equal(scored.scoreBreakdown.styles, 6);
  assert.deepEqual(scored.matched.terms, ['dashboard']);
});

test('search rejects unknown contract, schema, and incompatible reader versions', async () => {
  await assert.rejects(() => search(request(), { index: { ...indexWith([]), searchContractVersion: '9.0.0' } }), (error) => error.code === 'INCOMPATIBLE_SEARCH_CONTRACT_VERSION');
  await assert.rejects(() => search(request({ readerVersion: '2.0.0' }), { index: indexWith([]) }), (error) => error.code === 'INCOMPATIBLE_READER_VERSION');
  await assert.rejects(() => search(request({ schemaVersion: 2 }), { index: indexWith([]) }), (error) => error.code === 'UNSUPPORTED_SCHEMA_VERSION');
  await assert.rejects(() => search(request(), { index: { ...indexWith([]), taxonomyVersion: '9.0.0' } }), (error) => error.code === 'INCOMPATIBLE_TAXONOMY_VERSION');
});

test('search rejects invalid index records and an expected index hash mismatch', async () => {
  await assert.rejects(() => search(request(), { index: { ...indexWith([{ id: '../unsafe' }]) } }), (error) => error.code === 'INVALID_INDEX');
  await assert.rejects(() => search(request(), { index: indexWith([]), expectedHash: sha256('different') }), (error) => error.code === 'INDEX_HASH_MISMATCH');
  await assert.rejects(() => search(request(), { index: indexWith([{ ...record({ id: 'bad-reason' }), reasons: ['Bad Reason'] }]) }), (error) => error.code === 'INVALID_INDEX');
  await assert.rejects(() => search(request(), { index: { ...indexWith([record({ id: 'valid' })]), postings: { valid: ['missing-id'] } } }), (error) => error.code === 'INVALID_INDEX');
});

test('content-addressed cache is atomic and safe under concurrent writers', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-cache-'));
  const bytes = Buffer.from('{"hello":"world"}\n');
  const hash = sha256(bytes);
  const writes = await Promise.all(Array.from({ length: 8 }, () => cacheObject(cacheDir, hash, bytes)));
  assert.ok(writes.every((item) => item.hash === hash));
  assert.deepEqual(await readCachedObject(cacheDir, hash), bytes);
  assert.match(cacheKeyFor('https://example.test/base/manifest.json'), /^[a-f0-9]{64}$/);
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('offline cache returns stale explicitly and default network failure does not silently downgrade', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-offline-'));
  const index = indexWith([record({ id: 'cached', industries: ['finance-payments'], reviewStatus: 'approved', publishable: true })]);
  const payload = Buffer.from(JSON.stringify(index));
  const hash = sha256(payload);
  await cacheObject(cacheDir, hash, payload, 'https://example.test/base/index.json');
  const failedFetch = async () => { throw new Error('offline'); };
  const stale = await search(request(), { manifestUrl: 'https://example.test/base/manifest.json', cacheDir, fetch: failedFetch, offline: true, cachedIndexHash: hash });
  assert.equal(stale.cacheStatus, 'stale');
  await assert.rejects(() => search(request(), { manifestUrl: 'https://example.test/base/manifest.json', cacheDir, fetch: failedFetch, cachedIndexHash: hash }), (error) => error.code === 'STALE_CACHE_DISALLOWED');
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('local deferred results expose local artifacts but never invent a public package URL', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-artifact-'));
  const designPath = path.join(root, 'DESIGN.md');
  const previewPath = path.join(root, 'preview.html');
  const previewImagePath = path.join(root, 'cover.svg');
  const packagePath = path.join(root, 'deferred.tgz');
  await fs.writeFile(designPath, '# Deferred design\n');
  await fs.writeFile(previewPath, '<!doctype html>');
  await fs.writeFile(previewImagePath, '<svg/>');
  await fs.writeFile(packagePath, 'not publishable');
  const deferred = record({ id: 'deferred', designMdPath: designPath, previewPath, previewImagePath, packagePath, packageUrl: 'https://evil.example/package.tgz' });
  const response = await search(request(), { index: indexWith([deferred]), localRoot: root });
  const result = response.results[0];
  assert.equal(result.reviewStatus, 'deferred');
  assert.equal(result.publishable, false);
  assert.equal(result.artifacts.designMd.available, true);
  assert.equal(result.artifacts.preview.available, true);
  assert.equal(result.artifacts.previewImage.available, true);
  assert.equal(result.artifacts.package.available, false);
  assert.equal(result.artifacts.package.url, undefined);
  const fetched = await fetchArtifact(result, { kind: 'designMd', localRoot: root });
  assert.equal(fetched.body, '# Deferred design\n');
  await fs.rm(root, { recursive: true, force: true });
});

test('local artifact fetching rejects symlinks that escape localRoot', async (context) => {
  if (process.platform === 'win32') return context.skip('symlink privilege varies on Windows');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-symlink-root-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-symlink-outside-'));
  const secret = path.join(outside, 'secret.md');
  await fs.writeFile(secret, 'secret');
  await fs.symlink(secret, path.join(root, 'link.md'));
  const result = { id: 'local', publishable: false, artifacts: { designMd: { available: true, path: path.join(root, 'link.md') } } };
  await assert.rejects(() => fetchArtifact(result, { kind: 'designMd', localRoot: root }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

test('remote artifact fetching enforces HTTPS origin/base path, redirects, hashes, and size bounds', async () => {
  const body = '# Published design\n';
  const expectedHash = sha256(body);
  const calls = [];
  const safeFetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(body, { status: 200, headers: { 'content-length': String(Buffer.byteLength(body)) } });
  };
  const result = { id: 'published', publishable: true, artifacts: { designMd: { url: 'https://cdn.example.test/knowledge/design.md', hash: expectedHash } } };
  const fetched = await fetchArtifact(result, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' });
  assert.equal(fetched.body, body);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  assert.equal(new URL(calls[0].url).search, '');
  await assert.rejects(() => fetchArtifact({ ...result, artifacts: { designMd: { url: 'http://cdn.example.test/knowledge/design.md', hash: expectedHash } } }, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');
  await assert.rejects(() => fetchArtifact({ ...result, artifacts: { designMd: { url: 'https://cdn.example.test/other/design.md', hash: expectedHash } } }, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');

  const redirectFetch = async () => new Response(null, { status: 302, headers: { location: 'https://evil.example.test/design.md' } });
  await assert.rejects(() => fetchArtifact(result, { kind: 'designMd', fetch: redirectFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');
  await assert.rejects(() => fetchArtifact(result, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge', maxBytes: 2 }), (error) => error.code === 'FETCH_FAILED');
  await assert.rejects(() => fetchArtifact({ ...result, artifacts: { designMd: { url: result.artifacts.designMd.url, hash: sha256('wrong') } } }, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' }), (error) => error.code === 'ARTIFACT_HASH_MISMATCH');
  const deferredFetched = await fetchArtifact({ ...result, publishable: false }, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' });
  assert.equal(deferredFetched.body, body);
  await assert.rejects(() => fetchArtifact({ ...result, artifacts: { designMd: { url: 'https://cdn.example.test/knowledge/%2f..%2fsecret', hash: expectedHash } } }, { kind: 'designMd', fetch: safeFetch, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');
});

test('fetch never serializes search request terms or filters into network URL or body', async () => {
  const seen = [];
  const index = indexWith([record({ id: 'published', reviewStatus: 'approved', publishable: true, industries: ['finance-payments'] })]);
  const indexBytes = Buffer.from(JSON.stringify(index));
  const indexHash = sha256(indexBytes);
  const fetcher = async (url, options = {}) => {
    seen.push({ url: String(url), options });
    if (String(url).endsWith('/manifest.json')) {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        taxonomyVersion: '1.0.0',
        searchContractVersion: '1.0.0',
        tokenizationVersion: 'nfkc-intl-segmenter-v1',
        minReaderVersion: '1.0.0',
        maxReaderVersionExclusive: '2.0.0',
        records: index.records,
        indexes: { desktop: { url: 'indexes/desktop.json', hash: indexHash, count: 1 } },
      }), { status: 200 });
    }
    return new Response(indexBytes, { status: 200 });
  };
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-privacy-'));
  const manifestUrl = 'https://cdn.example.test/knowledge/manifest.json';
  const response = await search(request({ terms: ['secret phrase'], hardFilters: { industries: ['finance-payments'] } }), { manifestUrl, fetch: fetcher, cacheDir, allowedOrigin: 'https://cdn.example.test', allowedBasePath: '/knowledge' });
  assert.equal(response.results.length, 1);
  assert.ok(seen.every(({ url, options }) => !url.includes('secret') && !url.includes('finance-payments') && options.body === undefined));
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('remote search validates the manifest index hash against exact response bytes', async () => {
  const published = record({ id: 'published', reviewStatus: 'approved', publishable: true });
  const index = indexWith([published]);
  const exactBytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-exact-hash-'));
  const fetcher = async (url) => String(url).endsWith('/manifest.json')
    ? new Response(JSON.stringify({
      schemaVersion: 1,
      taxonomyVersion: '1.0.0',
      searchContractVersion: '1.0.0',
      tokenizationVersion: 'nfkc-intl-segmenter-v1',
      minReaderVersion: '1.0.0',
      maxReaderVersionExclusive: '2.0.0',
      records: [published],
      indexes: { desktop: { url: 'indexes/desktop.json', hash: sha256(exactBytes), count: 1 } },
    }))
    : new Response(exactBytes);
  const response = await search(request(), { manifestUrl: 'https://cdn.example.test/knowledge/manifest.json', fetch: fetcher, cacheDir });
  assert.deepEqual(response.results.map((item) => item.id), ['published']);
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('remote deferred results expose discovery artifacts but never a package', async () => {
  const deferred = {
    ...record({ id: 'remote-deferred', reviewStatus: 'deferred', publishable: false }),
    artifacts: {
      designMdUrl: 'https://cdn.example.test/knowledge/designs/remote-deferred/DESIGN.md',
      designMdHash: sha256('# Deferred\n'),
      previewUrl: 'https://cdn.example.test/knowledge/previews/remote-deferred/index.html',
      previewHash: sha256('<!doctype html>'),
      previewImageUrl: 'https://cdn.example.test/knowledge/previews/remote-deferred/cover.svg',
      previewImageHash: sha256('<svg/>'),
    },
  };
  const index = indexWith([deferred]);
  const indexBytes = Buffer.from(JSON.stringify(index));
  const fetcher = async (url) => {
    const value = String(url);
    if (value.endsWith('/manifest.json')) {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        taxonomyVersion: '1.0.0',
        searchContractVersion: '1.0.0',
        tokenizationVersion: 'nfkc-intl-segmenter-v1',
        minReaderVersion: '1.0.0',
        maxReaderVersionExclusive: '2.0.0',
        records: [deferred],
        indexes: { desktop: { url: 'indexes/desktop.json', hash: sha256(indexBytes), count: 1 } },
      }));
    }
    if (value.endsWith('/indexes/desktop.json')) return new Response(indexBytes);
    if (value.endsWith('/DESIGN.md')) return new Response('# Deferred\n');
    throw new Error(`Unexpected URL: ${value}`);
  };
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-remote-deferred-'));
  const response = await search(request(), {
    manifestUrl: 'https://cdn.example.test/knowledge/manifest.json',
    fetch: fetcher,
    cacheDir,
  });
  const result = response.results[0];
  assert.equal(result.reviewStatus, 'deferred');
  assert.equal(result.artifacts.designMd.available, true);
  assert.equal(result.artifacts.preview.available, true);
  assert.equal(result.artifacts.previewImage.available, true);
  assert.equal(result.artifacts.package.available, false);
  const fetched = await fetchArtifact(result, {
    kind: 'designMd',
    fetch: fetcher,
    allowedOrigin: 'https://cdn.example.test',
    allowedBasePath: '/knowledge',
  });
  assert.equal(fetched.body, '# Deferred\n');
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('remote search rejects manifest count drift and accepts a default system cache directory', async () => {
  const published = record({ id: 'published', reviewStatus: 'approved', publishable: true });
  const index = indexWith([published]);
  const bytes = Buffer.from(JSON.stringify(index));
  const fetcher = async (url) => String(url).endsWith('/manifest.json')
    ? new Response(JSON.stringify({
      schemaVersion: 1,
      taxonomyVersion: '1.0.0',
      searchContractVersion: '1.0.0',
      tokenizationVersion: 'nfkc-intl-segmenter-v1',
      minReaderVersion: '1.0.0',
      maxReaderVersionExclusive: '2.0.0',
      records: [published],
      indexes: { desktop: { url: 'indexes/desktop.json', hash: sha256(bytes), count: 2 } },
    }))
    : new Response(bytes);
  const systemCacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-system-cache-'));
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = systemCacheRoot;
  try {
    await assert.rejects(() => search(request(), { manifestUrl: 'https://cdn.example.test/knowledge/manifest.json', fetch: fetcher }), (error) => error.code === 'INVALID_INDEX' && error.details.reason === 'manifest-count-mismatch');
  } finally {
    if (previous === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
    await fs.rm(systemCacheRoot, { recursive: true, force: true });
  }
});

test('remote search rejects unsafe artifact URLs before returning results', async () => {
  const published = record({ id: 'published', reviewStatus: 'approved', publishable: true, industries: ['finance-payments'], packageUrl: 'https://evil.example.test/package.tgz' });
  const index = indexWith([published]);
  const indexBytes = Buffer.from(JSON.stringify(index));
  const fetcher = async (url) => String(url).endsWith('/manifest.json')
    ? new Response(JSON.stringify({
      schemaVersion: 1,
      taxonomyVersion: '1.0.0',
      searchContractVersion: '1.0.0',
      tokenizationVersion: 'nfkc-intl-segmenter-v1',
      minReaderVersion: '1.0.0',
      maxReaderVersionExclusive: '2.0.0',
      records: [published],
      indexes: { desktop: { url: 'indexes/desktop.json', hash: sha256(indexBytes), count: 1 } },
    }))
    : new Response(indexBytes);
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-unsafe-result-'));
  await assert.rejects(() => search(request(), { manifestUrl: 'https://cdn.example.test/knowledge/manifest.json', fetch: fetcher, cacheDir }), (error) => error.code === 'UNSAFE_ARTIFACT_URL');
  await fs.rm(cacheDir, { recursive: true, force: true });
});

test('CLI executes from paths with spaces and returns one machine-readable JSON response', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-search-cli-'));
  const indexPath = path.join(root, 'desktop.json');
  const requestPath = path.join(root, 'request.json');
  await fs.writeFile(indexPath, JSON.stringify(indexWith([record({ id: 'cli-result' })])));
  await fs.writeFile(requestPath, JSON.stringify(request()));
  const cliPath = fileURLToPath(new URL('../skills/design-system-search/scripts/cli.mjs', import.meta.url));
  const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'search', '--index', indexPath, '--request', requestPath]);
  assert.equal(stderr, '');
  const parsed = JSON.parse(stdout);
  assert.deepEqual(parsed.results.map((item) => item.id), ['cli-result']);
  await fs.rm(root, { recursive: true, force: true });
});

test('CLI defaults to the canonical Make-Template manifest while explicit sources win', async () => {
  const cli = await import('../skills/design-system-search/scripts/cli.mjs');
  assert.equal(cli.DEFAULT_MANIFEST_URL, 'https://lintendo.github.io/Make-Template/knowledge/latest/manifest.json');
  assert.deepEqual(cli.resolveSearchSource({}), {
    manifestUrl: cli.DEFAULT_MANIFEST_URL,
    allowedOrigin: 'https://lintendo.github.io',
    allowedBasePath: '/Make-Template/knowledge/',
  });
  assert.deepEqual(cli.resolveSearchSource({ manifestUrl: 'https://custom.example/knowledge/manifest.json' }), {
    manifestUrl: 'https://custom.example/knowledge/manifest.json',
  });
  assert.deepEqual(cli.resolveSearchSource({ indexPath: '/tmp/desktop.json' }), {
    indexPath: '/tmp/desktop.json',
  });
});

test('errors are structured with one of the versioned machine error codes', () => {
  const error = new DesignKnowledgeSearchError('CACHE_MISS', { path: 'cache' });
  assert.equal(error.code, 'CACHE_MISS');
  assert.deepEqual(error.details, { path: 'cache' });
});

test('Skill documents the privacy-preserving selection workflow and versioned references', async () => {
  const skillRoot = fileURLToPath(new URL('../skills/design-system-search/', import.meta.url));
  const [skill, agent, query, taxonomy, response, readme] = await Promise.all([
    fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
    fs.readFile(path.join(skillRoot, 'agents/openai.yaml'), 'utf8'),
    fs.readFile(path.join(skillRoot, 'references/query-schema.md'), 'utf8'),
    fs.readFile(path.join(skillRoot, 'references/taxonomy.md'), 'utf8'),
    fs.readFile(path.join(skillRoot, 'references/response-schema.md'), 'utf8'),
    fs.readFile(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8'),
  ]);

  assert.match(skill, /^---\nname: design-system-search\ndescription: Use when[^\n]+\n---\n/u);
  assert.doesNotMatch(skill.split('---')[1], /short-description|metadata:/u);
  assert.match(skill, /先把需求整理为结构化查询/u);
  assert.match(skill, /不得把用户原文传给脚本或网络端点/u);
  assert.match(skill, /同时搜索 desktop 和 mobile|向用户确认平台/u);
  assert.match(skill, /matched.*unmatched.*完整.*DESIGN\.md/su);
  assert.match(skill, /默认.*线上.*manifest|线上.*默认/u);
  assert.match(skill, /只有.*工作流需要.*下载.*package/su);
  assert.match(skill, /不得发送.*analytics|不得发送.*use 事件/u);
  assert.match(agent, /display_name: "Design System Search"/u);
  assert.match(agent, /default_prompt: "Use \$design-system-search/u);
  assert.match(query, /searchContractVersion: `1\.0\.0`/u);
  assert.match(query, /hardFilters/u);
  for (const dimension of ['industries', 'productTypes', 'pageTypes', 'styles', 'brandTraits', 'colorFamilies', 'colorModes', 'density']) {
    assert.match(taxonomy, new RegExp(`## ${dimension}\\b`, 'u'));
  }
  assert.match(response, /cacheVersion/u);
  assert.match(response, /reviewStatus/u);
  assert.match(response, /publishable/u);
  assert.match(response, /artifacts/u);
  assert.match(readme, /`design-system-search`/u);
});
