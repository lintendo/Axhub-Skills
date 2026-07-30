import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(testDir, '../skills/axhub-annotation-standalone');

function read(relativePath) {
  return readFileSync(path.join(skillRoot, relativePath), 'utf8');
}

test('standalone annotation skill demonstrates configurable foreground layers', () => {
  const skill = read('SKILL.md');
  const reactExample = read('references/react-example.tsx');
  const htmlExample = read('references/html-example.html');
  const source = JSON.parse(read('references/annotation-source.json'));

  assert.match(skill, /presentation\.layerSelectors/u);
  assert.deepEqual(source.presentation?.layerSelectors, [
    '.example-modal-layer[data-open="true"]',
  ]);
  assert.ok(source.data.nodes.some((node) => node.id === 'modal-background-target'));
  assert.ok(source.data.nodes.some((node) => node.id === 'modal-content-target'));
  assert.match(reactExample, /className="example-modal-layer"/u);
  assert.match(reactExample, /data-annotation-id="modal-content-target"/u);
  assert.match(htmlExample, /class="example-modal-layer"/u);
  assert.match(htmlExample, /data-annotation-id="modal-content-target"/u);
});
