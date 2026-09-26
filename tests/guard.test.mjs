import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CSS_IMPORT_ORDER,
  findExternalOrigins,
  findStyleImportMismatches,
  findUndefinedTokens,
  findIconFontUsage,
  findMissingRoutes,
  findRouterContract,
  findSpriteSymbols,
  findTokenDrift,
  findTransitionCss,
  PERSIST_KEYS,
  TRANSITION_NAMES,
  walk,
  WEB_ROUTES,
} from '../scripts/guard.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// The sprite tests read source rather than build output, so they run before `npm run build`.
const spriteSource = () =>
  readFileSync(fileURLToPath(new URL('../public/icons.svg', import.meta.url)), 'utf8');

// Every .astro in src/, not the four files that happen to use <Icon> today: the test below is
// titled "every icon referenced in src", and a hard-coded list makes that title a lie the moment a
// fifth file asks for a glyph. fs.globSync exists in Node 24 (checked with `node -e
// "typeof require('fs').globSync'"`), and its results are neither sorted nor POSIX-separated on
// Windows, so both are normalised here rather than left to chance.
const SRC_ASTRO = () =>
  globSync('src/**/*.astro', { cwd: root })
    .map((p) => p.split(sep).join('/'))
    .sort();

const appMarkup = () => SRC_ASTRO().map((p) => readFileSync(join(root, p), 'utf8')).join('\n');

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

// §4.5's invariant is "zero external origin", not "zero http": a schemeless //host reference is
// fetched over whatever scheme served the page, so it is unreachable offline exactly like a hard
// https:// one. The gate on a preceding delimiter keeps `// comment` and `a=1;//b` clean.
test('flags a protocol-relative origin in CSS and markup', () => {
  const files = [
    { path: 'dist/a.css', text: '@font-face{src:url("//unpkg.com/x.woff2")}' },
    { path: 'dist/index.html', text: '<script src="//cdn.example.com/a.js"></script>' },
  ];
  const hits = findExternalOrigins(files);
  assert.deepEqual(hits.map((h) => h.path), ['dist/a.css', 'dist/index.html']);
});

test('flags a wss:// or ftp:// origin', () => {
  const files = [
    { path: 'dist/app.js', text: 'location="wss://sock.example.com"' },
    { path: 'dist/app2.js', text: "data-u='ftp://h/f'" },
  ];
  assert.deepEqual(findExternalOrigins(files).map((h) => h.path),
    ['dist/app.js', 'dist/app2.js']);
});

