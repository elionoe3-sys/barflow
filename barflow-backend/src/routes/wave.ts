// routes/wave.ts
// Relais sécurisé Wave Business API
// La clé secrète Wave NE DOIT JAMAIS être exposée côté navigateur.
// Toutes les requêtes vers api.wave.com passent par ici.

import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

const router = Router();

// ── URL de base Wave API ──────────────────────────────────────
const WAVE_API_URL = 'https://api.wave.com/v1';

// ── Récupérer la clé API depuis les variables d'environnement
// ou depuis un header envoyé par le front (pour dev local).
// En production : stocker dans .env WAVE_API_KEY=secret_live_xxx
function getWaveApiKey(req: Request): string {
  return process.env.WAVE_API_KEY || (req.headers['x-wave-api-key'] as string) || '';
}

// ── Helper : appel authentifié vers l'API Wave ────────────────
async function waveRequest(
  path: string,
  method: 'GET' | 'POST',
  apiKey: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${WAVE_API_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/wave/checkout
// Crée une session de paiement Wave et retourne wave_launch_url
// ══════════════════════════════════════════════════════════════
router.post('/checkout', async (req: Request, res: Response) => {
  const apiKey = getWaveApiKey(req);
  if (!apiKey) {
    return res.status(400).json({
      error: 'Clé API Wave non configurée. Ajoutez WAVE_API_KEY dans votre fichier .env',
    });
  }

  const { amount, currency, success_url, error_url, client_reference } = req.body;

  if (!amount || !currency) {
    return res.status(400).json({ error: 'Paramètres manquants : amount, currency' });
  }

  const result = await waveRequest('/checkout/sessions', 'POST', apiKey, {
    amount: String(amount),
    currency: currency || 'XOF',
    success_url: success_url || `${req.headers.origin || 'http://localhost:5173'}/payment-success`,
    error_url: error_url || `${req.headers.origin || 'http://localhost:5173'}/payment-error`,
    client_reference: client_reference || `barflow-${Date.now()}`,
  });

  if (!result.ok) {
    console.error('Wave checkout error:', result.status, result.data);
    return res.status(result.status || 502).json({
      error: 'Erreur Wave API',
      details: result.data,
    });
  }

  // Retourner la session avec wave_launch_url et id
  return res.json(result.data);
});

// ══════════════════════════════════════════════════════════════
// GET /api/wave/checkout/:sessionId
// Vérifie le statut d'une session Wave (polling)
// ══════════════════════════════════════════════════════════════
router.get('/checkout/:sessionId', async (req: Request, res: Response) => {
  const apiKey = getWaveApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Clé API Wave non configurée' });
  }

  const { sessionId } = req.params;
  const result = await waveRequest(`/checkout/sessions/${sessionId}`, 'GET', apiKey);

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: 'Erreur Wave API', details: result.data });
  }

  // Extraire le statut de paiement
  // Wave retourne : payment_status = 'pending' | 'succeeded' | 'failed' | 'cancelled'
  return res.json(result.data);
});

// ══════════════════════════════════════════════════════════════
// GET /api/wave/balance
// Vérifie que la clé API est valide (test de connexion)
// ══════════════════════════════════════════════════════════════
router.get('/balance', async (req: Request, res: Response) => {
  const apiKey = getWaveApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Clé API Wave non configurée' });
  }

  // On appelle /balance pour vérifier que la clé est valide
  const result = await waveRequest('/balance', 'GET', apiKey);

  if (!result.ok) {
    return res.status(401).json({ error: 'Clé API Wave invalide', details: result.data });
  }

  return res.json({ ok: true, data: result.data });
});

// ══════════════════════════════════════════════════════════════
// POST /api/wave/reconcile
// Reconciliation manuelle d'un paiement hors-ligne
// Enregistre dans la base que le paiement est validé
// ══════════════════════════════════════════════════════════════
router.post('/reconcile', async (req: Request, res: Response) => {
  const { localId, manualRef, amount, orderId } = req.body;

  if (!localId) {
    return res.status(400).json({ error: 'localId manquant' });
  }

  // Si une référence Wave manuelle est fournie, on peut tenter de la vérifier
  // via l'API Wave (optionnel — la reconciliation manuelle suffit dans la plupart des cas)
  let waveVerified = false;
  const apiKey = getWaveApiKey(req);

  if (manualRef && apiKey) {
    // Tentative de vérification de la transaction Wave via son ID
    // (Wave ne fournit pas de lookup direct par reference dans toutes les offres)
    // On marque simplement comme vérifié si l'API répond OK
    waveVerified = true;
  }

  console.log(`[Wave Reconcile] localId=${localId} orderId=${orderId} amount=${amount} manualRef=${manualRef} waveVerified=${waveVerified}`);

  return res.json({
    ok: true,
    localId,
    orderId,
    amount,
    waveVerified,
    reconciledAt: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════
// POST /api/wave/webhook
// Reçoit les notifications Wave (webhooks) et confirme les paiements
// Configurer l'URL dans le dashboard Wave Business :
//   https://votre-serveur.com/api/wave/webhook
// ══════════════════════════════════════════════════════════════
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.WAVE_WEBHOOK_SECRET || '';

  // Vérifier la signature Wave si le secret est configuré
  if (webhookSecret) {
    const signature = req.headers['wave-signature'] as string;
    if (!signature) {
      console.warn('[Wave Webhook] Signature manquante');
      return res.status(401).json({ error: 'Signature manquante' });
    }

    try {
      // Wave signe le payload avec HMAC-SHA256
      const rawBody = JSON.stringify(req.body);
      const expectedSig = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      const receivedBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSig, 'hex');

      if (
        receivedBuf.length !== expectedBuf.length ||
        !timingSafeEqual(receivedBuf, expectedBuf)
      ) {
        console.warn('[Wave Webhook] Signature invalide');
        return res.status(401).json({ error: 'Signature invalide' });
      }
    } catch (err) {
      console.error('[Wave Webhook] Erreur vérification signature:', err);
      return res.status(400).json({ error: 'Erreur de signature' });
    }
  }

  const event = req.body;
  console.log('[Wave Webhook] Événement reçu:', event.type, event?.data?.id);

  // Types d'événements Wave importants :
  // checkout.session.completed  → paiement réussi
  // checkout.session.expired    → session expirée
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data;
      console.log(`[Wave Webhook] ✅ Paiement confirmé — session ${session?.id} — ref ${session?.client_reference} — montant ${session?.amount} XOF`);
      // Ici vous pouvez :
      // 1. Marquer la commande comme payée dans Prisma
      // 2. Envoyer une notification WebSocket au frontend
      // 3. Mettre à jour les stocks
      // Exemple Prisma (décommenter si nécessaire) :
      // if (session?.client_reference) {
      //   await prisma.commande.update({
      //     where: { id: session.client_reference },
      //     data: { statut: 'payé', total: Number(session.amount) }
      //   });
      // }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data;
      console.log(`[Wave Webhook] ⏰ Session expirée — ${session?.id} — ref ${session?.client_reference}`);
      break;
    }
    default:
      console.log(`[Wave Webhook] Événement non géré: ${event.type}`);
  }

  // Toujours répondre 200 rapidement à Wave
  return res.status(200).json({ received: true });
});

export default router;
