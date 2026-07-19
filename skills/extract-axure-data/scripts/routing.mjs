export function parseAxureRouteContext(url) {
  try {
    const publicationId = new URL(url).searchParams.get('id');
    if (publicationId) return { mode: 'query', publicationId };
  } catch {
    // Invalid URLs retain the legacy hash-routing fallback.
  }
  return { mode: 'hash' };
}

export function normalizeBaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith('.html')) u.pathname = u.pathname.replace(/\/[^/]+\.html$/, '/');
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    u.search = '';
    u.hash = '';
    return u.href;
  } catch {
    return url.endsWith('/') ? url : `${url}/`;
  }
}

export function buildPageUrl(baseUrl, pageName, routeContext = { mode: 'hash' }) {
  if (!pageName) return baseUrl;

  const pageUrl = new URL('start.html', baseUrl);
  if (routeContext.mode === 'query' && routeContext.publicationId) {
    pageUrl.searchParams.set('id', routeContext.publicationId);
    pageUrl.searchParams.set('p', pageName);
    pageUrl.searchParams.set('g', '1');
  } else {
    pageUrl.hash = `p=${pageName}`;
  }
  return pageUrl.href;
}

export function buildDefaultPageResourceBaseUrl(baseUrl, pageName) {
  return new URL(`files/${pageName}/`, baseUrl).href;
}

export function resolvePageResourceBaseUrl(renderedUrl, fallbackBaseUrl, routeContext = { mode: 'hash' }) {
  if (routeContext.mode !== 'query') return fallbackBaseUrl;

  try {
    const u = new URL(renderedUrl);
    if (u.pathname.endsWith('.html')) {
      u.pathname = u.pathname.replace(/\/[^/]+\.html$/, '/');
      u.search = '';
      u.hash = '';
      return u.href;
    }
  } catch {
    // Keep the known page resource directory.
  }
  return fallbackBaseUrl;
}