test('does not mistake a JS comment for a host', () => {
  const benignCss = '.x{background:url(../images/a.webp)}\nhref="/icons.svg#house"\n';
  const files = [
    { path: 'dist/app.js', text: '// a normal JS comment line\nconst a = b // c\n' },
    { path: 'dist/app2.js', text: 'a=1;//b\na=1;// x.y/z\na=1;//x.example.com/p\n' },
    { path: 'dist/a.css', text: benignCss },
  ];
  assert.deepEqual(findExternalOrigins(files), []);
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

// global.css's @import list IS the cascade: the 15 slices are contiguous ranges of the pre-split
// file, so a missing, added or reordered import changes rendering with no compile error and no
// other check can see it. Fixtures are synthetic (a, b, c) so a slice rename cannot silently
// delete the test's subject, and the order under test is three long — a set comparison passes all
// four mutations below except the reorder, which is the case that only an ordered compare catches.
const ORDER = ['src/styles/a.css', 'src/styles/b.css', 'src/styles/c.css'];
const asImports = (...paths) => paths
  .map((p) => `@import url("./${p.slice('src/styles/'.length)}");`)
  .join('\n');
const withGlobal = (paths) => ['src/styles/global.css', ...paths];

test('a deleted @import line is reported by its path', () => {
  const problems = findStyleImportMismatches(
    asImports('src/styles/a.css', 'src/styles/c.css'), withGlobal(ORDER), ORDER);
  assert.ok(problems.some((p) => p.includes('src/styles/b.css')), problems.join(' | '));
});

test('an @import the ledger does not declare is reported by its path', () => {
  const problems = findStyleImportMismatches(
    asImports(...ORDER, 'src/styles/ghost.css'), withGlobal(ORDER), ORDER);
  assert.ok(problems.some((p) => p.includes('src/styles/ghost.css')), problems.join(' | '));
});

test('reordering two adjacent slices is reported — membership alone would pass it', () => {
  const problems = findStyleImportMismatches(
    asImports('src/styles/a.css', 'src/styles/c.css', 'src/styles/b.css'),
    withGlobal(ORDER), ORDER);
  assert.equal(problems.length, 2, problems.join(' | '));
  assert.ok(problems.every((p) => /slot [23]:/.test(p)), problems.join(' | '));
});

test('an orphan .css on disk is named as shipping nothing', () => {
  const problems = findStyleImportMismatches(
    asImports(...ORDER), withGlobal([...ORDER, 'src/styles/leftover.css']), ORDER);
  assert.deepEqual(problems,
    ['orphan: src/styles/leftover.css is on disk but imported by nothing']);
});

test('the real global.css imports exactly CSS_IMPORT_ORDER, in order, with no orphan', () => {
  assert.ok(CSS_IMPORT_ORDER.length > 1, 'CSS_IMPORT_ORDER must declare more than one slice');
  assert.equal(new Set(CSS_IMPORT_ORDER).size, CSS_IMPORT_ORDER.length,
    'CSS_IMPORT_ORDER has a duplicate entry');
  const onDisk = walk(join(root, 'src/styles')).map((p) => relative(root, p).split(sep).join('/'));
  const text = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
  assert.deepEqual(findStyleImportMismatches(text, onDisk, CSS_IMPORT_ORDER), []);
});

test('flags the phosphor icon font by class', () => {
  const files = [
    { path: 'dist/index.html', text: '<i class="ph ph-house" aria-hidden="true"></i>' },
  ];
  assert.equal(findIconFontUsage(files).length, 1);
});

test('route parity is exact in both directions', () => {
  assert.deepEqual(findMissingRoutes(WEB_ROUTES, WEB_ROUTES), []);
  assert.deepEqual(
    findMissingRoutes(['dist/index.html'], WEB_ROUTES).length, WEB_ROUTES.length - 1);
  assert.deepEqual(findMissingRoutes([...WEB_ROUTES, 'dist/probe-tmp/index.html'], WEB_ROUTES),
    ['dist/probe-tmp/index.html']);
});

// The return is the problem text the build prints, so a rename of the reference form cannot read
// as an empty list: a check that never looked at anything is the defect this file already crashes
// on for `token drift`.
test('flags a referenced symbol the sprite does not define', () => {
  const sprite = '<symbol id="house" viewBox="0 0 256 256"></symbol>';
  const page = '<use href="/icons.svg#house"/><use href="/icons.svg#rocket"/>';
  assert.deepEqual(findSpriteSymbols(sprite, page), ['no <symbol id="rocket"> in the sprite']);
});

test('a source set that references the sprite nowhere fails instead of passing', () => {
  const sprite = '<symbol id="house" viewBox="0 0 256 256"></symbol>';
  const problems = findSpriteSymbols(sprite, '<p>no icon here</p>', '<div class="icon"></div>');
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.match(problems[0], /icons\.svg#/, problems[0]);
});

test('no reference source at all fails instead of passing', () => {
  const problems = findSpriteSymbols('<symbol id="house" viewBox="0 0 256 256"></symbol>');
  assert.equal(problems.length, 1, JSON.stringify(problems));
});

// Source asks for glyphs by <Icon name="x">; Icon.astro expands that into a <use href>, so the
// literal pattern findSpriteSymbols reads never appears in src. Rebuild the refs from the name
// props and feed them through the same predicate the guard runs on built HTML, so a typo is caught
// pre-build. The 7-glyph tripwire keeps that rebuild honest — an empty refs list reads as clean.
// There is deliberately NO call-site count here: 14 was Task 4's number, recorded in the plan,
// AGENTS.md §5 and the exit record, and a legitimate 15th icon must not fail a test whose subject
// is symbol resolution rather than icon history.
const iconNameRefs = () => {
  const names = [...appMarkup().matchAll(/<Icon\s+name="([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(names.length > 0, 'src references no icon at all — the rebuild checks nothing');
  assert.deepEqual(
    [...new Set(names)].sort(),
    ['calendar-blank', 'coffee', 'house', 'magnifying-glass', 'plus', 'shopping-bag', 'star'],
    'src asks for exactly the 7 briefed symbols');
  return names.map((name) => `<use href="/icons.svg#${name}"/>`);
};

test('every icon referenced in src resolves to a sprite symbol', () => {
  assert.deepEqual(findSpriteSymbols(spriteSource(), ...iconNameRefs()), []);
});

// Plan:94 promised 7 <symbol>s carrying fill="currentColor"; only the <path> was copied, so every
// glyph painted purely because base.css says `.icon { fill: currentColor }`. The attribute now
// sits on each <symbol> — a <use> shadow tree inherits from the referencing element, so the sprite
// root cannot carry it — and this test is what makes a regeneration that drops it loud.
// Deliberately no symbol-count assertion: an 8th glyph is legitimate, and frozen call-site counts
// are the defect removed from iconNameRefs above. The guard's own <symbol id> pattern is used so a
// leading-attribute reorder that breaks it cannot pass either.
test('every sprite symbol carries fill="currentColor"', () => {
  const sprite = spriteSource();
  const symbols = [...sprite.matchAll(/<symbol id="([\w-]+)"/g)];
  assert.ok(symbols.length > 0, 'no <symbol id="..."> matched — the sprite shape changed');
  // Anchored on the id attribute, not a bare `<symbol`: the file's own header comment mentions
  // <symbol> in prose, and a predicate that reads prose as markup fails on a clean sprite.
  const bare = [...sprite.matchAll(/<symbol id="[\w-]+"[^>]*>/g)]
    .filter((m) => !/fill="currentColor"/.test(m[0]))
    .map((m) => m[0]);
  assert.deepEqual(bare, [], 'a <symbol> lost fill="currentColor"');
});

// The glob is what makes the title above true, so pin that it actually walks: src has 14 .astro
// files today and Icon.astro is one of them. If the pattern ever matches nothing, the test would
// read as a pass on an empty refs list.
test('the src glob sees every .astro file, not the four that use icons today', () => {
  const files = SRC_ASTRO();
  assert.ok(files.length >= 14, `glob matched only ${files.length} .astro files`);
  const must = ['src/components/Icon.astro', 'src/components/Hero.astro', 'src/pages/index.astro'];
  for (const f of must) assert.ok(files.includes(f), `glob missed ${f}`);
});

// DESIGN.md is the contract the whole redesign was written from, and it drifted from the CSS
// (Inter vs Geist, a #e0e0e0 gray the no-grays rule forbids). Names differ on purpose —
// `sinaing-rust` vs `--rust` — so the only comparable thing is the hex value, and both
// directions matter: a colour in the doc the code never uses is a promise the build breaks,
// and a colour in the code the doc omits is an undeclared token.
test('drift is reported in both directions by hex value', () => {
  // `--cream-deep:#D3CBBD` (code, upper) against the doc's lowercase `#d3cbbd` is the same
  // colour: the two assertions below only stay green because the compare case-folds. A
  // case-sensitive compare would report #d3cbbd in *both* directions and break both lines.
  const md = '---\ncolors:\n  a: "#bb3d03"\n  b: "#e0e0e0"\n  c: "#d3cbbd"\n---\n';
  const css = [{ path: 'src/styles/tokens/legacy-root.css',
    text: ':root{--rust:#bb3d03;--cream:#f4efe6;--cream-deep:#D3CBBD}' }];
  const drift = findTokenDrift(md, css);
  assert.deepEqual(drift.map((d) => d.onlyInDoc).filter(Boolean), ['#e0e0e0']);
  assert.deepEqual(drift.map((d) => d.onlyInCode).filter(Boolean), ['#f4efe6']);
});

// The reconciliation tripwire, on the real files rather than a fixture: tokens/legacy-root.css
// is Phase 0's single source of truth, and Phase 2's rename must keep this green across it.
// `md` here is the *path*, not the text: the skip gate below and the read inside the test must
// agree on one location. DESIGN.md is gitignored, so a fresh clone has nothing to reconcile
// against — name that as a skip rather than let it read as a pass or a failure. The fixture test
// above stays un-skipped, and it is what keeps the drift predicate honest on any clone.
const md = fileURLToPath(new URL('../DESIGN.md', import.meta.url));
test('phase-0 reconciliation leaves zero color drift',
  { skip: existsSync(md) ? false : 'DESIGN.md is gitignored — colour tripwire inactive' },
  () => {
    const dir = fileURLToPath(new URL('../src/styles/tokens/', import.meta.url));
    const css = ['legacy-root.css'].map((f) => ({
      path: 'src/styles/tokens/' + f,
      text: readFileSync(dir + f, 'utf8'),
    }));
    assert.deepEqual(findTokenDrift(readFileSync(md, 'utf8'), css), []);
  });

// Task 6's router contract. `transition:persist` without an explicit key is measured dead (§4's
// contract item 4: Astro generates a page-scoped id, so the pair never matches across routes and
// the node is discarded), and a dropped directive is invisible to every other check — the shell
// still renders, the swap still happens, only the chrome reloads with the page. So this check reads
// the built documents for the enable-meta and for the six approved keys, and reports every value it
// does not approve. Each fixture below is one mutation of the clean document, because a check that
// only ever sees the clean shape cannot be shown to bite.
test('findRouterContract flags a missing meta, a rogue key and a generated key', () => {
  const meta = '<meta name="astro-view-transitions-enabled" content="true">';
  const allSix = PERSIST_KEYS.map(
    (k) => `<div data-astro-transition-persist="${k}"></div>`
  ).join('');
  const texts = (html, approved = PERSIST_KEYS) =>
    findRouterContract([{ path: 'dist/x.html', text: html }], approved).map((f) => f.text);

  // Clean: the enable-meta and every approved key present.
  assert.deepEqual(texts(`<head>${meta}</head><body>${allSix}</body>`), []);

  // No meta at all — reported alongside the vacuity note, never instead of it.
  assert.ok(texts('<head></head><body></body>').includes('missing enable-meta'));

  // A key that is not on the approved list, even though it is well-formed.
  assert.ok(
    texts(
      `<head>${meta}</head><body>${allSix.replace('cart-drawer', 'cart-closed')}</body>`,
      PERSIST_KEYS
    ).some((t) => t.startsWith('key not approved: cart-closed'))
  );

  // The page-scoped form a bare transition:persist generates (R-1's measured failure).
  const generated = allSix.replace('nav-rail', 'astro-7jqgbady-1');
  assert.ok(
    texts(`<head>${meta}</head><body>${generated}</body>`).some((t) =>
      t.startsWith('generated key: astro-7jqgbady-1')
    )
  );

  // An empty value: paired by nothing, and invisible to a name comparison.
  assert.ok(
    texts(`<head>${meta}</head><body>${allSix.replace('="tab-bar"', '=""')}</body>`).includes(
      'empty key'
    )
  );

  // A silently dropped attribute — the vacuous pass this check exists to refuse. The finding names
  // the page, because the rule is now per page (F-F1): a union over pages stayed green on it.
  const fiveOfSix = PERSIST_KEYS.slice(0, 5)
    .map((k) => `<div data-astro-transition-persist="${k}"></div>`)
    .join('');
  assert.deepEqual(
    texts(`<head>${meta}</head><body>${fiveOfSix}</body>`),
    ['key cart-drawer absent on dist/x.html — this page must emit it']
  );
});

// F-F1, the exact shape the deleted cross-page union could not see: two pages, every approved key
// emitted by SOME page, and one page short of the set it must carry. The union tallied over pages,
// so `cart-drawer` was "found" by nav-rail's co-traveller on the other document and the pair read
// clean (review mutant M-A => []). The declared per-page expectation has nothing to lean on.
test('findRouterContract reads a per-page expectation, not a cross-page union', () => {
  const meta = '<meta name="astro-view-transitions-enabled" content="true">';
  const node = (k) => `<div data-astro-transition-persist="${k}"></div>`;
  const doc = (keys) => `<head>${meta}</head><body>${keys.map(node).join('')}</body>`;
  const texts = (pages) => findRouterContract(pages, PERSIST_KEYS).map((f) => f.text);
  const complete = PERSIST_KEYS;
  const short = PERSIST_KEYS.filter((k) => k !== 'cart-drawer');

  // One finding, named by key and page: the union's failure was that it could not say which page.
  assert.deepEqual(
    texts([
      { path: 'dist/a.html', text: doc(complete) },
      { path: 'dist/b.html', text: doc(short) },
    ]),
    ['key cart-drawer absent on dist/b.html — this page must emit it']
  );

  // Both pages complete: the same corpus the union accepted, still accepted.
  assert.deepEqual(
    texts([
      { path: 'dist/a.html', text: doc(complete) },
      { path: 'dist/b.html', text: doc(complete) },
    ]),
    []
  );

  // A key emitted by NO page is now reported once per page, so the cross-page tally added nothing a
  // per-page rule could not say better. Vacuity is a different fact and keeps its own line.
  assert.deepEqual(texts([]), ['no persisted node in any page']);
});

// F-F1's declared table. The built `/admin` ships three of the six keys (Ruling J: no order
// controls, no cart panel, no bottom tab bar), and that spread is written down rather than
// inferred from whatever the build emits. A table rather than a heuristic is the point: a future
// page that drops chrome has to edit ADMIN_DROPPED_KEYS, which is a reviewable act, while a
// tally that "tolerates" a missing key silently weakens the contract.
test('findRouterContract declares the /admin key set instead of inferring it', () => {
  const meta = '<meta name="astro-view-transitions-enabled" content="true">';
  const node = (k) => `<div data-astro-transition-persist="${k}"></div>`;
  const doc = (keys) => `<head>${meta}</head><body>${keys.map(node).join('')}</body>`;
  const texts = (pages) => findRouterContract(pages, PERSIST_KEYS).map((f) => f.text);
  // Written out, not derived from the guard's own table: if ADMIN_DROPPED_KEYS changes, this test
  // has to change with it. That is the reviewable act the comment above claims.
  const adminKeys = ['nav-rail', 'mobile-topbar', 'cart-drawer'];

  // The correct /admin, refused by the old all-six rule — Ruling S's landmine, caught here by
  // running the new rule against the shipped shape rather than by argument.
  assert.deepEqual(texts([{ path: 'dist/admin/index.html', text: doc(adminKeys) }]), []);

  // An approved chrome key in the WRONG document: /admin carrying the tab bar means the page and
  // the table disagree. One defect, one finding — not a silent pass.
  assert.deepEqual(
    texts([{ path: 'dist/admin/index.html', text: doc([...adminKeys, 'tab-bar']) }]),
    ['unexpected key tab-bar on dist/admin/index.html — /admin ships no order chrome']
  );

  // A customer page may not use the admin exemption by accident of path shape: OS-native separators
  // are normalised, so `dist\admin\index.html` is still /admin and still must not be demanded of.
  assert.deepEqual(texts([{ path: 'dist\\admin\\index.html', text: doc(adminKeys) }]), []);
  // And the same normalisation cuts the other way — a backslash path is not an admin page.
  assert.deepEqual(texts([{ path: 'dist\\menu\\index.html', text: doc(adminKeys) }]).length, 3);
});

test('every router-contract failure is printable by the guard', () => {
  // The printer reads exactly `path`, `line`, `text`; a spare field is dropped and the
  // operator sees `undefined` where the finding should be.
  const failures = findRouterContract([{ path: 'dist/i.html', text: '<body></body>' }]);
  assert.ok(failures.length > 0);
  for (const f of failures) {
    assert.equal(typeof f.text, 'string');
    assert.ok(f.text.length > 0);
    assert.equal(typeof f.path, 'string');
    assert.ok(Number.isInteger(f.line) && f.line >= 1);
    assert.equal(f.kind, undefined);
  }
});

// Check 8's blind spot, found by Task 6's review: presence, approved-ness and non-emptiness are
// per-attribute tests, so one page carrying `transition:persist="nav-rail"` twice satisfied all
// three and returned []. Harmless while a key only kept a node alive; decisive once Task 7 gives
// every key a `view-transition-name`, because the name is what selects the snapshot group and two
// elements cannot hold one name. (What the browser then does with a repeated name is NOT asserted
// here — the brief's own two phrasings disagree, "animate as one group" and "drop the group" —
// and nothing in this task measures it. The rule is the spec's, not the browser's.)
test('findRouterContract flags a key used twice on one page', () => {
  const meta = '<meta name="astro-view-transitions-enabled" content="true">';
  const node = (k) => `<div data-astro-transition-persist="${k}"></div>`;
  const texts = (html) =>
    findRouterContract([{ path: 'dist/x.html', text: html }], PERSIST_KEYS).map((f) => f.text);
  const sixOnce = PERSIST_KEYS.map(node).join('');

  // Clean: six keys, one each.
  assert.deepEqual(texts(`<head>${meta}</head><body>${sixOnce}</body>`), []);

  // The duplicate, alone: the exact shape that used to read as a pass.
  assert.ok(
    texts(`<head>${meta}</head><body>${node('nav-rail')}${node('nav-rail')}</body>`).some((t) =>
      t.startsWith('duplicate key on one page: nav-rail')
    ),
    JSON.stringify(
      texts(`<head>${meta}</head><body>${node('nav-rail')}${node('nav-rail')}</body>`)
    )
  );

  // A duplicated key alongside a complete set — the case the real build would hit, because every
  // other assertion still passes and only the repeat is wrong.
  assert.deepEqual(
    texts(`<head>${meta}</head><body>${sixOnce}${node('tab-bar')}</body>`),
    ['duplicate key on one page: tab-bar — one node per name; a repeat breaks the pair']
  );

  // The report is per page, not per document: keys that repeat ACROSS pages are normal, and this is
  // exactly the real spread — `/admin` carries three of the six keys while a customer page carries
  // all six (Ruling J, measured over `dist/**/*.html`). A document-wide tally fails this fixture;
  // the assertion below is what pins "per page".
  const spread = [
    { path: 'dist/index.html', text: `<head>${meta}</head><body>${sixOnce}</body>` },
    {
      path: 'dist/admin/index.html',
      text: `<head>${meta}</head><body>${['nav-rail', 'mobile-topbar', 'cart-drawer']
        .map(node)
        .join('')}</body>`,
    },
  ];
  assert.deepEqual(
    findRouterContract(spread, PERSIST_KEYS)
      .map((f) => f.text)
      .filter((t) => t.startsWith('duplicate key')),
    []
  );
});

// Task 7's §6.4 motion: check 9. The CSS this reads is the SHIPPED sheet plus every inline
// <style> in the built pages, because the animation it exists to catch is the one Astro injects
// into <head>, which never appears in dist/_astro/*.css. Fixtures are one mutation each so every
// branch below is seen to bite; `deepEqual` on the first pair is deliberate — "some failures"
// would let an extra vacuous branch ship as green.
test('findTransitionCss needs the keyframes, the root wiring and a reduced-motion stop', () => {
  const root =
    '::view-transition-old(root){animation:maghapon-page-out 420ms var(--ease-out) both}' +
    '::view-transition-new(root){animation:maghapon-page-in 420ms var(--ease-out) both}';
  const carve = TRANSITION_NAMES.map(
    (n) =>
      `::view-transition-group(${n}),::view-transition-old(${n}),` +
      `::view-transition-new(${n}){animation:none;mix-blend-mode:normal}`
  ).join('');
  const reduced =
    '@media (prefers-reduced-motion:reduce){' +
    '::view-transition-old(root),::view-transition-new(root){animation:none!important}' +
    '}';
  const full = [
    '@keyframes maghapon-page-out{to{opacity:0}}',
    '@keyframes maghapon-page-in{from{opacity:0;transform:translateY(8px)}}',
    root,
    carve,
    reduced,
  ].join('\n');

  // Exact, not "some failures": an extra vacuous branch must show up as a diff.
  assert.deepEqual(findTransitionCss(full), []);

  // Renaming the out-keyframe breaks three rules at once.
  assert.deepEqual(
    findTransitionCss(full.replace(/maghapon-page-out/g, 'x')).sort(),
    [
      '::view-transition-old(root) does not animate maghapon-page-out',
      'missing @keyframes maghapon-page-out',
      'x is a second animation on a view-transition group',
    ].sort()
  );

  // A persisted node named in CSS but never carved out: it cross-fades with the page, which is
  // the "the tab bar reloaded" tell Ruling C exists to prevent. Prefix, not equality: the message
  // names which pseudo-els are uncarved, so the exact string is the finding's detail, not its id.
  assert.ok(
    findTransitionCss(full.replace(/maghapon-tab-bar/g, 'tab-bar-x')).some((t) =>
      t.startsWith('no carve-out rule for maghapon-tab-bar')
    )
  );

  // Half a carve is not a carve. Stopping `group` alone still cross-fades the old and new images,
  // and the (group|old|new) alternation this replaced read green on exactly that sheet.
  const groupOnly = TRANSITION_NAMES.map(
    (n) => `::view-transition-group(${n}){animation:none}`
  ).join('');
  const halfCarved = [full.slice(0, full.indexOf(carve)), groupOnly, reduced].join('\n');
  assert.deepEqual(
    findTransitionCss(halfCarved),
    TRANSITION_NAMES.map((n) => `no carve-out rule for ${n} (old new not stopped)`)
  );

  // A reduced-motion block that neutralises something other than the root pair still fails: the
  // selectors are what the check reads, so swapping the whole block body is the honest mutant.
  const NOT_THE_ROOT = '@media (prefers-reduced-motion:reduce){body{animation:none}}';
  assert.ok(
    findTransitionCss(full.replace(/@media[^]*?\}\}/, NOT_THE_ROOT)).includes(
      'prefers-reduced-motion does not stop the root animation'
    )
  );

  // Stopping one of the pair leaves the other animating, which is a slide-out with no slide-in.
  const OLD_ONLY = '@media (prefers-reduced-motion:reduce){::view-transition-old(root)' +
    '{animation:none!important}}';
  assert.ok(
    findTransitionCss(full.replace(/@media[^]*?\}\}/, OLD_ONLY)).includes(
      'prefers-reduced-motion does not stop the root animation'
    )
  );

  // A `no-preference` block is the opposite claim — it fires when motion is wanted. The earlier
  // loose matcher accepted it as a stop, and so would have shipped a reduce-motion leak.
  const INVERTED = reduced.replace(':reduce', ':no-preference');
  assert.deepEqual(findTransitionCss(full.replace(/@media[^]*?\}\}/, INVERTED)), [
    'no prefers-reduced-motion block',
  ]);

  // Deleting the block entirely is a different failure than an empty one, and both are reported.
  assert.ok(
    findTransitionCss(full.replace(/@media[^]*?\}\}/, '')).includes(
      'no prefers-reduced-motion block'
    )
  );

  // One name may name one element per page. A second application breaks the swap's pairing, and no
  // other check reads CSS, so this is the only place that could see it.
  const NAMED = '.x{view-transition-name:maghapon-tab-bar}';
  assert.deepEqual(findTransitionCss(full + NAMED + NAMED), [
    'view-transition-name: maghapon-tab-bar is applied 2 times — one name may name one element',
  ]);

  // A second animation on the root group, from Astro's own injected head CSS.
  assert.ok(
    findTransitionCss(
      full + '\n@keyframes astro-fade{from{opacity:0}}' +
        '\n::view-transition-old(root){animation:astro-fade .25s}'
    ).some((t) => t.startsWith('astro-fade is a second animation'))
  );
});

