#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_INSPECTOR_SPEC = '@modelcontextprotocol/inspector@2.0.0';
const FIGWRIGHT_MCP_SPEC = '@figwright/mcp@0.3.0';
const MCP_SERVER_NAME = 'figwright';
const TOOL_INDEX_PATH = fileURLToPath(new URL('../assets/tool-index.json', import.meta.url));
const MAX_BUFFER_BYTES = 24 * 1024 * 1024;

export function resolvePlatformCommands(platform, environment = process.env) {
  const isWindows = platform === 'win32';
  return {
    npxCommand: isWindows
      ? environment.ComSpec || environment.COMSPEC || 'cmd.exe'
      : 'npx',
    npxArgsPrefix: isWindows ? ['/d', '/s', '/c', 'npx.cmd'] : [],
    mcpConfigPath: fileURLToPath(new URL(
      isWindows
        ? '../assets/figwright.windows.mcp.json'
        : '../assets/figwright.mcp.json',
      import.meta.url,
    )),
  };
}

export function resolveRelayInvocation(platform, environment = process.env) {
  const { npxCommand, npxArgsPrefix } = resolvePlatformCommands(platform, environment);
  return {
    command: npxCommand,
    args: [...npxArgsPrefix, '-y', FIGWRIGHT_MCP_SPEC],
  };
}

const {
  npxCommand: NPX_COMMAND,
  npxArgsPrefix: NPX_ARGS_PREFIX,
  mcpConfigPath: MCP_CONFIG_PATH,
} =
  resolvePlatformCommands(process.platform);

const DRAFITO_PLUGIN = {
  id: '1337683962156635228',
  versionId: '191364',
  name: 'Drafito',
};

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const TOOL_ERROR_PATTERN = /^(?:(?:[✗×]\s*)?Tool execution failed:\s|(?:[A-Z][A-Z0-9_]+|Error):\s|plugin request timeout\b|pinned session not connected\b|no plugin connected\b|follower rpc transport\b|invalid rpc response\b)/iu;

function usage() {
  process.stdout.write(`Figma 内容操作器（第三方 Figwright 包装器）

用法：
  figwright-operator.mjs doctor
  figwright-operator.mjs relay
  figwright-operator.mjs ping
  figwright-operator.mjs profile
  figwright-operator.mjs launch-url <figma-design-url>
  figwright-operator.mjs catalog-check
  figwright-operator.mjs tools <keyword>
  figwright-operator.mjs schema <tool-name>
  figwright-operator.mjs call <tool-name> [json | @file | -]

本包装器不实现 MCP，也不会在宿主代理中注册 MCP 服务器。
`);
}

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function cleanOutput(value) {
  return String(value || '').replace(ANSI_PATTERN, '').trim();
}

function parseJsonBody(body) {
  const lines = body.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const candidate = lines.slice(index).join('\n').trim();
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // 继续尝试，直到跳过启动横幅或诊断前缀。
    }
  }
  return undefined;
}

function formatResult(result) {
  if (result.payload !== undefined) return `${JSON.stringify(result.payload, null, 2)}\n`;
  return `${result.body || result.stderr || result.stdout}\n`;
}

function imageExtension(mimeType) {
  switch (String(mimeType || '').toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/png':
    default:
      return 'png';
  }
}

function sanitizeInlineImages(value, artifacts, cursor = { index: 0 }) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInlineImages(item, artifacts, cursor));
  }
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'image' && isNonEmptyString(value.data)) {
    const artifact = artifacts[cursor.index];
    cursor.index += 1;
    return {
      type: 'image',
      mimeType: value.mimeType || artifact?.mimeType,
      path: artifact?.path,
      bytes: artifact?.bytes,
    };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sanitizeInlineImages(item, artifacts, cursor),
    ]),
  );
}

export function formatCallResult(result, imageArtifacts = []) {
  if (imageArtifacts.length === 0) return formatResult(result);
  return `${JSON.stringify({
    result: sanitizeInlineImages(result.payload, imageArtifacts),
    images: imageArtifacts,
    nextAction: '使用宿主的图片查看能力打开 images[].path，再进行视觉判断。',
  }, null, 2)}\n`;
}

export function isToolFailure(result) {
  return result.status !== undefined && result.status !== 0 ||
    result.payload?.isError === true ||
    TOOL_ERROR_PATTERN.test(result.body);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEndToEndPingPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    payload.ok === true &&
    payload.hop === 'e2e' &&
    payload.plugin &&
    typeof payload.plugin === 'object' &&
    payload.plugin.editorType === 'figma' &&
    isNonEmptyString(payload.plugin.currentPageId) &&
    isNonEmptyString(payload.plugin.currentPageName),
  );
}

