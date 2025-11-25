const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const config = require('./config');
const { telegramAuthMiddleware } = require('./middleware/telegramAuth');

const userRoutes = require('./routes/user');
const walletRoutes = require('./routes/wallet');

function createApp() {
  const app = express();

  // Basic logger shared across requests
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  app.use(cors());
  app.use(bodyParser.json());

  // Attach logger to each request
  app.use((req, res, next) => {
    req.log = logger;
    next();
  });

  // Basic rate limiting for all /api endpoints
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,             // 60 requests/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' },
  });

  app.use('/api', apiLimiter, telegramAuthMiddleware);

  app.use('/api/user', userRoutes);
  app.use('/api/wallet', walletRoutes);

  const frontendPath = path.resolve(__dirname, '../frontend');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Backend API + Frontend running');
  });

  return app;
}

module.exports = createApp;
