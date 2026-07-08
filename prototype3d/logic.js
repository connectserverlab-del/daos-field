// DAO'S FIELD: Human World I — explorable 3D vertical slice. Single-player, all
// gameplay client-side (WebGL). This stub satisfies the platform's rules-module
// requirement. No imports, no timers.
export const meta = { game: "daos-field-world", minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
