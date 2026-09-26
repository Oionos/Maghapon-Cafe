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

// Task 6: the six nodes the app shell persists across a client-side swap. §4's router contract item
// 4 is why the VALUE is the contract — a bare `transition:persist` gets a page-scoped generated key
// (`astro-7jqgbady-1` on one route, `astro-lpt2ysjp-1` on the next for the same element), so
// old and new never pair, the destination discards the node and the chrome reloads with the page.
// Frozen here because Task 7's `view-transition-name` list must match it one-for-one.
export const PERSIST_KEYS = [
  'nav-rail',
  'global-controls',
  'mobile-topbar',
  'tab-bar',
  'cart-panel',
  'cart-drawer',
];

// The exact shape Astro's `swapFunctions` generates when the directive is left unkeyed.
const GENERATED_KEY_RE = /^astro-[a-z0-9]{8}-\d+$/;

// Task 7: a key is a pairing handle for the swap AND, once §6.4 gives every key a
// `view-transition-name`, the selector that picks a snapshot group. One name can only name one
// element per page, so a repeat is reported even though presence/approved/non-empty all pass.
const DUPLICATE_KEY_TEXT = (key) =>
  `duplicate key on one page: ${key} — one node per name; a repeat breaks the pair`;

// The printer formats `path:line text`, so `text` must be the whole human-readable finding:
// a spare `kind` field is silently dropped and the run prints `undefined` in its place.
function contractFail(path, text, at = 0, src = '') {
  return { path, line: src ? src.slice(0, at).split('\n').length : 1, text };
}

// Ruling J: the built `/admin` renders no order controls, no cart panel and no bottom tab bar, so
// it ships three of the six keys while every other built page ships all six. That spread is
// DECLARED, never inferred from whatever the build happens to emit — a Phase 2/3 page that
// legitimately drops chrome has to edit this list, which is a reviewable act, instead of silently
// weakening a tally.
export const ADMIN_DROPPED_KEYS = ['global-controls', 'cart-panel', 'tab-bar'];

// POSIX `/` is what `main()` hands this function
// (`relative(ROOT, p).split(sep).join('/')`), but a caller that passes OS-native paths must not be
// able to make `/admin` look like a customer page and so demand chrome of it — that is a false
// refusal, Ruling S's landmine.
function expectedKeysFor(path, approved) {
  const posix = String(path).replace(/\\/g, '/');
  if (!posix.startsWith('dist/admin/')) return approved;
  return approved.filter((k) => !ADMIN_DROPPED_KEYS.includes(k));
}