function isPageReference(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name),
  );
}

export function isMetadataPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    isNonEmptyString(payload.fileName) &&
    isPageReference(payload.currentPage) &&
    Array.isArray(payload.pages) &&
    payload.pages.every(isPageReference),
  );
}

export function extractInspectorPayload(method, envelope) {
  const result = envelope && typeof envelope === 'object'
    ? envelope.result
    : undefined;
  if (method !== 'tools/call') return result ?? envelope;
  if (!result || typeof result !== 'object') return result ?? envelope;
  if (result.isError === true) return result;

  const content = Array.isArray(result.content) ? result.content : [];
  for (const block of content) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue;
    try {
      return JSON.parse(block.text);
    } catch {
      // 非 JSON 文本由 Inspector 的标准工具结果结构承载。
    }
  }
  return result;
}

export function extractInspectorImageBlocks(method, envelope) {
  if (method !== 'tools/call') return [];
  const content = Array.isArray(envelope?.result?.content)
    ? envelope.result.content
    : [];
  return content.filter((block) =>
    block?.type === 'image' &&
    isNonEmptyString(block.data) &&
    isNonEmptyString(block.mimeType),
  );
}

export function materializeImageBlocks(
  imageBlocks,
  { outputRoot = tmpdir(), toolName = 'figwright' } = {},
) {
  if (!Array.isArray(imageBlocks) || imageBlocks.length === 0) return [];
  const safeToolName = String(toolName || 'figwright').replace(/[^a-z0-9-]+/giu, '-');
  const directory = mkdtempSync(join(outputRoot, `${safeToolName}-`));
  return imageBlocks.map((block, index) => {
    const bytes = Buffer.from(block.data, 'base64');
    const path = join(directory, `${index + 1}.${imageExtension(block.mimeType)}`);
    writeFileSync(path, bytes, { flag: 'wx' });
    return {
      mimeType: block.mimeType,
      path,
      bytes: bytes.length,
    };
  });
}

export function formatInspectorToolResult(result, options = {}) {
  const imageArtifacts = materializeImageBlocks(result.imageBlocks, options);
  return formatCallResult(result, imageArtifacts);
}

function runInspectorCli(method, args = [], { toolName = 'figwright', exitOnFailure = true } = {}) {
  const invocation = [
    ...NPX_ARGS_PREFIX,
    '-y',
    MCP_INSPECTOR_SPEC,
    '--cli',
    '--config',
    MCP_CONFIG_PATH,
    '--server',
    MCP_SERVER_NAME,
    '--method',
    method,
    '--format',
    'json',
    ...args,
  ];
  const result = spawnSync(NPX_COMMAND, invocation, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
    env: {
      ...process.env,
      NO_COLOR: '1',
      TERM: 'dumb',
    },
  });

  if (result.error?.code === 'ENOENT') {
    fail('未找到 npx。请安装 Node.js 22.19 或更高版本，然后重新运行 doctor。');
  }
  if (result.error) fail(`无法运行 MCP Inspector：${result.error.message}`);

  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  const body = result.status === 0
    ? cleanOutput(stdout) || cleanOutput(stderr)
    : cleanOutput(stderr) || cleanOutput(stdout);
  const envelope = parseJsonBody(cleanOutput(stdout)) ?? parseJsonBody(cleanOutput(stderr));
  const normalized = {
    status: result.status ?? 1,
    stdout,
    stderr,
    body,
    payload: extractInspectorPayload(method, envelope),
    imageBlocks: extractInspectorImageBlocks(method, envelope),
  };

  if (normalized.status !== 0 && exitOnFailure) {
    process.stderr.write(
      method === 'tools/call'
        ? formatInspectorToolResult(normalized, { toolName })
        : formatResult(normalized),
    );
    process.exit(normalized.status);
  }
  return normalized;
}

export function callFigwrightTool(toolName, args) {
  return runInspectorCli('tools/call', [
    '--tool-name',
    toolName,
    '--tool-args-json',
    JSON.stringify(args),
  ], { toolName, exitOnFailure: false });
}

export function isSupportedNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 22) return minor >= 19;
  return major > 22;
}

function commandVersion(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || result.stderr || '').trim().split(/\r?\n/u)[0] || null;
}