// ---- Ruling S: check 9's testable hardening items -------------------------------------------
// The ruling's fourth item is the coverage-limit comments in guard.mjs, which state what no fixture
// here can pin: zero applications still passes, a duplicate of one name spread over two FILES still
// passes, and a later cascade override defeats the scan. Every fixture below is one mutation of an
// otherwise compliant sheet, so an assertion can fail only for the predicate it names.
// `node_modules/.cache/maghapon/t9a-mutants.mjs` and `t9a2-matrix.mjs` replay these against
// single-mutation copies of guard.mjs and print the matrices that show each one bites.

// The body a compliant reduced-motion block must carry: both root pseudo-elements, `!important` —
// load-bearing because Task 7's cascade run measured a reduce-equivalent stop inside a media query
// WITHOUT it losing to a later equal-specificity author rule (`rr7-cascade.log:2` reads
// `animationName = spin`), so the plain declaration is not what stops the animation. None of the
// widening below touches that requirement.
const ROOT_STOP =
  '::view-transition-old(root),::view-transition-new(root){animation:none!important}';
const BARE = `@media (prefers-reduced-motion){${ROOT_STOP}}`;
const VALUE = `@media (prefers-reduced-motion:reduce){${ROOT_STOP}}`;
const INVERTED = `@media (prefers-reduced-motion:no-preference){${ROOT_STOP}}`;

