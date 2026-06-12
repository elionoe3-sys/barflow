export type ProductCategory = 'bières' | 'cocktails' | 'vins' | 'softs' | 'spiritueux' | 'autres';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  // Nouveau système de prix multiples
  prices: {
    bouteille?: number;
    demi?: number;
    quart?: number;
    verre?: number;
    canette?: number;
  };
  // Nouveau champ : formats de prix à afficher dans l'interface commande
  activePriceFormats?: ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[];
  
  unit: string;
  stock: number;
  stockUnit: string;
  seuilAlerte: number;
  seuilCritique: number;
  bouteilleEquivalence?: number;
  image: string;
  color: string;
  popularite: number;
  options?: {
    bottleSize?: string;
    supplements?: string[];
    notes?: string;
  };
}
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  // Mise à jour pour inclure tous les formats possibles
  format: 'bouteille' | 'demi' | 'quart' | 'verre' | 'canette';
  unitPrice: number;
  comment?: string;
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

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  format: 'bouteille' | 'demi' | 'quart' | 'verre' | 'canette';
  unitPrice: number;
  supplements?: string[];  // ← Ajouter cette ligne
}