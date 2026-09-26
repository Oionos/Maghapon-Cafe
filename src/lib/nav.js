// src/lib/nav.js — route-scoped initialisation for client-side navigation.
// Zero dependencies (§3.3). boot()'s listener contract — registration order, the `swapped` gate,
// and `booted` being set before the first arrive() — IS covered by node --test, against a
// one-method `document` stub (ruling A-7, reversing the earlier policy): a wrong order here
// would be inherited by four later tasks, and the stub reaches everything boot() touches.
// What a stub cannot certify is the router itself: the real astro:after-swap/page-load pair, the
// swapped body, and a scrollIntoView that really moves the viewport, are proven only by the CDP
// pass in Tasks 6 and 9. What the stub does reach is the seams: consumePendingScroll() and
// isRouterActive() both take the document they query, so their selector and their absent-target
// branch are pinned here rather than assumed.
// Ordering dependency, named because nothing here enforces it (F-F7). registerPage() carries
// Ruling H's fallback — a page registering after boot() on the active path self-inits — while
// addArrivalHook() has no such fallback on purpose, so a hook registered after the first arrive()
// misses that arrival. Today that is harmless only because the shell chunk is emitted LAST in the
// document's script list on all six routes, which is what puts CartDrawer's and CartPanel's hooks
// and the shell's own back-press hook ahead of boot(arrive). An Astro output-ordering change would
// cost those three one render, silently, and no test in this repo asserts the order — so if that
// property ever moves, the fix belongs here, not in a component.
const inits = new Map();
const controllers = new Map();
const hooks = [];
let pendingScroll = null;
let activePath = null;
let booted = false;

export function normalizePath(p) {
  if (typeof p !== 'string' || p === '') return '/';
  const path = p.split('?')[0].split('#')[0];
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function abortPath(path) {
  const controller = controllers.get(path);
  if (!controller) return;
  controller.abort();
  controllers.delete(path);
}

export function runPage(pathname) {
  const path = normalizePath(pathname);
  if (activePath && activePath !== path) abortPath(activePath);
  // Recorded even when nothing is registered: this *is* the current path, and Ruling H's fallback
  // in registerPage() depends on being able to ask which one that was.
  activePath = path;
  const init = inits.get(path);
  if (!init) return false;
  abortPath(path);
  const controller = new AbortController();
  controllers.set(path, controller);
  init({ signal: controller.signal });
  return true;
}

export function registerPage(path, init) {
  const key = normalizePath(path);
  inits.set(key, init);
  if (booted && key === activePath) runPage(key);
}

export function addArrivalHook(fn) {
  hooks.push(fn);
}

export function runHooks() {
  for (const fn of hooks) fn();
}

// One arrival's worth of steps, run in order, each step isolated. It lives here rather than inline
// in `arrive()` because Base.astro is a layout, not an importable module: this is the only place
// the isolation itself can be tested (F-F6). The point is the continue, not the catch: the shell's
// last two steps are consumePendingScroll() and initHashNav(), so before this a throw anywhere
// earlier cancelled the scroll hand-off and the hash seam for the rest of the session. `report` is
// required rather than optional, because §2.6 forbids silent swallowing and an optional reporter
// would let a caller reintroduce it by forgetting an argument.
export function runArrivalSteps(steps, report) {
  for (const step of steps) {
    try {
      step.fn();
    } catch (err) {
      report(step.name, err);
    }
  }
}

export function requestScrollTo(id) {
  pendingScroll = id;
}

export function takePendingScroll() {
  const id = pendingScroll;
  pendingScroll = null;
  return id;
}

export function consumePendingScroll(doc = document) {
  const id = takePendingScroll();
  if (!id) return false;
  // The element may be gone: `#booking` is a fragment id with no `[data-hash-nav]` anchor today,
  // and a swap can land on a document that never rendered the target. Absent is not an error and
  // must not throw — the id is already consumed, so a throw here would also lose the hand-off.
  const el = doc.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  return true;
}

export function isRouterActive(doc = document) {
  return doc.querySelector('[name="astro-view-transitions-enabled"]') !== null;
}

export function boot(arrive) {
  booted = true;
  let swapped = false;
  document.addEventListener('astro:after-swap', () => {
    swapped = true;
  });
  document.addEventListener('astro:page-load', () => {
    if (!swapped) return;
    swapped = false;
    arrive();
  });
  arrive();
}

export function resetNav() {
  for (const path of [...controllers.keys()]) abortPath(path);
  inits.clear();
  hooks.length = 0;
  pendingScroll = null;
  activePath = null;
  booted = false;
}
