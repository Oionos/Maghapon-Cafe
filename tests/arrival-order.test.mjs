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

test('arrive() runs the contracted order through the isolated runner', () => {
  const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  // `\n\s*\}` and not the plan's `\n\}`: the whole script sits indented inside <script>, so the
  // closing brace of arrive() is never at column 0 and the brief's pattern matches nothing.
  const body = src.match(/function arrive\(\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(body, 'no function arrive() block found in Base.astro');
  // F-F6 changed the shape this reads, deliberately: the ten bare `init*();` calls this used to
  // match are now `{ name, fn }` entries handed to runArrivalSteps(), because an unisolated call
  // list is exactly the defect (a throw in step 3 cancelled steps 9 and 10 for the session). The
  // ORDER asserted below is the same ten names in the same order — the wrapper moved the calls, it
  // did not reorder them. A `{` on its own line never matches the extraction pattern, so the body
  // still ends at arrive()'s own brace.
  const steps = [
    ...body[1].matchAll(/\{\s*name:\s*'([A-Za-z]+)'\s*,\s*fn:\s*([A-Za-z][A-Za-z0-9]*)\s*,?\s*\}/g),
  ];
  assert.ok(steps.length, 'arrive() declares no `{ name, fn }` steps at all');
  assert.deepEqual(steps.map((m) => m[1]), ARRIVAL_ORDER);
  for (const m of steps) {
    assert.equal(m[2], m[1], `step '${m[1]}' must name the function it runs, not another one`);
  }
  assert.match(body[1], /runArrivalSteps\(\s*\[/, 'the steps must go through the isolating runner');
  assert.match(body[1], /,\s*reportArrivalStep\s*\)/, 'and to the reporter, never silently');
});

// F-F6's other half: isolation without a report is the silent swallowing §2.6 forbids, and a report
// nothing outside the module can read is not evidence. Source-asserted for the same reason as the
// order above — Base.astro is a layout, not an importable module.
test('a failed arrival step is logged and left readable from outside the module', () => {
  const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const reporter = src.match(/function reportArrivalStep\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(reporter, 'no reportArrivalStep() found in Base.astro');
  assert.match(reporter[1], /console\.error\('maghapon: arrival step failed'/);
  assert.match(reporter[1], /arrivalFailures\.push\(\{\s*step:/);
  const shell = src.match(/window\.maghaponShell\s*=\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(shell, 'no window.maghaponShell assignment found in Base.astro');
  assert.match(shell[1], /\barrivalFailures\b/, 'the failure log must be reachable from a probe');
});

// F-F7: the back decision and the probe surface are two different things, and conflating them is a
// correctness bug rather than a style one — `window.maghaponShell` is a plain global, so any later
// script can replace the object and make every press read "nothing is open" while the panel covers
// the screen. Source-asserted like the tests above it: Base.astro is a layout, not a module.
test('the back-press overlay check reads the shell closure, never the probe global', () => {
  const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const seam = src.match(/const backPress = createBackPress\(\s*\{([\s\S]*?)\n\s*\}\)/);
  assert.ok(seam, 'no createBackPress() seam found in Base.astro');
  // Comments excluded first: prose naming the global is not a read of it, and the defect this pins
  // is exactly one where the comment and the code disagreed.
  const code = seam[1].replace(/^\s*\/\/.*$/gm, '');
  const predicate = code.match(/isOverlayOpen:\s*\(\)\s*=>\s*([^,]+),/);
  assert.ok(predicate, 'no isOverlayOpen() predicate on the back seam');
  assert.doesNotMatch(predicate[1], /maghaponShell/, 'the probe object must not decide a press');
  assert.doesNotMatch(predicate[1], /window\./, 'nor may anything reached through the global');
  assert.match(predicate[1], /\bdrawerOpen\b/, 'must read the closure truth for the drawer');
  assert.match(predicate[1], /\bpanelOpen\b/, 'and the closure truth for the panel');
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