// A fully compliant sheet carrying `reduced` as its stop block. Written out again here instead of
// being extracted from the check-9 test above: that fixture is the one the Task 7 re-review
// reproduced byte-for-byte against a commit, and resharing it would move the ground under an
// assertion someone has already verified.
const sheetPlus = (reduced) =>
  [
    '@keyframes maghapon-page-out{to{opacity:0}}',
    '@keyframes maghapon-page-in{from{opacity:0;transform:translateY(8px)}}',
    '::view-transition-old(root){animation:maghapon-page-out 420ms both}' +
      '::view-transition-new(root){animation:maghapon-page-in 420ms both}',
    TRANSITION_NAMES.map(
      (n) =>
        `::view-transition-group(${n}),::view-transition-old(${n}),` +
        `::view-transition-new(${n}){animation:none;mix-blend-mode:normal}`
    ).join(''),
    reduced,
  ].join('\n');

// Item 1. The bare form is real CSS, and it is how Astro writes its own injected head block — which
// sits at the top of this project's shipped sheet today. The old `: reduce`-only matcher therefore
// refused a correct file and printed `no prefers-reduced-motion block` about it. A check that
// complains about a right file is a landmine; `no-preference` asserts the opposite of a stop, so it
// stays refused — here carrying the very body that passes in the other two forms.
test('findTransitionCss accepts the bare reduced form and refuses no-preference', () => {
  assert.deepEqual(findTransitionCss(sheetPlus(BARE)), []);
  assert.deepEqual(findTransitionCss(sheetPlus(VALUE)), []);
  assert.deepEqual(findTransitionCss(sheetPlus(INVERTED)), ['no prefers-reduced-motion block']);
});

