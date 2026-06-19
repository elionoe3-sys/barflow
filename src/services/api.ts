// src/services/api.ts
// Toutes les communications avec le serveur Express

const API_URL = 'http://localhost:3001/api';

// ── Helper ────────────────────────────────────────────────────
async function req(method: string, path: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function isServerOnline() {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch { return false; }
}

// ============ PRODUITS ============
export const getProduits            = ()           => req('GET',    '/produits');
export const createProduit          = (d: any)     => req('POST',   '/produits', d);
export const updateProduit          = (id: string, d: any) => req('PUT', `/produits/${id}`, d);
export const deleteProduit          = (id: string) => req('DELETE', `/produits/${id}`);

// ============ COMMANDES ============
export const getCommandes           = ()           => req('GET',    '/commandes');
export const createCommande         = (d: any)     => req('POST',   '/commandes', d);
export const updateCommande         = (id: string, d: any) => req('PUT', `/commandes/${id}`, d);
export const deleteCommande         = (id: string) => req('DELETE', `/commandes/${id}`);

// ============ CHARGES ============
export const getCharges             = ()           => req('GET',    '/charges');
export const createCharge           = (d: any)     => req('POST',   '/charges', d);
export const updateCharge           = (id: string, d: any) => req('PUT', `/charges/${id}`, d);
export const deleteCharge           = (id: string) => req('DELETE', `/charges/${id}`);

// ============ EMPLOYÉS ============
export const getEmployes            = ()           => req('GET',    '/employes');
export const createEmploye          = (d: any)     => req('POST',   '/employes', d);
export const updateEmploye          = (id: string, d: any) => req('PUT', `/employes/${id}`, d);
export const deleteEmploye          = (id: string) => req('DELETE', `/employes/${id}`);

// ============ INVESTISSEMENTS ============
export const getInvestissements     = ()           => req('GET',    '/investissements');
export const createInvestissement   = (d: any)     => req('POST',   '/investissements', d);
export const updateInvestissement   = (id: string, d: any) => req('PUT', `/investissements/${id}`, d);
export const deleteInvestissement   = (id: string) => req('DELETE', `/investissements/${id}`);

// ============ DAILY STATS ============
export const getDailyStats          = ()                              => req('GET',  '/dailyStats');
export const updateDailyStats       = (date: string, ca: number, clients: number = 0) =>
  req('POST', '/dailyStats', { date, ca, clients });

// ============ FOURNISSEURS ============
export const getFournisseurs        = ()           => req('GET',    '/fournisseurs');
export const createFournisseur      = (d: any)     => req('POST',   '/fournisseurs', d);
export const updateFournisseur      = (id: string, d: any) => req('PUT', `/fournisseurs/${id}`, d);
export const deleteFournisseur      = (id: string) => req('DELETE', `/fournisseurs/${id}`);

// ============ REAPPRO COMMANDES ============
export const getReapproCommandes    = ()           => req('GET',    '/reapproCommandes');
export const createReapproCommande  = (d: any)     => req('POST',   '/reapproCommandes', d);
export const updateReapproCommande  = (id: string, d: any) => req('PUT', `/reapproCommandes/${id}`, d);
export const deleteReapproCommande  = (id: string) => req('DELETE', `/reapproCommandes/${id}`);

// ============ PERTES ============
export const getPertes              = ()           => req('GET',    '/pertes');
export const createPerte            = (d: any)     => req('POST',   '/pertes', d);
export const deletePerte            = (id: string) => req('DELETE', `/pertes/${id}`);

// ============ CATÉGORIES ============
export const getCategories          = ()           => req('GET',    '/categories');
export const createCategorie        = (d: any)     => req('POST',   '/categories', d);
export const updateCategorie        = (id: string, d: any) => req('PUT', `/categories/${id}`, d);
export const deleteCategorie        = (id: string) => req('DELETE', `/categories/${id}`);

// ============ BAR SETTINGS ============
export const getSettings            = ()                    => req('GET',    '/settings');
export const getSettingByKey        = (key: string)         => req('GET',    `/settings/${key}`);
export const setSetting             = (key: string, value: any) => req('POST', '/settings', { key, value });
export const deleteSetting          = (key: string)         => req('DELETE', `/settings/${key}`);
