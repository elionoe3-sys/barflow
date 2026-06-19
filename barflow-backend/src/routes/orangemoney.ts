// routes/orangemoney.ts
// Relais sécurisé Orange Money (Sonatel) API
// Les clés NE DOIVENT JAMAIS être exposées côté navigateur.
// Flux : front → serveur Express → api.orange-sonatel.com

import { Router, Request, Response } from 'express';

const router = Router();

// ── Types pour les réponses Orange Money ──────────────────────────
interface OMTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface OMPayResponse {
  qrCode?: string;
  qrcode?: string;
  deepLink?: string;
  deeplink?: string;
  payToken?: string;
  expiryTime?: string;
}

interface OMStatusResponse {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  payToken: string;
  order?: { id: string };
  amount?: number;
}

interface OMNotifyBody {
  status?: string;
  paymentStatus?: string;
  payToken?: string;
  orderId?: string;
  order?: { id: string };
}

// ── Variables d'environnement ─────────────────────────────────
const OM_TOKEN_URL     = process.env.OM_TOKEN_URL     || 'https://api.orange-sonatel.com/oauth/v3/token';
const OM_API_URL       = process.env.OM_API_URL       || 'https://api.orange-sonatel.com';
const OM_CLIENT_ID     = process.env.OM_CLIENT_ID     || '';
const OM_CLIENT_SECRET = process.env.OM_CLIENT_SECRET || '';
const OM_MERCHANT_CODE = process.env.OM_MERCHANT_CODE || '';

// ── Obtenir un token OAuth (client_credentials) ───────────────
async function getOmToken(): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      client_id:     OM_CLIENT_ID,
      client_secret: OM_CLIENT_SECRET,
      grant_type:    'client_credentials',
    });
    const res = await fetch(OM_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as OMTokenResponse;
    return data.access_token || null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/orangemoney/pay
// Initie un paiement — retourne QR code (base64) + deeplink
// ══════════════════════════════════════════════════════════════
router.post('/pay', async (req: Request, res: Response) => {
  if (!OM_CLIENT_ID || !OM_CLIENT_SECRET) {
    return res.status(400).json({
      error: 'Orange Money non configuré. Ajoutez OM_CLIENT_ID et OM_CLIENT_SECRET dans .env',
    });
  }

  const { amount, orderId } = req.body;
  if (!amount || !orderId) {
    return res.status(400).json({ error: 'Paramètres manquants : amount, orderId' });
  }

  // 1. Obtenir le token OAuth
  const token = await getOmToken();
  if (!token) {
    return res.status(502).json({ error: "Impossible d'obtenir le token Orange Money" });
  }

  // 2. Initier le paiement QR
  try {
    const payToken = `BF_${orderId}_${Date.now()}`;
    const payload = {
      merchant: { code: OM_MERCHANT_CODE },
      order: {
        id:        orderId,
        amount:    Number(amount),
        currency:  'OUV',       // XOF Sénégal
        reference: orderId,
        validity:  10,          // minutes avant expiration
      },
      payment:    { payToken },
      return_url: `${req.headers.origin || 'http://localhost:5173'}/payment-callback`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/payment-cancel`,
      notif_url:  `${req.headers.origin?.replace('5173', '3001') || 'http://localhost:3001'}/api/orangemoney/notify`,
    };

    const payRes = await fetch(`${OM_API_URL}/api/eWallet/v1/qrcode/merchant/payment`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!payRes.ok) {
      const errData = await payRes.json().catch(() => ({}));
      console.error('[OM Pay] Erreur:', payRes.status, errData);
      return res.status(payRes.status || 502).json({
        error: 'Erreur Orange Money API',
        details: errData,
      });
    }

    const data = await payRes.json() as OMPayResponse;
    return res.json({
      ok:       true,
      qrCode:   data.qrCode   || data.qrcode   || null,
      deepLink: data.deepLink || data.deeplink || null,
      payToken: data.payToken || payToken,
      expiryTime: data.expiryTime || null,
    });
  } catch (err: any) {
    console.error('[OM Pay] Exception:', err.message);
    return res.status(502).json({ error: 'Erreur réseau Orange Money', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/orangemoney/status/:payToken
// Vérifie le statut d'un paiement en cours (polling)
// status possible : PENDING | SUCCESS | FAILED | EXPIRED
// ══════════════════════════════════════════════════════════════
router.get('/status/:payToken', async (req: Request, res: Response) => {
  if (!OM_CLIENT_ID || !OM_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Orange Money non configuré' });
  }

  const token = await getOmToken();
  if (!token) {
    return res.status(502).json({ error: 'Token Orange Money indisponible' });
  }

  try {
    const { payToken } = req.params;
    const statusRes = await fetch(
      `${OM_API_URL}/api/eWallet/v1/qrcode/merchant/payment/${payToken}/status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept':        'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!statusRes.ok) {
      return res.status(statusRes.status).json({ error: 'Erreur statut Orange Money' });
    }
    const data = await statusRes.json() as OMStatusResponse;
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/orangemoney/test
// Teste la connexion (obtention du token OAuth)
// Utilisé par le bouton "Tester la connexion" dans Paramètres
// ══════════════════════════════════════════════════════════════
router.get('/test', async (req: Request, res: Response) => {
  if (!OM_CLIENT_ID || !OM_CLIENT_SECRET) {
    return res.status(400).json({
      ok: false,
      error: 'OM_CLIENT_ID et OM_CLIENT_SECRET manquants dans .env',
    });
  }
  const token = await getOmToken();
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Identifiants Orange Money invalides' });
  }
  return res.json({ ok: true, message: 'Connexion Orange Money réussie ✅' });
});

// ══════════════════════════════════════════════════════════════
// POST /api/orangemoney/notify
// Webhook — reçoit les notifications de paiement de Sonatel
// Configurer l'URL dans le portail Orange Money :
//   https://votre-serveur.com/api/orangemoney/notify
// ══════════════════════════════════════════════════════════════
router.post('/notify', async (req: Request, res: Response) => {
  const event = req.body as OMNotifyBody;
  console.log('[OM Notify] Notification reçue:', JSON.stringify(event));

  // Orange Money envoie : status (SUCCESS|FAILED|EXPIRED), payToken, order.id
  const status   = event?.status || event?.paymentStatus;
  const orderId  = event?.order?.id || event?.orderId;
  const payToken = event?.payToken;

  if (status === 'SUCCESS') {
    console.log(`[OM Notify] ✅ Paiement confirmé — orderId=${orderId} payToken=${payToken}`);
    // Optionnel : mettre à jour la commande dans Prisma
    // await prisma.commande.update({ where: { id: orderId }, data: { statut: 'payé' } });
  } else if (status) {
    console.log(`[OM Notify] ❌ Paiement ${status} — orderId=${orderId}`);
  }

  // Toujours répondre 200 rapidement à Orange Money
  return res.status(200).json({ received: true });
});

export default router;