// Item 2 — check 8's `spread` lesson transplanted to CSS. Unreachable in today's build and named as
// such: measured 2026-09-26 over `dist/`, the six built pages carry 0 inline `<style>` blocks and
// all six names live in one sheet. Implemented anyway because Phase 2 puts styling back into
// components, and the first inline declaration would then read as a duplicate of the sheet's.
test('findTransitionCss counts a name per source, not per corpus (unreachable today)', () => {
  const named = (n) => `.x{view-transition-name:${n}}`;

  // The legal spread: the sheet applies the name once, one page's inline block restates it. The
  // corpus-wide tally reported this as `applied 2 times` — a correct build refused.
  assert.deepEqual(
    findTransitionCss([
      { path: 'dist/_astro/Base.css', text: sheetPlus(VALUE) + named('maghapon-tab-bar') },
      { path: 'dist/index.html <style>', text: named('maghapon-tab-bar') },
    ]),
    []
  );

  // The real repeat is inside one source, and the finding has to name which one: a per-file rule
  // whose message cannot say the file tells the operator nothing they can open.
  assert.deepEqual(
    findTransitionCss([
      { path: 'dist/_astro/Base.css', text: sheetPlus(VALUE) },
      {
        path: 'dist/menu.html <style>',
        text: named('maghapon-cart-panel') + named('maghapon-cart-panel'),
      },
    ]),
    [
      'view-transition-name: maghapon-cart-panel is applied 2 times in dist/menu.html <style>' +
        ' — one name may name one element',
    ]
  );
});