export function findRouterContract(pages, approved = PERSIST_KEYS) {
  const found = [];
  const failures = [];
  for (const page of pages) {
    // ClientRouter.astro writes this meta; without it astro's router calls preventDefault() and the
    // browser does a full navigation (§4 item 8), so the swap never happens at all.
    if (!/<meta\s+name="astro-view-transitions-enabled"/.test(page.text)) {
      failures.push(contractFail(page.path, 'missing enable-meta'));
    }
    // Per-page, never across pages: the built `/admin` legitimately carries three of the six keys
    // (`nav-rail`, `mobile-topbar`, `cart-drawer`) and a customer page all six, so a document-wide
    // tally would flag that legal spread as a repeat. Measured 2026-09-25 over `dist/**/*.html`.
    const perPage = new Map();
    for (const m of page.text.matchAll(/data-astro-transition-persist="([^"]*)"/g)) {
      const key = m[1];
      found.push(key);
      const at = m.index;
      perPage.set(key, (perPage.get(key) ?? 0) + 1);
      if (perPage.get(key) > 1) {
        failures.push(contractFail(page.path, DUPLICATE_KEY_TEXT(key), at, page.text));
      }
      if (!key) {
        failures.push(contractFail(page.path, 'empty key', at, page.text));
      } else if (GENERATED_KEY_RE.test(key)) {
        const why = `generated key: ${key} — write transition:persist="<stable key>"`;
        failures.push(contractFail(page.path, why, at, page.text));
      } else if (!approved.includes(key)) {
        const why = `key not approved: ${key} — add it to PERSIST_KEYS or fix the name`;
        failures.push(contractFail(page.path, why, at, page.text));
      }
    }
    // Completeness is judged against the set THIS page owes, never against the union of all pages.
    // The union tally this replaced passed the exact defect the check exists for: one page dropping
    // `tab-bar` while the other five still emitted it read as a green run (the whole-branch
    // review's M-A mutant). `/admin`'s three-key shape is legal only because it is declared above.
    // What this proves is EMISSION, per document — that the attribute is in the HTML the build
    // wrote. It never proves SURVIVAL: a key can be emitted on both pages and still fail to pair
    // across a swap, and that half is exit-record §7.2's claim, measured in a browser, not here.
    const expected = expectedKeysFor(page.path, approved);
    for (const key of expected) {
      if (!perPage.has(key)) {
        const why = `key ${key} absent on ${page.path} — this page must emit it`;
        failures.push(contractFail(page.path, why));
      }
    }
    // An approved chrome key in the wrong document — the same drift seen from the other side: a
    // persisted order panel appearing inside `/admin`, which renders none. Unapproved values are
    // already named by the loop above, so this stays silent on them; one defect, one finding.
    for (const key of perPage.keys()) {
      if (!expected.includes(key) && approved.includes(key)) {
        const why = `unexpected key ${key} on ${page.path} — /admin ships no order chrome`;
        failures.push(contractFail(page.path, why));
      }
    }
  }
  // Vacuity tripwire, kept; the union loop it sits beside is deleted, because a key emitted by no
  // page is now reported absent by every page, so the cross-page tally said nothing the per-page
  // rule does not say better. "No persisted node anywhere" is still a different fact from "this
  // page is missing that node", and the operator needs it stated as one line.
  // Appended, not returned instead: the enable-meta findings above are what tell the operator
  // whether the router is on at all, and a run that traded one for the other answers nothing.
  if (!found.length) {
    failures.push(contractFail('dist', 'no persisted node in any page'));
    return failures;
  }
  return failures;
}

// Task 7's check 9 — §6.4's route motion. The names below are the contract `src/styles/motion.css`
// writes: TRANSITION_NAMES is derived from PERSIST_KEYS rather than hand-listed, so a seventh
// persisted node cannot be added without this check noticing its missing carve-out.
export const TRANSITION_KEYFRAMES = ['maghapon-page-in', 'maghapon-page-out'];
export const TRANSITION_NAMES = PERSIST_KEYS.map((k) => `maghapon-${k}`);

function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function balancedBody(text, open) {
  const close = matchBrace(text, open);
  return close === -1 ? '' : text.slice(open + 1, close);
}

// The rules declared inside one block's body, as `{ selector, declarations }`. Nested at-rules are
// walked into rather than skipped: `@media` inside `@media` (or inside `@supports`) is legal CSS,
// and a stop authored one level down stops the animation just as dead — refusing that shape would
// be Ruling S's landmine. An unterminated `{` yields the rest of the text as its body, which is how
// a browser reads it too. No body `reducedMotionBlocks` returns can reach that branch — a slice
// taken by `matchBrace` is balanced by construction — so it is this helper's own totality guard for
// a future caller, and it has no fixture; `node_modules/.cache/maghapon/t9ff-mut.mjs` records the
// mutant of it as an equivalent mutant, and the differential fuzz beside it shows why.
function rulesIn(body) {
  const rules = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{', i);
    if (open === -1) break;
    const close = matchBrace(body, open);
    const end = close === -1 ? body.length : close;
    const prelude = body.slice(i, open);
    const inner = body.slice(open + 1, end);
    if (/^\s*@/.test(prelude)) rules.push(...rulesIn(inner));
    else rules.push({ selector: prelude, declarations: inner });
    i = end + 1;
  }
  return rules;
}

