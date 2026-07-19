import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDefaultPageResourceBaseUrl,
  buildPageUrl,
  normalizeBaseUrl,
  parseAxureRouteContext,
  resolvePageResourceBaseUrl,
} from '../skills/extract-axure-data/scripts/routing.mjs';

test('preserves the publication id from query-routed Axure URLs', () => {
  const inputUrl = 'https://example.com/prototype/start.html?id=publication-id&p=login';
  const routeContext = parseAxureRouteContext(inputUrl);
  const baseUrl = normalizeBaseUrl(inputUrl);

  assert.deepEqual(routeContext, {
    mode: 'query',
    publicationId: 'publication-id',
  });
  assert.equal(baseUrl, 'https://example.com/prototype/');
  assert.equal(
    buildPageUrl(baseUrl, 'home', routeContext),
    'https://example.com/prototype/start.html?id=publication-id&p=home&g=1',
  );
});

test('keeps traditional Axure URLs on hash routing', () => {
  const inputUrl = 'https://example.com/prototype/start.html#p=login';
  const routeContext = parseAxureRouteContext(inputUrl);
  const baseUrl = normalizeBaseUrl(inputUrl);

  assert.deepEqual(routeContext, { mode: 'hash' });
  assert.equal(buildPageUrl(baseUrl, 'home', routeContext), 'https://example.com/prototype/start.html#p=home');
});

test('resolves page data relative to the rendered iframe directory without duplicating the page path', () => {
  const exportBaseUrl = 'https://example.com/prototype/';
  const fallbackPageBaseUrl = buildDefaultPageResourceBaseUrl(exportBaseUrl, 'home');
  const pageBaseUrl = resolvePageResourceBaseUrl(
    'https://cdn.example.com/publication/files/home/home.html?cache=1',
    fallbackPageBaseUrl,
    { mode: 'query', publicationId: 'publication-id' },
  );

  assert.equal(fallbackPageBaseUrl, 'https://example.com/prototype/files/home/');
  assert.equal(pageBaseUrl, 'https://cdn.example.com/publication/files/home/');
  assert.equal(new URL('data.js', pageBaseUrl).href, 'https://cdn.example.com/publication/files/home/data.js');
  assert.equal(
    new URL('images/home/u0.png', pageBaseUrl).href,
    'https://cdn.example.com/publication/files/home/images/home/u0.png',
  );
});

test('falls back to the known page resource directory when no rendered HTML URL is available', () => {
  const fallbackPageBaseUrl = 'https://example.com/prototype/files/home/';

  assert.equal(
    resolvePageResourceBaseUrl('about:blank', fallbackPageBaseUrl, { mode: 'query' }),
    fallbackPageBaseUrl,
  );
  assert.equal(
    resolvePageResourceBaseUrl('not a url', fallbackPageBaseUrl, { mode: 'query' }),
    fallbackPageBaseUrl,
  );
});

test('keeps legacy hash-routed page data under files/page when the iframe is a root HTML file', () => {
  const fallbackPageBaseUrl = 'https://example.com/prototype/files/home/';

  assert.equal(
    resolvePageResourceBaseUrl(
      'https://example.com/prototype/home.html',
      fallbackPageBaseUrl,
      { mode: 'hash' },
    ),
    fallbackPageBaseUrl,
  );
});
