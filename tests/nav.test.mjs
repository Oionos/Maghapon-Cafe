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
  consumePendingScroll,
  runArrivalSteps,
  isRouterActive,
  boot,
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

// F-F6 / review mutant N10. consumePendingScroll() is the arrival step most likely to look up a
// node the destination never rendered — `#booking` is a fragment id with no `[data-hash-nav]`
// anchor today — and mutant N10 (deleting `if (!el) return false;`) survived the whole suite,
// because the function read the global `document` and no stub could be placed under it.
// isRouterActive() has taken its document as a parameter since Task 6; this closes the asymmetry.
// What is pinned: a missing node returns instead of throwing (N10's killer), the id stays consumed
// even then (a re-offer would scroll to a target from a page the user already left), and the exact
// options handed to scrollIntoView — `instant`, because the cross-fade owns the animation budget.
test('consumePendingScroll() reads an absent target as "nothing scrolled"', () => {
  resetNav();
  const scrolled = [];
  const doc = (hit) => ({
    getElementById: (id) => (hit ? { id, scrollIntoView: (o) => scrolled.push([id, o]) } : null),
  });
  assert.equal(consumePendingScroll(doc(false)), false, 'nothing queued means nothing to do');
  requestScrollTo('rewards');
  assert.equal(consumePendingScroll(doc(false)), false, 'a missing node must not throw');
  assert.equal(takePendingScroll(), null, 'the id stays consumed even when the target never lands');
  requestScrollTo('rewards');
  assert.equal(consumePendingScroll(doc(true)), true, 'a present target is a completed hand-off');
  assert.deepEqual(scrolled, [['rewards', { behavior: 'instant', block: 'start' }]]);
});

// F-F6: arrive()'s ten steps run through this runner, which is the only reason the isolation is
// testable at all — Base.astro is a layout, not a module. The failure the review priced was a throw
// anywhere in steps 1-8 cancelling the scroll hand-off and the hash seam for the rest of the
// session, so the assertion is not "it caught the error" but "everything after it still ran, in
// order, exactly once".
test('runArrivalSteps() continues past a throwing step and still reaches the last one', () => {
  const ran = [];
  const reported = [];
  runArrivalSteps(
    [
      { name: 'initOverlayState', fn: () => ran.push('overlay') },
      {
        name: 'initPageScripts',
        fn: () => {
          throw new Error('a page init blew up');
        },
      },
      { name: 'consumePendingScroll', fn: () => ran.push('scroll') },
      { name: 'initHashNav', fn: () => ran.push('hash') },
    ],
    (name, err) => reported.push(`${name}: ${err.message}`)
  );
  assert.deepEqual(ran, ['overlay', 'scroll', 'hash'], 'the failing step must stop nothing');
  assert.deepEqual(reported, ['initPageScripts: a page init blew up'], 'and report it by name');
});

// `report` is a required argument, not an optional one with a no-op default: §2.6's rule is that
// isolation must never turn into silence, and a default reporter is the shape that would let it.
test('runArrivalSteps() has no silent default for the reporter', () => {
  const steps = [
    {
      name: 'initHashNav',
      fn: () => {
        throw new Error('no reporter to tell');
      },
    },
  ];
  assert.throws(() => runArrivalSteps(steps, undefined), TypeError);
});

// Task 6 gives isRouterActive() its only consumer — initHashNav() asks it before turning a click
// into a navigate() swap — so the exported name is now pinned rather than dead. The selector is
// asserted literally because guard check 8 matches the SAME meta in the built HTML by the same
// name; the two sides drifting is the failure this catches. `doc` is a parameter precisely so this
// needs no jsdom (§3.3).
test('isRouterActive reads the router enable-meta by its exact selector', () => {
  const SELECTOR = '[name="astro-view-transitions-enabled"]';
  const asked = [];
  const doc = (hit) => ({
    querySelector: (sel) => {
      asked.push(sel);
      return sel === SELECTOR && hit ? { node: true } : null;
    },
  });
  assert.equal(isRouterActive(doc(true)), true, 'meta present must read as active');
  assert.equal(isRouterActive(doc(false)), false, 'meta absent must read as inactive');
  assert.deepEqual(asked, [SELECTOR, SELECTOR], 'must ask for the enable-meta, not any meta');
});

// I1: every slot resetNav() owns, pinned from Task 3 onward — other files will assume a clean
// registry, and a reset that skips one slot must fail THAT assertion, not a generic one.
test('resetNav() clears the registry, the live controller, the scroll slot and the hooks', () => {
  resetNav();
  const seen = [];
  addArrivalHook(() => seen.push('hook-ran'));
  registerPage('/menu', ({ signal }) => {
    signal.addEventListener('abort', () => seen.push('abort-menu'));
  });
  assert.equal(runPage('/menu'), true, 'setup: /menu must be registered and active');
  requestScrollTo('rewards');
  resetNav();
  assert.equal(runPage('/menu'), false, 'registry: resetNav() must unregister /menu again');
  assert.deepEqual(seen, ['abort-menu'], 'controllers: reset must abort the live route signal');
  assert.equal(takePendingScroll(), null, 'pendingScroll: resetNav() must drop the one-shot id');
  seen.length = 0;
  runHooks();
  assert.deepEqual(seen, [], 'hooks: resetNav() must empty the arrival-hook list');
});

