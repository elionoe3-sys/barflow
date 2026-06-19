// routes/email.ts
// Envoi d'emails via Gmail SMTP (Nodemailer) — gratuit, nécessite un compte
// Gmail + un "mot de passe d'application" (App Password), PAS le mot de passe
// normal du compte. À générer sur https://myaccount.google.com/apppasswords
//
// Variables d'environnement requises dans .env :
//   GMAIL_USER=tonadresse@gmail.com
//   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   (16 caractères, sans espaces)

import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

function isEmailConfigured(): boolean {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

// ══════════════════════════════════════════════════════════════
// GET /api/email/test
// Vérifie que les identifiants Gmail sont configurés et valides
// ══════════════════════════════════════════════════════════════
router.get('/test', async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    return res.status(400).json({
      ok: false,
      error: 'GMAIL_USER et GMAIL_APP_PASSWORD manquants dans .env',
    });
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return res.json({ ok: true, message: 'Connexion Gmail SMTP réussie ✅' });
  } catch (err: any) {
    return res.status(401).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/email/send-code
// Envoie un code de vérification à 6 chiffres par email
// Body: { to: string, code: string, barName?: string }
// ══════════════════════════════════════════════════════════════
router.post('/send-code', async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    return res.status(400).json({
      ok: false,
      error: 'Service email non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD dans .env',
    });
  }

  const { to, code, barName } = req.body as { to?: string; code?: string; barName?: string };
  if (!to || !code) {
    return res.status(400).json({ ok: false, error: 'Paramètres manquants : to, code' });
  }

  try {
    const transporter = getTransporter();
    const fromName = barName ? `${barName} (BarFlow)` : 'BarFlow';

    await transporter.sendMail({
      from: `"${fromName}" <${GMAIL_USER}>`,
      to,
      subject: 'Code de récupération — BarFlow',
      text: `Votre code de récupération est : ${code}\n\nCe code expire dans 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #7c3aed;">BarFlow — Récupération de mot de passe</h2>
          <p>Voici votre code de vérification :</p>
          <div style="background: #f5f3ff; border: 2px solid #8B5CF6; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">Ce code expire dans 10 minutes. Si vous n'avez pas demandé cette récupération, vous pouvez ignorer cet email en toute sécurité.</p>
        </div>
      `,
    });

    return res.json({ ok: true, message: 'Email envoyé avec succès' });
  } catch (err: any) {
    console.error('[Email] Erreur envoi:', err.message);
    return res.status(502).json({ ok: false, error: "Échec de l'envoi de l'email", details: err.message });
  }
});

export default router;