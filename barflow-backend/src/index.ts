// server/index.ts — Wave + Orange Money + Email (récupération mot de passe)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import allRoutes from './routes/all';
import waveRoutes from './routes/wave';
import omRoutes from './routes/orangemoney';
import emailRoutes from './routes/email';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// ⚠️ Les webhooks Wave et OM ont besoin du body RAW pour vérifier la signature HMAC
// Ce middleware doit être AVANT express.json()
app.use('/api/wave/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
  }
  next();
});

app.use('/api/orangemoney/notify', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
  }
  next();
});

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api', allRoutes);
app.use('/api/wave', waveRoutes);
app.use('/api/orangemoney', omRoutes);
app.use('/api/email', emailRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    wave:        !!process.env.WAVE_API_KEY,
    orangeMoney: !!(process.env.OM_CLIENT_ID && process.env.OM_CLIENT_SECRET),
    email:       !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur BarFlow démarré sur http://localhost:${PORT}`);
  console.log(process.env.WAVE_API_KEY
    ? '✅ Wave API configurée'
    : '⚠️  Wave API non configurée (WAVE_API_KEY manquant dans .env)');
  console.log((process.env.OM_CLIENT_ID && process.env.OM_CLIENT_SECRET)
    ? '✅ Orange Money configuré'
    : '⚠️  Orange Money non configuré (OM_CLIENT_ID / OM_CLIENT_SECRET manquants dans .env)');
  console.log((process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
    ? '✅ Email (Gmail SMTP) configuré'
    : '⚠️  Email non configuré (GMAIL_USER / GMAIL_APP_PASSWORD manquants dans .env)');
});