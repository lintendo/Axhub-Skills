import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(testDir, '..');
const skillsDir = resolve(appDir, 'skills');
const allowedDirectories = new Set(['agents', 'assets', 'references', 'scripts']);
const allowedRootFiles = new Set(['LICENSE', 'SKILL.md']);

const forbiddenContent = [
  ['macOS user path', /\/Users\/[A-Za-z0-9._-]+\//u],
  ['mounted workspace path', /\/Volumes\/[A-Za-z0-9._ -]+\//u],
  ['temporary workspace path', /\/private\/tmp\/[A-Za-z0-9._-]+/u],
  ['Linux user path', /(?:^|[\s"'(=])\/home\/[A-Za-z0-9._-]+\//mu],
  ['Windows user path', /[A-Za-z]:\\Users\\(?!<|%|\$|\{)[^\\\s]+\\/u],
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u],
  ['AWS access key', /AKIA[0-9A-Z]{16}/u],
  ['GitHub access token', /gh[pousr]_[A-Za-z0-9]{20,}/u],
  ['OpenAI-style secret key', /sk-[A-Za-z0-9]{16,}/u],
  ['private key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/u],
  ['internal workspace name', /Axhub Runtime/u],
  ['internal source package name', /axhub-export-core/u],
];

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test('repository excludes development-only publication fixtures', () => {
  assert.equal(
    existsSync(resolve(appDir, 'test-fixtures')),
    false,
    'test-fixtures is a development-only directory and must not be published',
  );
});

test('published skills contain only supported runtime resources', () => {
  for (const skillName of readdirSync(skillsDir)) {
    const skillPath = join(skillsDir, skillName);
    if (!statSync(skillPath).isDirectory()) continue;

    for (const entry of readdirSync(skillPath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        assert.ok(
          allowedDirectories.has(entry.name),
          `${skillName}/${entry.name} is not a supported published resource directory`,
        );
        continue;
      }

      assert.ok(
        allowedRootFiles.has(entry.name),
        `${skillName}/${entry.name} is not a supported skill root file`,
      );
    }
  }
});

test('published skill contents exclude private and internal identifiers', () => {
  for (const file of listFiles(skillsDir)) {
    const contents = readFileSync(file, 'utf8');
    for (const [label, pattern] of forbiddenContent) {
      assert.doesNotMatch(contents, pattern, `${relative(appDir, file)} contains ${label}`);
    }
  }
});
