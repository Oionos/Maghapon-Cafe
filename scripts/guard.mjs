// scripts/guard.mjs — build-time invariants for the Maghapon demo. Plain Node, zero deps:
// AGENTS.MD §3.3 allows no test/lint framework, so the checks are the framework.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSET_RE = /\.(html|css|js|mjs|webmanifest|svg)$/i;
// xmlns/xml prefixes are identity URIs, never fetched — the grain data-URI in base.css uses one.
const NS_DECL = /xmlns(:[a-z]+)?\s*=\s*["'][^"']*["']/g;
// §4.5's invariant is "zero external origin", and /https?:\/\// missed two ways to break it: a
// schemeless //host reference (fetched over whatever scheme served the page, unreachable offline
// exactly like a hard https:// one) and any non-http scheme. A bare \/\/ would also fire on every
// `// comment` and `a=1;//b` in bundled JS, so the schemeless form is gated on a preceding
// delimiter and demands a host-shaped segment before the first slash.
export const EXTERNAL_RE =
  /(?:https?:|wss?:|ftp:)\/\/|(?<=["'(=])\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\//i;

export const WEB_ROUTES = [
  'dist/404.html',
  'dist/admin/index.html',
  'dist/booking/index.html',
  'dist/index.html',
  'dist/menu/index.html',
  'dist/my-orders/index.html',
];

// The @import list in src/styles/global.css IS the cascade: slices are contiguous ranges of the
// pre-split file, so an import that is missing, added, or reordered changes rendering with no
// compile error. Order is compared, not just membership, because the 15 slices are interchangeable
// to a set comparison and not at all interchangeable to the browser.
export const CSS_IMPORT_ORDER = [
  'src/styles/tokens/legacy-root.css',
  'src/styles/base.css',
  'src/styles/button.css',
  'src/styles/shell.css',
  'src/styles/hero.css',
  'src/styles/story.css',
  'src/styles/menu-card.css',
  'src/styles/menu-page.css',
  'src/styles/testimonials.css',
  'src/styles/booking.css',
  'src/styles/footer.css',
  'src/styles/cart-drawer.css',
  'src/styles/admin.css',
  'src/styles/motion.css',
  'src/styles/responsive.css',
];

export function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (ASSET_RE.test(entry.name)) out.push(full);
  }
  return out;
}

function toFiles(absolutePaths) {
  return absolutePaths.map((p) => ({
    path: relative(ROOT, p).split(sep).join('/'),
    text: readFileSync(p, 'utf8'),
  }));
}

