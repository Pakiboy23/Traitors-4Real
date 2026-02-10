# Codebase Review: Traitors-4Real

**Date:** 2026-02-10
**Reviewer:** Claude (automated)
**Scope:** Full codebase review — bugs, pending items, and improvements

---

## Bugs / Correctness Issues

### 1. `handleAddEntry` bypasses normalization
**File:** `App.tsx:307-320`

`handleAddEntry` calls `setGameState` directly with a spread, while `updateGameState` runs the state through `normalizeGameState`. Player additions skip the safety normalization that protects against malformed data.

**Fix:** Use `updateGameState` instead of `setGameState` in `handleAddEntry`.

---

### 2. `useMemo` captures stale closures
**File:** `App.tsx:383-423`

The `content` memo depends on `[activeTab, gameState, isAdminAuthenticated]`, but the rendered JSX captures `handleAddEntry`, `authenticateAdmin`, `handleSignOut`, `saveNow` — all recreated every render (none use `useCallback`). The memoized content can use outdated function references.

**Fix:** Either wrap handlers in `useCallback` or remove the `useMemo` (React 19 handles this well on its own).

---

### 3. `Array(10).fill()` shared object reference
**File:** `DraftForm.tsx:33`

```js
Array(10).fill({ member: '', rank: 1, role: 'Faithful' })
```

All 10 slots point to the **same object**. Currently safe because `updatePick` spreads into a new object, but any future direct mutation on one element would corrupt all 10.

**Fix:** Use `.fill(null).map(() => ({ member: '', rank: 1, role: 'Faithful' }))`.

---

### 4. `autoGeneratePicks` accesses fragile array indices
**File:** `DraftForm.tsx:83-87`

After shuffling the cast and slicing 10, the code accesses `shuffled[11]` through `shuffled[15]` for prophecies/traitor guesses. Works with 23 cast members but would produce `undefined` if the cast ever shrank below 16.

**Fix:** Use `shuffled.slice(10)` and index into that, or add bounds checks.

---

### 5. Concurrent merge race condition
**File:** `AdminPanel.tsx:68, 513-559`

`gameStateRef` is mutated directly in both `mergeSubmissionRecord` and `mergeSubmissionList`, then `updateGameState` is called. If the real-time subscription fires a new submission while a merge is in-progress, the two operations can clobber each other's player state.

**Fix:** Use a queue or lock mechanism for concurrent merge operations.

---

### 6. `portraitUrl` type mismatch
**File:** `types.ts:8` vs `App.tsx:77`

`CastMemberStatus.portraitUrl` is typed as `string | undefined` (optional), but `normalizeGameState` assigns `null` to it. This creates a type inconsistency.

**Fix:** Change the type to `portraitUrl?: string | null` or normalize to `undefined` instead of `null`.

---

## Missing Feature / Pending

### 7. No Traitor Trio input in WeeklyCouncil UI
**File:** `WeeklyCouncil.tsx`

The scoring engine (`scoring.ts:197-232`) scores Traitor Trio predictions, the admin panel stores `traitorTrio` results, and the submission payload supports it — but the WeeklyCouncil form has **no UI to submit Traitor Trio picks**.

**Action:** Either implement the UI or document as intentionally omitted.

---

### 8. `DRAFT_CLOSED` is hardcoded
**File:** `DraftForm.tsx:27`

```js
const DRAFT_CLOSED = true;
```

Requires a code change and redeployment to open/close the draft.

**Fix:** Drive this from game state or an admin toggle.

---

## Security / Sensitive Data

### 9. Hardcoded personal email addresses
**Files:** `DraftForm.tsx:143`, `WeeklyCouncil.tsx:211,279`

Two personal email addresses are hardcoded in the source code for `mailto:` links.

**Fix:** Move to environment variables (e.g., `VITE_ADMIN_EMAIL`).

---

