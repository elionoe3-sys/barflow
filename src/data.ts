import type { Product, TableStatus, DailyStats, StockMovement, Alert } from '@/types';

export const products: Product[] = [
  {
    id: 'p1', name: 'Flag Spéciale', category: 'bières',
    prices: { bouteille: 1500 },
    activePriceFormats: ['bouteille'],
    unit: 'bouteille', stock: 48, stockUnit: 'bouteilles', seuilAlerte: 10, seuilCritique: 5,
    bouteilleEquivalence: 1, image: '🍺', color: '#E31B23', popularite: 95,
  },
  {
    id: 'p2', name: 'Gazelle', category: 'bières',
    prices: { bouteille: 1200 },
    activePriceFormats: ['bouteille'],
    unit: 'bouteille', stock: 36, stockUnit: 'bouteilles', seuilAlerte: 15, seuilCritique: 8,
    bouteilleEquivalence: 1, image: '🍺', color: '#F59E0B', popularite: 88,
  },
  {
    id: 'p3', name: 'MBO Bière', category: 'bières',
    prices: { bouteille: 2000 },
    activePriceFormats: ['bouteille'],
    unit: 'bouteille', stock: 24, stockUnit: 'bouteilles', seuilAlerte: 8, seuilCritique: 4,
    bouteilleEquivalence: 1, image: '🍺', color: '#00A859', popularite: 72,
  },
  {
    id: 'p4', name: 'Cocktail Dakar Sunset', category: 'cocktails',
    prices: { verre: 3500 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 20, stockUnit: 'verres', seuilAlerte: 8, seuilCritique: 4,
    image: '🍹', color: '#EC4899', popularite: 90,
  },
  {
    id: 'p5', name: 'Mojito Sénégal', category: 'cocktails',
    prices: { verre: 3000 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 15, stockUnit: 'verres', seuilAlerte: 6, seuilCritique: 3,
    image: '🍃', color: '#10B981', popularite: 85,
  },
  {
    id: 'p6', name: 'Bissap Fraise', category: 'cocktails',
    prices: { verre: 2500 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 25, stockUnit: 'verres', seuilAlerte: 10, seuilCritique: 5,
    image: '🍷', color: '#DC2626', popularite: 78,
  },
  {
    id: 'p7', name: 'Vin Rouge Toubab', category: 'vins',
    prices: { bouteille: 5000, verre: 1200 },
    activePriceFormats: ['bouteille', 'verre'],
    unit: 'bouteille', stock: 12, stockUnit: 'bouteilles', seuilAlerte: 4, seuilCritique: 2,
    bouteilleEquivalence: 5, image: '🍷', color: '#7C3AED', popularite: 60,
  },
  {
    id: 'p8', name: 'Vin Blanc Chardonnay', category: 'vins',
    prices: { bouteille: 5500, verre: 1300 },
    activePriceFormats: ['bouteille', 'verre'],
    unit: 'bouteille', stock: 8, stockUnit: 'bouteilles', seuilAlerte: 3, seuilCritique: 1,
    bouteilleEquivalence: 5, image: '🍷', color: '#FDE68A', popularite: 45,
  },
  {
    id: 'p9', name: 'Coca Cola', category: 'softs',
    prices: { bouteille: 1000, canette: 800 },
    activePriceFormats: ['bouteille', 'canette'],
    unit: 'bouteille', stock: 60, stockUnit: 'bouteilles', seuilAlerte: 20, seuilCritique: 10,
    image: '🥤', color: '#E31B23', popularite: 82,
  },
  {
    id: 'p10', name: 'Fanta Orange', category: 'softs',
    prices: { bouteille: 1000, canette: 800 },
    activePriceFormats: ['bouteille', 'canette'],
    unit: 'bouteille', stock: 45, stockUnit: 'bouteilles', seuilAlerte: 15, seuilCritique: 8,
    image: '🥤', color: '#F97316', popularite: 70,
  },
  {
    id: 'p11', name: 'Jus de Baobab', category: 'softs',
    prices: { verre: 2000 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 18, stockUnit: 'verres', seuilAlerte: 8, seuilCritique: 4,
    image: '🧃', color: '#8B5CF6', popularite: 75,
  },
  {
    id: 'p12', name: 'Whisky Johnnie', category: 'spiritueux',
    prices: { bouteille: 12000, verre: 2500 },
    activePriceFormats: ['bouteille', 'verre'],
    unit: 'bouteille', stock: 3, stockUnit: 'bouteilles', seuilAlerte: 5, seuilCritique: 2,
    bouteilleEquivalence: 12, image: '🥃', color: '#B45309', popularite: 55,
  },
  {
    id: 'p13', name: 'Gin Gordon', category: 'spiritueux',
    prices: { bouteille: 10000, verre: 2000 },
    activePriceFormats: ['bouteille', 'verre'],
    unit: 'bouteille', stock: 2, stockUnit: 'bouteilles', seuilAlerte: 4, seuilCritique: 2,
    bouteilleEquivalence: 10, image: '🥃', color: '#D4D4D8', popularite: 50,
  },
  {
    id: 'p14', name: "Jus d'Ananas Frais", category: 'softs',
    prices: { verre: 1800 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 12, stockUnit: 'verres', seuilAlerte: 6, seuilCritique: 3,
    image: '🍍', color: '#FDE047', popularite: 68,
  },
  {
    id: 'p15', name: 'Cocktail Teranga', category: 'cocktails',
    prices: { verre: 4000 },
    activePriceFormats: ['verre'],
    unit: 'verre', stock: 8, stockUnit: 'verres', seuilAlerte: 4, seuilCritique: 2,
    image: '🍸', color: '#06B6D4', popularite: 80,
  },
];

export const tables: TableStatus[] = [
  { number: 1, status: 'libre', seats: 4, x: 5, y: 15 },
  { number: 2, status: 'occupée', seats: 2, x: 20, y: 15 },
  { number: 3, status: 'occupée', seats: 6, x: 35, y: 15 },
  { number: 4, status: 'libre', seats: 4, x: 50, y: 15 },
  { number: 5, status: 'en_attente', seats: 4, x: 65, y: 15 },
  { number: 6, status: 'occupée', seats: 2, x: 80, y: 15 },
  { number: 7, status: 'libre', seats: 4, x: 5, y: 40 },
  { number: 8, status: 'occupée', seats: 6, x: 20, y: 40 },
  { number: 9, status: 'libre', seats: 4, x: 35, y: 40 },
  { number: 10, status: 'libre', seats: 2, x: 50, y: 40 },
  { number: 11, status: 'en_attente', seats: 4, x: 65, y: 40 },
  { number: 12, status: 'libre', seats: 6, x: 80, y: 40 },
  { number: 13, status: 'libre', seats: 2, x: 15, y: 62 },
  { number: 14, status: 'occupée', seats: 4, x: 35, y: 62 },
  { number: 15, status: 'libre', seats: 4, x: 55, y: 62 },
];

export const dailyStats: DailyStats[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const baseCA = isWeekend ? 250000 : 150000;
  const variance = Math.random() * 0.4 - 0.2;
  const ca = Math.round(baseCA * (1 + variance));
  const clients = Math.round((isWeekend ? 60 : 35) * (1 + variance));
  return {
    date: date.toISOString().split('T')[0],
    ca,
    clients,
    ticketMoyen: Math.round(ca / clients),
    produitsPlusVendus: [
      { name: 'Flag Spéciale', quantity: Math.round(20 + Math.random() * 15) },
      { name: 'Gazelle', quantity: Math.round(15 + Math.random() * 10) },
      { name: 'Cocktail Dakar Sunset', quantity: Math.round(8 + Math.random() * 8) },
    ],
    marge: Math.round(ca * 0.65),
    consos: {
      'bières': Math.round(25 + Math.random() * 20),
      'cocktails': Math.round(10 + Math.random() * 10),
      'vins': Math.round(5 + Math.random() * 5),
      'softs': Math.round(15 + Math.random() * 10),
      'spiritueux': Math.round(3 + Math.random() * 4),
      'autres': Math.round(2 + Math.random() * 3),
    },
  };
});

export const stockMovements: StockMovement[] = [
  { id: 'm1', productId: 'p1', type: 'entrée', quantity: 50, date: new Date(Date.now() - 86400000 * 3), supplier: 'Coca Cola Sénégal', purchasePrice: 700, reason: 'Réapprovisionnement hebdomadaire' },
  { id: 'm2', productId: 'p2', type: 'entrée', quantity: 40, date: new Date(Date.now() - 86400000 * 3), supplier: 'Coca Cola Sénégal', purchasePrice: 600, reason: 'Réapprovisionnement hebdomadaire' },
  { id: 'm3', productId: 'p12', type: 'sortie', quantity: 2, date: new Date(Date.now() - 86400000 * 2), reason: 'Vente' },
  { id: 'm4', productId: 'p7', type: 'entrée', quantity: 6, date: new Date(Date.now() - 86400000 * 5), supplier: 'Les Vins du Monde', purchasePrice: 2500, reason: 'Commande fournisseur' },
  { id: 'm5', productId: 'p13', type: 'sortie', quantity: 1, date: new Date(Date.now() - 86400000), reason: 'Vente' },
  { id: 'm6', productId: 'p1', type: 'sortie', quantity: 10, date: new Date(Date.now() - 86400000), reason: 'Vente soirée' },
  { id: 'm7', productId: 'p10', type: 'correction', quantity: -2, date: new Date(Date.now() - 86400000 * 2), reason: 'Écart inventaire' },
];

export const alerts: Alert[] = [
  { type: 'stock_critique', productId: 'p13', productName: 'Gin Gordon', message: 'Stock critique : 2 bouteilles restantes', level: 'danger' },
  { type: 'stock_bas', productId: 'p12', productName: 'Whisky Johnnie', message: 'Stock bas : 3 bouteilles restantes', level: 'warning' },
  { type: 'stock_critique', productId: 'p15', productName: 'Cocktail Teranga', message: 'Stock critique : 8 verres restants', level: 'warning' },
  { type: 'info', productId: 'p1', productName: 'Flag Spéciale', message: 'Bonne nouvelle : 48 bouteilles en stock', level: 'info' },
];

export const categoryColors: Record<string, string> = {
  'bières': '#F59E0B',
  'cocktails': '#EC4899',
  'vins': '#8B5CF6',
  'softs': '#06B6D4',
  'spiritueux': '#B45309',
  'autres': '#64748B',
};

export const categoryEmojis: Record<string, string> = {
  'bières': '🍺',
  'cocktails': '🍹',
  'vins': '🍷',
  'softs': '🥤',
  'spiritueux': '🥃',
  'autres': '🍸',
};

// data.ts - AJOUTER À LA FIN DU FICHIER

// Exporter les catégories pour l'initialisation du store
export const defaultCategories = {
  'bières': { emoji: '🍺', color: '#F59E0B' },
  'cocktails': { emoji: '🍹', color: '#EC4899' },
  'vins': { emoji: '🍷', color: '#8B5CF6' },
  'softs': { emoji: '🥤', color: '#06B6D4' },
  'spiritueux': { emoji: '🥃', color: '#B45309' },
  'autres': { emoji: '🍸', color: '#64748B' },
};