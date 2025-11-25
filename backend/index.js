
const createApp = require('./app');

// Start only the API + frontend server in this process.
// The Harmony deposit monitor should be started from a separate process
// (see monitor-runner.js).
createApp();
