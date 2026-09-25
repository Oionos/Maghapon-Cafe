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
