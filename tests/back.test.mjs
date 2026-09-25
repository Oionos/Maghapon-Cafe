import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACK, EXIT_WINDOW_MS, decideBack, createBackPress } from '../src/lib/back.js';

test('an open overlay closes before anything else is considered', () => {
  assert.deepEqual(
    decideBack({ overlayOpen: true, canGoBack: true, now: 0, armedAt: 1234 }),
    { action: BACK.CLOSE, armedAt: null }
  );
});

test('history wins over the exit arming', () => {
  assert.deepEqual(decideBack({ canGoBack: true, now: 0 }), { action: BACK.BACK, armedAt: null });
});

test('the first press at the stack root arms, the second inside the window exits', () => {
  const armed = decideBack({ now: 1000 });
  assert.deepEqual(armed, { action: BACK.ARM_EXIT, armedAt: 1000 });
  assert.equal(
    decideBack({ now: 1000 + EXIT_WINDOW_MS - 1, armedAt: armed.armedAt }).action,
    BACK.EXIT
  );
  assert.equal(
    decideBack({ now: 1000 + EXIT_WINDOW_MS, armedAt: armed.armedAt }).action,
    BACK.ARM_EXIT,
    'the window is exclusive at its end — a late press re-arms rather than quitting'
  );
});

test('presses at the root must come within 2 seconds, and notify on both', () => {
  const log = [];
  let clock = 0;
  const press = createBackPress({
    isOverlayOpen: () => false,
    canGoBack: () => false,
    goBack: () => log.push('goBack'),
    exit: () => log.push('exit'),
    notify: (kind) => log.push(`notify:${kind}`),
    now: () => clock,
  });
  press.press();
  clock = 1500;
  press.press();
  assert.deepEqual(log, ['notify:arm-exit', 'exit']);
});

test('reset forgets an armed exit, e.g. after the user navigates away', () => {
  const log = [];
  const press = createBackPress({
    isOverlayOpen: () => false,
    canGoBack: () => false,
    goBack: () => log.push('goBack'),
    exit: () => log.push('exit'),
    notify: (kind) => log.push(`notify:${kind}`),
    now: () => 5000,
  });
  press.press();
  press.reset();
  press.press();
  assert.deepEqual(log, ['notify:arm-exit', 'notify:arm-exit']);
});

// M1: the literal, pinned where it is defined — Task 8's toast lifetime reuses this constant and
// its boundary test waits "2 001 ms".
test('the exit window is exactly 2 000 ms', () => {
  assert.equal(EXIT_WINDOW_MS, 2000);
});

// M2: every branch of press() returns the action it took; Task 8's CDP tour only prints this,
// and Phase 5's addListener('backButton', () => press()) consumes it.
test('press() returns the action it took, for all four cases', () => {
  const log = [];
  const state = { overlay: false, canGoBack: false, clock: 0 };
  const back = createBackPress({
    isOverlayOpen: () => state.overlay,
    canGoBack: () => state.canGoBack,
    goBack: () => log.push('goBack'),
    exit: () => log.push('exit'),
    notify: (kind) => log.push(`notify:${kind}`),
    now: () => state.clock,
  });
  state.overlay = true;
  assert.equal(back.press(), BACK.CLOSE, 'an open overlay returns CLOSE');
  state.overlay = false;
  state.canGoBack = true;
  assert.equal(back.press(), BACK.BACK, 'history wins and returns BACK');
  state.canGoBack = false;
  assert.equal(back.press(), BACK.ARM_EXIT, 'the first press at the root returns ARM_EXIT');
  state.clock = EXIT_WINDOW_MS - 1;
  assert.equal(back.press(), BACK.EXIT, 'the second press inside the window returns EXIT');
  assert.deepEqual(log, ['notify:close', 'goBack', 'notify:arm-exit', 'exit']);
});
