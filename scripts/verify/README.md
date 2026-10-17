# FEMBOY WAR 🎀 — V13 verification harness (Wave 4, Task 8)

Repo-convention bun assertion scripts (no jest/vitest). Run from the repo root.

- `bun run verify:group` → `scripts/verify/group-engine.ts` (needs the live dev engine on :3000)
- `bun run verify:bot` → `scripts/verify/bot-group.ts` (fully offline; engine fetch mocked)
- `bun run verify:all` → both, in that order

Each suite prints per-assertion results and exits non-zero on any failure.

## Coverage (V13 Part 10 mapping)

`group-engine.ts` — engine integration + E2E over real HTTP (X-Service-Key):
§0 health/auth (10.2) · §R router determinism + unknown grammar (10.1) ·
§A new player (10.3A) · §B existing player + awards math (10.3B/10.1) ·
§C multiplayer duel challenge + exactly-once rewards (10.3C) · §D cross-group
isolation (10.3D) · §E expiry/pause/recover/corrupt-settings/no-player (10.3E) ·
§F regression: private endpoints, Mini App snapshot+action, no-character duel
(10.3F) · §U citizenship gates + duplicate choice/vote/contribute (10.1) ·
§Z real-data guard. Awards math uses a deterministic oracle replicating the
engine's seeded outcome selection (rng.ts + template catalog).

`bot-group.ts` — offline bot transport suite (48 assertions, 10 groups): dedup,
rate limits, /duel → challenge transport, gc:/gs: routing, live admin verify +
60s cache, home edit-in-place, lifecycle, private spot-checks, /gadmin, outbox
drain (challenge edits + delivery reports). Telegram is stubbed via a grammY
api transformer; `bot-secret.env` is loaded like `bot/src/env.ts` does.

## Throwaway-data discipline

Players use telegram ids `99…` (≥ 99000000, unique per run); groups use
`-10099…` chatIds. All flows use the same HTTP routes the real bot uses; direct
DB writes are fixtures on throwaway rows only (expiresAt fast-forward, lastTickAt
rewind, settingsJson corruption). Cleanup runs in `finally`; a final guard
re-asserts the real baseline (36 players / 2 groups) + zero residue. The only
real-player call is the bot's own read-refresh (`POST /api/game/state` — the
live contract; the route has no GET).

The 10.4 boundary (what only a real Telegram client can prove) is documented in
the final V13 report, not here.