// Item 3 — a commented-out declaration used to feed the count, so parking a rule mid-restyle (the
// normal thing to do with a disabled `view-transition-name`) made check 9 refuse a correct file.
test('a commented-out view-transition-name is not an application', () => {
  const named = (n) => `.x{view-transition-name:${n}}`;
  const dead = (n) => `/* .y{view-transition-name:${n}} */`;

  // One live application plus its disabled twin counts 1, which is clean.
  assert.deepEqual(
    findTransitionCss(
      sheetPlus(VALUE) + named('maghapon-tab-bar') + dead('maghapon-tab-bar')
    ),
    []
  );

  // Stripping is not silencing: two live applications behind a comment still count 2. Same string
  // as the check-9 test above, because a single-source input has no file to name in it.
  assert.deepEqual(
    findTransitionCss(
      sheetPlus(VALUE) + dead('maghapon-tab-bar') + named('maghapon-tab-bar') +
        named('maghapon-tab-bar')
    ),
    ['view-transition-name: maghapon-tab-bar is applied 2 times — one name may name one element']
  );
});

// Ruling S item 3's remaining hole, found by the review's B7 fixture: CSS closes an unterminated
// `/*` at the end of the text, so nothing after one is live — but a lazy-only closer finds no
// closer, strips nothing, and hands the whole commented-out tail back to the count. Same landmine
// class as the test above: a correct file, one a browser simply ignores the tail of, refused.
test('an unterminated /* runs to the end of the sheet, as CSS reads it', () => {
  const named = (n) => `.x{view-transition-name:${n}}`;
  const twice = named('maghapon-tab-bar') + named('maghapon-tab-bar');

  // The tail never opens a declaration to the browser, so nothing here is applied twice.
  assert.deepEqual(findTransitionCss(`${sheetPlus(VALUE)}/* ${twice}`), []);

  // The same input with the closer present IS two live applications. The two inputs differ only by
  // that terminator, so the pair pins how it is read: a strip matching only a closed comment passes
  // this assertion and fails the one above.
  assert.deepEqual(
    findTransitionCss(`${sheetPlus(VALUE)}/* x */ ${twice}`),
    ['view-transition-name: maghapon-tab-bar is applied 2 times — one name may name one element']
  );
});

