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
