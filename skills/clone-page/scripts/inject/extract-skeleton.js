/**
 * extract-skeleton.js
 * 在浏览器内执行，递归遍历 DOM 构建骨架树。
 * 产出轻量级结构（不含样式），每个节点附带唯一 CSS selector。
 *
 * @param {string|null} rootSelector - 限制范围的根选择器，null 为 body
 * @returns {{ root: string, nodeCount: number, nodes: Record<string, SkeletonNode> }}
 */
(function extractSkeleton(rootSelector) {
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template', 'slot']);
  const SEMANTIC_ROLES = {
    header: 'header', nav: 'nav', main: 'main', footer: 'footer',
    aside: 'aside', article: 'article', section: 'section', form: 'form',
  };
  const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'details', 'summary']);

  let nodeCounter = 0;
  const nodes = {};

  /**
   * 生成稳定且唯一的 CSS selector
   */
  function getSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let current = el;
    while (current && current !== document.documentElement) {
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      let tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          tag += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  /**
   * 获取元素的 bounding box
   */
  function getBBox(el) {
    const rect = el.getBoundingClientRect();
    return {
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  /**
   * 检测元素是否不可见
   */
  function isHidden(el) {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return true;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  }

  /**
   * 递归遍历 DOM
   */
  function walk(el, depth) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return null;
    if (isHidden(el)) return null;

    const nodeId = `n${++nodeCounter}`;
    const node = {
      tag,
      depth,
      selector: getSelector(el),
    };

    // bbox
    const bbox = getBBox(el);
    if (bbox.width > 0 || bbox.height > 0) {
      node.bbox = bbox;
    }

    // Semantic role
    if (SEMANTIC_ROLES[tag]) {
      node.role = SEMANTIC_ROLES[tag];
    } else {
      const cls = (el.className || '').toString().toLowerCase();
      if (cls.includes('header') || cls.includes('navbar')) node.role = 'header';
      else if (cls.includes('footer')) node.role = 'footer';
      else if (cls.includes('sidebar')) node.role = 'aside';
      else if (cls.includes('hero')) node.role = 'hero';
    }

    // Interactive flag
    if (INTERACTIVE_TAGS.has(tag)) {
      node.interactive = true;
    }

    // Text content (only direct text, not children's)
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ');
    if (directText) {
      node.text = directText.slice(0, 200);
    }

    // Element-specific attributes
    if (el.id) node.id = el.id;
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
      node.class = el.className.trim();
    }
    if (tag === 'img' && el.src) node.src = el.src;
    if (tag === 'a' && el.href) node.href = el.href;
    if (tag === 'img' && el.alt) node.alt = el.alt;

    // Recurse children
    const childIds = [];
    let descendantCount = 0;
    for (const child of el.children) {
      const childResult = walk(child, depth + 1);
      if (childResult) {
        childIds.push(childResult.id);
        descendantCount += 1 + (nodes[childResult.id]?.childCount || 0);
      }
    }
    if (childIds.length > 0) {
      node.children = childIds;
    }
    node.childCount = descendantCount;

    nodes[nodeId] = node;
    return { id: nodeId };
  }

  // ── Execute ────────────────────────────
  const rootEl = rootSelector ? document.querySelector(rootSelector) : document.body;
  if (!rootEl) return { error: `Root element not found: ${rootSelector}`, root: null, nodeCount: 0, nodes: {} };

  const result = walk(rootEl, 0);
  return {
    root: result?.id || null,
    nodeCount: nodeCounter,
    nodes,
  };
})