// Ruling S item 3's asymmetry, closed rather than commented: the corpus-wide predicates used to
// read raw text while only the application count stripped it, so a fully commented-out second
// animation FAILED the build (the false-positive direction Ruling S calls a landmine) while a
// commented-out `@keyframes` or carve-out passed the check it does not satisfy (the false-negative
// direction). One stripped input now feeds every predicate, and the two directions agree.
test('every check 9 predicate reads comment-stripped CSS', () => {
  const tabBarCarve =
    '::view-transition-group(maghapon-tab-bar),::view-transition-old(maghapon-tab-bar),' +
    '::view-transition-new(maghapon-tab-bar){animation:none;mix-blend-mode:normal}';

  // Dead text cannot animate a group: this used to report `astro-fade is a second animation`.
  assert.deepEqual(
    findTransitionCss(
      sheetPlus(VALUE) +
        '/* @keyframes astro-fade{from{opacity:0}}' +
        ' ::view-transition-old(root){animation:astro-fade .25s} */'
    ),
    []
  );

  // The mirror image: a keyframe that exists only in a comment is missing, not defined.
  assert.deepEqual(
    findTransitionCss(
      sheetPlus(VALUE).replace(
        '@keyframes maghapon-page-in{from{opacity:0;transform:translateY(8px)}}',
        '/* @keyframes maghapon-page-in{from{opacity:0}} */'
      )
    ),
    ['missing @keyframes maghapon-page-in']
  );

  // And a carve-out parked in a comment stops nothing, so it is not a carve-out.
  assert.ok(
    findTransitionCss(sheetPlus(VALUE).replace(tabBarCarve, `/* ${tabBarCarve} */`)).includes(
      'no carve-out rule for maghapon-tab-bar (group old new not stopped)'
    )
  );
});

// F-F3. `stopsRootPair` used to be three text tests over one block's text, so a reduce block that
// merely MENTIONS both root pseudo-elements while stopping an unrelated rule satisfied all three
// and animated the page anyway (review mutant M-C, `mention-not-stop`, which returned []). It is
// now structural: within the block, the rule whose OWN selector names
// `::view-transition-old(root)` must carry a declaration resolving to `none` in that rule's OWN
// body, and likewise for `new`, both in the same block. The accepted-value widening below is
// load-bearing in the other direction: the shipped sheet carries
// `@media (prefers-reduced-motion:reduce){.skeleton{animation:none}}` as its fourth block, and a
// root stop's body BEGINS at the declaration, so a predicate that only accepted `animation:` after
// a `;`, or only with `!important`, refused a correct file. That is Ruling S's landmine, and it was
// caught by running the new rule against `dist/_astro/Base.DthEEQz0.css`, not by argument.
test('findTransitionCss requires the reduced-motion stop inside each root rule', () => {
  const both = '::view-transition-old(root),::view-transition-new(root)';
  // sheetPlus('') is the compliant sheet with NO reduce block, so every block below is the only one
  // the check can read — a fixture that left a passing block in place would assert nothing.
  const sheet = (body) =>
    findTransitionCss(sheetPlus('') + `@media (prefers-reduced-motion:reduce){${body}}`);
  const FAIL = ['prefers-reduced-motion does not stop the root animation'];

  // The shape motion.css actually ships, and the legal spellings the structural read must accept.
  assert.deepEqual(sheet(`${both}{animation:none!important}`), []);
  assert.deepEqual(sheet(`${both}{animation:none}`), []);
  assert.deepEqual(sheet(`${both}{animation-name:none}`), []);
  assert.deepEqual(sheet(`${both}{opacity:1;animation:none!important}`), []);
  assert.deepEqual(sheet(`${both}{animation:420ms ease both none}`), []);
  // `@media` inside `@media` is legal CSS and a stop one level down stops just as dead.
  assert.deepEqual(
    sheet(`@media (min-width:1px){${both}{animation:none!important}}`),
    []
  );

  // M-C, the mutant that survived: the pair is named, an unrelated rule is stopped, the root
  // animation runs. One block, both halves of the lie.
  assert.deepEqual(sheet(`${both}{opacity:1}body{animation:none!important}`), FAIL);
  // Only one of the pair: a slide-out with no slide-in is not a stop.
  assert.deepEqual(
    sheet('::view-transition-old(root){animation:none}::view-transition-new(root){opacity:1}'),
    FAIL
  );
  // `animation-duration: 0.01ms` is Phase 0's blanket component stop, not a root stop — it shortens
  // the animation rather than ending it, and the property name must be anchored to a declaration.
  assert.deepEqual(sheet(`${both}{animation-duration:0.01ms!important}`), FAIL);
  assert.deepEqual(sheet(`${both}{animation-timing-function:none}`), FAIL);
});

