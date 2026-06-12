// src/utils/productStore.ts
import { useState, useEffect, useCallback } from 'react';
import { products as defaultProducts } from '@/data';
import type { Product } from '@/types';
import { getAllProducts, addProduct, getDb } from '@/utils/db';

// ── Types pour le score de rentabilité ─────────────────────────
export interface ProductScore {
  productId: string;
  productName: string;
  category: string;
  margeBrute: number;
  vitesseRotation: number;
  tauxPerte: number;
  scoreTotal: number;
  couleur: string;
  recommandation: 'top' | 'bon' | 'moyen' | 'faible' | 'critique';
  action: string;
  prix: number;
  stock: number;
}

// ── Catégories ────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

// ── Store global en mémoire ───────────────────────────────────
let globalProducts: Product[] = [];
let listeners: (() => void)[] = [];

// Store catégories
let globalCategories: Category[] = [];
let categoryListeners: (() => void)[] = [];

// ── Fonctions de notification ─────────────────────────────────
function notifyListeners() {
  listeners.forEach(l => l());
}

function notifyCategoryListeners() {
  categoryListeners.forEach(l => l());
}

// ── Gestion des produits ──────────────────────────────────────
export async function loadProducts(): Promise<Product[]> {
  const dbProducts = await getAllProducts();
  if (dbProducts.length > 0) {
    globalProducts = dbProducts as unknown as Product[];
  } else {
    globalProducts = [...defaultProducts];
  }
  notifyListeners();
  return globalProducts;
}

export async function updateProductInStore(product: Product): Promise<void> {
  await addProduct(product as unknown as Record<string, unknown>);
  globalProducts = globalProducts.map(p => p.id === product.id ? product : p);
  notifyListeners();
}

export async function addProductToStore(product: Product): Promise<void> {
  await addProduct(product as unknown as Record<string, unknown>);
  globalProducts = [...globalProducts, product];
  notifyListeners();
}

export async function deleteProductFromStore(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('products', id);
  globalProducts = globalProducts.filter(p => p.id !== id);
  notifyListeners();
}

export async function updateStockInStore(productId: string, newStock: number): Promise<void> {
  const product = globalProducts.find(p => p.id === productId);
  if (!product) return;
  const updated = { ...product, stock: newStock };
  await addProduct(updated as unknown as Record<string, unknown>);
  globalProducts = globalProducts.map(p => p.id === productId ? updated : p);
  notifyListeners();
}

// ── Gestion des catégories ────────────────────────────────────
export function initCategories(categoriesData: Record<string, { emoji: string; color: string }>) {
  globalCategories = Object.entries(categoriesData).map(([name, { emoji, color }]) => ({
    id: name.toLowerCase().replace(/\s/g, '_'),
    name,
    emoji,
    color,
  }));
  notifyCategoryListeners();
}

export function getCategories(): Category[] {
  return [...globalCategories];
}

export async function addCategory(name: string, emoji: string = '📦', color: string = '#64748B'): Promise<boolean> {
  if (globalCategories.some(c => c.name === name)) return false;
  const id = name.toLowerCase().replace(/\s/g, '_');
  globalCategories.push({ id, name, emoji, color });
  localStorage.setItem('barflow_categories', JSON.stringify(globalCategories));
  notifyCategoryListeners();
  return true;
}

export async function updateCategory(oldName: string, newName: string, emoji?: string, color?: string): Promise<boolean> {
  const index = globalCategories.findIndex(c => c.name === oldName);
  if (index === -1) return false;
  
  // Mettre à jour les produits qui utilisent cette catégorie
  globalProducts = globalProducts.map(p => 
    p.category === oldName ? { ...p, category: newName } : p
  );
  
  globalCategories[index] = {
    ...globalCategories[index],
    name: newName,
    emoji: emoji || globalCategories[index].emoji,
    color: color || globalCategories[index].color,
  };
  
  localStorage.setItem('barflow_categories', JSON.stringify(globalCategories));
  notifyCategoryListeners();
  notifyListeners();
  return true;
}

export async function deleteCategory(categoryName: string): Promise<boolean> {
  const hasProducts = globalProducts.some(p => p.category === categoryName);
  if (hasProducts) {
    throw new Error(`Impossible de supprimer "${categoryName}" : des produits l'utilisent`);
  }
  
  globalCategories = globalCategories.filter(c => c.name !== categoryName);
  localStorage.setItem('barflow_categories', JSON.stringify(globalCategories));
  notifyCategoryListeners();
  return true;
}

