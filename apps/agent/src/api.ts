// Re-export from shared library — all API logic is in shared/protocol.js
const shared = require('../shared/protocol');
export const request = shared.request;
export const registerAgent = shared.register;
export const checkin = shared.checkin;
export const heartbeat = shared.heartbeat;
export const disconnect = shared.disconnect;