function runDoctor() {
  const nodeVersion = process.version;
  const npxVersion = commandVersion(NPX_COMMAND, [...NPX_ARGS_PREFIX, '--version']);
  const report = {
    ok:
      isSupportedNodeVersion(nodeVersion) &&
      Boolean(npxVersion) &&
      existsSync(MCP_CONFIG_PATH) &&
      existsSync(TOOL_INDEX_PATH),
    node: {
      version: nodeVersion,
      supported: isSupportedNodeVersion(nodeVersion),
      requirement: '22.19+',
    },
    npx: {
      command: NPX_COMMAND,
      argsPrefix: NPX_ARGS_PREFIX,
      version: npxVersion,
      available: Boolean(npxVersion),
    },
    mcpInspector: MCP_INSPECTOR_SPEC,
    figwrightMcp: FIGWRIGHT_MCP_SPEC,
    config: { path: MCP_CONFIG_PATH, exists: existsSync(MCP_CONFIG_PATH) },
    toolIndex: {
      path: TOOL_INDEX_PATH,
      exists: existsSync(TOOL_INDEX_PATH),
      count: existsSync(TOOL_INDEX_PATH) ? loadToolIndex().length : 0,
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exit(1);
}

function runRelay() {
  const invocation = resolveRelayInvocation(process.platform);
  process.stderr.write(
    '正在启动任务级 Figwright MCP Relay。请保持本进程运行，并在任务完成、取消或失败后停止它。\n',
  );
  const child = spawn(invocation.command, invocation.args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NO_COLOR: '1',
      TERM: 'dumb',
    },
  });
  let stopping = false;
  const stopRelay = (signal) => {
    if (stopping) return;
    stopping = true;
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  const onSigint = () => stopRelay('SIGINT');
  const onSigterm = () => stopRelay('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  child.once('error', (error) => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    if (error.code === 'ENOENT') {
      fail('未找到 npx。请安装 Node.js 22.19 或更高版本，然后重新运行 doctor。');
    }
    fail(`无法启动 Figwright MCP Relay：${error.message}`);
  });
  child.once('exit', (code, signal) => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    if (stopping || signal === 'SIGINT' || signal === 'SIGTERM') {
      process.exitCode = 0;
      return;
    }
    if (typeof code === 'number' && code !== 0) {
      process.exitCode = code;
      return;
    }
    if (signal) fail(`Figwright MCP Relay 被信号 ${signal} 中止。`);
  });
}

function assertEndToEndPing(result) {
  const payload = result.payload;
  if (!isEndToEndPingPayload(payload)) {
    process.stderr.write(formatResult(result));
    fail('Figwright MCP 已启动，但尚未验证 Figma 插件的端到端连接。');
  }
  return payload;
}

function runPing() {
  const result = callFigwrightTool('ping', {});
  assertEndToEndPing(result);
  process.stdout.write(formatResult(result));
}

function runProfile() {
  const ping = callFigwrightTool('ping', {});
  const pingPayload = assertEndToEndPing(ping);
  const metadata = callFigwrightTool('get_metadata', {});
  const profile = isMetadataPayload(metadata.payload)
    ? 'figwright-full'
    : 'unknown';
  process.stdout.write(`${JSON.stringify({
    connected: true,
    profile,
    page: pingPayload.plugin,
    catalogProbe: metadata.payload ?? metadata.body,
  }, null, 2)}\n`);
  if (profile !== 'figwright-full') process.exitCode = 2;
}

function buildDrafitoLaunchUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    fail('launch-url 需要一个绝对 Figma 设计文件 URL。');
  }
  const isFigmaHost = url.protocol === 'https:' &&
    (url.hostname === 'figma.com' || url.hostname.endsWith('.figma.com'));
  const isDesignPath = /^\/(?:design|file)\/[^/]+(?:\/|$)/u.test(url.pathname);
  if (!isFigmaHost || !isDesignPath) {
    fail('Drafito 只能从 Figma 设计文件 URL 启动。');
  }
  url.searchParams.set('try-plugin-id', DRAFITO_PLUGIN.id);
  url.searchParams.set('try-plugin-version-id', DRAFITO_PLUGIN.versionId);
  url.searchParams.set('try-plugin-name', DRAFITO_PLUGIN.name);
  url.searchParams.set('is-widget', '0');
  url.searchParams.set('is-playground-file', '1');
  url.searchParams.set('mode', 'design');
  url.searchParams.set('type', 'design');
  url.searchParams.set('try-plugin-editor-type', 'figma');
  return url.toString();
}

function loadCatalog() {
  const result = runInspectorCli('tools/list');
  const tools = result.payload?.tools;
  if (!Array.isArray(tools)) {
    process.stderr.write(formatResult(result));
    fail('MCP Inspector 未返回 JSON 工具目录。');
  }
  return tools;
}

