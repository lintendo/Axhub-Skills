import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(testDir, '..');
const skillName = 'figma-content-operator';
const skillDir = resolve(appDir, `skills/${skillName}`);
const scriptPath = resolve(skillDir, 'scripts/figwright-operator.mjs');
const configPath = resolve(skillDir, 'assets/figwright.mcp.json');
const windowsConfigPath = resolve(skillDir, 'assets/figwright.windows.mcp.json');
const toolIndexPath = resolve(skillDir, 'assets/tool-index.json');
const toolReferencePath = resolve(skillDir, 'references/tools/index.md');
const localizedMarkdownPaths = [
  'SKILL.md',
  'references/design-systems-and-advanced.md',
  'references/edit-canvas.md',
  'references/grounding-workflows.md',
  'references/read-and-inspect.md',
  'references/setup-and-connect.md',
  'references/troubleshooting-and-security.md',
  'references/tools/canvas-content.md',
  'references/tools/components-and-prototypes.md',
  'references/tools/export-and-grounding.md',
  'references/tools/index.md',
  'references/tools/inspect.md',
  'references/tools/layout-and-structure.md',
  'references/tools/pages-and-batch.md',
  'references/tools/styles-and-variables.md',
];

const run = (...args) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: appDir,
    encoding: 'utf8',
  });

test('publishes the generic Figma skill name consistently', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const source = readFileSync(scriptPath, 'utf8');
  const evals = JSON.parse(
    readFileSync(resolve(skillDir, 'evals/evals.json'), 'utf8'),
  );
  const interfaceMetadata = readFileSync(
    resolve(skillDir, 'agents/openai.yaml'),
    'utf8',
  );
  const readme = readFileSync(resolve(appDir, 'README.md'), 'utf8');

  assert.match(skill, /^name: figma-content-operator$/mu);
  assert.match(
    skill,
    /^description: 用于处理涉及检查、读取、创建、编辑、导出或代码映射的 Figma 内容任务/mu,
  );
  assert.match(skill, /^# Figma 内容操作器$/mu);
  assert.equal(evals.skill_name, skillName);
  assert.match(readme, /`figma-content-operator`/u);
  assert.doesNotMatch(readme, /`figwright-mcp-operator`/u);
  assert.match(interfaceMetadata, /display_name: "Figma 内容操作器"/u);
  assert.match(interfaceMetadata, /\$figma-content-operator/u);
  assert.match(source, /Figma 内容操作器/u);
  assert.doesNotMatch(source, /Figwright MCP Operator/u);
});

test('localizes all user-facing Skill guidance and evaluation text to Chinese', () => {
  const chineseText = /[\u3400-\u9fff]/u;
  for (const relativePath of localizedMarkdownPaths) {
    const contents = readFileSync(resolve(skillDir, relativePath), 'utf8');
    assert.match(contents, chineseText, `${relativePath} must contain Chinese guidance`);
  }

  const interfaceMetadata = readFileSync(
    resolve(skillDir, 'agents/openai.yaml'),
    'utf8',
  );
  assert.match(interfaceMetadata, /short_description: "[^"]*[\u3400-\u9fff][^"]*"/u);
  assert.match(interfaceMetadata, /default_prompt: "[^"]*[\u3400-\u9fff][^"]*"/u);

  const evals = JSON.parse(
    readFileSync(resolve(skillDir, 'evals/evals.json'), 'utf8'),
  );
  for (const evaluation of evals.evals) {
    assert.match(evaluation.expected_output, chineseText);
    for (const expectation of evaluation.expectations) {
      assert.match(expectation, chineseText);
    }
  }

  const help = run('--help');
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Figma 内容操作器/u);
  assert.match(help.stdout, /用法：/u);
});

test('publishes validator-compatible frontmatter without losing runtime requirements', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\n(?<yaml>[\s\S]*?)\n---/u.exec(skill)?.groups?.yaml;
  const keys = frontmatter
    ?.split('\n')
    .map((line) => /^([a-z][a-z-]*):/u.exec(line)?.[1])
    .filter(Boolean);

  assert.deepEqual(keys, ['name', 'description']);
  assert.match(skill, /^## 运行要求$/mu);
  assert.match(skill, /Node\.js `22\.19\+`/u);
  assert.match(skill, /当前版本的 Drafito 或上游 Figwright 插件/u);
});

