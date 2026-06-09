'use strict';

/**
 * Resolv Agent — Shared Library
 *
 * Re-exports all shared agent utilities so consumers can import from a
 * single entry point:
 *
 *   const {
 *     collectSystemInfo,
 *     computeFingerprint,
 *     getInstalledSoftware,
 *     request,
 *     register,
 *     checkin,
 *     heartbeat,
 *     disconnect,
 *     AgentLifecycle,
 *     CommandExecutor,
 *   } = require('./shared');
 */

const {
  collectSystemInfo,
  computeFingerprint,
  getInstalledSoftware,
} = require('./collector');

const {
  request,
  register,
  checkin,
  heartbeat,
  disconnect,
} = require('./protocol');

const { AgentLifecycle } = require('./lifecycle');

const { CommandExecutor } = require('./commands');

module.exports = {
  collectSystemInfo: collectSystemInfo,
  computeFingerprint: computeFingerprint,
  getInstalledSoftware: getInstalledSoftware,
  request: request,
  register: register,
  checkin: checkin,
  heartbeat: heartbeat,
  disconnect: disconnect,
  AgentLifecycle: AgentLifecycle,
  CommandExecutor: CommandExecutor,
};
