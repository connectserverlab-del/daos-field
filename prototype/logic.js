// DAO'S FIELD — solo vertical slice. All gameplay is client-side (character
// creation is a single-player ceremony); this stub satisfies the platform's
// required rules module. No imports, no timers.
export const meta = { game: "daos-field-awakening", minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
