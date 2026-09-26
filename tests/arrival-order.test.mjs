import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The sequence `arrive()` runs is a contract, not an implementation detail: initOverlayState() must
// settle `drawerOpen` before syncOrderControls() reads it, initChromeNav() must run before anything
// measures or scrolls to the surface it highlights, and consumePendingScroll() must sit after every
// step that can change page height — so it is last until Task 6 appends `initHashNav` in its own
// commit. Reordering is silent on every other test, so the order is asserted where it is written —
// read off the source, never off a minified bundle.
const ARRIVAL_ORDER = [
  'initOverlayState',
  'initStatusPill',
  'initChromeNav',
  'initReveals',
  'initOrderSurface',
  'initRailCollapse',
  'initBadgeMirror',
  'initPageScripts',
  'consumePendingScroll',
  'initHashNav',
];

test('arrive() calls the initialisers in the contracted order', () => {
  const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  // `\n\s*\}` and not the plan's `\n\}`: the whole script sits indented inside <script>, so the
  // closing brace of arrive() is never at column 0 and the brief's pattern matches nothing.
  const body = src.match(/function arrive\(\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(body, 'no function arrive() block found in Base.astro');
  const calls = [...body[1].matchAll(/^\s*([a-z][A-Za-z]*)\(\);$/gm)].map((m) => m[1]);
  assert.deepEqual(calls, ARRIVAL_ORDER);
});

// F-F5: the reveal observer is a module-scope singleton, so the arrival boundary is the only place
// its target list can be reset — an accumulation of detached nodes is invisible to every other test
// here (an observer is not a listener, so §12 row 1's registration census cannot see it either).
// Read off the source, like the order above: Base.astro is a layout, not an importable module.
test('initReveals() resets the shared observer before it re-observes the live document', () => {
  const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const body = src.match(/function initReveals\(\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(body, 'no function initReveals() block found in Base.astro');
  // Comments excluded: prose about disconnecting is not a disconnection.
  const code = body[1].replace(/^\s*\/\/.*$/gm, '');
  const reset = code.indexOf('io.disconnect()');
  const observe = code.indexOf('io.observe(');
  assert.ok(reset !== -1, 'initReveals() never releases the previous arrival\'s observer targets');
  assert.ok(observe !== -1, 'initReveals() no longer observes the live document at all');
  assert.ok(reset < observe, 'the reset must open the step, not follow the observation it undoes');
});