// Ruling A-7: boot() is covered against the smallest stub that reaches it — a literal object with
// one method, no jsdom, no linkedom, no new dependency. Each call installs its own stub, so a test
// sees only the listener pair its own boot() registered; `fire()` runs those handlers, `order`
// records the names in registration order. The ROUTER is still only proven by the CDP pass in
// Tasks 6 and 9 — this pins the contract this module owns.
function useDocument() {
  const listeners = {};
  const order = [];
  globalThis.document = {
    addEventListener: (name, fn) => {
      (listeners[name] ||= []).push(fn);
      order.push(name);
    },
  };
  return {
    order,
    fire: (name) => {
      for (const fn of listeners[name] || []) fn();
    },
  };
}

test('boot() binds after-swap then page-load, and sets booted before the first arrive()', () => {
  resetNav();
  const { order } = useDocument();
  const seen = [];
  runPage('/menu');
  boot(() => {
    // order.length is 2 only if both listeners exist before the first arrival runs.
    seen.push(`arrive:${order.length}`);
    registerPage('/menu', () => seen.push('fallback'));
  });
  assert.deepEqual(order, ['astro:after-swap', 'astro:page-load'], 'swap listener binds first');
  assert.deepEqual(seen, ['arrive:2', 'fallback'], 'booted is true before arrive() is called');
});

test('a page-load with no swap before it does not re-arrive (the load-time duplicate)', () => {
  resetNav();
  const { fire } = useDocument();
  let calls = 0;
  boot(() => {
    calls += 1;
  });
  assert.equal(calls, 1, 'boot() arrives synchronously on the first load');
  fire('astro:page-load');
  assert.equal(calls, 1, 'the swapped gate must swallow the load-time page-load');
});

test('exactly one arrival per swap, and a bare page-load after it adds none', () => {
  resetNav();
  const { fire } = useDocument();
  let calls = 0;
  boot(() => {
    calls += 1;
  });
  fire('astro:after-swap');
  fire('astro:page-load');
  assert.equal(calls, 2, 'one swap plus one page-load is exactly one arrival');
  fire('astro:page-load');
  assert.equal(calls, 2, 'the gate must re-close — a page-load alone never re-arrives');
  fire('astro:after-swap');
  fire('astro:after-swap');
  fire('astro:page-load');
  assert.equal(calls, 3, 'two swaps without a page-load between still yield one arrival');
});

test('registerPage() on the active path self-inits once, immediately (Ruling H)', () => {
  resetNav();
  useDocument();
  let arrivals = 0;
  boot(() => {
    arrivals += 1;
  });
  runPage('/menu');
  let inits = 0;
  registerPage('/menu', () => {
    inits += 1;
  });
  assert.equal(inits, 1, 'a late registration on the active path must self-init');
  assert.equal(arrivals, 1, 'self-init must not fake a second arrival');
  registerPage('/booking', () => {
    inits += 1;
  });
  assert.equal(inits, 1, 'a path that is not the active one must wait for a real arrival');
});

test('resetNav() disarms the fallback; boot() again restores the listener pair', () => {
  resetNav();
  useDocument();
  boot(() => {});
  runPage('/menu');
  resetNav();
  runPage('/menu');
  // The active path is back without any boot(), so only `booted` can make registerPage self-fire.
  let inits = 0;
  registerPage('/menu', () => {
    inits += 1;
  });
  assert.equal(inits, 0, 'booted: resetNav() must disarm Ruling H\'s fallback');
  let arrivals = 0;
  const { fire } = useDocument();
  boot(() => {
    arrivals += 1;
  });
  assert.equal(arrivals, 1, 'boot() after a reset must arrive synchronously again');
  fire('astro:after-swap');
  fire('astro:page-load');
  assert.equal(arrivals, 2, 'the restored listener pair must drive a swap arrival');
});

test('resetNav() forgets the active path, so a re-boot has nothing to fall back to', () => {
  resetNav();
  useDocument();
  boot(() => {});
  runPage('/menu');
  resetNav();
  useDocument();
  boot(() => {});
  let inits = 0;
  registerPage('/menu', () => {
    inits += 1;
  });
  assert.equal(inits, 0, 'activePath: resetNav() must forget which path is current');
});

test('an arrive() that throws propagates out of boot(), leaving booted already true', () => {
  resetNav();
  useDocument();
  runPage('/booking');
  assert.throws(
    () =>
      boot(() => {
        throw new Error('init blew up');
      }),
    /init blew up/,
    'the shell must not swallow a failing arrival — it may die half-initialised'
  );
  let inits = 0;
  registerPage('/booking', () => {
    inits += 1;
  });
  assert.equal(inits, 1, 'boot() set booted before calling arrive(); the measured order stands');
});
