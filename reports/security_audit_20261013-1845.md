# Security Audit: whole repository (first release), 13 October 2026

Scope: the shipped client (`src/`, `index.html`, `public/manifest.webmanifest`,
`tools/build/sw-template.js`, `vite.config.ts`, about 7,700 lines) plus what the planned
GitHub Pages deployment and public repository `ArtSkw/dino-mazes` would publish.
Static Vite + Phaser game, no backend, no accounts, no network APIs.

Method: `/security-audit-static` (map entry points and sinks, intent vs implementation against
README.md, PRD.md and docs/STATUS.md, self-refute, verified citations). Run inline by one
agent (Claude, Opus 5.5) without subagent fan-out: the attack surface is small and the
auditor had read every shipped file during this session. No model reroutes occurred.

## Map

| Entry point | Reaches | Guard |
|---|---|---|
| `localStorage['dino-mazes:save']` (any same-origin script can write it) | game state, DOM text, maze rebuild | `validateSave` / `validateSession`: allow-listed keys, typed and bounded values (`src/storage/save.ts`) |
| URL query `?test`, `?debug` | exposes the controller on `window.__dino`, shows a debug overlay | none (see refuted R1) |
| Pointer and keyboard input | trail engine (geometry only) | — |
| Service worker `message` | `skipWaiting` only | same-origin clients only (browser rule) |
| Service worker `fetch` | same-origin GET cache | origin check, GET only |

Sinks: one `innerHTML` (`src/ui/dom.ts:13`, used only with constant SVG strings from
`src/ui/icons.ts`), `textContent` everywhere else, CSS `url()` built from the compiled asset
manifest, `localStorage.setItem`. No `eval`, `new Function`, dynamic import of user data,
outbound fetch, `postMessage` to other windows, cookies, analytics, or third-party scripts.

## Findings

README.md / deployment:
  1. [MEDIUM] [A01 Broken access control / data exposure, intent vs implementation] Public GitHub Pages and a public repository
     Evidence: README.md:93-96 — "An obscure URL is not access control. If the game must stay private, put it behind / real access restriction (host-level password / SSO / private network). / - The Gigantosaurus characters belong to their rights holders; this build is for / private family use only and should not be published publicly."
     Risk Level: Medium
     Attack Scenario: anyone who finds `https://artskw.github.io/dino-mazes/` or the public repo (links, referrers, GitHub search) can play and download the character art; the repository would also have carried the official show images in `art/references/` (cast image, poster, close-ups). The rights holder can file a takedown; the owner carries the IP exposure.
     Impact: copyrighted character likenesses and official promotional images published; no personal data involved.
     Solution: owner decision. Applied now: `art/references/`, `art/source/` and the large review images stay out of the public repository (`.gitignore`); `index.html` already sends `noindex, nofollow` (index.html:7). Note that a `robots.txt` inside a project site has no effect (crawlers read only the domain root). For a truly private site use a host with real access control (for example Cloudflare Pages + Access, free for small teams) or a private network.

index.html:
  2. [LOW] [A05 Security misconfiguration, CSP] No Content-Security-Policy
     Evidence: index.html:1-22 — no `Content-Security-Policy` meta; GitHub Pages cannot send custom headers.
     Risk Level: Low
     Attack Scenario: none found today (no injection sink takes untrusted data). A future change that renders untrusted text as HTML, or a compromised dependency injecting a remote script, would run unrestricted.
     Impact: defence in depth only.
     Solution (applied): a build-time `<meta http-equiv="Content-Security-Policy">` (vite.config.ts) with `default-src 'self'`, `script-src 'self'` (no inline scripts, no eval), `img-src 'self' data: blob:` (Phaser's loader and default textures), `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`. `style-src` keeps `'unsafe-inline'` on purpose: Phaser measures the iOS viewport with an inline-styled ruler (node_modules/phaser/dist/phaser.esm.js:32309), and a stricter policy would break layout on iPad. Dev server unaffected.

## Refuted candidates (kept for the record)

| # | Candidate | Why refuted (evidence) |
|---|---|---|
| R1 | `?test` / `?debug` expose `window.__dino` in production (src/main.ts:67-70) | Attacker equals victim: the flag only lets a page's own visitor poke their own local game state; no secret, server or other user exists. |
| R2 | Tampered `localStorage` from another page on the shared `artskw.github.io` origin | `validateSave` (src/storage/save.ts) rebuilds every field from allow-lists (`isTreasure`, `questById`, `isNat`, bounded trail); values reach the DOM only through `textContent`. Writing it requires publishing on the owner's own account. |
| R3 | `innerHTML` in `h()` (src/ui/dom.ts:13) | Only called with `ICONS[name]` (src/ui/ui.ts:115): constant SVG from a pinned package at build time. |
| R4 | Service worker serves stale or foreign content | Same-origin GET only (tools/build/sw-template.js:33-35); cache name versioned by a content hash; old caches deleted on activate. |
| R5 | Vulnerable dependencies (A06) | `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities; all versions pinned exactly with a lockfile. |

## OWASP Top 10 backstop

| Category | Result |
|---|---|
| A01 Broken access control | Finding 1 (public deployment vs documented private intent) |
| A02 Cryptographic failures | No evidence: no credentials, tokens or PII are stored; `crypto.getRandomValues` seeds mazes only |
| A03 Injection (incl. XSS) | No evidence (R3); not covered by a CSP before finding 2's fix |
| A04 Insecure design | No evidence |
| A05 Security misconfiguration | Finding 2 |
| A06 Vulnerable components | No evidence (R5) |
| A07 Identification and authentication | Not applicable: no accounts or login |
| A08 Software and data integrity | No evidence; the new GitHub Actions workflow uses least-privilege `permissions` and `npm ci` against the lockfile |
| A09 Logging and monitoring | Not applicable: no server, no auth events |
| A10 SSRF | Not applicable: no server-side fetch |

## Root cause, what is well built, what to double-check

Root cause: the only real exposure is a hosting choice (public static hosting for a private,
fan-made game), not code.

Well built: strict validation of persisted state with allow-lists and bounds; no network calls,
no third-party scripts or fonts (Baloo 2 is self-hosted); text rendered with `textContent`;
reward commits are atomic and idempotent; service worker limited to same-origin GET with
versioned caches; `noindex` already in place; dependencies pinned and clean.

Double-check: whether you accept public hosting of the character art (finding 1); that
`art/prompts/jobs-v3-executed-animation.json` (written by Codex) contains absolute local
paths with your macOS user name, which become public with the repository; and the GitHub
Pages URL is shared only with family.

## Addendum (same day, after deployment)

Checking the live site found a production-only defect (not a security issue): the painted
panel, leaf-button and corner-leaf images returned 404 (`/dino-mazes/assets/assets/ui/…`)
because relative `url()` values in CSS custom properties resolve against the stylesheet in
production. Fixed in `src/main.ts` with absolute URLs; `tests/offline/offline.spec.ts` now
checks those surfaces on the production build and runs in the deploy workflow.
