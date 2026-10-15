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
// compile error. Order is compared, not just membership, because the 16 imported files are
// interchangeable to a set comparison and not at all to the browser.
export const CSS_IMPORT_ORDER = [
  'src/styles/tokens/1-primitive.css',
  'src/styles/tokens/2-semantic.css',
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

// The four Task 9 checks read either the walked CSS corpus or the built documents, and the two
// scope predicates need one file's TEXT out of that corpus. A renamed or deleted tier file must
// crash the run, exactly as `token drift`'s empty code set does: an empty string would satisfy
// "no [data-surface] block" as a *missing* input rather than a design fact, and the operator would
// read a design finding from a plumbing failure.
function readSrc(cssFiles, path) {
  const hit = cssFiles.find((f) => f.path === path);
  if (!hit) throw new Error(`guard: ${path} is not in the walked CSS set`);
  return hit.text;
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

// Dead-token note: `--font-mono: 'Geist Mono', …` was deleted in Task 5, when the Google Fonts
// <link> supply went away. Nothing in src/ ever referenced it, and that <link> was its only
// source, so re-adding it would put a second untruth in the token files. (Task 8 deleted the
// legacy token file this note used to name as a live path.)
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
// `stopsRootPseudo` below). There is more than one reduce block on purpose — Astro's head CSS,
// motion.css's component-motion block from Phase 0, and §6.4's root stop — so reading only the
// first would make this check fail a file that is correct (measured: the bundle's first block is
// Astro's and never names `(root)`). The rule is therefore "some block does", per pseudo.
function reducedMotionBlocks(cssText) {
  const bodies = [];
  const open = /@media[^{]*\(\s*prefers-reduced-motion\s*(?::\s*reduce\s*)?\)[^{]*\{/g;
  for (const m of cssText.matchAll(open)) {
    bodies.push(balancedBody(cssText, m.index + m[0].length - 1));
  }
  return bodies;
}

// What a browser cannot see, this check must not see either: a commented-out declaration is not a
// declaration. Leaving `/* … */` text in the input made `transition css` refuse a correct sheet —
// parking a rule mid-restyle is the normal thing to do with a disabled `view-transition-name` —
// while a commented-out `@keyframes` quietly satisfied "defined". Each comment becomes whitespace
// of the same length with its newlines kept, so every caller's offsets and line numbers stay the
// raw file's: removal rewrote offsets, so every per-site finding read lines early (review Q-1 —
// all five `--focus-ring` sites on the real tree, the worst 10 lines off). An identifier a comment
// splits (`--rad/*x*/ius`) is separated, exactly as CSS reads it, where removal used to merge the
// halves into a name the file never declares. An unterminated `/*` is closed at the end of the
// text, exactly as CSS does, because a lazy-only closer would leave such a sheet's commented-out
// tail in the count. Measured 2026-10-13 over the shipped `dist/_astro/Base.cyweyQUY.css`: 0
// occurrences of `/*` in 49,130 bytes, so today the strip is the identity and the shapes it
// protects are Phase 2 authoring, not a live hole. The cost of the tail form is that a `/*` inside
// a `url(data:…)` value would hide the rest of the sheet from this check — the shipped sheet
// carries 2 `data:` URIs and none of them contains one.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));
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
  // pseudo; across the reduce blocks, both pseudos must be stopped. The accepted value is a
  // declaration on `animation`/`animation-name` whose value contains `none`, which covers
  // `animation: none !important`, a plain `animation: none`, `animation-name`, and a shorthand
  // that puts the name last — refusing a legal spelling is Ruling S's landmine. The property
  // name is anchored to a declaration start (the head of the body, or after a `;`) and must be
  // followed by `:`, so `animation-duration: 0.01ms !important` — Phase 0's blanket component
  // stop — never counts.
  const stopsRootPseudo = (blockBody, word) => {
    const named = new RegExp(`::view-transition-${word}\\(root\\)`);
    const stopped = /(^|[;])\s*animation(?:-name)?\s*:[^;}]*\bnone\b/;
    return rulesIn(blockBody).some(
      (rule) => named.test(rule.selector) && stopped.test(rule.declarations)
    );
  };
  // Per pseudo across the whole set of reduce blocks, not per block: the shipped sheet
  // already carries two reduce blocks (`src/styles/motion.css:71` and `:165`) and the sheet
  // is authored as slices under `src/styles/`, so `old` stopped in one and `new` in another
  // is legal CSS that halts both. Requiring the pair inside one block refused it (re-review
  // Minor-1, shape S3) while printing a reason that was false. What stays refused on purpose:
  // a duration stop (`animation: 0s`, `animation-duration: 0s`) — the contract is that the
  // NAME is gone, not that the movement is short — and a block that stops some unrelated rule
  // while merely naming a root pseudo (F-F3's mutant M-C).
  const stops = (word) => blocks.some((b) => stopsRootPseudo(b, word));
  if (!blocks.length) {
    problems.push('no prefers-reduced-motion block');
  } else if (!(stops('old') && stops('new'))) {
    problems.push('prefers-reduced-motion does not stop the root pair with `animation: none`');
  }
  return problems;
}

// Phase 2A §3.3: the deleted aliases are NOT re-exported under their old names. That decision is
// what turns `undefined token` into the completeness proof for all 263 rename sites — a kept
// `--radius: var(--tmp-radius-container)` would let a missed site resolve quietly and the check
// would print OK for it. This predicate is the other half: it refuses the back-compat alias
// creeping back in, as either a definition or a read, because either form restores the silence.
// Input completeness, measured 2026-10-13 at this BASE: `cssFiles` is `walk(src/styles)`, so a
// `var()` read in an inline `<style>` or a component script would be invisible here (and to
// `scope coverage`), and there is nowhere for one to hide today —
//   grep -rlE "var\(--" src/ --include=*.astro --include=*.js | wc -l  -> 0
//   grep -rl "<style" src/ --include=*.astro | wc -l                   -> 0
// A future inline `<style>` breaks that silently; re-run both before trusting a green run.
export const DELETED_ALIASES = [
  'radius',
  'radius-sm',
  'radius-xs',
  'shadow',
  'shadow-lift',
  'shadow-soft',
  'ease',
];

export function findAliasAbsence(cssFiles) {
  const failures = [];
  for (const file of cssFiles) {
    // A commented-out alias is not an alias (see `transition css` for why comments are stripped).
    const text = stripComments(file.text);
    for (const alias of DELETED_ALIASES) {
      // `(?![\w-])`, never `\b`: `--radius` must not match the head of `--radius-sm`, and a word
      // boundary after a closing paren is a different shape again in the read form below.
      const re = new RegExp(
        `(--${alias}(?![\\w-])\\s*:|var\\(\\s*--${alias}(?![\\w-])\\s*\\))`,
        'g'
      );
      for (const m of text.matchAll(re)) {
        failures.push({
          path: file.path,
          line: lineOf(file.text, m.index),
          text: `deleted alias --${alias} reappears: ${m[0]} — §3.3 deletes these names`,
        });
      }
    }
  }
  return failures;
}

// The two `[data-surface="…"]` blocks, as a surface -> body map. The `]` before the `{` is what
// keeps the compound tone selector (`[data-surface="editorial"][data-tone="dark"]`) out of this
// match: that selector has another `]` in the way, and it is a tone refinement, not a scope block.
// Feeding it in would make `scope parity` refuse a correct file — Ruling S's landmine — by
// counting two declarations as a third editorial block.
// Two limits, named: a grouped selector list (`[data-surface="a"], [data-surface="b"] {`) also
// fails the `]`-before-`{` form and is refused loudly by the missing-block clause, never passed
// silently; and a duplicated block for one surface overwrites the first in this Map, so the later
// body is the one judged (one block per surface in today's sheet).
function scopeBlocks(text) {
  const out = new Map();
  for (const m of text.matchAll(/\[data-surface="([a-z]+)"\]\s*\{/g)) {
    out.set(m[1], balancedBody(text, m.index + m[0].length - 1));
  }
  return out;
}

// §4.5 item 3 verbatim: every tier-2 token *read* somewhere must be declared in both blocks. A
// read of a key neither block sets resolves to nothing and the property falls back silently, which
// is the failure no other predicate sees.
export const TIER2_TOKENS = [
  '--surface',
  '--surface-raised',
  '--text-1',
  '--text-2',
  '--border',
  '--border-ui',
  '--radius-container',
  '--card-pad',
  '--elev-card',
  '--grain-opacity',
  '--dur-ui',
  '--focus-ring',
  '--elev-sheet',
  '--chrome-glass',
  '--focus-halo',
  '--pulse-ring',
  '--control-h',
];

// Stricter than coverage, and a different predicate: the two blocks must declare the same KEY SET.
// A key present in one ground and missing in the other is the two-grounds rule failing open, and
// coverage cannot see it when nothing reads the key (the typo case: `--card-padd` in one block).
// The deltas are DECLARED, never inferred from what the sheet happens to emit — the idiom
// `ADMIN_DROPPED_KEYS` established. Editing this table is a reviewable act.
export const SCOPE_DELTA = {
  'app-only': ['--border-ui'],
  'editorial-only': [],
};

export function findScopeCoverage(cssFiles, semanticText, delta = SCOPE_DELTA) {
  const blocks = scopeBlocks(stripComments(semanticText));
  const declared = (name) => (body) =>
    new RegExp(`--${name.slice(2)}(?![\\w-])\\s*:`, '').test(body);
  // `bothOk` carries --border-ui through the same declared table `scope parity` uses, and the
  // reason is real rather than convenient: it is a tier-1 primitive the app block restates, so a
  // read of it resolves on either ground. Requiring it in both blocks would make 2B's A-2
  // migration — the change that finally reads it — fail a correct edit. One table, two predicates.
  const bothOk = new Set();
  for (const name of delta['app-only']) bothOk.add(name);
  for (const name of delta['editorial-only']) bothOk.add(name);

  const failures = [];
  const reads = new Map(); // name -> first site, de-duped by name like `undefined token`
  for (const file of cssFiles) {
    const text = stripComments(file.text);
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!TIER2_TOKENS.includes(m[1]) || reads.has(m[1])) continue;
      reads.set(m[1], { path: file.path, line: lineOf(file.text, m.index) });
    }
  }
  // A missing block is this check's own failure to report, never a green run: with no
  // `[data-surface="app"]` in the sheet every read of a tier-2 name would be "undeclared", and
  // the operator would get twelve findings about tokens instead of one about the cascade.
  for (const surface of ['editorial', 'app']) {
    if (!blocks.has(surface)) {
      failures.push({
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: `no [data-surface="${surface}"] block — coverage cannot judge reads against nothing`,
      });
    }
  }
  if (failures.length) return failures;
  for (const [name, site] of reads) {
    if (bothOk.has(name)) continue;
    for (const [surface, body] of blocks) {
      if (!declared(name)(body)) {
        failures.push({
          ...site,
          text: `${name} is read but not declared in [data-surface="${surface}"]`,
        });
      }
    }
  }
  return failures;
}

export function findScopeParity(semanticText, delta = SCOPE_DELTA) {
  const blocks = scopeBlocks(stripComments(semanticText));
  const keys = (body) => new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  if (!blocks.has('editorial') || !blocks.has('app')) {
    return [
      {
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: 'both [data-surface] blocks are required to compare key sets',
      },
    ];
  }
  const ed = keys(blocks.get('editorial'));
  const ap = keys(blocks.get('app'));
  const failures = [];
  for (const name of ed) {
    if (!ap.has(name) && !delta['editorial-only'].includes(name)) {
      failures.push({
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: `${name} declared in editorial only — add it to the app block or to SCOPE_DELTA`,
      });
    }
  }
  for (const name of ap) {
    if (!ed.has(name) && !delta['app-only'].includes(name)) {
      failures.push({
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: `${name} declared in app only — add it to the editorial block or to SCOPE_DELTA`,
      });
    }
  }
  // A delta row for a key that is NOT actually a delta is dead table, and a dead table teaches the
  // next reader that tables here are decoration. Refused.
  for (const name of delta['app-only']) {
    if (ed.has(name) && ap.has(name)) {
      failures.push({
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: `SCOPE_DELTA lists ${name} as app-only but both blocks declare it`,
      });
    } else if (!ed.has(name) && !ap.has(name)) {
      failures.push({
        path: 'src/styles/tokens/2-semantic.css',
        line: 0,
        text: `SCOPE_DELTA lists ${name} as app-only but neither block declares it`,
      });
    }
  }
  return failures;
}

// §4.2's six rows, declared rather than inferred. This check exists because nothing else can:
// `astro build` validates no component props — measured at this BASE (2026-10-13), the anchored
// `grep -cE "^[[:space:]]*interface Props" src/layouts/Base.astro` prints 0 (the unanchored form
// prints 1 only because the comment above the props destructure states the absence) and
// node_modules/@astrojs/check is not installed — so a page that omits `surface` ships an unscoped
// document that falls through to `:root`, keeps working, and fails no other predicate. The
// guarantee is therefore mechanical here, reading the artifact that carries it, and not in the
// compiler.
export const ROUTE_SURFACES = [
  ['dist/index.html', 'editorial'],
  ['dist/menu/index.html', 'app'],
  ['dist/booking/index.html', 'app'],
  ['dist/my-orders/index.html', 'app'],
  ['dist/admin/index.html', 'app'],
  ['dist/404.html', 'editorial'],
];
export const TONE_TAG_TOTAL = 8; // six footers + the hero + the loyalty band
export const TONE_VALUES = ['dark', 'fill'];

export function findScopeDeclaration(pages, approved = ROUTE_SURFACES) {
  const failures = [];
  let toneTotal = 0;
  const toneSeen = new Set();
  for (const page of pages) {
    // (A) exactly one data-surface on <html>, matching this route's declared row. An unknown path
    // is reported, not skipped: a seventh page must edit this table, the same reviewable act
    // `ADMIN_DROPPED_KEYS` is.
    const row = approved.find(([path]) => path === page.path);
    if (!row) {
      failures.push(contractFail(page.path, 'no declared route -> surface row for this document'));
      continue;
    }
    const html = /<html\b[^>]*>/i.exec(page.text);
    if (!html) {
      failures.push(contractFail(page.path, 'no <html> tag found'));
      continue;
    }
    const attrs = [...html[0].matchAll(/\bdata-surface="([^"]*)"/g)];
    if (attrs.length !== 1) {
      failures.push(
        contractFail(page.path, `<html> carries ${attrs.length} data-surface, expected 1`, 0, '')
      );
    } else if (attrs[0][1] !== row[1]) {
      const why = `<html data-surface="${attrs[0][1]}"> but ${row[0]} is declared "${row[1]}"`;
      failures.push(contractFail(page.path, why));
    }
    // (B) every data-tone tag carries data-surface on the SAME tag. An attribute selector never
    // matches by inheritance, so `[data-surface="editorial"][data-tone="dark"]` is a conjunction
    // and a lone data-tone on an app document silently misses — the footer's 6.77 -> 3.46
    // regression spec §4.3 prices. That is the shape this clause exists to refuse.
    // This scans the whole document text, so it would also count a `data-tone="` sitting inside an
    // inline <script> string. Measured precondition at this BASE (re-run by Task 11 row 11):
    //   grep -rho 'data-tone="' dist/ | wc -l          -> 8   (one per tag, none per string)
    //   grep -rl 'data-tone' dist/_astro/*.js | wc -l  -> 0   (no bundle string carries it)
    // The line form `grep -rh 'data-tone' dist/` prints 7 — six HTML lines carry the eight tags
    // and one minified-CSS line carries the selector — so the occurrence form is the count of
    // markup tags, and the second grep is what keeps it one.
    for (const tag of page.text.matchAll(/<[a-zA-Z][^>]*>/g)) {
      if (!/\bdata-tone="/.test(tag[0])) continue;
      toneTotal += 1;
      for (const v of tag[0].matchAll(/\bdata-tone="([^"]*)"/g)) toneSeen.add(v[1]);
      if (!/\bdata-surface="/.test(tag[0])) {
        const head = tag[0].slice(0, 60).replace(/\s+/g, ' ');
        failures.push(
          contractFail(page.path, `data-tone without data-surface on the same tag: ${head}`)
        );
      }
    }
  }
  // (C) the corpus tally. Exact equality, not `>=`: eight is a measurement of this phase's markup,
  // and a ninth tag is a new tone declaration a reviewer should have to look at.
  if (toneTotal !== TONE_TAG_TOTAL) {
    failures.push(
      contractFail('dist', `data-tone count is ${toneTotal}, declared ${TONE_TAG_TOTAL}`)
    );
  }
  for (const value of toneSeen) {
    if (!TONE_VALUES.includes(value)) {
      failures.push(contractFail('dist', `data-tone="${value}" is not a declared tone`));
    }
  }
  for (const value of TONE_VALUES) {
    if (!toneSeen.has(value)) {
      failures.push(contractFail('dist', `declared tone "${value}" appears on no tag`));
    }
  }
  return failures;
}

// A declared selector -> minimum table, judged against the authored CSS rather than a browser.
// The limit is stated where a reader will hit it: this check cannot audit its own membership, so
// deleting a row is invisible to it and visible to test 4 below, which pins the selector set.
// Same shape as `ADMIN_DROPPED_KEYS`: the reviewable act is the edit, not the tally.
export const TOUCH_FLOOR = 44;
export const TOUCH_TARGETS = [
  {
    file: 'src/styles/cart-drawer.css',
    selector: '.cart-line-qty button',
    props: ['min-width', 'min-height'],
  },
  { file: 'src/styles/button.css', selector: '.btn-sm', props: ['min-height'] },
  { file: 'src/styles/menu-card.css', selector: '.tab-btn', props: ['min-height'] },
];

// The declared SCAN set: every shipping stylesheet except the two token tiers, which declare
// values rather than controls. Derived from the cascade's own declared list (CSS_IMPORT_ORDER) so a
// slice added to `global.css` is scanned without a second edit here, and `style imports` already
// keeps that list honest against disk. A `row.file` absent from the walked corpus is still a
// refusal (the file-outside-the-set fixture), so the table's owner column stays reviewable; the
// size scan spans this whole set, which is what lets a SECOND copy of a selector —
// `responsive.css`'s `.cart-panel .cart-line-qty button` — be read rather than missed. Pinned by
// test.
export const TOUCH_SCAN_FILES = CSS_IMPORT_ORDER.filter(
  (p) => !p.startsWith('src/styles/tokens/')
);

export function findTouchTargets(
  cssFiles,
  table = TOUCH_TARGETS,
  floor = TOUCH_FLOOR,
  scanFiles = TOUCH_SCAN_FILES
) {
  const failures = [];
  const scan = cssFiles.filter((f) => scanFiles.includes(f.path));
  for (const row of table) {
    const owner = cssFiles.find((f) => f.path === row.file);
    if (!owner) {
      failures.push({
        path: row.file,
        line: 0,
        text: `touch table names a file not in the CSS set`,
      });
      continue;
    }
    for (const prop of row.props) {
      // Each rule whose selector ENDS WITH this one immediately before `{` — the match is
      // unanchored, so `.cart-panel .cart-line-qty button` is read while `.tab-btn:hover` is not:
      // a `:hover` suffix sits between the target and the brace, and a hover rule that changes
      // colour must not be able to satisfy or break a size predicate. `[^}]*` stops at the first
      // block end, which is what keeps the suffix out. Within a matched block the FIRST `<prop>:`
      // declaration is judged (the lookup is a single `exec`, not a global scan), and `m.index`
      // comes from the comment-stripped text while `lineOf` reads the raw text — the two agree only
      // because `stripComments` replaces comments with equal-length spaces.
      const re = new RegExp(
        `${row.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
        'g'
      );
      // Aggregated per prop across every matched rule in the whole scan set: a sibling rule that
      // carries no size is legal, but a prop no matched rule declares has no floor, and that is a
      // refusal.
      let sized = false;
      for (const file of scan) {
        for (const m of stripComments(file.text).matchAll(re)) {
          const decl = new RegExp(`(^|[;\\s])${prop}:\\s*([^;}]+)`).exec(m[1]);
          if (!decl) continue; // this matched rule may carry no size; that is legal.
          sized = true;
          const value = decl[2].trim();
          const px = /^([0-9.]+)px$/.exec(value);
          if (px) {
            if (Number(px[1]) < floor) {
              failures.push({
                path: file.path,
                line: lineOf(file.text, m.index),
                text: `${row.selector} ${prop}: ${px[1]}px is under the ${floor}px touch floor`,
              });
            }
          } else if (!/^var\(\s*--control-h\s*\)$/.test(value)) {
            // 2B: controls read `--control-h` (declared 44), so the token is the second legal floor
            // form. A bare `var(--space-*)` is not: it resolves to a spacing step, not the control
            // height, and the refusal says so rather than converting it silently.
            failures.push({
              path: file.path,
              line: lineOf(file.text, m.index),
              text: `${prop}: ${value} is not a px value or var(--control-h)`,
            });
          }
        }
      }
      if (!sized) {
        failures.push({
          path: row.file,
          line: 0,
          text: `no rule for ${row.selector} declaring ${prop} — the control has no floor`,
        });
      }
    }
  }
  return failures;
}

// WCAG 2.1 relative luminance and the ratio it defines. Re-derived here from the hexes rather than
// copied from a report: the number this check prints is its own evidence, and a transcribed
// constant would be a claim the guard cannot defend (Ruling AM applied to a check body).
function srgbChannel(byte) {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

export function contrastRatio(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Twelve rows: spec §2's six text pairs and six indicator pairs (§6.1's five token-derivable
// grounds plus §6.2's fill ring at the band's ink end). §6.1's loyalty RUST end is carried in the
// text group as `--cream-0` on `--rust-600` (5.37), and its hero-scrim row is absent on purpose:
// a photograph under a scrim is not derivable from a hex (§10 names it, and §6.2's row is
// labelled a proxy). No row is whitelisted: A-2 and A-3 are 2B's, which is what lets this check
// arrive green by merit instead of by exception.
//
// A ground may be a bare hex when no token names it. Exactly one row does: #ffffff, the app
// block's `--surface-raised`, which §4.4 keeps a literal on purpose and §7.2 keeps out of
// `token drift` for the same reason. Naming a hex here is honest; adding a `--white` primitive
// nothing reads would not be (spec §3.2 declares only what is read).
export const CONTRAST_PAIRS = [
  { kind: 'text', fg: '--ink-900', bg: '--cream-0', min: 4.5, why: 'headings on the app ground' },
  { kind: 'text', fg: '--ink-700', bg: '--cream-0', min: 4.5, why: 'body copy on the app ground' },
  { kind: 'text', fg: '--ink-700', bg: '--cream-50', min: 4.5,
    why: 'body copy on the editorial ground' },
  { kind: 'text', fg: '--cream-50', bg: '--hearth-950', min: 4.5, why: 'footer body copy' },
  { kind: 'text', fg: '--cream-0', bg: '--rust-600', min: 4.5,
    why: 'primary button label, and the band rust end' },
  { kind: 'text', fg: '--cream-0', bg: '--open-600', min: 4.5, why: 'the open-now pill' },
  { kind: 'ui', fg: '--rust-600', bg: '--cream-0', min: 3, why: 'focus ring on the app ground' },
  { kind: 'ui', fg: '--rust-600', bg: '--cream-50', min: 3,
    why: 'focus ring on the editorial ground' },
  { kind: 'ui', fg: '--rust-600', bg: '#ffffff', min: 3, why: 'focus ring on a white field' },
  { kind: 'ui', fg: '--rust-400', bg: '--hearth-950', min: 3,
    why: 'dark-tone focus ring: the value the sheet ships today' },
  { kind: 'ui', fg: '--cream-0', bg: '--ink-900', min: 3,
    why: 'the fill ring at the band ink end' },
  { kind: 'ui', fg: '--rust-400', bg: '--ink-900', min: 3,
    why: 'dark-tone ring at the band ink end' },
];

export function findContrast(
  primitiveText,
  pairs = CONTRAST_PAIRS,
  sourcePath = 'src/styles/tokens/1-primitive.css'
) {
  // A local, non-global validator. `HEX_RE` at the top of this file has the `g` flag, so `.test()`
  // on it advances `lastIndex` and answers differently on the second call — a stateful helper
  // would make one row's verdict depend on the row before it.
  const HEX = /^#[0-9a-f]{6}$/;
  const hexes = new Map();
  for (const m of primitiveText.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!hexes.has(m[1])) hexes.set(m[1], m[2].trim().toLowerCase());
  }
  const failures = [];
  for (const row of pairs) {
    const resolve = (ref) => (HEX.test(ref) ? ref : hexes.get(ref));
    const [fg, bg] = [resolve(row.fg), resolve(row.bg)];
    for (const [role, value, ref] of [
      ['fg', fg, row.fg],
      ['bg', bg, row.bg],
    ]) {
      if (!value) {
        failures.push({
          path: sourcePath,
          line: 0,
          text:
            `${row.kind} pair ${row.fg} on ${row.bg} (${role}): ` +
            `${ref} has no hex in the token file`,
        });
        continue;
      }
      if (!HEX.test(value)) {
        failures.push({
          path: sourcePath,
          line: 0,
          text: `${row.kind} pair ${row.fg} on ${row.bg} (${role}): unparsable ${value}`,
        });
      }
    }
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < row.min) {
      const r = ratio.toFixed(4);
      failures.push({
        path: sourcePath,
        line: 0,
        text: `${row.kind} ${row.fg} on ${row.bg} = ${r}, under ${row.min} — ${row.why}`,
      });
    }
  }
  return failures;
}

// Task 13 check 1 — `tmp deletion`. 2B's scaffolding had two shapes: `--tmp-*` names (§3.3
// deletes them) and the `3-transitional.css` slice (Task 12 deleted it). Either reappearing in the
// authored tree is a regression, and neither has another owner here: `undefined token` can only
// report a read of a name no shipping file declares, so a name nothing reads yet sails past it,
// and an orphan slice declares what nothing ships. Comments are stripped first — a commented-out
// name is not a name, the same boundary every predicate in this file reads through. The limit is
// the scan's horizon: it reads authored text under `src/styles/` (the walked corpus, tests are
// deliberately not in it — the three `3-transitional` path strings the fixtures carry are
// survivors, not hits), not the cascade and not the build, so a name arriving from anywhere else
// is invisible to it.
export const TMP_SCANS = [
  { needle: '--tmp-', why: '§3.3 deleted the transitional names' },
  { needle: '3-transitional', why: '2B Task 12 deleted the transitional slice' },
];

export function findTmpDeletion(cssFiles, scans = TMP_SCANS) {
  const failures = [];
  for (const file of cssFiles) {
    const clean = stripComments(file.text);
    for (const { needle, why } of scans) {
      let at = clean.indexOf(needle);
      while (at !== -1) {
        failures.push({
          path: file.path,
          line: lineOf(file.text, at),
          text: `${needle} reappears — ${why}`,
        });
        at = clean.indexOf(needle, at + needle.length);
      }
    }
  }
  return failures;
}

// Every custom-property declaration in the walked corpus, comments stripped, as occurrences in
// file order plus a first-wins name map. The map is the M-8 convention Task 8's size lookup uses:
// a later duplicate of a name is judged by the value a reader resolves first, so the map — not
// the last declaration — is what a target resolves through. Shared by `indirection` and
// `translucency cap`, the two checks that resolve a declared name to its value.
function customPropertyDecls(cssFiles) {
  const decls = [];
  const first = new Map();
  for (const file of cssFiles) {
    const clean = stripComments(file.text);
    for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;}]+);/g)) {
      const value = m[2].trim();
      decls.push({ path: file.path, raw: file.text, index: m.index, name: m[1], value });
      if (!first.has(m[1])) first.set(m[1], value);
    }
  }
  return { decls, first };
}

// Task 13 check 2 — `indirection`. 2B's semantic names land on primitive literals: a declaration
// whose whole value is a bare `var(--name)` (no fallback) is one hop, and one hop is the shape
// every converted site has. A target whose own value is itself a bare var() is a second hop — a
// chain, or a cycle — and that is where a reader chasing the value to a literal stops being able
// to. `--elev-sheet: var(--elev-float)` is the canonical accept: its target is a tier-1 literal.
// Resolution reads the FIRST declaration of the target's name (the M-8 convention above), so a
// later duplicate cannot change a verdict the first declaration already settled. Two limits are
// named here: a literal re-introduced at a previously converted site is invisible to this check
// — no check owns arbitrary value shapes (`token drift` censuses DESIGN.md's hexes, `alias
// absence` judges the seven retired names), so the gap is inherent to a static guard — and a
// target no shipping file declares is silent on purpose: a dangling read is `undefined
// token`'s finding.
export function findIndirection(cssFiles) {
  const { decls, first } = customPropertyDecls(cssFiles);
  // A local, non-global pattern: `.test` on a global regex would carry `lastIndex` between rows
  // (the same statefulness `findContrast`'s local HEX comment describes).
  const BARE_VAR = /^var\(\s*(--[\w-]+)\s*\)$/;
  const failures = [];
  for (const d of decls) {
    const hop = BARE_VAR.exec(d.value);
    if (!hop) continue;
    const target = first.get(hop[1]);
    if (target === undefined) continue;
    if (BARE_VAR.test(target)) {
      failures.push({
        path: d.path,
        line: lineOf(d.raw, d.index),
        text: `${d.name}: ${d.value} — ${hop[1]} is itself a bare var(); one hop only`,
      });
    }
  }
  return failures;
}

// A value resolved through the first-wins map until it is a literal. A dangling hop (a name no
// declaration provides) and the depth bound (which a cycle never escapes) both return undefined —
// the same "cannot be certified" answer, since neither ever lands on a literal. The bound is a
// stop for cycles, not a second indirection rule: `indirection` already refuses chains at one
// hop, so on a tree that passes that check the first hop always lands.
function resolveThrough(first, value, depth = 4) {
  let v = value;
  for (let i = 0; i < depth; i += 1) {
    const hop = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
    if (!hop) return v;
    const next = first.get(hop[1]);
    if (next === undefined) return undefined;
    v = next;
  }
  return undefined;
}

// The rule an offset sits inside, as { selector, declarations }. The enclosing `{` is the nearest
// one before the offset, and the prelude runs from the nearest brace-or-close before that `{` —
// so a rule nested in an at-rule reports its own selector, never the at-rule's prelude. The
// selector is whitespace-normalised here because authored selectors wrap lines (`.field input,\n
// .field select`), and a matcher that kept the newline would never equal a one-line table row.
function ruleAt(text, index) {
  const open = text.lastIndexOf('{', index);
  if (open === -1) return null;
  const prev = Math.max(text.lastIndexOf('}', open - 1), text.lastIndexOf('{', open - 1));
  return {
    selector: text.slice(prev + 1, open).trim().replace(/\s+/g, ' '),
    declarations: balancedBody(text, open),
  };
}

// The alpha a resolved background declares: a 6-digit hex or rgb() is opaque, rgba() carries its
// own. Anything else (a modern colour function, a named colour) returns undefined and the caller
// refuses rather than certifying a number it did not compute — the floor is enforced by the
// printed value or not at all.
function glassAlpha(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return 1;
  if (/^rgb\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)$/i.test(value)) return 1;
  const rgba = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i.exec(value);
  return rgba ? Number(rgba[1]) : undefined;
}

// Task 13 check 3 — `translucency cap`. §6.2 ships exactly two glass elements and keeps their
// blur behind a nearly opaque fill; under a reduce-transparency request the chrome goes opaque
// and blurless. Four arms, all read from declarations: the count of DISTINCT blurred selectors
// is capped at the pair's own size (the pair is elements, not rules — a breakpoint-tuned copy
// of a sanctioned selector adds no surface, and a foreign selector is already the membership
// arm's finding); every such declaration's selector is a pair member; every glass rule's
// resolved `background` alpha clears the floor; and a reduce block must stop each pair member
// that blurs. The media test accepts the bare feature form exactly as `reducedMotionBlocks`
// does — a correct file must not be refused — and never `no-preference`. The limits: this reads
// declarations, not the resolved cascade, so an alpha arriving through a shorthand or a
// composite is invisible; the property read is the unprefixed `backdrop-filter`; and Ruling X's
// boundary holds because every scan reads the stripped text (a commented-out declaration is not
// one).
export const GLASS_SELECTORS = ['.mobile-topbar', '.tab-bar'];
export const GLASS_ALPHA_FLOOR = 0.92;

export function findTranslucencyCap(
  cssFiles,
  selectors = GLASS_SELECTORS,
  alphaFloor = GLASS_ALPHA_FLOOR
) {
  const failures = [];
  const { first } = customPropertyDecls(cssFiles);
  // The stops, collected corpus-wide first: a pair member that blurs anywhere in the walked set
  // must be stopped by a reduce block anywhere in it — the check reads the sheet's declarations,
  // and a stop split from its glass across two files still stops it in the browser.
  const stopped = new Set();
  const reduceOpen = /@media[^{]*\(\s*prefers-reduced-transparency\s*(?::\s*reduce\s*)?\)[^{]*\{/g;
  for (const file of cssFiles) {
    const clean = stripComments(file.text);
    for (const m of clean.matchAll(reduceOpen)) {
      const body = balancedBody(clean, m.index + m[0].length - 1);
      for (const rule of rulesIn(body)) {
        if (!/(^|[;\s])backdrop-filter\s*:\s*none\b/.test(rule.declarations)) continue;
        for (const part of rule.selector.split(',').map((s) => s.trim())) stopped.add(part);
      }
    }
  }
  const glass = [];
  for (const file of cssFiles) {
    const clean = stripComments(file.text);
    for (const m of clean.matchAll(/(^|[;\s])backdrop-filter\s*:\s*([^;}]+)/g)) {
      const value = m[2].trim();
      if (value === 'none') continue; // the stop form; the reduce arm below is what reads stops.
      const line = lineOf(file.text, m.index);
      const rule = ruleAt(clean, m.index + m[1].length);
      const parts = rule ? rule.selector.split(',').map((s) => s.trim()).filter(Boolean) : [];
      glass.push({ path: file.path, line, parts });
      for (const part of parts) {
        if (!selectors.includes(part)) {
          failures.push({
            path: file.path,
            line,
            text: `glass on ${part} — §6.2 keeps blur on ${selectors.join(' and ')} only`,
          });
        }
      }
      const bg = rule ? /(^|[;\s])background\s*:\s*([^;}]+)/.exec(rule.declarations) : null;
      if (!bg) {
        failures.push({
          path: file.path,
          line,
          text: `glass on ${rule ? rule.selector : '?'} declares no background — no alpha to certify`,
        });
        continue;
      }
      const raw = bg[2].trim();
      const resolved = resolveThrough(first, raw);
      const alpha = resolved === undefined ? undefined : glassAlpha(resolved);
      if (alpha === undefined) {
        failures.push({
          path: file.path,
          line,
          text:
            `glass background ${raw}${resolved === undefined || resolved === raw ? '' : ` → ${resolved}`}` +
            ` has no readable alpha — the ${alphaFloor} floor cannot be certified`,
        });
      } else if (alpha < alphaFloor) {
        failures.push({
          path: file.path,
          line,
          text: `glass background ${raw} alpha ${alpha} is under the ${alphaFloor} floor`,
        });
      }
    }
  }
  const surfaces = new Set(glass.flatMap((g) => g.parts));
  if (surfaces.size > selectors.length) {
    const last = glass[glass.length - 1];
    failures.push({
      path: last.path,
      line: last.line,
      text: `${surfaces.size} blurred surfaces — the cap is ${selectors.length} (§6.2)`,
    });
  }
  for (const sel of selectors) {
    const site = glass.find((g) => g.parts.includes(sel));
    if (site && !stopped.has(sel)) {
      failures.push({
        path: site.path,
        line: site.line,
        text: `no prefers-reduced-transparency: reduce block stops ${sel}`,
      });
    }
  }
  return failures;
}

// Task 13 check 4 — `contrast floor`. §6.4's matcha landing: `--matcha-700` is the text end and
// reads on both app grounds and the fill direction; `--matcha-600` is a fill and a border and is
// never text; and one exception survives on its own floor — `.done-icon`'s large text (2rem/700)
// on the matcha-600 fill, judged at the large-text floor rather than the body floor. The floors
// are named constants and every refusal prints the ratio this check computed (Ruling AM applied
// to a check body: a transcribed number would be a claim the guard cannot defend). The border
// rows are Task 8's D13 3-site set, frozen: three field borders on `--border-ui` read across
// their declared grounds in the same direction the sites render. The census and the two refusal
// scans are the parts a ratio table cannot see: where the wash hexes live, and the two cascade
// shapes §6.4 bans by name (`matcha-600` as a text colour, `matcha-700` as text over the
// editorial `--cream-50`). The limits, named: every judgement reads declared values, not the
// resolved cascade (the M-DUP boundary carried from 2A), so `.my-status.done`'s text (4.0061)
// over its rgba(.14) tint is invisible here — Task 9's M-1, carried with the fix out of scope —
// and a value arriving through a shorthand or an inheritance is invisible for the same reason.
export const TEXT_FLOOR = 4.5;
export const LARGE_TEXT_FLOOR = 3;
export const BORDER_FLOOR = 3;

export const MATCHA_ROWS = [
  { kind: 'text', fg: '--matcha-700', bg: '--cream-0', min: TEXT_FLOOR,
    why: '§6.4: matcha-700 text on the app ground' },
  { kind: 'text', fg: '--matcha-700', bg: '--paper', min: TEXT_FLOOR,
    why: '§6.4: matcha-700 text on the paper card fill' },
  { kind: 'text', fg: '--cream-0', bg: '--matcha-700', min: TEXT_FLOOR,
    why: '§6.4 fill direction: the cream-0 label on a matcha-700 fill' },
  { kind: 'large', fg: '#f6f8ef', bg: '--matcha-600', min: LARGE_TEXT_FLOOR,
    why: '§6.4 exception: .done-icon large text on matcha-600 only' },
  { kind: 'border', fg: '--border-ui', bg: '--cream-0', min: BORDER_FLOOR,
    why: 'D13 site booking.css:43 — field border on cream-0' },
  { kind: 'border', fg: '--border-ui', bg: '--paper', min: BORDER_FLOOR,
    why: 'D13 site cart-drawer.css:184 — opt-pill border on paper' },
  { kind: 'border', fg: '--border-ui', bg: '--cream-50', min: BORDER_FLOOR,
    why: 'D13 site story.css:46 — search-input border on cream-50' },
];

export const MATCHA_CENSUS = [
  { hex: '#eef3dc', count: 0, why: '§6.4 removed the wash — it must not return' },
  { hex: '#f6f8ef', count: 1, why: '§6.4 keeps it only for .done-icon large text' },
];

export function findContrastFloor(
  primitiveText,
  cssFiles,
  rows = MATCHA_ROWS,
  census = MATCHA_CENSUS
) {
  const failures = findContrast(primitiveText, rows);
  for (const row of census) {
    let n = 0;
    let where = null;
    for (const file of cssFiles) {
      const clean = stripComments(file.text);
      for (const m of clean.matchAll(new RegExp(row.hex, 'gi'))) {
        n += 1;
        if (!where) where = { path: file.path, line: lineOf(file.text, m.index) };
      }
    }
    if (n !== row.count) {
      failures.push({
        // A count of zero has no line to point at; the site that grew one does.
        path: where ? where.path : cssFiles.length ? cssFiles[0].path : 'src/styles/',
        line: where ? where.line : 0,
        text: `${row.hex}: expected ${row.count}, found ${n} — ${row.why}`,
      });
    }
  }
  // The two refusal scans read declaration shapes a ratio row cannot hold a site for. The `color`
  // boundary is `(^|[;{\s])`, so `background-color`, `outline-color` and friends are different
  // properties and stay out — only the text colour is judged, which is the §6.4 rule's own scope.
  const M600_TEXT = /var\(\s*--matcha-600\s*[,)]/;
  const M700_TEXT = /var\(\s*--matcha-700\s*[,)]/;
  const CREAM_50 = /var\(\s*--cream-50\s*[,)]/;
  for (const file of cssFiles) {
    const clean = stripComments(file.text);
    for (const m of clean.matchAll(/(^|[;{\s])color\s*:\s*([^;}]+)/g)) {
      const value = m[2].trim();
      if (M600_TEXT.test(value)) {
        failures.push({
          path: file.path,
          line: lineOf(file.text, m.index),
          text: `color: ${value} — §6.4: matcha-600 is never text`,
        });
      }
      if (!M700_TEXT.test(value)) continue;
      const rule = ruleAt(clean, m.index + m[1].length);
      const bg = rule ? /(^|[;\s])background\s*:\s*([^;}]+)/.exec(rule.declarations) : null;
      const bgValue = bg ? bg[2].trim() : '';
      if (bg && CREAM_50.test(bgValue)) {
        failures.push({
          path: file.path,
          line: lineOf(file.text, m.index),
          text:
            `color: ${value} over background: ${bgValue} — ` +
            `§6.4: matcha-700 is never text on the editorial wash`,
        });
      }
    }
  }
  return failures;
}

// Task 13 check 5 — `control floor`. Task 8's conversion moved the controls onto `--control-h`
// and left one deliberate literal (`.loyalty-form input`'s 46px, the D14 reversal). The check
// keeps both halves honest: the token's own declarations must clear `TOUCH_FLOOR` — the binding
// arm, cure for Task 8's parked M-1, where a token declared under 44 would have satisfied every
// reader while shipping small controls — and every declared control row must still carry a floor
// of its own, as a `<n>px` value at or over the floor or the token read exactly. Two row shapes
// are refused by name: `var(--control-h, 44px)`, because a fallback makes the declared value
// optional (Task 8's M-3, plan-mandated), and any other non-px value, because a spacing token is
// not a control height (the reason `findTouchTargets` already names). The four allowlist rows are
// asserted to exist and not judged: they are the non-control `min-height` sites — shell geometry
// and the header height — and their values are deliberately not this check's business. The limits
// are the declared-table idiom itself: the table is what is read, so a control site absent from
// it is invisible (the edit is the reviewable act, exactly as `TOUCH_TARGETS` says), and a
// breakpoint copy of a row is judged by its first declaration (Task 8's M-4). Reusing
// `TOUCH_FLOOR` rather than re-literalling 44 is the point: the two floors are one number.
export const CONTROL_FLOOR_ROWS = [
  // The 15 reads of `--control-h` across the shipped slices, then the one declared literal.
  { file: 'src/styles/booking.css', selector: '.field input, .field select' },
  { file: 'src/styles/booking.css', selector: '.loyalty-form input' },
  { file: 'src/styles/button.css', selector: '.btn' },
  { file: 'src/styles/button.css', selector: '.btn-sm' },
  { file: 'src/styles/cart-drawer.css', selector: '.drawer-close' },
  { file: 'src/styles/cart-drawer.css', selector: '.opt-pill' },
  { file: 'src/styles/cart-drawer.css', selector: '.qty-btn' },
  { file: 'src/styles/cart-drawer.css', selector: '.cart-line-qty button' },
  { file: 'src/styles/menu-card.css', selector: '.tab-btn' },
  { file: 'src/styles/responsive.css', selector: '.cart-panel .cart-line-qty button' },
  { file: 'src/styles/shell.css', selector: '.rail-nav a' },
  { file: 'src/styles/shell.css', selector: '.rail-toggle' },
  { file: 'src/styles/shell.css', selector: '.cart-btn' },
  { file: 'src/styles/shell.css', selector: '.tab-bar a, .tab-bar button' },
  { file: 'src/styles/story.css', selector: '.search-input' },
  { file: 'src/styles/story.css', selector: '.chip' },
];

export const CONTROL_ALLOW_ROWS = [
  // Asserted to exist, not judged — the four `min-height` sites that are not controls.
  { file: 'src/styles/hero.css', selector: '.hero' },
  { file: 'src/styles/shell.css', selector: '.app-shell' },
  { file: 'src/styles/shell.css', selector: '.app-toolbar' },
  { file: 'src/styles/shell.css', selector: '.mobile-topbar' },
];

export function findControlFloor(
  cssFiles,
  semanticText,
  rows = CONTROL_FLOOR_ROWS,
  allow = CONTROL_ALLOW_ROWS,
  floor = TOUCH_FLOOR,
  sourcePath = 'src/styles/tokens/2-semantic.css'
) {
  const failures = [];
  // The binding arm reads the token's own declarations, both grounds included: one under-floor
  // copy is enough to ship a small control, so none is exempt.
  const declarations = [
    ...stripComments(semanticText).matchAll(/--control-h\s*:\s*([^;}]+);/g),
  ];
  if (!declarations.length) {
    failures.push({
      path: sourcePath,
      line: 0,
      text: `--control-h is declared 0 times — the controls' floor has no binding`,
    });
  }
  for (const m of declarations) {
    const value = m[1].trim();
    const px = /^([0-9.]+)px$/.exec(value);
    if (!px) {
      failures.push({
        path: sourcePath,
        line: lineOf(semanticText, m.index),
        text: `--control-h: ${value} is not a px value — the ${floor}px floor cannot be certified`,
      });
    } else if (Number(px[1]) < floor) {
      failures.push({
        path: sourcePath,
        line: lineOf(semanticText, m.index),
        text: `--control-h: ${value} is under the ${floor}px floor`,
      });
    }
  }
  // The row arm: the same unanchored, ENDS-WITH-the-selector match `findTouchTargets` uses and
  // documents — a compound copy of a control (`.cart-panel .cart-line-qty button`) is read, a
  // `:hover` suffix is not — so a second copy is judged where it lives, and a row whose rules
  // declare no `min-height` anywhere is a refusal rather than a silent skip. A selector wrapped
  // across lines is whitespace-normalised before it becomes the pattern, because the authored
  // selectors wrap (`.field input,\n.field select`), and the comma join is `\s*,\s*` — so the
  // `, `, `,\n` and `,.`-tight forms all match. The earlier single-whitespace join demanded
  // whitespace after the comma and refused the tight form with a false "no rule … no floor".
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const judge = (row, judged) => {
    const pattern = row.selector
      .split(',')
      .map((part) => part.trim().split(/\s+/).map(esc).join('\\s+'))
      .join('\\s*,\\s*');
    const re = new RegExp(`${pattern}\\s*\\{([^}]*)\\}`, 'g');
    let sized = false;
    for (const file of cssFiles) {
      for (const m of stripComments(file.text).matchAll(re)) {
        const decl = /(^|[;\s])min-height\s*:\s*([^;}]+)/.exec(m[1]);
        if (!decl) continue;
        sized = true;
        if (!judged) continue;
        const value = decl[2].trim();
        const px = /^([0-9.]+)px$/.exec(value);
        if (px) {
          if (Number(px[1]) < floor) {
            failures.push({
              path: file.path,
              line: lineOf(file.text, m.index),
              text: `${row.selector} min-height: ${value} is under the ${floor}px control floor`,
            });
          }
        } else if (!/^var\(\s*--control-h\s*\)$/.test(value)) {
          failures.push({
            path: file.path,
            line: lineOf(file.text, m.index),
            text: `${row.selector} min-height: ${value} is not a px value or var(--control-h)`,
          });
        }
      }
    }
    if (!sized) {
      failures.push({
        path: row.file,
        line: 0,
        text: judged
          ? `no rule for ${row.selector} declaring min-height — the control has no floor`
          : `no rule for ${row.selector} declaring min-height — the allowlist site is gone`,
      });
    }
  };
  for (const row of rows) judge(row, true);
  for (const row of allow) judge(row, false);
  return failures;
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
    // Task 9's four. Registered inside the array literal, above the conditional `token drift`
    // push, so the count printed at the end still comes from CHECKS.length and `token drift`
    // stays the last entry it conditionally is.
    ['alias absence', () => findAliasAbsence(cssFiles)],
    [
      'scope coverage',
      () =>
        findScopeCoverage(cssFiles, readSrc(cssFiles, 'src/styles/tokens/2-semantic.css')),
    ],
    [
      'scope parity',
      () => findScopeParity(readSrc(cssFiles, 'src/styles/tokens/2-semantic.css')),
    ],
    ['scope declaration', () => findScopeDeclaration(pages)],
    [
      'touch targets',
      () => findTouchTargets(cssFiles),
    ],
    [
      'contrast',
      () => findContrast(readSrc(cssFiles, 'src/styles/tokens/1-primitive.css')),
    ],
    // Task 13's five. Registered inside the array literal, above the conditional `token drift`
    // push, so the count printed at the end is still read off CHECKS.length (20 here, 19 where
    // the gitignored docs are absent and `token drift` announces its skip).
    ['tmp deletion', () => findTmpDeletion(cssFiles)],
    ['indirection', () => findIndirection(cssFiles)],
    ['translucency cap', () => findTranslucencyCap(cssFiles)],
    [
      'contrast floor',
      () =>
        findContrastFloor(readSrc(cssFiles, 'src/styles/tokens/1-primitive.css'), cssFiles),
    ],
    [
      'control floor',
      () =>
        findControlFloor(cssFiles, readSrc(cssFiles, 'src/styles/tokens/2-semantic.css')),
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
          (f) => f.path === 'src/styles/tokens/1-primitive.css'
        );
        if (tokenCss.length === 0) {
          throw new Error(
            'token drift: src/styles/tokens/1-primitive.css missing from src/styles/ — ' +
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