### 10. `window.prompt()` / `window.confirm()` for admin actions
**File:** `AdminPanel.tsx:373,381,618,745,772`

Blocking synchronous dialogs are used for setting portraits, clearing data, and confirming deletions. These are being deprecated in cross-origin iframes by some browsers.

**Fix:** Replace with custom modal components.

---

### 11. No submission rate limiting
**File:** `services/pocketbase.ts:244-277`

`submitWeeklyCouncilVote` creates PocketBase records with no client-side deduplication or server-side throttling. A user could spam submissions.

**Fix:** Enforce server-side via PocketBase rules and/or add client-side cooldown.

---

## Version / Configuration Issues

### 12. PocketBase version mismatch
**Files:** `Dockerfile:3` vs `package.json:14`

The Dockerfile pulls PocketBase binary **v0.36.1**, but the JS SDK in package.json is **^0.25.2**. PocketBase has breaking changes between major versions.

**Fix:** Align the SDK and server binary versions.

---

### 13. Unused `env` variable in Vite config
**File:** `vite.config.ts:6`

```js
const env = loadEnv(mode, '.', '');
```

Assigned but never referenced.

**Fix:** Remove the unused variable.

---

### 14. Unused `isAdmin` prop
**File:** `Layout.tsx:9`

The `isAdmin` prop is declared in the interface but never used in the component body and never passed by the parent.

**Fix:** Remove from interface.

---

## Code Quality / Cleanup

### 15. `formatScore` is duplicated
**Files:** `Welcome.tsx:17-18` vs `src/utils/scoring.ts:26-27`

`Welcome.tsx` defines its own local `formatScore` identical to the exported one in `scoring.ts`.

**Fix:** Import from `scoring.ts` instead of duplicating.

---

### 16. 20 `console.log/warn/error` calls in production code

Spread across `App.tsx` (4), `services/pocketbase.ts` (11), `DraftForm.tsx` (1), `AdminPanel.tsx` (2), `WeeklyCouncil.tsx` (2).

**Fix:** Remove or gate behind a debug flag for production builds.

---

### 17. Legacy directories still in the repo
**Directories:** `hello-fly/`, `functions/`

Old Express.js and Firebase Cloud Functions code replaced by PocketBase. Adds confusion and bloat.

**Fix:** Remove or move to a separate archive branch.

---

### 18. `mailto:` redirect after API submission
**Files:** `DraftForm.tsx:141-143`, `WeeklyCouncil.tsx:209-213,277-280`

After submitting via PocketBase API, the code also triggers `window.location.href = mailto:...`. This dual-channel approach can interrupt the UI and fires regardless of API success/failure.

**Fix:** Remove the mailto fallback now that PocketBase handles submissions, or make it opt-in.

---

### 19. No tests or linting configured

No test framework, no test scripts, no ESLint/Prettier configuration.

**Fix:** Add at minimum a linting setup and basic test coverage for scoring logic.

---

## Scoring Logic

### 20. Bonus score calculation depends on evaluation order
**File:** `scoring.ts:146`

`isNegativeForBonus` is computed once before any bonus games are evaluated. The order of Redemption Roulette vs Shield Gambit evaluation matters for which gets the negative-score 2x bonus.

**Fix:** If intentional, document this. If not, re-evaluate `isNegativeForBonus` before each bonus game.

---

## Summary

| Category | Count |
|----------|-------|
| Bugs / Correctness | 6 |
| Missing / Pending | 2 |
| Security / Sensitive Data | 3 |
| Version / Config | 3 |
| Code Quality / Cleanup | 5 |
| Scoring Logic | 1 |
| **Total** | **20** |

### Priority recommendations
1. **#1** — Normalization bypass (quick fix)
2. **#12** — PocketBase version mismatch (deployment risk)
3. **#9** — Hardcoded emails (sensitive data in source)
4. **#2** — Stale closures in useMemo (subtle UI bugs)
5. **#7** — Missing Traitor Trio UI (feature gap)
