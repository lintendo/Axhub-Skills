#!/usr/bin/env node
/**
 * query.mjs — 轻量查询脚本，从 clone-data 目录渐进式读取数据
 *
 * Usage:
 *   node query.mjs <dir> <command> [args...] [--options]
 *
 * Commands:
 *   summary                     元数据摘要
 *   skeleton [--depth=N]        骨架树（控制展开深度）
 *   subtree <nodeId> [--depth=N] 特定节点的子树
 *   node <nodeId>               单节点信息
 *   section <name>              查看已采集的 section 数据
 *   sections                    列出所有已采集的 section
 *   find [--tag=X] [--text=X] [--interactive]  条件反查
 *   file <path>                 读取目录内任意文件
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = (data) => process.stdout.write(JSON.stringify(data, null, 2) + '\n');
const die = (msg) => { out({ error: msg }); process.exit(1); };

const readJSON = (p) => {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
};

const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > 0) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      else flags[arg.slice(2)] = true;
    } else positional.push(arg);
  }
  return { positional, flags };
};

// ────────────────────────────────────────────────────────────────

class CloneDataReader {
  constructor(baseDir) {
    this.baseDir = resolve(baseDir);
    if (!existsSync(this.baseDir)) die(`目录不存在: ${this.baseDir}`);
    this._meta = null;
    this._skeleton = null;
  }

  get meta() {
    if (!this._meta) this._meta = readJSON(join(this.baseDir, 'meta.json')) || {};
    return this._meta;
  }

  get skeleton() {
    if (!this._skeleton) this._skeleton = readJSON(join(this.baseDir, 'skeleton.json'));
    return this._skeleton;
  }

  getSection(name) {
    const dir = join(this.baseDir, 'sections', name);
    if (!existsSync(dir)) return null;
    return {
      nodes: readJSON(join(dir, 'nodes.json')),
      styles: readJSON(join(dir, 'styles.json')),
      hasScreenshot: existsSync(join(dir, 'screenshot.png')),
    };
  }

  listSections() {
    const dir = join(this.baseDir, 'sections');
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => {
      const p = join(dir, f);
      return statSync(p).isDirectory();
    });
  }

  readFile(relativePath) {
    const fullPath = join(this.baseDir, relativePath);
    if (!existsSync(fullPath)) return null;
    const ext = relativePath.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'woff', 'woff2', 'ttf'].includes(ext)) {
      return { type: 'binary', path: fullPath, size: statSync(fullPath).size };
    }
    const content = readFileSync(fullPath, 'utf-8');
    if (ext === 'json') { try { return JSON.parse(content); } catch {} }
    return content;
  }
}

// ── Commands ─────────────────────────────────────────────────

function cmdSummary(reader) {
  const meta = reader.meta;
  const skeleton = reader.skeleton;
  const sections = reader.listSections();
  out({
    url: meta.url || skeleton?.url || '',
    title: meta.title || skeleton?.title || '',
    timestamp: meta.timestamp || '',
    viewport: meta.viewport || {},
    phases: meta.phases || [],
    nodeCount: skeleton?.nodeCount || meta.nodeCount || 0,
    sections,
    sectionCount: sections.length,
    hasScreenshot: existsSync(join(reader.baseDir, 'screenshot.png')),
    hasTheme: existsSync(join(reader.baseDir, 'theme.json')),
    hasResponsive: existsSync(join(reader.baseDir, 'responsive')),
    hasAssets: existsSync(join(reader.baseDir, 'assets')),
  });
}

function cmdSkeleton(reader, flags) {
  const maxDepth = parseInt(flags.depth) || Infinity;
  const skeleton = reader.skeleton;
  if (!skeleton) die('skeleton.json 不存在，请先运行 skeleton 命令');

  if (maxDepth === Infinity) { out(skeleton); return; }

  const filtered = {};
  for (const [id, node] of Object.entries(skeleton.nodes)) {
    if (node.depth <= maxDepth) {
      const copy = { ...node };
      if (node.depth === maxDepth) delete copy.children;
      filtered[id] = copy;
    }
  }
  out({ ...skeleton, nodes: filtered, _filteredToDepth: maxDepth });
}

function cmdSubtree(reader, nodeId, flags) {
  const maxDepth = parseInt(flags.depth) ?? Infinity;
  const skeleton = reader.skeleton;
  if (!skeleton?.nodes) die('skeleton.json 不存在');
  if (!skeleton.nodes[nodeId]) die(`节点 ${nodeId} 不存在`);

  const result = {};
  const collect = (id, d) => {
    const node = skeleton.nodes[id];
    if (!node) return;
    const copy = { ...node };
    if (d >= maxDepth) delete copy.children;
    result[id] = copy;
    if (node.children && d < maxDepth) {
      node.children.forEach(cid => collect(cid, d + 1));
    }
  };
  collect(nodeId, 0);
  out({ rootId: nodeId, nodeCount: Object.keys(result).length, nodes: result });
}

function cmdNode(reader, nodeId) {
  const skeleton = reader.skeleton;
  if (!skeleton?.nodes?.[nodeId]) die(`节点 ${nodeId} 不存在`);

  const node = { nodeId, ...skeleton.nodes[nodeId] };

  // 尝试从 section 数据中找到该节点的样式
  for (const sectionName of reader.listSections()) {
    const section = reader.getSection(sectionName);
    if (!section?.nodes?.nodes) continue;
    // 在 section 的 nodes 中按 selector 匹配
    for (const [sid, snode] of Object.entries(section.nodes.nodes)) {
      if (snode.selector === node.selector) {
        node.sectionStyle = snode;
        if (snode.styleId && section.styles?.styles?.[snode.styleId]) {
          node.computedStyle = section.styles.styles[snode.styleId];
        }
        break;
      }
    }
  }
  out(node);
}

function cmdSection(reader, name) {
  const section = reader.getSection(name);
  if (!section) die(`Section "${name}" 不存在。可用: ${reader.listSections().join(', ')}`);
  out(section);
}

function cmdSections(reader) {
  const sections = reader.listSections();
  const details = sections.map(name => {
    const s = reader.getSection(name);
    return {
      name,
      nodeCount: s?.nodes?.nodeCount || 0,
      styleCount: s?.styles?.styleCount || 0,
      hasScreenshot: s?.hasScreenshot || false,
    };
  });
  out({ count: sections.length, sections: details });
}

function cmdFind(reader, flags) {
  const skeleton = reader.skeleton;
  if (!skeleton?.nodes) die('skeleton.json 不存在');

  let candidates = Object.entries(skeleton.nodes);

  if (flags.tag) candidates = candidates.filter(([, n]) => n.tag === flags.tag);
  if (flags.interactive) candidates = candidates.filter(([, n]) => n.interactive);
  if (flags.role) candidates = candidates.filter(([, n]) => n.role === flags.role);
  if (flags.text) {
    const q = flags.text.toLowerCase();
    candidates = candidates.filter(([, n]) => n.text?.toLowerCase().includes(q));
  }

  const results = candidates.slice(0, 100).map(([id, n]) => {
    const brief = { nodeId: id, tag: n.tag, selector: n.selector };
    if (n.text) brief.text = n.text.slice(0, 50);
    if (n.role) brief.role = n.role;
    if (n.interactive) brief.interactive = true;
    return brief;
  });

  out({
    totalMatches: candidates.length,
    showing: results.length,
    results,
  });
}

function cmdFile(reader, relativePath) {
  const content = reader.readFile(relativePath);
  if (content === null) die(`文件不存在: ${relativePath}`);
  if (typeof content === 'string') { process.stdout.write(content + '\n'); return; }
  out(content);
}

// ── Main ─────────────────────────────────────────────────────

function printUsage() {
  out({
    usage: 'node query.mjs <dir> <command> [args...] [--options]',
    commands: {
      summary: '元数据摘要',
      'skeleton [--depth=N]': '骨架树',
      'subtree <nodeId> [--depth=N]': '特定节点的子树',
      'node <nodeId>': '单节点信息（含已采集的样式）',
      'section <name>': '查看已采集的 section 数据',
      sections: '列出所有已采集的 section',
      'find [--tag=X] [--text=X] [--interactive] [--role=X]': '条件反查',
      'file <path>': '读取目录内任意文件',
    },
  });
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (positional.length < 2 || flags.help) { printUsage(); process.exit(positional.length < 2 ? 1 : 0); }

  const [dir, command, ...rest] = positional;
  const reader = new CloneDataReader(dir);

  switch (command) {
    case 'summary': cmdSummary(reader); break;
    case 'skeleton': cmdSkeleton(reader, flags); break;
    case 'subtree':
      if (!rest[0]) die('subtree 需要 nodeId');
      cmdSubtree(reader, rest[0], flags); break;
    case 'node':
      if (!rest[0]) die('node 需要 nodeId');
      cmdNode(reader, rest[0]); break;
    case 'section':
      if (!rest[0]) die('section 需要名称');
      cmdSection(reader, rest[0]); break;
    case 'sections': cmdSections(reader); break;
    case 'find': cmdFind(reader, flags); break;
    case 'file':
      if (!rest[0]) die('file 需要文件路径');
      cmdFile(reader, rest[0]); break;
    default: die(`未知命令: ${command}`);
  }
}

main();
