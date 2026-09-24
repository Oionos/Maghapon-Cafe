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

test('every icon referenced in src resolves to a sprite symbol', () => {
  assert.deepEqual(findSpriteSymbols(spriteSource(), appMarkup()), []);
});