// Two accepted forms of the feature test — `: reduce` and the bare `(prefers-reduced-motion)` —
// and never `no-preference`, which asserts the opposite. The bare form is real CSS and it is
// already in this build: Astro's own injected head CSS, which opens the bundle, is written that
// way (measured 2026-09-26 over `dist/_astro/*.css`). Ruling S: a check that refuses a correct
// file is a landmine, because it also prints a false finding about it — `no prefers-reduced-motion
// block` — while a check that accepts an incorrect one is merely loud.
//
// Each block's own body is what is read, and inside it the rule whose selector names the
// pseudo-element — a block that merely mentions the root pair does not stop anything (see
// `stopsRootPair` below). There is more than one reduce block on purpose — Astro's head CSS,
// motion.css's component-motion block from Phase 0, and §6.4's root stop — so reading only the
// first would make this check fail a file that is correct (measured: the bundle's first block is
// Astro's and never names `(root)`). The rule is therefore "some block does".
function reducedMotionBlocks(cssText) {
  const bodies = [];
  const open = /@media[^{]*\(\s*prefers-reduced-motion\s*(?::\s*reduce\s*)?\)[^{]*\{/g;
  for (const m of cssText.matchAll(open)) {
    bodies.push(balancedBody(cssText, m.index + m[0].length - 1));
  }
  return bodies;
}

// What a browser cannot see, this check must not see either: a commented-out declaration is not a
// declaration. Leaving `/* … */` text in the input made check 9 refuse a correct sheet — parking a
// rule mid-restyle is the normal thing to do with a disabled `view-transition-name` — while a
// commented-out `@keyframes` quietly satisfied "defined". An unterminated `/*` is closed at the end
// of the text, exactly as CSS does, because a lazy-only closer strips nothing from such a sheet and
// hands its commented-out tail back to the count. Measured 2026-09-26 over the shipped
// `dist/_astro/Base.DthEEQz0.css`: 0 occurrences of `/*` in 47,768 chars, so today the strip is the
// identity and the shapes it protects are Phase 2 authoring, not a live hole. The cost of the tail
// form is that a `/*` inside a `url(data:…)` value would hide the rest of the sheet from this check
// — the shipped sheet carries 2 `data:` URIs and none of them contains one.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '');
}

// Check 9 reads EVERY shipped CSS source — the bundled sheet plus each page's inline <style> — and
// takes them as `{ path, text }` objects (bare strings are accepted for single-corpus callers)
// rather than as one pre-joined blob, because the two rules it enforces have different scopes: the
// keyframes and carve-out rules are corpus-wide on purpose (a `@keyframes` defined in any one file
// is defined), while a name application is per source, exactly as check 8 counts persist keys per
// page. Every shipped CSS source is passed in, not just the bundle, because the animation this
// check exists to catch arrives from Astro's own CSS rather than from motion.css.
export function findTransitionCss(input) {
  const sources = (typeof input === 'string' ? [{ text: input }] : input).map((s) =>
    typeof s === 'string' ? { text: s } : s
  );
  // Stripped once, here, so no predicate can read raw text by accident. Before this line the corpus
  // rules and the per-file tally disagreed about what a comment contains, and the divergence was
  // documented in a comment instead of removed.
  const clean = sources.map((s) => ({ path: s.path, text: stripComments(s.text) }));
  const cssText = clean.map((s) => s.text).join('\n');
  const problems = [];

  for (const name of TRANSITION_KEYFRAMES) {
    const defined = [...cssText.matchAll(new RegExp(`@keyframes\\s+${name}\\b`, 'g'))].length;
    if (defined === 0) problems.push(`missing @keyframes ${name}`);
    if (defined > 1) problems.push(`@keyframes ${name} is defined ${defined} times`);
  }

  for (const [pseudo, name] of [
    ['old', 'maghapon-page-out'],
    ['new', 'maghapon-page-in'],
  ]) {
    const re = new RegExp(
      `::view-transition-${pseudo}\\(root\\)[^{]*\\{[^}]*animation[^;}]*\\b${name}\\b`
    );
    if (!re.test(cssText)) {
      problems.push(`::view-transition-${pseudo}(root) does not animate ${name}`);
    }
  }

  // Coverage limit, named because a text scan cannot see past the rule it is reading: three
  // later-override shapes leave these predicates green while the browser animates anyway —
  // `animation` redefined for the same selector later in the cascade, a later `animation` shorthand
  // that resets the longhand, and a `!important` from a later rule beating an un-`!important`
  // carve-out. Phase 2's restyle is where an authored override could arrive, and a browser
  // measurement, not this guard, owns it.
  for (const name of TRANSITION_NAMES) {
    // All three forms, not any one of them: `group` alone sizes the snapshot but still cross-fades
    // its old and new images, so a half-carved node keeps the "the tab bar reloaded" tell Ruling C
    // exists to prevent while the check reads green.
    const missing = ['group', 'old', 'new'].filter((word) => {
      const carve = new RegExp(
        `::view-transition-${word}\\(${name}\\)[^{]*\\{[^}]*animation:\\s*none`
      );
      return !carve.test(cssText);
    });
    if (missing.length) {
      const forms = missing.join(' ');
      problems.push(`no carve-out rule for ${name} (${forms} not stopped)`);
    }
    // One name may name one element per page, so a second application of the same name breaks the
    // swap's pairing the same way a duplicate persist key does — and no other check sees the CSS.
    // Tallied PER SOURCE, never over the joined corpus: all six names legitimately appear once in
    // the bundled sheet, and a page may restate one in its own inline <style>, so a corpus-wide
    // count would flag that legal spread as a repeat — check 8's `spread` lesson, transplanted.
    // Coverage limits, stated rather than implied, both of this tally's unit and of its subject:
    // ZERO applications still passes, so check 9 proves the sheet names the animation, not that any
    // element uses one. And because the unit is a FILE, a name applied once in the shared sheet and
    // once more in a page's inline <style> — or once in each of two sheets — is two applications on
    // the page that loads both, and passes here; check 8's per-document reasoning does not transfer
    // that far, since a stylesheet is shared by every page that links it. The two shapes are the
    // review's `rr9a-fixtures.mjs` C2/C3 (scratch, gitignored); reachability is measured — the six
    // shipped pages carry 0 inline <style> blocks, so today this is a Phase 2 authoring risk, not a
    // live hole. Counting over the corpus instead would refuse the legal spread above: Ruling S
    // names refusing a correct file as the landmine and accepting an incorrect one as merely loud,
    // so the miss is named, not cured.
    for (const src of clean) {
      const applied = [
        ...src.text.matchAll(new RegExp(`view-transition-name:\\s*${name}\\b`, 'g'))
      ].length;
      if (applied > 1) {
        // The source is named because the finding is per file: `in` a sheet the operator can open.
        const where = src.path ? ` in ${src.path}` : '';
        const why = `${name} is applied ${applied} times${where} — one name may name one element`;
        problems.push(`view-transition-name: ${why}`);
      }
    }
  }

  // A `view-transition-name` the shell never persists has no carve-out to find, so the loop above
  // cannot see it. A typo of an approved name — `#tab-bar { view-transition-name:
  // maghapon-tabbar }` — leaves the node named, keeps Astro's default cross-fade, and shows the
  // exact "the tab bar reloaded" tell Ruling C exists to prevent, while both halves of the
  // contract stay green (review finding F-F2). Scope, stated: only the `maghapon-` prefix is
  // collected, because that prefix IS this project's naming contract; a node named something else
  // entirely drops to zero applications of its approved name, which is the limit documented
  // above, not a hole new to this rule. The refusal runs the other way too, and is the cheaper
  // half to name: a Phase 2 shared-element transition that deliberately takes a `maghapon-` name
  // WITHOUT persisting its node is refused here, and the honest answer is to widen this rule's
  // contract on purpose — the same reviewable act `ADMIN_DROPPED_KEYS` above is — not to rename
  // the glyph to slip past a prefix test.
  // The repeat of a real name is reported once, by the per-source tally above, never twice.
  const rogue = new Set();
  for (const src of clean) {
    for (const m of src.text.matchAll(/view-transition-name:\s*(maghapon-[\w-]+)/g)) {
      const name = m[1];
      if (TRANSITION_NAMES.includes(name) || rogue.has(`${src.path}|${name}`)) continue;
      rogue.add(`${src.path}|${name}`);
      const where = src.path ? ` in ${src.path}` : '';
      const why = `${name} is applied${where} but is not a persisted-node name`;
      problems.push(`view-transition-name: ${why}`);
    }
  }

  // Any keyframe that is not ours but is named by a view-transition rule is a second animation on
  // one group — the Ruling B risk, which arrives from Astro's head CSS, not from motion.css.
  for (const m of cssText.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const name = m[1];
    if (TRANSITION_KEYFRAMES.includes(name)) continue;
    if (new RegExp(`::view-transition-[^{]*\\{[^}]*\\b${name}\\b`).test(cssText)) {
      problems.push(`${name} is a second animation on a view-transition group`);
    }
  }

  const blocks = reducedMotionBlocks(cssText);
  // Structural, not "the block's text contains these three things": a reduce block that merely
  // MENTIONS both root pseudos and stops some unrelated rule with `animation: none !important`
  // satisfies three text tests and animates anyway (review mutant M-C, which returned []). So the
  // declaration is looked for inside the body of a rule whose OWN selector names that pseudo, per
  // pseudo, and both must hold in the same block. The accepted value is a declaration on
  // `animation`/`animation-name` whose value contains `none`, which covers `animation: none
  // !important`, a plain `animation: none`, `animation-name`, and a shorthand that puts the name
  // last — refusing a legal spelling is Ruling S's landmine. The property name is anchored to a
  // declaration start (the head of the body, or after a `;`) and must be followed by `:`, so
  // `animation-duration: 0.01ms !important` — Phase 0's blanket component stop — never counts.
  const stopsRootPseudo = (blockBody, word) => {
    const named = new RegExp(`::view-transition-${word}\\(root\\)`);
    const stopped = /(^|[;])\s*animation(?:-name)?\s*:[^;}]*\bnone\b/;
    return rulesIn(blockBody).some(
      (rule) => named.test(rule.selector) && stopped.test(rule.declarations)
    );
  };
  const stopsRootPair = (b) => stopsRootPseudo(b, 'old') && stopsRootPseudo(b, 'new');
  if (!blocks.length) {
    problems.push('no prefers-reduced-motion block');
  } else if (!blocks.some(stopsRootPair)) {
    problems.push('prefers-reduced-motion does not stop the root animation');
  }
  return problems;
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
    // `pages` is the .html subset of the build, already carrying `.text`; `route parity` above
    // consumes the same array, so no projection is needed here either.
    ['router contract', () => findRouterContract(pages)],
    [
      'transition css',
      () => {
        // Over BOTH sources of shipped CSS: the second animation this check exists to catch (Ruling
        // B) arrives from Astro's own view-transition CSS, not from motion.css. Measured 2026-09-26
        // over `dist/`: that CSS lands in the single bundled `.css` sheet today and no page carries
        // an inline `<style>`, but a page-level `<style>` is a legal Astro construct, so both kinds
        // stay inputs rather than one being assumed away.
        // Each stays a separate source: the corpus rules join them inside the check, while a name
        // application is counted per file — one page's block must not read as a second copy of the
        // sheet's declaration, which is check 8's per-page lesson.
        const sheets = distFiles.filter((f) => f.path.endsWith('.css'));
        const inline = pages.flatMap((p) =>
          [...p.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => ({
            path: `${p.path} <style>`,
            text: m[1],
          }))
        );
        const sources = [...sheets.map((f) => ({ path: f.path, text: f.text })), ...inline];
        const problems = findTransitionCss(sources);
        if (!problems.length) return [];
        // The same {path, line, text} shape `style imports` above uses: a bare string would print
        // `undefined` in the place where the finding belongs.
        const owner = sheets.find((f) => f.text.includes('maghapon-page-in'));
        return problems.map((text) => ({
          path: owner ? owner.path : 'dist/_astro/*.css',
          line: 0,
          text,
        }));
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
