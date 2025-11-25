
const startMonitor = require('./monitor');

// Standalone runner for the Harmony deposit monitor.
// Run this as a separate Node.js process (or container) from the API server.
startMonitor();