test('generates the published Drafito launch contract without losing the node id', () => {
  const result = run(
    'launch-url',
    'https://www.figma.com/design/file-id/Untitled?node-id=1-3',
  );
  assert.equal(result.status, 0, result.stderr);
  const url = new URL(result.stdout.trim());
  assert.equal(url.searchParams.get('node-id'), '1-3');
  assert.equal(url.searchParams.get('try-plugin-id'), '1337683962156635228');
  assert.equal(url.searchParams.get('try-plugin-version-id'), '191364');
  assert.equal(url.searchParams.get('try-plugin-name'), 'Drafito');
  assert.equal(url.searchParams.get('is-playground-file'), '1');
});

test('rejects non-design URLs before attempting any external command', () => {
  const result = run('launch-url', 'https://www.figma.com/files/team/123');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /只能从 Figma 设计文件 URL 启动/u);
});

test('validates tool args locally before starting MCP Inspector', () => {
  const result = run('call', 'set_text', '{not-json}');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /有效的 JSON/u);
  assert.equal(result.stdout, '');
});

test('runs normally when invoked through a symlinked Skill path', (context) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'figma-content-operator-'));
  const linkedSkillDir = join(tempDir, 'figma-content-operator');
  const linkedScript = join(linkedSkillDir, 'scripts/figwright-operator.mjs');
  context.after(() => rmSync(tempDir, { recursive: true, force: true }));
  symlinkSync(skillDir, linkedSkillDir, process.platform === 'win32' ? 'junction' : 'dir');

  const result = spawnSync(process.execPath, [linkedScript, '--help'], {
    cwd: appDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Figma 内容操作器/u);
});

test('classifies plugin transport failures even when the MCP client exits zero', async () => {
  const { isToolFailure } = await import(pathToFileURL(scriptPath));

  assert.equal(
    isToolFailure({
      body: 'plugin request timeout (method=get_selection)',
      payload: undefined,
    }),
    true,
  );
  assert.equal(
    isToolFailure({
      body: 'pinned session not connected (sessionId=abc, method=get_node)',
      payload: undefined,
    }),
    true,
  );
  assert.equal(
    isToolFailure({
      body: '✗ Tool execution failed: No server found for tool: unknown',
      payload: undefined,
    }),
    true,
  );
  assert.equal(
    isToolFailure({ body: '{"ok":true}', payload: { ok: true } }),
    false,
  );
});

test('supports the MCP Inspector Node floor and unwraps Inspector JSON envelopes', async () => {
  const module = await import(pathToFileURL(scriptPath));

  assert.equal(typeof module.isSupportedNodeVersion, 'function');
  assert.equal(module.isSupportedNodeVersion('v20.19.5'), false);
  assert.equal(module.isSupportedNodeVersion('v22.18.0'), false);
  assert.equal(module.isSupportedNodeVersion('v22.19.0'), true);
  assert.equal(module.isSupportedNodeVersion('v24.0.0'), true);

  assert.equal(typeof module.extractInspectorPayload, 'function');
  assert.deepEqual(
    module.extractInspectorPayload('tools/list', {
      result: { tools: [{ name: 'ping' }] },
    }),
    { tools: [{ name: 'ping' }] },
  );
  assert.deepEqual(
    module.extractInspectorPayload('tools/call', {
      result: { content: [{ type: 'text', text: '{"ok":true}' }] },
    }),
    { ok: true },
  );

  const errorPayload = module.extractInspectorPayload('tools/call', {
    result: {
      isError: true,
      content: [{ type: 'text', text: '{"code":"INVALID_PARAMS"}' }],
    },
  });
  assert.equal(errorPayload.isError, true);
  assert.equal(
    module.isToolFailure({ body: JSON.stringify(errorPayload), payload: errorPayload }),
    true,
  );
});

