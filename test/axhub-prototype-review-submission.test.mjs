import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const referencePath = path.resolve(
  testDir,
  '../skills/axhub-prototype-context/references/review-report-submission.md',
);
const referenceSource = readFileSync(referencePath, 'utf8');
const prototypeSkillPath = path.resolve(
  testDir,
  '../skills/axhub-prototype-context/SKILL.md',
);
const annotationRuntimePath = path.resolve(
  testDir,
  '../skills/axhub-annotation-standalone/references/axhub-annotation.global.js',
);

test('axhub-prototype-context uses the injected review context as the channel-agnostic submission contract', () => {
  assert.match(referenceSource, /唯一事实来源/u);
  assert.match(referenceSource, /不识别或区分局域网与 Axhub/u);
  assert.match(referenceSource, /submitContext\.url/u);
  assert.match(referenceSource, /submitContext\.existsUrl/u);
  assert.match(referenceSource, /report\.id/u);
  assert.match(referenceSource, /"title":/u);
  assert.match(referenceSource, /"reviewer":/u);
  assert.match(referenceSource, /"score":/u);
  assert.match(referenceSource, /"content":/u);
  assert.match(referenceSource, /"source":/u);
  assert.doesNotMatch(referenceSource, /lan-submit-config/u);
  assert.doesNotMatch(referenceSource, /Axhub Make LAN\/admin origin/u);
  assert.doesNotMatch(referenceSource, /POST <window\.__AXHUB_REVIEW_SUBMIT__\.url or/u);
});

test('axhub-prototype-context gives an AI Agent generic annotated prototype context', () => {
  const skillSource = readFileSync(prototypeSkillPath, 'utf8');

  assert.match(skillSource, /^# Annotated Prototype Context$/mu);
  assert.match(skillSource, /AI Agent/u);
  assert.match(skillSource, /annotated prototype URL/u);
  assert.doesNotMatch(skillSource, /AI Engine/u);
  assert.doesNotMatch(skillSource, /an Axhub prototype URL/u);
});

test('annotation runtime installs axhub-prototype-context as the single prototype reader', () => {
  const runtimeSource = readFileSync(annotationRuntimePath, 'utf8');

  assert.match(runtimeSource, /skills\/axhub-prototype-context\/SKILL\.md/u);
  assert.match(runtimeSource, /\$axhub-prototype-context/u);
  assert.doesNotMatch(runtimeSource, /extract-annotation-source/u);
});
