import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePath,
  registerPage,
  runPage,
  addArrivalHook,
  runHooks,
  requestScrollTo,
  takePendingScroll,
  resetNav,
} from '../src/lib/nav.js';

test('normalizePath strips trailing slash but keeps the root', () => {
  assert.equal(normalizePath('/menu/'), '/menu');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/booking/?x=1'), '/booking');
  assert.equal(normalizePath('/#rewards'), '/');
  assert.equal(normalizePath(''), '/');
});

test('runPage inits the registered route and reports whether one existed', () => {
  resetNav();
  const seen = [];
  registerPage('/menu', ({ signal }) => seen.push(signal.aborted));
  assert.equal(runPage('/menu'), true);
  assert.equal(runPage('/nope'), false);
  assert.deepEqual(seen, [false]);
});

test('leaving a route aborts its controller and arriving twice aborts the first', () => {
  resetNav();
  const controllers = [];
  registerPage('/a', ({ signal }) => controllers.push(signal));
  registerPage('/b', ({ signal }) => controllers.push(signal));
  runPage('/a');
  assert.equal(controllers[0].aborted, false);
  runPage('/b');
  assert.equal(controllers[0].aborted, true, 'the leaving route must be aborted');
  assert.equal(controllers[1].aborted, false);
  runPage('/b');
  assert.equal(controllers[1].aborted, true, 'a re-arrival replaces, never stacks');
  assert.equal(controllers[2].aborted, false);
});

test('arrival hooks run once per call, in registration order', () => {
  resetNav();
  const order = [];
  addArrivalHook(() => order.push('drawer'));
  addArrivalHook(() => order.push('panel'));
  runHooks();
  assert.deepEqual(order, ['drawer', 'panel']);
});

test('the pending scroll is a one-shot', () => {
  resetNav();
  assert.equal(takePendingScroll(), null);
  requestScrollTo('rewards');
  assert.equal(takePendingScroll(), 'rewards');
  assert.equal(takePendingScroll(), null);
});
