import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'barflow-db';
const DB_VERSION = 1;

interface BarFlowDB extends DBSchema {
  products: { key: string; value: Record<string, unknown>; indexes: { 'category': string } };
  orders: { key: string; value: Record<string, unknown>; indexes: { 'date': string; 'tableNumber': number; 'status': string } };
  stock_movements: { key: string; value: Record<string, unknown>; indexes: { 'productId': string; 'date': string } };
  settings: { key: string; value: { key: string; value: unknown; updatedAt: string } };
  payments: { key: string; value: Record<string, unknown>; indexes: { 'orderId': string; 'method': string; 'date': string } };
  offline_queue: { key: string; value: Record<string, unknown> };
}

let dbPromise: Promise<IDBPDatabase<BarFlowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BarFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BarFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('products')) {
          const store = database.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('category', 'category');
        }
        if (!database.objectStoreNames.contains('orders')) {
          const store = database.createObjectStore('orders', { keyPath: 'id' });
          store.createIndex('date', 'createdAt');
          store.createIndex('tableNumber', 'tableNumber');
          store.createIndex('status', 'status');
        }
        if (!database.objectStoreNames.contains('stock_movements')) {
          const store = database.createObjectStore('stock_movements', { keyPath: 'id' });
          store.createIndex('productId', 'productId');
          store.createIndex('date', 'date');
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('payments')) {
          const store = database.createObjectStore('payments', { keyPath: 'id' });
          store.createIndex('orderId', 'orderId');
          store.createIndex('method', 'method');
          store.createIndex('date', 'date');
        }
        if (!database.objectStoreNames.contains('offline_queue')) {
          database.createObjectStore('offline_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllProducts() {
  const db = await getDb();
  return db.getAll('products');
}

export async function addProduct(product: Record<string, unknown>) {
  const db = await getDb();
  await db.put('products', product as never);
}

export async function deleteProduct(id: string) {
  const db = await getDb();
  await db.delete('products', id);
}

export async function getAllOrders() {
  const db = await getDb();
  return db.getAll('orders');
}

export async function addOrder(order: Record<string, unknown>) {
  const db = await getDb();
  await db.put('orders', order as never);
}

export async function getAllStockMovements() {
  const db = await getDb();
  return db.getAll('stock_movements');
}

export async function addStockMovement(movement: Record<string, unknown>) {
  const db = await getDb();
  await db.add('stock_movements', movement as never);
}

export async function getSetting(key: string) {
  const db = await getDb();
  return db.get('settings', key);
}

export async function setSetting(key: string, value: unknown, updatedAt: string) {
  const db = await getDb();
  await db.put('settings', { key, value, updatedAt } as never);
}

export async function getAllPayments() {
  const db = await getDb();
  return db.getAll('payments');
}

export async function addPayment(payment: Record<string, unknown>) {
  const db = await getDb();
  await db.add('payments', payment as never);
}

export async function initDbWithDefaults(defaultProducts: Record<string, unknown>[]) {
  const existing = await getAllProducts();
  if (existing.length === 0) {
    for (const product of defaultProducts) {
      await addProduct(product);
    }
  }
  const adminPassword = await getSetting('admin_password');
  if (!adminPassword) {
    await setSetting('admin_password', 'admin123', new Date().toISOString());
  }
}
