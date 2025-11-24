
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');

const userRoutes = require('./routes/user');
const walletRoutes = require('./routes/wallet');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());

  app.use('/api/user', userRoutes);
  app.use('/api/wallet', walletRoutes);

  const frontendPath = path.resolve(__dirname, '../frontend');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.listen(config.port, () => {
    console.log(`Backend API + Frontend running on port ${config.port}`);
  });

  return app;
}

module.exports = createApp;
