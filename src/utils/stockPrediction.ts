import { dailyStats, products } from '@/data';
import type { Product } from '@/types';

export interface StockPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  dailyConsumption: number;
  daysUntilRupture: number | null;
  status: 'critical' | 'warning' | 'normal' | 'rupture';
  message: string;
  color: string;
}

// Calculer la consommation moyenne des 7 derniers jours pour un produit
const getProductDailyConsumption = (productName: string): number => {
  const last7Stats = dailyStats.slice(-7);
  let totalConsumed = 0;
  let daysWithData = 0;
  
  last7Stats.forEach(day => {
    const productSale = day.produitsPlusVendus.find(p => p.name === productName);
    if (productSale && productSale.quantity > 0) {
      totalConsumed += productSale.quantity;
      daysWithData++;
    }
  });
  
  if (daysWithData === 0) return 0;
  return totalConsumed / daysWithData;
};

// Calculer la prédiction pour un produit spécifique
export const predictStockRupture = (product: Product): StockPrediction => {
  const dailyConsumption = getProductDailyConsumption(product.name);
  const currentStock = product.stock;
  
  // Si le stock est déjà à 0
  if (currentStock <= 0) {
    return {
      productId: product.id,
      productName: product.name,
      currentStock: 0,
      dailyConsumption,
      daysUntilRupture: 0,
      status: 'rupture',
      message: '🔴 EN RUPTURE',
      color: 'bg-red-100 text-red-700 border-red-200',
    };
  }
  
  // Si pas de données de consommation
  if (dailyConsumption === 0) {
    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      dailyConsumption: 0,
      daysUntilRupture: null,
      status: 'normal',
      message: '📊 Pas assez de données',
      color: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }
  
  const daysUntilRupture = Math.floor(currentStock / dailyConsumption);
  
  if (daysUntilRupture <= 2) {
    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      dailyConsumption,
      daysUntilRupture,
      status: 'critical',
      message: `⚠️ Rupture dans ${daysUntilRupture} jour${daysUntilRupture > 1 ? 's' : ''} !`,
      color: 'bg-red-50 text-red-700 border-red-200',
    };
  }
  
  if (daysUntilRupture <= 5) {
    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      dailyConsumption,
      daysUntilRupture,
      status: 'warning',
      message: `🟡 Rupture dans ${daysUntilRupture} jours`,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  
  if (daysUntilRupture <= 14) {
    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      dailyConsumption,
      daysUntilRupture,
      status: 'warning',
      message: `📦 Stock pour ${daysUntilRupture} jours`,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  
  return {
    productId: product.id,
    productName: product.name,
    currentStock,
    dailyConsumption,
    daysUntilRupture,
    status: 'normal',
    message: `✅ Stock OK (${Math.round(dailyConsumption)}/jour)`,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
};

// Obtenir tous les produits avec leur prédiction
export const getAllPredictions = (productsList: Product[]): StockPrediction[] => {
  return productsList.map(product => predictStockRupture(product));
};

// Obtenir les produits critiques (rupture imminente)
export const getCriticalProducts = (productsList: Product[]): StockPrediction[] => {
  return getAllPredictions(productsList)
    .filter(p => p.status === 'critical' || p.status === 'rupture')
    .sort((a, b) => (a.daysUntilRupture ?? 999) - (b.daysUntilRupture ?? 999));
};