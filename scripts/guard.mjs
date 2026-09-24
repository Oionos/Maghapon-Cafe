// scripts/guard.mjs — build-time invariants for the Maghapon demo. Plain Node, zero deps:
// AGENTS.MD §3.3 allows no test/lint framework, so the checks are the framework.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSET_RE = /\.(html|css|js|mjs|webmanifest|svg)$/i;
// xmlns/xml prefixes are identity URIs, never fetched — the grain data-URI in base.css uses one.
const NS_DECL = /xmlns(:[a-z]+)?\s*=\s*["'][^"']*["']/g;

export const WEB_ROUTES = [
  'dist/404.html',
  'dist/admin/index.html',
  'dist/booking/index.html',
  'dist/index.html',
  'dist/menu/index.html',
  'dist/my-orders/index.html',
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
    /https?:\/\//.test(line)
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

// Sprite references resolve against the sprite's own <symbol> ids, so a typo'd `<use href>`
// renders nothing at runtime and no other check notices. Spare glyphs are deliberately not
// reported: an unused symbol in a 7-symbol sprite violates nothing (§3.5).
export function findSpriteSymbols(...sources) {
  const [sprite, ...refs] = sources;
  const defined = new Set([...sprite.matchAll(/<symbol id="([\w-]+)"/g)].map((m) => m[1]));
  const referenced = new Set();
  for (const text of refs) {
    for (const m of text.matchAll(/icons\.svg#([\w-]+)/g)) referenced.add(m[1]);
  }
  return [...referenced].filter((id) => !defined.has(id));
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
  // One entry per check. Task 4 appends `sprite symbols` and Task 7 appends `token drift`
  // here; the count below is read off this array so it can never drift from what ran.
  const CHECKS = [
    ['external origin', () => findExternalOrigins(distFiles)],
    ['icon font usage', () => findIconFontUsage(distFiles)],
    [
      'undefined token',
      () =>
        findUndefinedTokens(cssFiles).map((u) => ({
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
        (spriteOk ? findSpriteSymbols(spriteOk.text, ...pages.map((p) => p.text)) : ['icons.svg'])
          .map((id) => ({ path: 'dist/icons.svg', line: 0, text: `no <symbol id="${id}">` })),
    ],
  ];
  // The docs are gitignored, so a fresh clone must still build: guard the check on the file
  // rather than deleting it — a missing DESIGN.md must never read as zero drift.
  if (existsSync(join(ROOT, 'DESIGN.md'))) {
    CHECKS.push([
      'token drift',
      () =>
        findTokenDrift(readFileSync(join(ROOT, 'DESIGN.md'), 'utf8'), cssFiles.filter(
          (f) => f.path === 'src/styles/tokens/legacy-root.css'
        )).map((d) => ({
          path: 'DESIGN.md',
          line: 0,
          text: d.onlyInDoc ? `doc-only ${d.onlyInDoc}` : `code-only ${d.onlyInCode}`,
        })),
    ]);
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