test('accepts only complete end-to-end Figma and metadata contracts', async () => {
  const { isEndToEndPingPayload, isMetadataPayload } = await import(
    pathToFileURL(scriptPath)
  );
  const validPing = {
    ok: true,
    hop: 'e2e',
    plugin: {
      editorType: 'figma',
      currentPageId: '1:1',
      currentPageName: 'Cover',
    },
  };
  const validMetadata = {
    fileName: 'Product',
    currentPage: { id: '1:1', name: 'Cover' },
    pages: [{ id: '1:1', name: 'Cover' }],
  };

  assert.equal(isEndToEndPingPayload(validPing), true);
  assert.equal(isEndToEndPingPayload({ ...validPing, ok: false }), false);
  assert.equal(
    isEndToEndPingPayload({ ...validPing, plugin: { editorType: 'figjam' } }),
    false,
  );
  assert.equal(isMetadataPayload(validMetadata), true);
  assert.equal(isMetadataPayload({ error: 'METHOD_NOT_FOUND' }), false);
  assert.equal(
    isMetadataPayload({ ...validMetadata, currentPage: undefined }),
    false,
  );
});

test('selects safe MCP launch commands and configs for each platform', async () => {
  const { resolvePlatformCommands, resolveRelayInvocation } = await import(
    pathToFileURL(scriptPath)
  );
  const comSpec = 'C:\\Windows\\System32\\cmd.exe';
  const windows = resolvePlatformCommands('win32', { ComSpec: comSpec });
  const macOS = resolvePlatformCommands('darwin');
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const setup = readFileSync(
    resolve(skillDir, 'references/setup-and-connect.md'),
    'utf8',
  );

  assert.equal(windows.npxCommand, comSpec);
  assert.deepEqual(windows.npxArgsPrefix, ['/d', '/s', '/c', 'npx.cmd']);
  assert.match(windows.mcpConfigPath, /figwright\.windows\.mcp\.json$/u);
  assert.equal(macOS.npxCommand, 'npx');
  assert.deepEqual(macOS.npxArgsPrefix, []);
  assert.match(macOS.mcpConfigPath, /figwright\.mcp\.json$/u);
  assert.deepEqual(resolveRelayInvocation('darwin'), {
    command: 'npx',
    args: ['-y', '@figwright/mcp@0.3.0'],
  });
  assert.deepEqual(resolveRelayInvocation('win32', { ComSpec: comSpec }), {
    command: comSpec,
    args: ['/d', '/s', '/c', 'npx.cmd', '-y', '@figwright/mcp@0.3.0'],
  });
  assert.match(skill, /^### Windows（PowerShell）$/mu);
  assert.match(skill, /\$skillDir = \(Resolve-Path/u);
  assert.match(setup, /npx\.cmd/u);
});

test('starts the task relay before presenting the Drafito launch link and cleans it up', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const setup = readFileSync(
    resolve(skillDir, 'references/setup-and-connect.md'),
    'utf8',
  );
  const troubleshooting = readFileSync(
    resolve(skillDir, 'references/troubleshooting-and-security.md'),
    'utf8',
  );
  const help = run('--help');

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /figwright-operator\.mjs relay/u);
  assert.ok(
    setup.indexOf('figwright-operator.mjs" relay') <
      setup.indexOf('figwright-operator.mjs" launch-url'),
    'the task relay must start before generating the launch URL',
  );
  assert.match(skill, /任务完成、取消或失败后，停止本次启动的准确 Relay 进程/u);
  assert.match(setup, /Relay 就绪后再发送插件启动链接/u);
  assert.match(troubleshooting, /不要在 Relay 启动前要求用户运行 Drafito/u);
  assert.match(skill, /不要尝试启动、关闭或替用户管理 Drafito 插件本身/u);
});

test('wires the repository test suite into the package script', () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(appDir, 'package.json'), 'utf8'),
  );

  assert.equal(packageJson.scripts.test, 'node --test');
});

