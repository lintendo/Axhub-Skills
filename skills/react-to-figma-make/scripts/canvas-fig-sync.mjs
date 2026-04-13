import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeBinarySchema, compileSchema } from 'kiwi-schema/kiwi-esm.js';
import { inflateRaw } from 'pako/dist/pako.esm.mjs';

const PRELUDE_LENGTH = 8;
const VERSION_OFFSET = PRELUDE_LENGTH;
const PARTS_OFFSET = VERSION_OFFSET + 4;
const DEFAULT_SOURCE_ROOT = 'src';
const MANIFEST_FILENAME = 'canvas.code-manifest.json';

function printUsage() {
  console.log(`Usage:
  node canvas-fig-sync.mjs inspect --fig <canvas.fig> [--manifest <file>]
  node canvas-fig-sync.mjs extract --fig <canvas.fig> --out <project-dir> [--source-root src] [--manifest <file>]
  node canvas-fig-sync.mjs pack --fig <canvas.fig> --from <project-dir> [--source-root src] [--out <new-canvas.fig>] [--manifest <file>] [--prune-missing] [--sanitize-for-export]
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return { command: 'help', options: {} };
  }

  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return { command, options };
}

function getRequiredOption(options, key) {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function resolvePath(value) {
  return path.resolve(value);
}

function sha1(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function normalizeRelativePath(value) {
  const normalized = path.posix.normalize(value).replace(/^\/+/, '');
  if (!normalized || normalized === '.') {
    return '';
  }
  if (normalized.startsWith('../') || normalized === '..') {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return normalized;
}

function joinLogicalPath(codeFilePath, name) {
  const basePath = codeFilePath ? normalizeRelativePath(toPosixPath(codeFilePath)) : '';
  const fileName = normalizeRelativePath(name);
  return basePath ? path.posix.join(basePath, fileName) : fileName;
}

function normalizeSourceRoot(sourceRoot) {
  return normalizeRelativePath(toPosixPath(sourceRoot || DEFAULT_SOURCE_ROOT));
}

function guidToString(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }

  if (value.guid && typeof value.guid === 'object') {
    return guidToString(value.guid);
  }

  if (typeof value.sessionID === 'number' && typeof value.localID === 'number') {
    return `${value.sessionID}:${value.localID}`;
  }

  return '';
}

function createCollaborativeSourceCode(sourceCode, sessionID = 1) {
  const contentBuffer = Uint8Array.from(Buffer.from(sourceCode, 'utf8'));
  return {
    historyOpsWithIds: [
      {
        firstId: { sessionID, counterID: 1 },
        runLength: sourceCode.length,
        parentIds: [],
      },
    ],
    historyOpsWithLoc: [
      {
        type: 'INSERT',
        range: { startIndex: 0, endIndexExclusive: sourceCode.length },
        contentBytesInBuffer: { startIndex: 0, endIndexExclusive: contentBuffer.length },
      },
    ],
    historyStringContentBuffer: contentBuffer,
  };
}

function resolveProjectFilePath(projectDir, sourceRoot, logicalPath) {
  const root = normalizeSourceRoot(sourceRoot);
  const relativePath = root ? path.posix.join(root, logicalPath) : logicalPath;
  return path.resolve(projectDir, ...relativePath.split('/'));
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseArchive(buffer) {
  if (buffer.byteLength < PARTS_OFFSET) {
    throw new Error('Archive is too small.');
  }

  const prelude = Buffer.from(buffer.subarray(0, PRELUDE_LENGTH)).toString('utf8');
  const version = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(
    VERSION_OFFSET,
    true,
  );
  const parts = [];
  let offset = PARTS_OFFSET;

  while (offset + 4 <= buffer.byteLength) {
    const size = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;
    if (offset + size > buffer.byteLength) {
      throw new Error(`Invalid archive bounds at offset ${offset}.`);
    }
    parts.push(buffer.subarray(offset, offset + size));
    offset += size;
  }

  return { prelude, version, parts };
}

function encodeArchive({ prelude, version, parts }) {
  const totalLength =
    PARTS_OFFSET + parts.reduce((sum, part) => sum + 4 + Buffer.byteLength(part), 0);
  const output = Buffer.alloc(totalLength);

  output.write(prelude, 0, PRELUDE_LENGTH, 'utf8');
  output.writeUInt32LE(version, VERSION_OFFSET);

  let offset = PARTS_OFFSET;
  for (const part of parts) {
    const buffer = Buffer.from(part);
    output.writeUInt32LE(buffer.length, offset);
    offset += 4;
    buffer.copy(output, offset);
    offset += buffer.length;
  }

  return output;
}

function loadCanvasFig(figPath) {
  const archiveBytes = new Uint8Array(fs.readFileSync(figPath));
  const { prelude, version, parts } = parseArchive(archiveBytes);

  if (prelude !== 'fig-make') {
    throw new Error(`Unsupported prelude: ${prelude}`);
  }
  if (parts.length !== 2) {
    throw new Error(`Expected 2 archive parts, got ${parts.length}`);
  }

  const schemaPart = parts[0];
  const messagePart = parts[1];
  const schemaBytes = inflateRaw(schemaPart);
  const schema = decodeBinarySchema(schemaBytes);
  const compiled = compileSchema(schema);
  const messageBytes = new Uint8Array(zlib.zstdDecompressSync(Buffer.from(messagePart)));
  const message = compiled.decodeMessage(messageBytes);

  return {
    figPath,
    prelude,
    version,
    schemaPart,
    compiled,
    message,
  };
}

function buildCodeFileEntries(message) {
  const codeEntries = [];

  for (const [nodeChangeIndex, node] of (message.nodeChanges || []).entries()) {
    if (node?.type !== 'CODE_FILE') {
      continue;
    }

    const name = node.name || `unnamed-${nodeChangeIndex}`;
    const codeFilePath = node.codeFilePath || '';
    const logicalPath = joinLogicalPath(codeFilePath, name);
    const sourceCode = node.sourceCode || '';

    codeEntries.push({
      nodeChangeIndex,
      node,
      name,
      codeFilePath,
      logicalPath,
      sourceCode,
      sourceCodeSha1: sha1(sourceCode),
    });
  }

  const duplicateMap = new Map();
  for (const entry of codeEntries) {
    duplicateMap.set(entry.logicalPath, (duplicateMap.get(entry.logicalPath) || 0) + 1);
  }

  return codeEntries.map((entry) => ({
    ...entry,
    isDuplicate: (duplicateMap.get(entry.logicalPath) || 0) > 1,
    duplicateCount: duplicateMap.get(entry.logicalPath) || 1,
  }));
}

function summarizeEntries(entries) {
  const pathCounts = new Map();
  const duplicateGroups = [];
  const grouped = new Map();

  for (const entry of entries) {
    const codeFilePath = entry.codeFilePath || '(root)';
    pathCounts.set(codeFilePath, (pathCounts.get(codeFilePath) || 0) + 1);

    if (!grouped.has(entry.logicalPath)) {
      grouped.set(entry.logicalPath, []);
    }
    grouped.get(entry.logicalPath).push(entry.nodeChangeIndex);
  }

  for (const [logicalPath, indices] of grouped.entries()) {
    if (indices.length > 1) {
      duplicateGroups.push({
        logicalPath,
        nodeChangeIndices: indices,
      });
    }
  }

  return {
    totalCodeFiles: entries.length,
    pathCounts: Object.fromEntries([...pathCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    duplicateGroups,
  };
}

function collectCodeGraph(message) {
  const codeFiles = [];
  const codeFilesByGuid = new Map();
  const codeFilesByLogicalPath = new Map();

  for (const [nodeChangeIndex, node] of (message.nodeChanges || []).entries()) {
    if (node?.type !== 'CODE_FILE') {
      continue;
    }

    const logicalPath = joinLogicalPath(node.codeFilePath || '', node.name || `unnamed-${nodeChangeIndex}`);
    const guid = guidToString(node.guid);
    const codeFile = {
      nodeChangeIndex,
      node,
      guid,
      logicalPath,
    };
    codeFiles.push(codeFile);

    if (guid) {
      codeFilesByGuid.set(guid, codeFile);
    }
    if (!codeFilesByLogicalPath.has(logicalPath)) {
      codeFilesByLogicalPath.set(logicalPath, []);
    }
    codeFilesByLogicalPath.get(logicalPath).push(codeFile);
  }

  return {
    codeFiles,
    codeFilesByGuid,
    codeFilesByLogicalPath,
  };
}

function listRelativeImportSpecifiers(sourceCode) {
  const specifiers = new Set();
  const patterns = [
    /import\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /export\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(sourceCode); match; match = pattern.exec(sourceCode)) {
      const specifier = match[1];
      if (specifier && specifier.startsWith('.')) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

function resolveImportToLogicalPath(fromLogicalPath, specifier, availableLogicalPaths) {
  const baseDir = path.posix.dirname(fromLogicalPath);
  const normalizedBaseDir = baseDir === '.' ? '' : baseDir;
  const resolvedBase = path.posix.normalize(
    normalizedBaseDir ? path.posix.join(normalizedBaseDir, specifier) : specifier,
  );

  const candidates = [
    resolvedBase,
    `${resolvedBase}.ts`,
    `${resolvedBase}.tsx`,
    `${resolvedBase}.js`,
    `${resolvedBase}.jsx`,
    `${resolvedBase}.css`,
    path.posix.join(resolvedBase, 'index.ts'),
    path.posix.join(resolvedBase, 'index.tsx'),
    path.posix.join(resolvedBase, 'index.js'),
    path.posix.join(resolvedBase, 'index.jsx'),
    path.posix.join(resolvedBase, 'index.css'),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRelativePath(candidate);
    if (availableLogicalPaths.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

function sanitizeForExport(message) {
  const warnings = [];
  const codeGraph = collectCodeGraph(message);
  const availableLogicalPaths = new Set(codeGraph.codeFiles.map((codeFile) => codeFile.logicalPath));
  const existingCodeFileGuids = new Set(codeGraph.codeFiles.map((codeFile) => codeFile.guid).filter(Boolean));
  let clearedChatMessageCount = 0;
  let clearedLibraryCount = 0;
  let rebuiltImportReferenceCount = 0;
  let prunedDanglingImportReferenceCount = 0;
  let prunedCodeComponentCount = 0;
  let clearedCodeInstanceSnapshotCount = 0;

  for (const node of message.nodeChanges || []) {
    if (node?.type !== 'CODE_LIBRARY') {
      continue;
    }

    const chatMessages = Array.isArray(node.chatMessages) ? node.chatMessages : [];
    if (chatMessages.length > 0) {
      clearedChatMessageCount += chatMessages.length;
      node.chatMessages = [];
    }
    if (node.chatCompressionState !== undefined) {
      delete node.chatCompressionState;
    }
    clearedLibraryCount += 1;
  }

  for (const node of message.nodeChanges || []) {
    if (node?.type !== 'CODE_INSTANCE') {
      continue;
    }

    if (node.codeSnapshot !== undefined) {
      delete node.codeSnapshot;
      clearedCodeInstanceSnapshotCount += 1;
    }
  }

  for (const codeFile of codeGraph.codeFiles) {
    const importedLogicalPaths = [];
    for (const specifier of listRelativeImportSpecifiers(codeFile.node.sourceCode || '')) {
      const resolved = resolveImportToLogicalPath(codeFile.logicalPath, specifier, availableLogicalPaths);
      if (resolved) {
        importedLogicalPaths.push(resolved);
        continue;
      }
      warnings.push(`Unresolved relative import ${specifier} in ${codeFile.logicalPath}; omitted from importedCodeFiles.`);
    }

    const uniqueImportedPaths = [...new Set(importedLogicalPaths)].filter(
      (logicalPath) => logicalPath !== codeFile.logicalPath,
    );

    const nextEntries = [];
    for (const logicalPath of uniqueImportedPaths) {
      const target = codeGraph.codeFilesByLogicalPath.get(logicalPath)?.[0];
      if (!target?.guid) {
        continue;
      }
      nextEntries.push({
        codeFileId: {
          guid: target.node.guid,
        },
      });
    }

    const previousEntries = Array.isArray(codeFile.node.importedCodeFiles?.entries)
      ? codeFile.node.importedCodeFiles.entries
      : [];
    const previousGuidCount = previousEntries.filter((entry) => existingCodeFileGuids.has(guidToString(entry?.codeFileId))).length;
    prunedDanglingImportReferenceCount += Math.max(0, previousEntries.length - previousGuidCount);
    rebuiltImportReferenceCount += nextEntries.length;

    if (nextEntries.length > 0) {
      codeFile.node.importedCodeFiles = { entries: nextEntries };
    } else {
      delete codeFile.node.importedCodeFiles;
    }
  }

  message.nodeChanges = (message.nodeChanges || []).filter((node) => {
    if (node?.type !== 'CODE_COMPONENT') {
      return true;
    }

    const exportedFromGuid = guidToString(node.exportedFromCodeFileId);
    if (exportedFromGuid && existingCodeFileGuids.has(exportedFromGuid)) {
      return true;
    }

    prunedCodeComponentCount += 1;
    warnings.push(`Pruned CODE_COMPONENT ${node.name || '(unnamed)'} because exportedFromCodeFileId no longer exists.`);
    return false;
  });

  return {
    warnings,
    clearedChatMessageCount,
    clearedLibraryCount,
    clearedCodeInstanceSnapshotCount,
    rebuiltImportReferenceCount,
    prunedDanglingImportReferenceCount,
    prunedCodeComponentCount,
  };
}

function buildBaseManifest(command, figData, entries, sourceRoot) {
  const summary = summarizeEntries(entries);
  return {
    command,
    generatedAt: new Date().toISOString(),
    figPath: figData.figPath,
    archive: {
      prelude: figData.prelude,
      version: figData.version,
      parts: 2,
    },
    sourceRoot: normalizeSourceRoot(sourceRoot),
    summary,
  };
}

function defaultManifestPath(command, figPath, options) {
  if (options.manifest) {
    return resolvePath(options.manifest);
  }

  const figBaseName = path.basename(
    command === 'pack' ? resolvePath(options.out || options.fig) : resolvePath(options.fig),
    path.extname(command === 'pack' ? resolvePath(options.out || options.fig) : resolvePath(options.fig)),
  );

  if (command === 'extract') {
    return path.resolve(resolvePath(options.out), MANIFEST_FILENAME);
  }

  const baseDir =
    command === 'pack'
      ? path.dirname(resolvePath(options.out || options.fig))
      : path.dirname(resolvePath(options.fig));
  return path.resolve(baseDir, `${figBaseName}.code-manifest.json`);
}

function writeManifest(manifestPath, manifest) {
  ensureParentDirectory(manifestPath);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function extractCommand(options) {
  const figPath = resolvePath(getRequiredOption(options, 'fig'));
  const outputDir = resolvePath(getRequiredOption(options, 'out'));
  const sourceRoot = options['source-root'] || DEFAULT_SOURCE_ROOT;
  const manifestPath = defaultManifestPath('extract', figPath, options);
  const figData = loadCanvasFig(figPath);
  const entries = buildCodeFileEntries(figData.message);

  const latestByLogicalPath = new Map();
  for (const entry of entries) {
    latestByLogicalPath.set(entry.logicalPath, entry);
  }

  const manifestEntries = [];
  for (const entry of entries) {
    const outputFilePath = resolveProjectFilePath(outputDir, sourceRoot, entry.logicalPath);
    const isLatest = latestByLogicalPath.get(entry.logicalPath)?.nodeChangeIndex === entry.nodeChangeIndex;
    const status = isLatest ? 'written' : 'shadowed-by-later-duplicate';

    if (isLatest) {
      ensureParentDirectory(outputFilePath);
      fs.writeFileSync(outputFilePath, entry.sourceCode, 'utf8');
    }

    manifestEntries.push({
      nodeChangeIndex: entry.nodeChangeIndex,
      name: entry.name,
      codeFilePath: entry.codeFilePath || null,
      logicalPath: entry.logicalPath,
      sourceCodeSha1: entry.sourceCodeSha1,
      isDuplicate: entry.isDuplicate,
      duplicateCount: entry.duplicateCount,
      extractedPath: outputFilePath,
      extractStatus: status,
    });
  }

  const manifest = {
    ...buildBaseManifest('extract', figData, entries, sourceRoot),
    outputDirectory: outputDir,
    entries: manifestEntries,
  };
  writeManifest(manifestPath, manifest);

  const duplicateCount = manifest.summary.duplicateGroups.length;
  console.log(`Extracted ${manifest.summary.totalCodeFiles} CODE_FILE nodes from ${path.basename(figPath)}`);
  console.log(`Source root: ${normalizeSourceRoot(sourceRoot) || '.'}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Manifest: ${manifestPath}`);
  if (duplicateCount > 0) {
    console.warn(`Warning: ${duplicateCount} duplicate logical path group(s) were resolved with last-wins semantics.`);
  }
}

function inspectCommand(options) {
  const figPath = resolvePath(getRequiredOption(options, 'fig'));
  const manifestPath = defaultManifestPath('inspect', figPath, options);
  const figData = loadCanvasFig(figPath);
  const entries = buildCodeFileEntries(figData.message);
  const manifest = {
    ...buildBaseManifest('inspect', figData, entries, DEFAULT_SOURCE_ROOT),
    entries: entries.map((entry) => ({
      nodeChangeIndex: entry.nodeChangeIndex,
      name: entry.name,
      codeFilePath: entry.codeFilePath || null,
      logicalPath: entry.logicalPath,
      sourceCodeSha1: entry.sourceCodeSha1,
      isDuplicate: entry.isDuplicate,
      duplicateCount: entry.duplicateCount,
    })),
  };
  writeManifest(manifestPath, manifest);

  console.log(`FIG: ${figPath}`);
  console.log(`Prelude: ${figData.prelude}`);
  console.log(`Version: ${figData.version}`);
  console.log(`CODE_FILE nodes: ${manifest.summary.totalCodeFiles}`);
  console.log('Path distribution:');
  for (const [codeFilePath, count] of Object.entries(manifest.summary.pathCounts)) {
    console.log(`  ${codeFilePath}: ${count}`);
  }
  if (manifest.summary.duplicateGroups.length > 0) {
    console.log('Duplicate logical paths:');
    for (const duplicate of manifest.summary.duplicateGroups) {
      console.log(`  ${duplicate.logicalPath} -> [${duplicate.nodeChangeIndices.join(', ')}]`);
    }
  } else {
    console.log('Duplicate logical paths: none');
  }
  console.log(`Manifest: ${manifestPath}`);
}

function packCommand(options) {
  const figPath = resolvePath(getRequiredOption(options, 'fig'));
  const projectDir = resolvePath(getRequiredOption(options, 'from'));
  const sourceRoot = options['source-root'] || DEFAULT_SOURCE_ROOT;
  const outputFigPath = resolvePath(options.out || figPath);
  const manifestPath = defaultManifestPath('pack', outputFigPath, options);
  const pruneMissing = options['prune-missing'] === true || options['prune-missing'] === 'true';
  const sanitizeForExportMode =
    options['sanitize-for-export'] === true || options['sanitize-for-export'] === 'true';
  const figData = loadCanvasFig(figPath);
  const entries = buildCodeFileEntries(figData.message);

  const byLogicalPath = new Map();
  for (const entry of entries) {
    if (!byLogicalPath.has(entry.logicalPath)) {
      byLogicalPath.set(entry.logicalPath, []);
    }
    byLogicalPath.get(entry.logicalPath).push(entry);
  }

  const manifestEntries = [];
  const warnings = [];
  const updatedLogicalPaths = new Set();
  const prunedLogicalPaths = new Set();
  const prunedNodeChangeIndices = new Set();

  for (const [logicalPath, group] of byLogicalPath.entries()) {
    const projectFilePath = resolveProjectFilePath(projectDir, sourceRoot, logicalPath);
    const exists = fs.existsSync(projectFilePath);

    if (!exists) {
      if (pruneMissing) {
        warnings.push(`Missing source file for ${logicalPath}; pruned ${group.length} CODE_FILE node(s).`);
        prunedLogicalPaths.add(logicalPath);
        for (const entry of group) {
          prunedNodeChangeIndices.add(entry.nodeChangeIndex);
          manifestEntries.push({
            nodeChangeIndex: entry.nodeChangeIndex,
            name: entry.name,
            codeFilePath: entry.codeFilePath || null,
            logicalPath,
            sourceCodeSha1: entry.sourceCodeSha1,
            isDuplicate: entry.isDuplicate,
            duplicateCount: entry.duplicateCount,
            packedPath: projectFilePath,
            packStatus: 'pruned-missing-file',
          });
        }
        continue;
      }

      warnings.push(`Missing source file for ${logicalPath}; preserved original canvas.fig content.`);
      for (const entry of group) {
        manifestEntries.push({
          nodeChangeIndex: entry.nodeChangeIndex,
          name: entry.name,
          codeFilePath: entry.codeFilePath || null,
          logicalPath,
          sourceCodeSha1: entry.sourceCodeSha1,
          isDuplicate: entry.isDuplicate,
          duplicateCount: entry.duplicateCount,
          packedPath: projectFilePath,
          packStatus: 'preserved-missing-file',
        });
      }
      continue;
    }

    const nextSource = fs.readFileSync(projectFilePath, 'utf8');
    const nextSha1 = sha1(nextSource);
    if (group.length > 1) {
      warnings.push(`Duplicate logical path ${logicalPath} updated across ${group.length} CODE_FILE nodes.`);
    }

    for (const entry of group) {
      entry.node.sourceCode = nextSource;
      entry.node.collaborativeSourceCode = createCollaborativeSourceCode(
        nextSource,
        entry.node.guid?.sessionID ?? 1,
      );
      updatedLogicalPaths.add(logicalPath);
      manifestEntries.push({
        nodeChangeIndex: entry.nodeChangeIndex,
        name: entry.name,
        codeFilePath: entry.codeFilePath || null,
        logicalPath,
        sourceCodeSha1: nextSha1,
        isDuplicate: entry.isDuplicate,
        duplicateCount: entry.duplicateCount,
        packedPath: projectFilePath,
        packStatus: 'updated-from-disk',
      });
    }
  }

  if (pruneMissing && prunedNodeChangeIndices.size > 0) {
    figData.message.nodeChanges = (figData.message.nodeChanges || []).filter((_, index) => !prunedNodeChangeIndices.has(index));
  }

  let exportSanitization = null;
  if (sanitizeForExportMode) {
    exportSanitization = sanitizeForExport(figData.message);
    warnings.push(...exportSanitization.warnings);
  }

  const encodedMessage = figData.compiled.encodeMessage(figData.message);
  const compressedMessage = zlib.zstdCompressSync(Buffer.from(encodedMessage));
  const encodedArchive = encodeArchive({
    prelude: figData.prelude,
    version: figData.version,
    parts: [figData.schemaPart, compressedMessage],
  });

  ensureParentDirectory(outputFigPath);
  fs.writeFileSync(outputFigPath, encodedArchive);

  const finalEntries = buildCodeFileEntries(figData.message);

  const manifest = {
    ...buildBaseManifest('pack', figData, finalEntries, sourceRoot),
    projectDirectory: projectDir,
    outputFigPath,
    updatedLogicalPathCount: updatedLogicalPaths.size,
    prunedLogicalPathCount: prunedLogicalPaths.size,
    sanitizeForExport: exportSanitization,
    warnings,
    entries: manifestEntries,
  };
  writeManifest(manifestPath, manifest);

  console.log(`Packed ${updatedLogicalPaths.size} logical path(s) into ${outputFigPath}`);
  if (prunedLogicalPaths.size > 0) {
    console.log(`Pruned ${prunedLogicalPaths.size} logical path(s) without source files.`);
  }
  console.log(`Manifest: ${manifestPath}`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }
  }
}

function main() {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));

    switch (command) {
      case 'help':
        printUsage();
        return;
      case 'inspect':
        inspectCommand(options);
        return;
      case 'extract':
        extractCommand(options);
        return;
      case 'pack':
        packCommand(options);
        return;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
}

main();
