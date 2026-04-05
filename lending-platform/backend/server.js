require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const loanRoutes      = require('./routes/loans');
const zkRoutes        = require('./routes/zk');
const guarantorRoutes = require('./routes/guarantor');
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
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const incoming = origin.replace(/\/$/, '');
    if (incoming === allowed) return callback(null, true);
    return callback(null, false); // silent reject, not error — avoids 500
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.options('*', cors()); // handle preflight for all routes
app.use(express.json());
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/loans',      loanRoutes);
app.use('/api/zk',         zkRoutes);
app.use('/api/guarantor',  guarantorRoutes);

// ── ETH/USD price — median of 3 sources (60s cache) ──────────
let _ethPriceCache = { usd: null, ts: 0 };

async function fetchEthMedianPrice() {
  async function src(name, url, extract) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const p = extract(d);
      return (p && typeof p === 'number' && p > 0) ? p : null;
    } catch { return null; }
  }
  const [a, b, c] = await Promise.all([
    src('coingecko',     'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', d => d?.ethereum?.usd),
    src('cryptocompare', 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',              d => d?.USD),
    src('binance',       'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',                   d => d?.price ? parseFloat(d.price) : null),
  ]);
  const prices = [a, b, c].filter(p => p !== null);
  if (prices.length < 2) return null;
  prices.sort((x, y) => x - y);
  return prices.length === 3 ? prices[1] : (prices[0] + prices[1]) / 2;
}

app.get('/api/eth-price', async (req, res) => {
  try {
    const now = Date.now();
    if (_ethPriceCache.usd && now - _ethPriceCache.ts < 60_000) {
      return res.json({ success: true, usd: _ethPriceCache.usd, cached: true });
    }
    const usd = await fetchEthMedianPrice();
    if (!usd) throw new Error('All price sources failed');
    _ethPriceCache = { usd, ts: now };
    res.json({ success: true, usd });
  } catch (err) {
    console.error('[eth-price]', err.message);
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
