const express = require('express');
const path = require('path');
const { initDB } = require('./db');
const { PORT } = require('./config/env');
const apiRoutes = require('./api/routes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

app.use('/api', apiRoutes);

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log('Server running on port', PORT);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