function eachLine(files, test) {
  const hits = [];
  for (const file of files) {
    file.text.split('\n').forEach((line, i) => {
      if (test(line)) hits.push({ path: file.path, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
  return hits;
}

export function findExternalOrigins(files) {
  return eachLine(files.map((f) => ({ ...f, text: f.text.replace(NS_DECL, '') })), (line) =>
    EXTERNAL_RE.test(line)
  );
}

export function findIconFontUsage(files) {
  return eachLine(files, (line) => /class="[^"]*\bph\b|\bph ph-/.test(line));
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Dead-token note: `--font-mono: 'Geist Mono', …` was deleted from tokens/legacy-root.css in
// Task 5. Nothing in src/ ever referenced it, and its family came only from the Google Fonts
// <link> the same task removed, so re-adding it would put a second untruth in the token file.
// Do not restore it without also self-hosting a mono face and proving a consumer exists.
export function findUndefinedTokens(cssFiles) {
  const defined = new Set();
  const used = [];
  for (const file of cssFiles) {
    for (const m of file.text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
    for (const m of file.text.matchAll(/var\(\s*(--[\w-]+)/g)) {
      used.push({ name: m[1], site: { path: file.path, line: lineOf(file.text, m.index) } });
    }
  }
  const seen = new Set();
  return used.filter((u) => {
    if (defined.has(u.name) || seen.has(u.name)) return false;
    seen.add(u.name);
    return true;
  });
}

export function findMissingRoutes(filePaths, expected) {
  const have = new Set(filePaths);
  const extra = filePaths.filter((p) => !expected.includes(p));
  return [...expected.filter((r) => !have.has(r)), ...extra];
}

// Nothing else in the guard reads global.css, so the declaration of what ships was invisible to
// it: dropping an @import removed real CSS while every check stayed green, and an orphan slice on
// disk fed findUndefinedTokens definitions that never ship - masking the exact bug class that
// check 3 exists to catch.
// Returns human-readable problems; empty means the ledger, the entry point and the disk agree.
export function findStyleImportMismatches(globalCssText, cssPaths, expected) {
  const imported = [...globalCssText.matchAll(/@import\s+url\(\s*["']\.\/([^"']+?)["']\s*\)/g)]
    .map((m) => `src/styles/${m[1]}`);
  const problems = [];
  if (imported.length !== expected.length) {
    problems.push(`${imported.length} @import line(s), CSS_IMPORT_ORDER has ${expected.length}`);
  }
  expected.forEach((p, i) => {
    if (imported[i] !== p) {
      problems.push(`slot ${i + 1}: expected ${p}, found ${imported[i] || 'nothing'}`);
    }
  });
  for (const p of imported) {
    if (!expected.includes(p)) problems.push(`undeclared import: ${p} is not in CSS_IMPORT_ORDER`);
  }
  for (const p of cssPaths) {
    if (p !== 'src/styles/global.css' && !expected.includes(p)) {
      problems.push(`orphan: ${p} is on disk but imported by nothing`);
    }
  }
  return problems;
}

// Sprite references resolve against the sprite's own <symbol> ids, so a typo'd `<use href>`
// renders nothing at runtime and no other check notices. Spare glyphs are deliberately not
// reported: an unused symbol in a 7-symbol sprite violates nothing (§3.5). A source set that
// references the sprite nowhere is reported too — `[]` there would mean "nothing was checked",
// which is the failure shape this file already crashes on for `token drift`.
export function findSpriteSymbols(...sources) {
  const [sprite, ...refs] = sources;
  const defined = new Set([...sprite.matchAll(/<symbol id="([\w-]+)"/g)].map((m) => m[1]));
  const referenced = new Set();
  for (const text of refs) {
    for (const m of text.matchAll(/icons\.svg#([\w-]+)/g)) referenced.add(m[1]);
  }
  if (referenced.size === 0) {
    return [`no icons.svg# reference in ${refs.length} source file(s) — nothing was resolved`];
  }
  return [...referenced]
    .filter((id) => !defined.has(id))
    .map((id) => `no <symbol id="${id}"> in the sprite`);
}

// DESIGN.md is prose the build never reads, so it drifts silently — it claimed Inter for weeks
// while the CSS loaded Geist. Hex *values* are compared rather than token names because the doc
// says `sinaing-rust` where the code says `--rust`; name parity is Phase 2's job, when both sides
// move together and a value-only check keeps working across the rename.
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

function colorsBlock(mdText) {
  const m = /^colors:\n((?:[ \t]+\S.*\n)+)/m.exec(mdText);
  return m ? m[1] : '';
}

export function findTokenDrift(designMd, cssFiles) {
  const inDoc = new Set((colorsBlock(designMd).match(HEX_RE) || []).map((h) => h.toLowerCase()));
  const inCode = new Set();
  for (const f of cssFiles) {
    for (const m of f.text.matchAll(HEX_RE)) inCode.add(m[0].toLowerCase());
  }
  const out = [];
  for (const v of inDoc) if (!inCode.has(v)) out.push({ onlyInDoc: v, onlyInCode: null });
  for (const v of inCode) if (!inDoc.has(v)) out.push({ onlyInDoc: null, onlyInCode: v });
  return out;
}

function main() {
  const distFiles = toFiles(walk(join(ROOT, 'dist')));
  const cssFiles = toFiles(walk(join(ROOT, 'src', 'styles')));
  if (!distFiles.length) {
    console.error('GUARD FAIL 0: no dist/ — run `npm run build` before `npm run guard`');
    process.exit(1);
  }
  // `walk` keeps every text-ish build artifact, but dist also holds the bundles and images.
  // Only the documents are routes, so parity is judged on .html — otherwise every hashed
  // chunk and the sprite itself come back as "unexpected route" failures on a good build.
  const pages = distFiles.filter((f) => f.path.endsWith('.html'));
  const spriteOk = distFiles.find((f) => f.path === 'dist/icons.svg');
  const cssPaths = cssFiles.map((f) => f.path);
  // Only files the cascade actually imports can contribute a definition: counting an orphan slice
  // on disk would certify a token that never ships, and that is the one mask check 3 exists for.
  const shippingCss = cssFiles.filter((f) => CSS_IMPORT_ORDER.includes(f.path));
  // One entry per check. Task 4 appends `sprite symbols`, the final review appends
  // `style imports`, and Task 7 appends `token drift` below the array; the count printed at the
  // end is read off this array so it can never drift from what actually ran.
  const CHECKS = [
    ['external origin', () => findExternalOrigins(distFiles)],
    ['icon font usage', () => findIconFontUsage(distFiles)],
    [
      'undefined token',
      () =>
        findUndefinedTokens(shippingCss).map((u) => ({
          path: u.site.path,
          line: u.site.line,
          text: u.name,
        })),
    ],
    [
      'route parity',
      () =>
        findMissingRoutes(pages.map((p) => p.path), WEB_ROUTES).map((r) => ({
          path: r,
          line: 0,
          text: '',
        })),
    ],
    [
      'sprite symbols',
      () =>
        (spriteOk
          ? findSpriteSymbols(spriteOk.text, ...pages.map((p) => p.text))
          : ['dist/icons.svg is not in the build'])
          .map((text) => ({ path: 'dist/icons.svg', line: 0, text })),
    ],
    [
      'style imports',
      () => {
        // global.css is the only place the cascade order is declared, so if it is gone the order is
        // undeclared — that is this check's failure to report, not a crash in it.
        const entry = cssFiles.find((f) => f.path === 'src/styles/global.css');
        const problems = entry
          ? findStyleImportMismatches(entry.text, cssPaths, CSS_IMPORT_ORDER)
          : ['entry point missing: no src/styles/global.css in src/styles/'];
        return problems.map((text) => ({ path: 'src/styles/global.css', line: 0, text }));
      },
    ],
  ];
  // The docs are gitignored, so a fresh clone must still build: guard the check on the file
  // rather than deleting it — a missing DESIGN.md must never read as zero drift. The absence is
  // announced on stdout, because a check count that quietly shrinks from 6 to 5 is how this
  // tripwire stopped being one. The count in the summary line comes from CHECKS.length, so the
  // note above it is what explains a 5-check run.
  const designMdPath = join(ROOT, 'DESIGN.md');
  if (existsSync(designMdPath)) {
    CHECKS.push([
      'token drift',
      () => {
        // Matched by exact path, so a rename of the token file yields [] — and an empty code set
        // would read as "every doc hex is doc-only drift", or as a clean pass if the doc were
        // empty too. Crash on it instead of going green.
        const tokenCss = cssFiles.filter(
          (f) => f.path === 'src/styles/tokens/legacy-root.css'
        );
        if (tokenCss.length === 0) {
          throw new Error(
            'token drift: src/styles/tokens/legacy-root.css missing from src/styles/ — ' +
            'the drift check has no code side to compare and cannot report honestly'
          );
        }
        return findTokenDrift(readFileSync(designMdPath, 'utf8'), tokenCss).map((d) => ({
          path: 'DESIGN.md',
          line: 0,
          text: d.onlyInDoc ? `doc-only ${d.onlyInDoc}` : `code-only ${d.onlyInCode}`,
        }));
      },
    ]);
  } else {
    console.log('token drift skipped: no DESIGN.md (untracked)');
  }
  const failures = CHECKS.flatMap(([check, run]) => run().map((h) => [check, h]));
  failures.forEach(([check, h], i) => {
    console.error(`GUARD FAIL ${i + 1} [${check}] ${h.path}:${h.line} ${h.text}`);
  });
  if (failures.length) {
    console.error(`guard: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log(`guard: OK (${CHECKS.length} checks, 0 failures)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