test('pins the tested server and official MCP Inspector CLI versions', () => {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const windowsConfig = JSON.parse(readFileSync(windowsConfigPath, 'utf8'));
  assert.deepEqual(config.mcpServers.figwright.args, ['-y', '@figwright/mcp@0.3.0']);
  assert.equal(config.mcpServers.figwright.command, 'npx');
  assert.equal(windowsConfig.mcpServers.figwright.command, 'cmd.exe');
  assert.deepEqual(
    windowsConfig.mcpServers.figwright.args,
    ['/d', '/s', '/c', 'npx.cmd', ...config.mcpServers.figwright.args],
  );
  const source = readFileSync(scriptPath, 'utf8');
  assert.match(source, /@modelcontextprotocol\/inspector@2\.0\.0/u);
  assert.match(source, /'--cli'/u);
  assert.match(source, /'--method'/u);
  assert.match(source, /'--format',\s*'json'/u);
  assert.match(source, /'--tool-args-json'/u);
  assert.doesNotMatch(source, /mcp-cli|MCP_CLI_SPEC|uvx|UVX_COMMAND/iu);
  assert.match(source, /resolvePlatformCommands\(process\.platform\)/u);
  assert.match(source, /name: tool\.name/u);
  assert.match(source, /String\(tool\.description/u);
});

test('omits unreleased Drafito compatibility and obsolete local prerequisites', () => {
  const paths = [
    'SKILL.md',
    'references/design-systems-and-advanced.md',
    'references/setup-and-connect.md',
    'references/troubleshooting-and-security.md',
    'evals/evals.json',
    'scripts/figwright-operator.mjs',
  ];
  const corpus = paths
    .map((relativePath) => readFileSync(resolve(skillDir, relativePath), 'utf8'))
    .join('\n');

  assert.doesNotMatch(
    corpus,
    /outdated-drafito-build|Axhub Figwright adapter|旧版 Drafito|旧适配器|旧工具子集|旧版构建|versionSkew/u,
  );
  assert.doesNotMatch(corpus, /Astral|uvx|mcp-cli|IBM/iu);
  assert.doesNotMatch(corpus, /同一台机器/u);
  assert.match(corpus, /@modelcontextprotocol\/inspector@2\.0\.0/u);
});

test('indexes all 104 pinned tools exactly once with progressive references', () => {
  const index = JSON.parse(readFileSync(toolIndexPath, 'utf8'));
  const tools = index.domains.flatMap((domain) => domain.tools);
  const uniqueTools = new Set(tools);
  const compactReference = readFileSync(toolReferencePath, 'utf8');

  assert.equal(index.server, '@figwright/mcp@0.3.0');
  assert.equal(index.toolCount, 104);
  assert.equal(tools.length, 104);
  assert.equal(uniqueTools.size, 104);
  assert.equal(index.domains.length, 7);

  for (const domain of index.domains) {
    const domainReference = resolve(skillDir, domain.reference);
    assert.match(domain.reference, /^references\/tools\//u);
    assert.ok(
      compactReference.includes(`\`${domain.reference}\``),
      `compact index must link ${domain.reference} from the Skill root`,
    );
    assert.doesNotThrow(() => readFileSync(domainReference, 'utf8'));
    for (const tool of domain.tools) {
      assert.match(compactReference, new RegExp(`\\b${tool}\\b`, 'u'));
    }
  }
});

test('covers the published inspect, edit, export, and grounding capabilities in evals', () => {
  const evals = JSON.parse(
    readFileSync(resolve(skillDir, 'evals/evals.json'), 'utf8'),
  );
  const corpus = JSON.stringify(evals.evals);

  assert.match(corpus, /get_selection/u);
  assert.match(corpus, /set_text/u);
  assert.match(corpus, /save_screenshots|save_image_fills|export_pdf/u);
  assert.match(corpus, /analyze_project|scan_components|component_map|token_map/u);
});

test('documents third-party positioning and IPv4 loopback diagnosis', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const troubleshooting = readFileSync(
    resolve(skillDir, 'references/troubleshooting-and-security.md'),
    'utf8',
  );

  assert.match(skill, /第三方 Skill，并非 Figwright 官方 CLI/u);
  assert.match(skill, /references\/tools\/index\.md/u);
  assert.match(troubleshooting, /127\.0\.0\.1:3055/u);
  assert.match(troubleshooting, /localhost.*::1/su);
  assert.match(troubleshooting, /server-only/u);
});
