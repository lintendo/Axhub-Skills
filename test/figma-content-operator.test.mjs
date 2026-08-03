import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
const webpageToFigmaScriptPath = resolve(skillDir, 'scripts/webpage-to-figma.mjs');
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
  'references/webpage-to-figma.md',
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
  assert.match(readme, /`figma-content-operator`/u);
  assert.doesNotMatch(readme, /`figwright-mcp-operator`/u);
  assert.match(interfaceMetadata, /display_name: "Figma 内容操作器"/u);
  assert.match(interfaceMetadata, /\$figma-content-operator/u);
  assert.match(source, /Figma 内容操作器/u);
  assert.doesNotMatch(source, /Figwright MCP Operator/u);
});

test('localizes all user-facing Skill guidance and metadata to Chinese', () => {
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

test('materializes Inspector image blocks without printing base64 to the terminal', async (context) => {
  const module = await import(pathToFileURL(scriptPath));
  const outputRoot = mkdtempSync(join(tmpdir(), 'figwright-images-test-'));
  const imageBytes = Buffer.from('fake-png-bytes');
  const imageData = imageBytes.toString('base64');
  const envelope = {
    result: {
      content: [
        { type: 'text', text: '{"nodeId":"1:42"}' },
        { type: 'image', mimeType: 'image/png', data: imageData },
      ],
    },
  };
  context.after(() => rmSync(outputRoot, { recursive: true, force: true }));

  const imageBlocks = module.extractInspectorImageBlocks('tools/call', envelope);
  const artifacts = module.materializeImageBlocks(imageBlocks, {
    outputRoot,
    toolName: 'get_screenshot',
  });
  const formatted = module.formatCallResult(
    { payload: module.extractInspectorPayload('tools/call', envelope) },
    artifacts,
  );

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].mimeType, 'image/png');
  assert.equal(existsSync(artifacts[0].path), true);
  assert.deepEqual(readFileSync(artifacts[0].path), imageBytes);
  assert.match(formatted, /"nodeId": "1:42"/u);
  assert.match(formatted, /"images"/u);
  assert.match(formatted, /"path"/u);
  assert.doesNotMatch(formatted, new RegExp(imageData, 'u'));

  const imageOnlyEnvelope = {
    result: { content: [{ type: 'image', mimeType: 'image/png', data: imageData }] },
  };
  const imageOnlyFormatted = module.formatCallResult(
    { payload: module.extractInspectorPayload('tools/call', imageOnlyEnvelope) },
    artifacts,
  );
  assert.match(imageOnlyFormatted, new RegExp(artifacts[0].path, 'u'));
  assert.doesNotMatch(imageOnlyFormatted, new RegExp(imageData, 'u'));

  const errorEnvelope = {
    result: {
      isError: true,
      content: [{ type: 'image', mimeType: 'image/png', data: imageData }],
    },
  };
  const errorFormatted = module.formatInspectorToolResult({
    payload: module.extractInspectorPayload('tools/call', errorEnvelope),
    imageBlocks: module.extractInspectorImageBlocks('tools/call', errorEnvelope),
  }, { outputRoot, toolName: 'get_screenshot' });
  assert.match(errorFormatted, /"isError": true/u);
  assert.match(errorFormatted, /"path"/u);
  assert.doesNotMatch(errorFormatted, new RegExp(imageData, 'u'));

  const source = readFileSync(scriptPath, 'utf8');
  const runCallStart = source.indexOf('function runCall');
  const mainStart = source.indexOf('function main', runCallStart);
  assert.notEqual(runCallStart, -1);
  assert.notEqual(mainStart, -1);
  const runCallSource = source.slice(runCallStart, mainStart);
  assert.match(runCallSource, /formatInspectorToolResult\(result/u);
  assert.doesNotMatch(runCallSource, /formatResult\(result\)/u);

  const svgArtifacts = module.materializeImageBlocks([
    {
      type: 'image',
      mimeType: 'image/svg+xml',
      data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),
    },
  ], { outputRoot, toolName: 'get_screenshot' });
  assert.match(svgArtifacts[0].path, /\.svg$/u);

  const guidance = readFileSync(
    resolve(skillDir, 'references/read-and-inspect.md'),
    'utf8',
  );
  assert.match(guidance, /images\[\]\.path/u);
  assert.match(guidance, /图片查看能力/u);
  const toolGuidance = readFileSync(
    resolve(skillDir, 'references/tools/export-and-grounding.md'),
    'utf8',
  );
  assert.match(toolGuidance, /临时文件路径/u);
  assert.doesNotMatch(toolGuidance, /向模型返回/u);
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
  assert.doesNotMatch(skill, /^### Windows（PowerShell）$/mu);
  assert.match(setup, /npx\.cmd/u);
  assert.match(setup, /figwright-operator\.mjs" doctor/u);
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
  assert.equal(config.mcpServers.figwright.connectionTimeout, 30_000);
  assert.equal(config.mcpServers.figwright.requestTimeout, 180_000);
  assert.equal('init_timeout' in config.mcpServers.figwright, false);
  assert.equal('tool_timeout' in config.mcpServers.figwright, false);
  assert.equal(windowsConfig.mcpServers.figwright.command, 'cmd.exe');
  assert.deepEqual(
    windowsConfig.mcpServers.figwright.args,
    ['/d', '/s', '/c', 'npx.cmd', ...config.mcpServers.figwright.args],
  );
  assert.equal(windowsConfig.mcpServers.figwright.connectionTimeout, 30_000);
  assert.equal(windowsConfig.mcpServers.figwright.requestTimeout, 180_000);
  assert.equal('init_timeout' in windowsConfig.mcpServers.figwright, false);
  assert.equal('tool_timeout' in windowsConfig.mcpServers.figwright, false);
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

test('documents compact tool discovery and IPv4 loopback diagnosis', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const setup = readFileSync(
    resolve(skillDir, 'references/setup-and-connect.md'),
    'utf8',
  );
  const tools = readFileSync(toolReferencePath, 'utf8');
  const batchTools = readFileSync(
    resolve(skillDir, 'references/tools/pages-and-batch.md'),
    'utf8',
  );
  const troubleshooting = readFileSync(
    resolve(skillDir, 'references/troubleshooting-and-security.md'),
    'utf8',
  );

  assert.match(skill, /references\/tools\/index\.md/u);
  assert.doesNotMatch(skill, /^## 命令$|^## 固定版本$/mu);
  assert.match(setup, /figwright-operator\.mjs" ping/u);
  assert.match(setup, /figwright-operator\.mjs" profile/u);
  assert.match(tools, /figwright-operator\.mjs" tools <keyword>/u);
  assert.match(tools, /figwright-operator\.mjs" catalog-check/u);
  assert.match(batchTools, /figwright-operator\.mjs" call batch @/u);
  assert.match(troubleshooting, /127\.0\.0\.1:3055/u);
  assert.match(troubleshooting, /localhost.*::1/su);
  assert.match(troubleshooting, /server-only/u);
});

test('routes rendered webpages to clipboard and explicit canvas edits to MCP', () => {
  const skill = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
  const grounding = readFileSync(
    resolve(skillDir, 'references/grounding-workflows.md'),
    'utf8',
  );

  assert.match(skill, /“网页”包括静态 HTML、React、Vue/u);
  assert.match(skill, /先生成网页（HTML\/React\/Vue），还是直接修改 Figma 画布/u);
  assert.match(skill, /明确要求修改当前画布、选区或已有节点时，直接走 Figwright MCP/u);
  assert.match(skill, /references\/webpage-to-figma\.md/u);
  assert.match(skill, /不启动 Relay 或调用 MCP/u);
  assert.doesNotMatch(skill, /node "\$SKILL_DIR\/scripts\/webpage-to-figma\.mjs"/u);
  assert.doesNotMatch(skill, /第三方 Skill，并非 Figwright 官方 CLI/u);
  assert.doesNotMatch(skill, /clipboardHtmlVerified|embeddedAssetCount|missingAssetCount|--official-script|capture\.js/u);
  const webpageReference = readFileSync(
    resolve(skillDir, 'references/webpage-to-figma.md'),
    'utf8',
  );
  assert.match(webpageReference, /scripts\/webpage-to-figma\.mjs/u);
  assert.match(webpageReference, /--manual/u);
  assert.match(webpageReference, /--official-script/u);
  assert.match(webpageReference, /capture\.js/u);
  assert.match(webpageReference, /https:\/\/axhub\.im\/chrome\//u);
  assert.match(webpageReference, /不通过 MCP 创建节点/u);
  assert.match(webpageReference, /覆盖当前剪贴板/u);
  assert.match(webpageReference, /`\.cache` 目录/u);
  assert.match(webpageReference, /clipboardHtmlVerified/u);
  assert.match(webpageReference, /SHA-256/u);
  assert.match(webpageReference, /assetCount.*embeddedAssetCount.*missingAssetCount/u);
  assert.match(webpageReference, /页面上的复制按钮/u);
  assert.match(webpageReference, /Cmd\/Ctrl\+V/u);
  assert.match(grounding, /交付路径不明确时，先询问/u);
  assert.match(grounding, /用户自行粘贴到目标文件/u);
  assert.match(
    grounding,
    /新设计场景中选择直接生成 Figma 内容时，读取 <https:\/\/github\.com\/awdr74100\/figwright\/blob\/v0\.3\.0\/skills\/figma-build\/SKILL\.md>/u,
  );
  assert.match(grounding, /修改当前画布、选区或已有节点时.*不读取上述构建 Skill/u);
  assert.doesNotMatch(grounding, /figma-codegen|如已安装|本 Skill 的 `call` 命令/u);
  assert.doesNotMatch(skill, /figma-build/u);
  assert.doesNotMatch(skill, /scripts\/html-to-figma\.mjs/u);
});

test('ships a focused official clipboard runtime without Figwright writes', () => {
  const runtimePath = resolve(
    skillDir,
    'assets/webpage-to-figma-runtime.js',
  );
  const runtime = readFileSync(runtimePath, 'utf8');
  const script = readFileSync(webpageToFigmaScriptPath, 'utf8');

  assert.equal(existsSync(runtimePath), true);
  assert.match(runtime, /^\/\* Bundled Figma clipboard capture runtime\. \*\//u);
  assert.match(runtime, /__AXHUB_WEBPAGE_TO_FIGMA__/u);
  assert.match(runtime, /serialize:/u);
  assert.match(runtime, /figh2d/u);
  assert.match(runtime, /ClipboardItem/u);
  assert.match(runtime, /embeddedAssetCount/u);
  assert.match(runtime, /missingAssetCount/u);
  assert.doesNotMatch(runtime, /Figma size budget|clipboard limit|25e5/u);
  assert.doesNotMatch(runtime, /callFigwrightTool|writeLayersToFigwright|figwright-operator/u);
  assert.doesNotMatch(script, /callFigwrightTool|writeLayersToFigwright|figwright-operator/u);
  assert.match(script, /pasteboard\.clearContents;/u);
  assert.doesNotMatch(script, /pasteboard\.clearContents\(\)/u);
  assert.doesNotMatch(script, /\/capture\/[^/]+\/submit|captureId:\s*['"]axhub-intercept/u);
});

test('validates webpage copy args and exposes the manual clipboard fallback', async () => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  assert.deepEqual(
    module.parseArgs([
      '--source', 'http://localhost:5173',
      '--selector', '#app',
      '--timeout', '9000',
      '--manual',
    ]),
    {
      source: 'http://localhost:5173',
      selector: '#app',
      timeout: 9000,
      manual: true,
    },
  );
  assert.throws(() => module.parseArgs([]), /--source 是必填参数/u);
  assert.throws(() => module.parseArgs(['--unknown']), /未知参数/u);
  assert.deepEqual(
    module.parseArgs([
      '--source', 'http://localhost:5173',
      '--official-script', 'https://mcp.figma.com/mcp/html-to-design/capture.js',
    ]),
    {
      source: 'http://localhost:5173',
      selector: 'body',
      timeout: 60_000,
      manual: false,
      officialScript: 'https://mcp.figma.com/mcp/html-to-design/capture.js',
    },
  );

  const fallback = module.buildFallbackButtonMarkup();
  assert.match(fallback, /复制到 Figma/u);
  assert.match(fallback, /https:\/\/axhub\.im\/chrome\//u);
  assert.match(fallback, /__axhub_webpage_to_figma_copy__/u);
  assert.deepEqual(
    module.validateCaptureResult({
      success: true,
      assetCount: 4,
      embeddedAssetCount: 4,
      missingAssetCount: 0,
    }),
    {
      success: true,
      assetCount: 4,
      embeddedAssetCount: 4,
      missingAssetCount: 0,
    },
  );
  assert.throws(
    () => module.validateCaptureResult({
      success: false,
      assetCount: 4,
      embeddedAssetCount: 3,
      missingAssetCount: 1,
    }),
    /缺失 1 个/u,
  );
  const expectedHtml = Buffer.from('<span data-h2d="payload"></span>');
  const nativeClipboardResult = module.writeMacOSClipboardHtml(
    expectedHtml.toString('base64'),
    {
      platform: 'darwin',
      execFile: (_command, _args, options) => {
        writeFileSync(options.env.AXHUB_FIGMA_HTML_RESULT, readFileSync(options.env.AXHUB_FIGMA_HTML_SOURCE));
      },
    },
  );
  assert.deepEqual(nativeClipboardResult, {
    supported: true,
    clipboardWriter: 'macos-native',
    expectedBytes: expectedHtml.byteLength,
    actualBytes: expectedHtml.byteLength,
    payloadDigestMatch: true,
    clipboardHtmlVerified: true,
  });
  const mismatchedHtml = Buffer.from('<span data-h2d="other"></span>');
  assert.deepEqual(
    module.verifyClipboardPayload(expectedHtml, mismatchedHtml),
    {
      expectedBytes: expectedHtml.byteLength,
      actualBytes: mismatchedHtml.byteLength,
      payloadDigestMatch: false,
      clipboardHtmlVerified: false,
    },
  );
});

test('downloads an explicitly supplied official script into the Skill cache once', async (context) => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  const cacheDir = mkdtempSync(join(tmpdir(), 'figma-official-script-'));
  const sourceUrl = 'https://mcp.figma.com/mcp/html-to-design/capture.js';
  const officialSource = 'window.figma = { captureForDesign: async () => ({ success: true }) };' +
    '/* official capture fixture */'.repeat(12);
  let fetchCount = 0;
  context.after(() => rmSync(cacheDir, { recursive: true, force: true }));

  const first = await module.resolveOfficialScript(sourceUrl, {
    officialScriptCacheDir: cacheDir,
    fetch: async () => {
      fetchCount += 1;
      return { ok: true, status: 200, text: async () => officialSource };
    },
  });
  const second = await module.resolveOfficialScript(sourceUrl, {
    officialScriptCacheDir: cacheDir,
    fetch: async () => assert.fail('the matching cached URL must not be downloaded again'),
  });
  const cached = await module.resolveOfficialScript('cached', {
    officialScriptCacheDir: cacheDir,
  });

  assert.equal(fetchCount, 1);
  assert.equal(first.downloaded, true);
  assert.equal(second.downloaded, false);
  assert.equal(cached.downloaded, false);
  assert.equal(first.path, join(cacheDir, 'capture.js'));
  assert.equal(readFileSync(first.path, 'utf8'), officialSource);
  assert.equal(second.path, first.path);
  assert.equal(cached.path, first.path);
});

test('copies a rendered page without launching Figwright or MCP', async () => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  const calls = [];
  const page = {
    goto: async (url) => calls.push(['goto', url]),
    addScriptTag: async ({ path }) => calls.push(['runtime', path]),
    evaluate: async (callback) => {
      if (String(callback).includes('runtime.copy')) {
        return {
          success: true,
          payloadSizeKb: 12,
          assetCount: 4,
          embeddedAssetCount: 4,
          missingAssetCount: 0,
        };
      }
      return undefined;
    },
  };
  const context = {
    grantPermissions: async (permissions) => calls.push(['permissions', permissions]),
    newPage: async () => page,
    close: async () => calls.push(['context-close']),
  };
  const browser = {
    newContext: async () => context,
    close: async () => calls.push(['browser-close']),
  };
  const playwright = {
    chromium: {
      launch: async (options) => {
        calls.push(['launch', options]);
        return browser;
      },
    },
  };

  const result = await module.run({
    source: '<!doctype html><main>Invoice</main>',
    selector: 'main',
    timeout: 5_000,
    manual: false,
  }, { playwright, platform: 'linux' });

  assert.equal(result.mode, 'clipboard');
  assert.equal(result.interaction, 'automatic');
  assert.equal(result.payloadSizeKb, 12);
  assert.equal(result.assetCount, 4);
  assert.equal(result.embeddedAssetCount, 4);
  assert.equal(result.missingAssetCount, 0);
  assert.equal(result.clipboardHtmlVerified, null);
  const launchOptions = calls.find(([name]) => name === 'launch')[1];
  assert.equal(launchOptions.headless, true);
  assert.doesNotMatch(launchOptions.args.join(' '), /--no-sandbox/u);
  assert.deepEqual(calls.find(([name]) => name === 'permissions')[1], [
    'clipboard-read',
    'clipboard-write',
  ]);
  assert.match(calls.find(([name]) => name === 'runtime')[1], /webpage-to-figma-runtime\.js$/u);
  await assert.rejects(
    module.run({
      source: webpageToFigmaScriptPath,
      selector: 'body',
      timeout: 5_000,
      manual: false,
    }, { playwright }),
    /本地源必须是 HTML 文件/u,
  );
});

test('writes serialized H2D HTML through the native macOS clipboard path', async () => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  const calls = [];
  const htmlBytes = Buffer.from('<span data-h2d="payload"></span>');
  const page = {
    goto: async (url) => calls.push(['goto', url]),
    addScriptTag: async ({ path }) => calls.push(['runtime', path]),
    evaluate: async (callback) => {
      if (String(callback).includes('runtime.serialize')) {
        return {
          success: true,
          payloadSizeKb: 12,
          assetCount: 4,
          embeddedAssetCount: 4,
          missingAssetCount: 0,
          htmlBase64: htmlBytes.toString('base64'),
        };
      }
      return undefined;
    },
  };
  const context = {
    grantPermissions: async () => {},
    newPage: async () => page,
    close: async () => calls.push(['context-close']),
  };
  const browser = {
    newContext: async () => context,
    close: async () => calls.push(['browser-close']),
  };
  const playwright = {
    chromium: {
      launch: async () => browser,
    },
  };

  const result = await module.run({
    source: '<!doctype html><main>Invoice</main>',
    selector: 'main',
    timeout: 5_000,
    manual: false,
  }, {
    playwright,
    platform: 'darwin',
    execFile: (_command, _args, options) => {
      writeFileSync(options.env.AXHUB_FIGMA_HTML_RESULT, readFileSync(options.env.AXHUB_FIGMA_HTML_SOURCE));
    },
  });

  assert.equal(result.interaction, 'automatic');
  assert.equal(result.method, 'axhub-runtime');
  assert.equal(result.clipboardWriter, 'macos-native');
  assert.equal(result.clipboardHtmlVerified, true);
  assert.equal(result.payloadDigestMatch, true);
  assert.equal(result.expectedBytes, htmlBytes.byteLength);
  assert.equal(result.actualBytes, htmlBytes.byteLength);
  assert.equal(calls.filter(([name]) => name === 'runtime').length, 1);
});

test('injects an explicitly supplied official script and uses its clipboard flow', async (context) => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  const cacheDir = mkdtempSync(join(tmpdir(), 'figma-official-injection-'));
  const officialSource = 'window.figma = { captureForDesign: async () => ({ success: true }) };' +
    '/* official capture fixture */'.repeat(12);
  const calls = [];
  context.after(() => rmSync(cacheDir, { recursive: true, force: true }));

  const page = {
    goto: async (url) => calls.push(['goto', url]),
    addScriptTag: async ({ path }) => calls.push(['script', path]),
    evaluate: async (callback) => {
      if (String(callback).includes('captureForDesign')) {
        calls.push(['official-copy']);
        return { success: true };
      }
      return undefined;
    },
  };
  const contextState = {
    grantPermissions: async () => {},
    newPage: async () => page,
    close: async () => {},
  };
  const playwright = {
    chromium: {
      launch: async () => ({
        newContext: async () => contextState,
        close: async () => {},
      }),
    },
  };

  const result = await module.run({
    source: '<!doctype html><main>Invoice</main>',
    selector: 'main',
    timeout: 5_000,
    manual: false,
    officialScript: 'https://mcp.figma.com/mcp/html-to-design/capture.js',
  }, {
    playwright,
    officialScriptCacheDir: cacheDir,
    fetch: async () => ({ ok: true, status: 200, text: async () => officialSource }),
  });

  assert.equal(result.mode, 'clipboard');
  assert.equal(result.method, 'official-script');
  assert.equal(result.success, true);
  assert.equal(calls.filter(([name]) => name === 'script').length, 2);
  assert.match(calls.find(([name, path]) => name === 'script' && /capture\.js$/u.test(path))[1], /capture\.js$/u);
  assert.equal(calls.filter(([name]) => name === 'official-copy').length, 1);
  assert.match(String(module.copyFromOfficialPage), /__axhub_webpage_to_figma_fallback__/u);
  assert.doesNotMatch(String(module.copyFromOfficialPage), /endpoint|captureId/u);
});

test('serves relative and root-relative assets for a local HTML page', async (context) => {
  const module = await import(pathToFileURL(webpageToFigmaScriptPath));
  const tempDir = mkdtempSync(join(tmpdir(), 'webpage-to-figma-source-'));
  const htmlPath = join(tempDir, 'index.html');
  const cssPath = join(tempDir, 'styles.css');
  context.after(() => rmSync(tempDir, { recursive: true, force: true }));
  writeFileSync(htmlPath, '<link rel="stylesheet" href="/styles.css"><main>Invoice</main>');
  writeFileSync(cssPath, 'main { color: rgb(1, 2, 3); }');

  const source = await module.prepareSource(htmlPath);
  try {
    const htmlResponse = await fetch(source.url);
    const relativeCssResponse = await fetch(new URL('styles.css', source.url));
    const rootCssResponse = await fetch(new URL('/styles.css', source.url));
    assert.equal(htmlResponse.status, 200);
    assert.equal(relativeCssResponse.status, 200);
    assert.equal(rootCssResponse.status, 200);
    assert.match(await rootCssResponse.text(), /rgb\(1, 2, 3\)/u);
  } finally {
    await source.close();
  }
});

test('describes the webpage CLI and keeps React and Vue on rendered URLs', () => {
  const result = spawnSync(process.execPath, [webpageToFigmaScriptPath, '--help'], {
    cwd: appDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /网页 → Figma 剪贴板（不使用 MCP）/u);
  assert.match(result.stdout, /React\/Vue 等项目请先启动开发服务器/u);
  assert.match(result.stdout, /--manual/u);
  assert.match(result.stdout, /--official-script/u);
  assert.match(result.stdout, /本技能的 \.cache 目录/u);
});
