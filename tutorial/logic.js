// DAO'S FIELD — Tutorial Region. Single-player; all gameplay client-side. Platform stub.
export const meta = { game: "daos-field-tutorial", minPlayers: 1, maxPlayers: 1 };
export function setup(){ return {}; }
export function validateAction(){ return { ok: true }; }
export function applyAction(s){ return s; }
export function isGameOver(){ return { over: false }; }
export function viewFor(s){ return s; }
