/**
 * Logger utility — wraps console with production-safe methods
 * CLAUDE.md: console.log() vietato in produzione
 */

const Logger = {
  warn: (message, ...args) => {
    console.warn(`[Threadkeep] ${message}`, ...args);
  },

  error: (message, ...args) => {
    console.error(`[Threadkeep] ${message}`, ...args);
  }
};

export default Logger;
