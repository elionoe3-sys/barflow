// QRCodeGenerator.tsx - Version corrigée
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  text: string;
  size?: number;
  className?: string;
}

export function QRCodeGenerator({ text, size = 200, className = '' }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !text) return;
    QRCode.toCanvas(canvasRef.current, text, {
      width: size,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    }).catch(() => setError('Erreur de génération du QR Code'));
  }, [text, size]);

  if (error) return <p className="text-red-500 text-sm text-center">{error}</p>;
  return <canvas ref={canvasRef} className={className} />;
}

// ── Générateur QR Wave Sénégal (CORRIGÉ) ─────────────────────
// Wave utilise le format standard: 
// "wave://payment?merchant=NUMERO&amount=MONTANT&currency=XOF&reference=REF"
export function generatePaymentQRData(
  method: 'wave' | 'orange_money',
  amount: number,
  orderId: string,
  merchantNumber = ''
): string {
  // Nettoyer le numéro (enlever espaces, tirets, +)
  const cleanNumber = merchantNumber.replace(/[\s\-\+]/g, '');
  const timestamp = Date.now();
  const ref = `${orderId}-${timestamp}`;

  if (method === 'wave') {
    if (cleanNumber && cleanNumber !== 'barflow-senegal') {
      // Format officiel Wave pour QR code de paiement
      return `wave://payment?merchant=${cleanNumber}&amount=${amount}&currency=XOF&reference=${ref}`;
    }
    return `wave://payment?merchant=CONFIGUREZ_VOTRE_NUMERO&amount=${amount}&currency=XOF&reference=${ref}`;
  }

  // Orange Money Sénégal
  if (method === 'orange_money') {
    if (cleanNumber && cleanNumber !== 'barflow-senegal') {
      // Format Orange Money pour QR code
      return `om://payment?merchant=${cleanNumber}&amount=${amount}&currency=XOF&reference=${ref}`;
    }
    return `om://payment?merchant=CONFIGUREZ_VOTRE_NUMERO&amount=${amount}&currency=XOF&reference=${ref}`;
  }

  return cleanNumber;
}

export function generateManualTransactionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'BF-';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}