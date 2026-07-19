import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const referencePaths = [
  '../skills/axhub-prototype-context/references/review-report-submission.md',
  '../skills/extract-annotation-source/references/review-report-submission.md',
].map((relativePath) => path.resolve(testDir, relativePath));
const referenceSources = referencePaths.map((referencePath) => readFileSync(referencePath, 'utf8'));

test('keeps review submission guidance identical across independently installable skills', () => {
  assert.equal(referenceSources[0], referenceSources[1]);
});

for (const [index, referencePath] of referencePaths.entries()) {
  test(`${path.basename(path.dirname(path.dirname(referencePath)))} uses the injected review context as the channel-agnostic submission contract`, () => {
    const source = referenceSources[index];

    assert.match(source, /唯一事实来源/u);
    assert.match(source, /不识别或区分局域网与 Axhub/u);
    assert.match(source, /submitContext\.url/u);
    assert.match(source, /submitContext\.existsUrl/u);
    assert.match(source, /report\.id/u);
    assert.match(source, /"title":/u);
    assert.match(source, /"reviewer":/u);
    assert.match(source, /"score":/u);
    assert.match(source, /"content":/u);
    assert.match(source, /"source":/u);
    assert.doesNotMatch(source, /lan-submit-config/u);
    assert.doesNotMatch(source, /Axhub Make LAN\/admin origin/u);
    assert.doesNotMatch(source, /POST <window\.__AXHUB_REVIEW_SUBMIT__\.url or/u);
  });
}