// F-F2. A `view-transition-name` the shell never persists has no carve-out for the loop above to
// look for, so `#tab-bar { view-transition-name: maghapon-tabbar }` — a typo of an approved name —
// kept both halves of the contract green while the tab bar reloaded with the page (the review's
// `typo name` case, which returned []). Only the `maghapon-` prefix is collected, because that
// prefix IS this project's naming contract; guard.mjs states the remaining limit.
test('findTransitionCss refuses a view-transition-name that is not a persisted-node name', () => {
  const rogue = '#tab-bar{view-transition-name:maghapon-tabbar}';
  const named = (n) => `.x{view-transition-name:${n}}`;

  // The single-source input has no file to name, so the finding is the bare fact.
  assert.deepEqual(
    findTransitionCss(sheetPlus(VALUE) + rogue),
    ['view-transition-name: maghapon-tabbar is applied but is not a persisted-node name']
  );

  // With a path, it names the sheet the operator can open — the same discipline as the per-source
  // application tally above.
  assert.deepEqual(
    findTransitionCss([{ path: 'src/styles/motion.css', text: sheetPlus(VALUE) + rogue }]),
    [
      'view-transition-name: maghapon-tabbar is applied in src/styles/motion.css ' +
        'but is not a persisted-node name',
    ]
  );

  // One defect, one finding: the typo applied twice in one file is not reported twice.
  assert.deepEqual(
    findTransitionCss(sheetPlus(VALUE) + rogue + rogue),
    ['view-transition-name: maghapon-tabbar is applied but is not a persisted-node name']
  );

  // The existing case must NOT be double-reported: a second element stealing a REAL name is still
  // exactly one finding, from the per-source tally, because the rogue rule skips approved names.
  assert.deepEqual(
    findTransitionCss(sheetPlus(VALUE) + named('maghapon-tab-bar') + named('maghapon-tab-bar')),
    ['view-transition-name: maghapon-tab-bar is applied 2 times — one name may name one element']
  );

  // Both defects at once are both reported, and neither swallows the other.
  assert.deepEqual(
    findTransitionCss(
      sheetPlus(VALUE) + named('maghapon-tab-bar') + named('maghapon-tab-bar') + rogue
    ).sort(),
    [
      'view-transition-name: maghapon-tab-bar is applied 2 times — one name may name one element',
      'view-transition-name: maghapon-tabbar is applied but is not a persisted-node name',
    ].sort()
  );
});

// F-F4. Two predicates in check 9 had no test that could kill them: `defined > 1` (review mutant
// G11 removed the branch and nothing failed) and the DERIVATION of TRANSITION_NAMES from
// PERSIST_KEYS (G13). The derivation matters more than it looks — a hand-listed name array would
// let a seventh persisted node ship with no carve-out rule and no complaint. Both are pinned here;
// `node_modules/.cache/maghapon/t9-final-fix-mut.mjs` shows each assertion failing against a copy
// of the guard with its branch deleted.
test('findTransitionCss counts a duplicated @keyframes', () => {
  const again = '@keyframes maghapon-page-in{from{opacity:0}}';
  assert.deepEqual(
    findTransitionCss(sheetPlus(VALUE) + again),
    ['@keyframes maghapon-page-in is defined 2 times']
  );
  // The count is the count: three definitions say 3, so the operator can go delete two.
  assert.deepEqual(
    findTransitionCss(sheetPlus(VALUE) + again + again),
    ['@keyframes maghapon-page-in is defined 3 times']
  );
  // One definition stays silent — the branch is a duplicate detector, not a presence requirement.
  assert.deepEqual(findTransitionCss(sheetPlus(VALUE)), []);
});

test('TRANSITION_NAMES is derived from PERSIST_KEYS, not hand-listed beside it', () => {
  assert.deepEqual(TRANSITION_NAMES, PERSIST_KEYS.map((k) => `maghapon-${k}`));
  // The pairing the derivation exists for: one name per persisted key, in the same order, so a key
  // added to the shell cannot be missing from the CSS contract this check enforces.
  assert.equal(TRANSITION_NAMES.length, PERSIST_KEYS.length);

  // The value assertions above cannot see review mutant G13: a hand-listed array of the SAME six
  // names satisfies a value comparison, and the drift it warns about (rename a key in PERSIST_KEYS,
  // keep the old name in the list) only shows up once the two have already diverged. So the
  // derivation itself is pinned on the source, the way `tests/arrival-order.test.mjs` pins the
  // arrival order: any expression over `PERSIST_KEYS` passes, a literal list does not. This reads
  // the same module the test imports, so a copy of the guard relocated by a mutant harness is read
  // as its own source, not as the real one.
  const source = readFileSync(new URL('../scripts/guard.mjs', import.meta.url), 'utf8');
  const declaration = /export const TRANSITION_NAMES\s*=\s*([\s\S]*?);\n/.exec(source);
  assert.ok(declaration, 'no `export const TRANSITION_NAMES = …;` in the guard source');
  assert.match(
    declaration[1],
    /PERSIST_KEYS/,
    'TRANSITION_NAMES must be computed from PERSIST_KEYS, not written out beside it'
  );
});
