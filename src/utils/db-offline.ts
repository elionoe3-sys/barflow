import { db } from '@/db';

// Export des fonctions compatibles avec l'ancienne API
export async function initDbWithDefaults(productsData: any[]) {
  await db.initDefaultData(productsData);
}

// Pour la compatibilité avec le code existant
export async function getAllProducts() {
  return await db.getActiveProduits();
}

export async function addProduct(product: any) {
  return await db.addProduit(product);
}

export async function updateProduct(id: string, data: any) {
  return await db.updateProduit(id, data);
}

export async function deleteProduct(id: string) {
  return await db.deleteProduit(id);
}

export async function getAllCharges() {
  return await db.getActiveCharges();
}

export async function getAllEmployes() {
  return await db.getActiveEmployes();
}

export async function getAllInvestissements() {
  return await db.getActiveInvestissements();
}

export async function addDailySale(date: string, amount: number) {
  return await db.addDailyStat(date, amount);
}