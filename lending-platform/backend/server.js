require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const loanRoutes     = require('./routes/loans');
const { startMonitoring } = require('./services/monitoringService');

// ── Startup env validation ─────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
if (process.env.NODE_ENV === 'production') {
  REQUIRED_ENV.push('SEPOLIA_RPC_URL', 'CONTRACT_ADDRESS', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL');
}
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const app = express();

// ── Rate limiters ──────────────────────────────────────────
// General API: 200 req / 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Auth endpoints (login, register, OTP): 20 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth requests, please try again later.' },
});

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/loans', loanRoutes);

// ── ETH/USD price (CoinGecko, no API key needed) ──────────
let _ethPriceCache = { usd: null, ts: 0 };
app.get('/api/eth-price', async (req, res) => {
  try {
    const now = Date.now();
    // Cache for 60 seconds to avoid hammering CoinGecko
    if (_ethPriceCache.usd && now - _ethPriceCache.ts < 60_000) {
      return res.json({ success: true, usd: _ethPriceCache.usd, cached: true });
    }
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    if (!response.ok) throw new Error('CoinGecko error ' + response.status);
    const data = await response.json();
    const usd  = data?.ethereum?.usd;
    if (!usd) throw new Error('Unexpected CoinGecko response');
    _ethPriceCache = { usd, ts: now };
    res.json({ success: true, usd });
  } catch (err) {
    console.error('[eth-price]', err.message);
    // Return cached value if available, even if stale
    if (_ethPriceCache.usd) {
      return res.json({ success: true, usd: _ethPriceCache.usd, cached: true, stale: true });
    }
    res.status(503).json({ success: false, message: 'Could not fetch ETH price' });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    blockchain: !!(process.env.SEPOLIA_RPC_URL && process.env.CONTRACT_ADDRESS),
  });
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err.message || 'Internal server error'),
  });
});

// ── Connect DB & Start ─────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Start collateral price monitoring (hourly cron)
    startMonitoring();

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received — shutting down gracefully');
      server.close(() => mongoose.connection.close(() => process.exit(0)));
    });
    process.on('SIGINT', () => {
      server.close(() => mongoose.connection.close(() => process.exit(0)));
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