export function loadCategoriesFromStorage(): Category[] {
  try {
    const saved = localStorage.getItem('barflow_categories');
    if (saved) {
      globalCategories = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Erreur chargement catégories', e);
  }
  return globalCategories;
}

export function getCategoryColor(categoryName: string): string {
  const cat = globalCategories.find(c => c.name === categoryName);
  return cat?.color || '#64748B';
}

export function getCategoryEmoji(categoryName: string): string {
  const cat = globalCategories.find(c => c.name === categoryName);
  return cat?.emoji || '📦';
}

// Pour compatibilité avec les anciens composants
export const categoryColors: Record<string, string> = {};
export const categoryEmojis: Record<string, string> = {};

export function refreshCategoryMaps() {
  Object.keys(categoryColors).forEach(key => delete categoryColors[key]);
  Object.keys(categoryEmojis).forEach(key => delete categoryEmojis[key]);
  
  globalCategories.forEach(cat => {
    categoryColors[cat.name] = cat.color;
    categoryEmojis[cat.name] = cat.emoji;
  });
}

// ── Hook pour les catégories ──────────────────────────────────
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(globalCategories);

  useEffect(() => {
    setCategories([...globalCategories]);
    
    const listener = () => setCategories([...globalCategories]);
    categoryListeners.push(listener);
    return () => { categoryListeners = categoryListeners.filter(l => l !== listener); };
  }, []);

  const addNewCategory = useCallback(async (name: string, emoji?: string, color?: string) => {
    return await addCategory(name, emoji, color);
  }, []);

  const editCategory = useCallback(async (oldName: string, newName: string, emoji?: string, color?: string) => {
    return await updateCategory(oldName, newName, emoji, color);
  }, []);

  const removeCategory = useCallback(async (categoryName: string) => {
    return await deleteCategory(categoryName);
  }, []);

  const refreshCategories = useCallback(() => {
    setCategories([...globalCategories]);
    refreshCategoryMaps();
  }, []);

  return { categories, addNewCategory, editCategory, removeCategory, refreshCategories };
}

// ── Fonctions de score ────────────────────────────────────────
const getProductMainPrice = (product: Product): number => {
  if (!product.prices) return 1000;
  if (product.prices.bouteille) return product.prices.bouteille;
  if (product.prices.verre) return product.prices.verre;
  if (product.prices.canette) return product.prices.canette;
  if (product.prices.demi) return product.prices.demi;
  if (product.prices.quart) return product.prices.quart;
  return 1000;
};

const calculateGrossMarginScore = (product: Product): number => {
  const price = getProductMainPrice(product);
  const estimatedCost = price * 0.35;
  const margin = price - estimatedCost;
  const marginRate = (margin / price) * 100;
  const weightedMargin = marginRate * (product.popularite / 100);
  return Math.min(100, Math.round((weightedMargin / 80) * 100));
};

const calculateRotationSpeed = (product: Product): number => {
  const stock = product.stock;
  if (stock === 0) return 100;
  const estimatedDailySales = product.popularite * 0.5;
  const rotationDays = stock / Math.max(estimatedDailySales, 1);
  let score = 100 - (rotationDays / 30) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const calculateLossRate = (productId: string, productName: string): number => {
  const product = globalProducts.find(p => p.id === productId);
  if (!product) return 70;
  if (product.stock <= product.seuilCritique) return 30;
  if (product.stock <= product.seuilAlerte) return 50;
  return 80;
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
};

const getRecommendation = (score: number, product: Product): { niveau: string; action: string } => {
  if (score >= 80) return { niveau: 'top', action: '🔥 Produit star - Mettre en avant ce soir !' };
  if (score >= 60) return { niveau: 'bon', action: '✅ Bon produit - Idéal pour happy hour' };
  if (score >= 40) return { niveau: 'moyen', action: '📊 Marge correcte - À associer en pack' };
  if (score >= 20) return { niveau: 'faible', action: '⚠️ Rotation lente - Envisager promotion' };
  return { niveau: 'critique', action: '🔴 Produit peu rentable - Réévaluer le prix' };
};

export const calculateProductScores = (): ProductScore[] => {
  const scores = globalProducts.map(product => {
    const margeBrute = calculateGrossMarginScore(product);
    const vitesseRotation = calculateRotationSpeed(product);
    const tauxPerte = calculateLossRate(product.id, product.name);
    const prix = getProductMainPrice(product);
    const scoreTotal = Math.round(margeBrute * 0.4 + vitesseRotation * 0.35 + tauxPerte * 0.25);
    const { niveau, action } = getRecommendation(scoreTotal, product);
    
    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      margeBrute,
      vitesseRotation,
      tauxPerte,
      scoreTotal,
      couleur: getScoreColor(scoreTotal),
      recommandation: niveau as any,
      action,
      prix,
      stock: product.stock,
    };
  }).sort((a, b) => b.scoreTotal - a.scoreTotal);
  
  return scores;
};

export const getTopProductsToPromote = (limit: number = 5): ProductScore[] => {
  const scores = calculateProductScores();
  return scores.slice(0, limit);
};

// ── Hook React pour utiliser le store ────────────────────────
export function useProducts() {
  const [products, setProducts] = useState<Product[]>(globalProducts);
  const [productScores, setProductScores] = useState<ProductScore[]>([]);

  useEffect(() => {
    if (globalProducts.length === 0) {
      loadProducts().then(products => {
        setProducts(products);
        setProductScores(calculateProductScores());
      });
    } else {
      setProductScores(calculateProductScores());
    }
    
    const listener = () => {
      setProducts([...globalProducts]);
      setProductScores(calculateProductScores());
    };
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  }, []);

  const updateProduct = useCallback(async (product: Product) => {
    await updateProductInStore(product);
  }, []);

  const addProduct = useCallback(async (product: Product) => {
    await addProductToStore(product);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await deleteProductFromStore(id);
  }, []);

  const updateStock = useCallback(async (productId: string, newStock: number) => {
    await updateStockInStore(productId, newStock);
  }, []);

  const getTopProducts = useCallback((limit: number = 5) => {
    return getTopProductsToPromote(limit);
  }, []);

  return { 
    products, 
    productScores,
    updateProduct, 
    addProduct, 
    deleteProduct, 
    updateStock,
    getTopProducts
  };
}