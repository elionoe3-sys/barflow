export type ProductCategory = 'bières' | 'cocktails' | 'vins' | 'softs' | 'spiritueux' | 'autres';

// ── Configuration centilitres par format de service ───────────
// Permet de déduire exactement le bon volume du stock à chaque vente
export interface VolumeConfig {
  // Contenance réelle de la bouteille/unité en cl (ex: 75 pour un vin, 70 pour whisky, 33 pour bière)
  contenanceCl: number;
  // Volume servi par format (configurable par produit)
  clParBouteille?: number;  // = contenanceCl par défaut
  clParDemi?: number;       // ex: 37.5 pour vin 75cl
  clParQuart?: number;      // ex: 18.75 pour vin 75cl
  clParVerre?: number;      // ex: 15 pour vin, 4 pour whisky, 25 pour bière pression
  clParCanette?: number;    // = contenanceCl de la canette (33 ou 50)
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  // Prix multiples par format de service
  prices: {
    bouteille?: number;
    demi?: number;
    quart?: number;
    verre?: number;
    canette?: number;
  };

  // Formats affichés dans l'interface commande
  activePriceFormats?: ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[];

  // ── Gestion stock en centilitres ─────────────────────────────
  // stockCl : stock réel en centilitres (source de vérité)
  // stock   : nombre de bouteilles/unités entières (calculé depuis stockCl / contenanceCl)
  //           conservé pour rétrocompatibilité avec les affichages existants
  stockCl?: number;         // stock en cl (ex: 900 = 12 bouteilles de 75cl)
  volumeConfig?: VolumeConfig; // configuration des volumes par format

  unit: string;
  stock: number;            // bouteilles/unités (= floor(stockCl / contenanceCl) si volumeConfig défini)
  stockUnit: string;
  seuilAlerte: number;
  seuilCritique: number;
  bouteilleEquivalence?: number;
  image: string;
  // Photo réelle du produit (base64 data-URL ou URL externe). Si absente,
  // toutes les vignettes (Stocks, Commandes) retombent sur l'emoji `image`.
  photo?: string;
  color: string;
  popularite: number;
  options?: {
    bottleSize?: string;
    supplements?: string[];
    notes?: string;
  };
}

// ── Helper : calcul de la déduction en cl pour un format ─────
export function getClPourFormat(
  format: 'bouteille' | 'demi' | 'quart' | 'verre' | 'canette',
  volumeConfig: VolumeConfig
): number {
  const contenance = volumeConfig.contenanceCl || 75;
  switch (format) {
    case 'bouteille': return volumeConfig.clParBouteille ?? contenance;
    case 'demi':      return volumeConfig.clParDemi      ?? Math.round(contenance / 2 * 10) / 10;
    case 'quart':     return volumeConfig.clParQuart     ?? Math.round(contenance / 4 * 10) / 10;
    case 'verre':     return volumeConfig.clParVerre     ?? 15;
    case 'canette':   return volumeConfig.clParCanette   ?? contenance;
    default:          return contenance;
  }
}

// ── Helper : affichage du stock en bouteilles + cl ───────────
export function formatStockDisplay(product: Product): string {
  if (!product.volumeConfig || !product.stockCl) {
    return `${product.stock} ${product.stockUnit}`;
  }
  const contenance = product.volumeConfig.contenanceCl;
  const bouteilles = Math.floor(product.stockCl / contenance);
  const reste = Math.round((product.stockCl % contenance) * 10) / 10;
  if (reste > 0) {
    return `${bouteilles} btl + ${reste}cl (${product.stockCl}cl total)`;
  }
  return `${bouteilles} btl (${product.stockCl}cl)`;
}

// ── Helper : stock en bouteilles entières (pour seuils) ──────
export function getStockBouteilles(product: Product): number {
  if (product.volumeConfig && product.stockCl != null) {
    return product.stockCl / product.volumeConfig.contenanceCl;
  }
  return product.stock;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  format: 'bouteille' | 'demi' | 'quart' | 'verre' | 'canette';
  unitPrice: number;
  comment?: string;
  supplements?: string[];
  // Volume déduit en cl pour ce item (quantité × clParFormat)
  clDeduitsParUnite?: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  tableNumber: number;
  server: string;
  status: 'en_cours' | 'en_attente' | 'servi' | 'payé' | 'annulé';
  createdAt: Date;
  total: number;
  paymentMethod?: 'espèces' | 'wave' | 'orange_money' | 'carte' | 'autre';
  comment?: string;
}

export interface TableStatus {
  number: number;
  status: 'libre' | 'occupée' | 'en_attente';
  currentOrder?: string;
  server?: string;
  seats: number;
  x: number;
  y: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'entrée' | 'sortie' | 'correction';
  quantity: number;
  quantityCl?: number; // en cl si volumeConfig actif
  date: Date;
  supplier?: string;
  purchasePrice?: number;
  reason: string;
}

export interface DailyStats {
  date: string;
  ca: number;
  clients: number;
  ticketMoyen: number;
  produitsPlusVendus: { name: string; quantity: number }[];
  marge: number;
  consos: Record<ProductCategory, number>;
}

export interface Alert {
  type: 'stock_bas' | 'stock_critique' | 'info';
  productId: string;
  productName: string;
  message: string;
  level: 'info' | 'warning' | 'danger';
}

export type TabId = 'dashboard' | 'orders' | 'stocks' | 'finance' | 'reappro' | 'settings';