function loadToolIndex() {
  const parsed = JSON.parse(readFileSync(TOOL_INDEX_PATH, 'utf8'));
  if (!parsed || !Array.isArray(parsed.domains)) {
    fail('随附的 Figwright 工具索引无效。');
  }
  return parsed.domains.flatMap((domain) =>
    Array.isArray(domain.tools) ? domain.tools : [],
  );
}

function runCatalogCheck() {
  const indexed = loadToolIndex();
  const live = loadCatalog().map((tool) => tool.name);
  const indexedSet = new Set(indexed);
  const liveSet = new Set(live);
  const missingFromIndex = live.filter((name) => !indexedSet.has(name));
  const unavailableInServer = indexed.filter((name) => !liveSet.has(name));
  const duplicateIndexEntries = indexed.filter((name, position) => indexed.indexOf(name) !== position);
  const ok = missingFromIndex.length === 0 &&
    unavailableInServer.length === 0 &&
    duplicateIndexEntries.length === 0;
  process.stdout.write(`${JSON.stringify({
    ok,
    pinnedServer: FIGWRIGHT_MCP_SPEC,
    indexedCount: indexed.length,
    liveCount: live.length,
    missingFromIndex,
    unavailableInServer,
    duplicateIndexEntries: [...new Set(duplicateIndexEntries)],
  }, null, 2)}\n`);
  if (!ok) process.exitCode = 2;
}

function runTools(queryParts) {
  const query = queryParts.join(' ').trim().toLowerCase();
  if (!query) {
    fail('请提供工具名称或任务关键词。完整目录输出已被主动禁用。');
  }
  const terms = query.split(/\s+/u).filter(Boolean);
  const catalog = loadCatalog();
  const nameMatches = catalog.filter((tool) => {
    const name = String(tool.name || '').toLowerCase();
    return terms.some((term) => name.includes(term));
  });
  const matches = nameMatches.length > 0 ? nameMatches : catalog.filter((tool) => {
    const haystack = `${tool.name || ''} ${tool.description || ''}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
  const limit = 24;
  process.stdout.write(`${JSON.stringify({
    query,
    matched: matches.length,
    truncated: matches.length > limit,
    tools: matches.slice(0, limit).map((tool) => ({
      name: tool.name,
      description: String(tool.description || '').length > 360
        ? `${String(tool.description).slice(0, 357)}...`
        : tool.description,
    })),
  }, null, 2)}\n`);
  if (matches.length === 0) process.exitCode = 2;
}

function runSchema(toolName) {
  if (!toolName) fail('schema 需要准确的工具名称。');
  const tool = loadCatalog().find((candidate) => candidate.name === toolName);
  if (!tool) fail(`未知的 Figwright 工具：${toolName}`);
  process.stdout.write(`${JSON.stringify(tool, null, 2)}\n`);
}

function readToolArgs(raw) {
  if (raw === undefined) return {};
  let source = raw;
  if (raw === '-') {
    source = readFileSync(0, 'utf8');
  } else if (raw.startsWith('@')) {
    const path = resolve(process.cwd(), raw.slice(1));
    source = readFileSync(path, 'utf8');
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    fail(`工具参数必须是有效的 JSON：${error instanceof Error ? error.message : String(error)}`, 2);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('工具参数必须是 JSON 对象。', 2);
  }
  return parsed;
}

function runCall(toolName, rawArgs) {
  if (!toolName) fail('call 需要工具名称。');
  const result = callFigwrightTool(toolName, readToolArgs(rawArgs));
  if (result.status !== 0 || isToolFailure(result)) {
    process.stderr.write(formatInspectorToolResult(result, { toolName }));
    process.exit(result.status || 2);
  }
  process.stdout.write(formatInspectorToolResult(result, { toolName }));
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'doctor':
      runDoctor();
      break;
    case 'relay':
      runRelay();
      break;
    case 'ping':
      runPing();
      break;
    case 'profile':
      runProfile();
      break;
    case 'launch-url':
      if (!args[0]) fail('launch-url 需要 Figma 设计文件 URL。');
      process.stdout.write(`${buildDrafitoLaunchUrl(args[0])}\n`);
      break;
    case 'catalog-check':
      runCatalogCheck();
      break;
    case 'tools':
      runTools(args);
      break;
    case 'schema':
      runSchema(args[0]);
      break;
    case 'call':
      runCall(args[0], args[1]);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      usage();
      break;
    default:
      usage();
      fail(`未知命令：${command}`, 2);
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const isDirectInvocation = entryPath &&
  realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main();
}
