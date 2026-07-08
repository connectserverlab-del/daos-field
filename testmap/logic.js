// DAO'S FIELD — Test Map (300x300m). Single-player viewer; all client-side.
// Platform rules-module stub. No imports, no timers.
export const meta = { game: "daos-field-testmap", minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
