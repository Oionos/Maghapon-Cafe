// src/lib/nav.js — route-scoped initialisation for client-side navigation.
// Zero dependencies (§3.3). The DOM-touching exports (boot, consumePendingScroll,
// isRouterActive) are covered by Phase 1's CDP probes, not node --test: faking a document here
// would certify code that never runs.
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

export function requestScrollTo(id) {
  pendingScroll = id;
}

export function takePendingScroll() {
  const id = pendingScroll;
  pendingScroll = null;
  return id;
}

export function consumePendingScroll() {
  const id = takePendingScroll();
  if (!id) return false;
  const el = document.getElementById(id);
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
