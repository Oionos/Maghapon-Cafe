import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  findExternalOrigins,
  findUndefinedTokens,
  findIconFontUsage,
  findMissingRoutes,
  findSpriteSymbols,
  findTokenDrift,
  WEB_ROUTES,
} from '../scripts/guard.mjs';

// The sprite tests read source rather than build output, so they run before `npm run build`.
const spriteSource = () =>
  readFileSync(fileURLToPath(new URL('../public/icons.svg', import.meta.url)), 'utf8');

const appMarkup = () =>
  ['src/layouts/Base.astro', 'src/components/MenuCard.astro', 'src/pages/404.astro',
    'src/pages/index.astro']
    .map((p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8'))
    .join('\n');

test('flags the real CDN tags and nothing else', () => {
  const files = [{
    path: 'dist/index.html',
    text: [
      '<html xmlns="http://www.w3.org/1999/xhtml">',
      '<link href="https://fonts.googleapis.com/css2?family=Geist" rel="stylesheet">',
      '<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>',
      '<a href="/menu">Menu</a>',
    ].join('\n'),
  }];
  const hits = findExternalOrigins(files);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.line), [2, 3]);
});

test('ignores xml namespace declarations and data URIs', () => {
  const css = "body::before{background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 \
256' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E\")}";
  assert.deepEqual(findExternalOrigins([{ path: 'dist/a.css', text: css }]), []);
});

test('reports an undefined var usage with its site', () => {
  const files = [{ path: 'src/styles/base.css', text: ':root{--a:1}\n.x{color:var(--b)}' }];
  const hits = findUndefinedTokens(files);
  assert.deepEqual(hits.map((h) => h.name), ['--b']);
  assert.equal(hits[0].site.path, 'src/styles/base.css');
  assert.equal(hits[0].site.line, 2);
});

test('accepts var fallbacks and does not flag the fallback name', () => {
  const files = [{ path: 'src/styles/base.css', text: ':root{--a:1}\n.x{color:var(--a,2)}' }];
  assert.deepEqual(findUndefinedTokens(files), []);
});

test('flags the phosphor icon font by class', () => {
  const files = [{ path: 'dist/index.html', text: '<i class="ph ph-house" aria-hidden="true"></i>' }];
  assert.equal(findIconFontUsage(files).length, 1);
});

test('route parity is exact in both directions', () => {
  assert.deepEqual(findMissingRoutes(WEB_ROUTES, WEB_ROUTES), []);
  assert.deepEqual(findMissingRoutes(['dist/index.html'], WEB_ROUTES).length, WEB_ROUTES.length - 1);
  assert.deepEqual(findMissingRoutes([...WEB_ROUTES, 'dist/probe-tmp/index.html'], WEB_ROUTES),
    ['dist/probe-tmp/index.html']);
});

test('flags a referenced symbol the sprite does not define', () => {
  const sprite = '<symbol id="house" viewBox="0 0 256 256"></symbol>';
  const page = '<use href="/icons.svg#house"/><use href="/icons.svg#rocket"/>';
  assert.deepEqual(findSpriteSymbols(sprite, page), ['rocket']);
});

// Source asks for glyphs by <Icon name="x">; Icon.astro expands that into a <use href>, so the
// literal pattern findSpriteSymbols reads never appears in src. Rebuild the refs from the name
// props and feed them through the same predicate the guard runs on built HTML, so a typo is caught
// pre-build. The tripwires keep that rebuild honest: an empty refs list reads as a clean pass.
const iconNameRefs = () => {
  const names = [...appMarkup().matchAll(/<Icon\s+name="([\w-]+)"/g)].map((m) => m[1]);
  assert.equal(names.length, 14, 'Task 4 converted exactly 14 call sites');
  assert.deepEqual(
    [...new Set(names)].sort(),
    ['calendar-blank', 'coffee', 'house', 'magnifying-glass', 'plus', 'shopping-bag', 'star'],
    'src asks for exactly the 7 briefed symbols');
  return names.map((name) => `<use href="/icons.svg#${name}"/>`);
};

test('every icon referenced in src resolves to a sprite symbol', () => {
  assert.deepEqual(findSpriteSymbols(spriteSource(), ...iconNameRefs()), []);
});

// DESIGN.md is the contract the whole redesign was written from, and it drifted from the CSS
// (Inter vs Geist, a #e0e0e0 gray the no-grays rule forbids). Names differ on purpose —
// `sinaing-rust` vs `--rust` — so the only comparable thing is the hex value, and both
// directions matter: a colour in the doc the code never uses is a promise the build breaks,
// and a colour in the code the doc omits is an undeclared token.
test('drift is reported in both directions by hex value', () => {
  const md = '---\ncolors:\n  a: "#bb3d03"\n  b: "#e0e0e0"\n---\n';
  const css = [{ path: 'src/styles/tokens/legacy-root.css',
    text: ':root{--rust:#bb3d03;--cream:#f4efe6}' }];
  const drift = findTokenDrift(md, css);
  assert.deepEqual(drift.map((d) => d.onlyInDoc).filter(Boolean), ['#e0e0e0']);
  assert.deepEqual(drift.map((d) => d.onlyInCode).filter(Boolean), ['#f4efe6']);
});

// The reconciliation tripwire, on the real files rather than a fixture: tokens/legacy-root.css
// is Phase 0's single source of truth, and Phase 2's rename must keep this green across it.
test('phase-0 reconciliation leaves zero color drift', () => {
  const md = readFileSync(fileURLToPath(new URL('../DESIGN.md', import.meta.url)), 'utf8');
  const dir = fileURLToPath(new URL('../src/styles/tokens/', import.meta.url));
  const css = ['legacy-root.css'].map((f) => ({
    path: 'src/styles/tokens/' + f,
    text: readFileSync(dir + f, 'utf8'),
  }));
  assert.deepEqual(findTokenDrift(md, css), []);
});
