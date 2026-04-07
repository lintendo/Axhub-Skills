/**
 * extract-section-styles.js
 * 在浏览器内执行，对指定 selector 范围内的所有节点采集完整 computedStyle。
 * 样式自动去重（相同样式共享 styleId）。
 *
 * @param {string} sectionSelector - CSS selector 定位目标区域
 * @returns {{ selector: string, nodeCount: number, nodes: Record, styles: Record }}
 */
(function extractSectionStyles(sectionSelector) {
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template', 'slot']);

  // 只采集有视觉意义的 CSS 属性（过滤掉 400+ 个无用属性）
  const STYLE_WHITELIST = [
    // Layout
    'display', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
    'float', 'clear', 'overflow', 'overflowX', 'overflowY',
    // Flexbox
    'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf',
    'alignContent', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'order', 'gap',
    'rowGap', 'columnGap',
    // Grid
    'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
    'gridGap', 'gridAutoFlow',
    // Box model
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'boxSizing',
    // Border
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'borderWidth', 'borderStyle', 'borderColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomLeftRadius', 'borderBottomRightRadius',
    // Colors & backgrounds
    'color', 'backgroundColor', 'opacity',
    'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
    'background',
    // Typography
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
    'letterSpacing', 'textAlign', 'textDecoration', 'textTransform',
    'whiteSpace', 'wordBreak', 'wordSpacing', 'textOverflow',
    // Visual effects
    'boxShadow', 'textShadow', 'outline', 'outlineColor', 'outlineStyle', 'outlineWidth',
    'transform', 'transformOrigin', 'filter', 'backdropFilter',
    'clipPath', 'maskImage',
    // Transitions & animations
    'transition', 'transitionProperty', 'transitionDuration', 'transitionTimingFunction',
    'animation', 'animationName', 'animationDuration',
    // Misc
    'cursor', 'pointerEvents', 'userSelect', 'visibility', 'objectFit', 'objectPosition',
    'listStyleType', 'listStylePosition',
    'verticalAlign', 'tableLayout', 'borderCollapse', 'borderSpacing',
    'aspectRatio',
  ];

  // 这些值被视为"默认/无用"，会被过滤掉
  const DEFAULT_VALUES = new Set([
    'none', 'normal', 'auto', '0px', '0', 'static', 'visible',
    'start', 'stretch', 'baseline', 'row', 'nowrap', 'content-box',
    'currentcolor', 'medium', 'separate', 'show', 'inline',
    'left', 'ltr', 'break-word',
  ]);

  let nodeCounter = 0;
  let styleCounter = 0;
  const nodes = {};
  const styles = {};
  const styleHashMap = new Map(); // hash → styleId（去重）

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

  function getBBox(el) {
    const rect = el.getBoundingClientRect();
    return {
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  function isHidden(el) {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return true;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  /**
   * 提取有意义的 computedStyle 属性
   */
  function extractStyle(el) {
    const cs = getComputedStyle(el);
    const result = {};
    for (const prop of STYLE_WHITELIST) {
      const value = cs[prop];
      if (!value) continue;
      const trimmed = value.toString().trim().toLowerCase();
      if (DEFAULT_VALUES.has(trimmed)) continue;
      // Skip if it's rgba(0,0,0,0) / transparent
      if (trimmed === 'rgba(0, 0, 0, 0)' || trimmed === 'transparent') continue;
      result[prop] = value;
    }
    return result;
  }

  /**
   * 对样式对象进行去重
   */
  function getOrCreateStyleId(styleObj) {
    const keys = Object.keys(styleObj).sort();
    if (keys.length === 0) return null;
    const hash = keys.map(k => `${k}:${styleObj[k]}`).join('|');
    if (styleHashMap.has(hash)) return styleHashMap.get(hash);
    const id = `s${++styleCounter}`;
    styleHashMap.set(hash, id);
    styles[id] = styleObj;
    return id;
  }

  function walk(el, depth) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return null;
    if (isHidden(el)) return null;

    const nodeId = `n${++nodeCounter}`;
    const node = {
      tag,
      selector: getSelector(el),
      bbox: getBBox(el),
    };

    // Style
    const styleObj = extractStyle(el);
    const styleId = getOrCreateStyleId(styleObj);
    if (styleId) node.styleId = styleId;

    // Text
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ');
    if (directText) node.text = directText.slice(0, 500);

    // Attrs
    if (el.id) node.id = el.id;
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
      node.class = el.className.trim();
    }
    if (tag === 'img' && el.src) node.src = el.src;
    if (tag === 'a' && el.href) node.href = el.href;
    if (tag === 'img' && el.alt) node.alt = el.alt;
    if (tag === 'input' && el.type) node.type = el.type;
    if (tag === 'input' && el.placeholder) node.placeholder = el.placeholder;

    // Children
    const childIds = [];
    for (const child of el.children) {
      const childResult = walk(child, depth + 1);
      if (childResult) childIds.push(childResult.id);
    }
    if (childIds.length > 0) node.children = childIds;

    nodes[nodeId] = node;
    return { id: nodeId };
  }

  // ── Execute ────────────────────────────
  const rootEl = document.querySelector(sectionSelector);
  if (!rootEl) {
    return { error: `Element not found: ${sectionSelector}`, selector: sectionSelector, nodeCount: 0, nodes: {}, styles: {} };
  }

  walk(rootEl, 0);

  return {
    selector: sectionSelector,
    nodeCount: nodeCounter,
    styleCount: styleCounter,
    nodes,
    styles,
  };
})
