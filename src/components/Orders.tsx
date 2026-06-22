// Orders.tsx - Version avec persistance réelle (IndexedDB)
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Table2, Search,
  Check, Receipt, CreditCard, Settings, Edit3, Trash2, Printer,
  AlertCircle, BookOpen, Wallet, Lock, DoorOpen, DoorClosed,
  TrendingUp, Banknote, ClipboardList, History, Shield,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { tables as defaultTables } from '@/data';
import { useCategories, getCategoryEmoji } from '@/utils/productStore';
import type { Product, OrderItem, Order, TableStatus } from '@/types';
import { getClPourFormat } from '@/types';
import { PaymentModal } from '@/components/PaymentModal';
import { predictStockRupture } from '@/utils/stockPrediction';
import { useBarInfo } from '@/hooks/useBarInfo';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  orderDb,
  saveOrder,
  payOrder,
  loadActiveOrders,
  loadOrderHistory,
  type PersistedOrder,
} from '@/utils/orderStore';

type CartItem = OrderItem & { supplements?: string[] };

// ── Vignette produit : photo réelle si dispo, sinon emoji générique ──
// (même logique que dans Stocks.tsx — la photo doit s'afficher partout
// où le produit apparaît : Commandes, Stocks, Réappro)
function ProductThumb({ product, size = 'md', className }: {
  product: { photo?: string; image?: string; color?: string };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = size === 'lg' ? 'w-14 h-14 text-3xl' : size === 'sm' ? 'w-8 h-8 text-lg' : 'w-12 h-12 text-2xl';
  if (product.photo) {
    return (
      <div className={cn('rounded-xl overflow-hidden shrink-0 border border-slate-200', sizeClasses, className)}>
        <img src={product.photo} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={cn('rounded-xl flex items-center justify-center shrink-0', sizeClasses, className)}
      style={{ backgroundColor: `${product.color || '#8B5CF6'}20` }}
    >
      {product.image || '📦'}
    </div>
  );
}

// Session de caisse (fond + serveur + horaires)
interface CaisseSession {
  isOpen: boolean;
  fondCaisse: number;
  serverName: string;
  openedAt: string | null;
  closedAt: string | null;
}

// Entrée d'historique caisse (35 jours)
interface CaisseHistoryEntry {
  id: string;
  fondCaisse: number;
  serverName: string;
  openedAt: string;
  closedAt: string | null;
  recettesEspeces: number;
  totalAttendu: number;
  montantCompte: number | null;
  ecart: number | null;
  nbCommandes: number;
  caTotal: number;
}

// Convertir PersistedOrder → Order (pour compatibilité avec le reste du code)
function toOrder(p: PersistedOrder): Order {
  return {
    id: p.id,
    items: p.items as OrderItem[],
    tableNumber: p.tableNumber,
    server: p.server,
    status: p.status as Order['status'],
    createdAt: new Date(p.createdAt),
    total: p.total,
    paymentMethod: p.paymentMethod as Order['paymentMethod'],
    comment: p.comment,
  };
}

export function Orders() {
  const products = useLiveQuery(() => universalSync.getProduits(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);

  useEffect(() => {
    const loadCats = async () => {
      const { getCategories } = await import('@/utils/productStore');
      const cats = getCategories();
      setCategories(['all', ...cats.map(c => c.name)]);
    };
    loadCats();
  }, []);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // ── CAISSE : ouverture/fermeture de service ────────────────
  const loadCaisseFromStorage = (): CaisseSession => {
    try {
      const saved = localStorage.getItem('barflow_caisse_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { isOpen: false, fondCaisse: 0, serverName: '', openedAt: null, closedAt: null };
  };

  const [caisseSession, setCaisseSession] = useState<CaisseSession>(loadCaisseFromStorage);
  const [showCaisseModal, setShowCaisseModal] = useState(false);
  const [showFermetureModal, setShowFermetureModal] = useState(false);
  const [showCaisseHistory, setShowCaisseHistory] = useState(false);
  const [fondCaisseInput, setFondCaisseInput] = useState('');
  const [serverNameInput, setServerNameInput] = useState('');
  const [montantCompteInput, setMontantCompteInput] = useState('');

  // ── Historique caisse 35 jours ────────────────────────────
  const loadCaisseHistory = (): CaisseHistoryEntry[] => {
    try {
      const saved = localStorage.getItem('barflow_caisse_history');
      if (!saved) return [];
      const all: CaisseHistoryEntry[] = JSON.parse(saved);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 35);
      return all.filter(e => new Date(e.openedAt) >= cutoff);
    } catch { return []; }
  };

  const [caisseHistory, setCaisseHistory] = useState<CaisseHistoryEntry[]>(loadCaisseHistory);

  const saveCaisseHistory = (entries: CaisseHistoryEntry[]) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 35);
    const filtered = entries.filter(e => new Date(e.openedAt) >= cutoff);
    setCaisseHistory(filtered);
    localStorage.setItem('barflow_caisse_history', JSON.stringify(filtered));
  };

  // ── Cancel order state ─────────────────────────────────────
  // ── Cancel order state ─────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const saveCaisse = (session: CaisseSession) => {
    setCaisseSession(session);
    localStorage.setItem('barflow_caisse_session', JSON.stringify(session));
  };

  const ouvrirCaisse = () => {
    const fond = parseFloat(fondCaisseInput.replace(/\s/g, '')) || 0;
    if (fond <= 0) return;
    const session: CaisseSession = {
      isOpen: true,
      fondCaisse: fond,
      serverName: serverNameInput.trim(),
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    saveCaisse(session);
    setShowCaisseModal(false);
    setFondCaisseInput('');
    setServerNameInput('');
  };

  const fermerCaisse = () => {
    const now = new Date().toISOString();
    const compte = parseFloat(montantCompteInput) || 0;
    const ecart = montantCompteInput !== '' ? compte - totalCaisseAttendu : null;
    const entry: CaisseHistoryEntry = {
      id: `caisse-${Date.now()}`,
      fondCaisse: caisseSession.fondCaisse,
      serverName: caisseSession.serverName,
      openedAt: caisseSession.openedAt || now,
      closedAt: now,
      recettesEspeces: recettesEspecesService,
      totalAttendu: totalCaisseAttendu,
      montantCompte: montantCompteInput !== '' ? compte : null,
      ecart,
      nbCommandes: allHistory.filter(o =>
        caisseSession.openedAt && new Date(o.createdAt) >= new Date(caisseSession.openedAt)
      ).length,
      caTotal: allHistory
        .filter(o => caisseSession.openedAt && new Date(o.createdAt) >= new Date(caisseSession.openedAt))
        .reduce((s, o) => s + o.total, 0),
    };
    saveCaisseHistory([entry, ...caisseHistory]);
    const session: CaisseSession = { ...caisseSession, isOpen: false, closedAt: now };
    saveCaisse(session);
    setMontantCompteInput('');
    setShowFermetureModal(false);
  };

  // ── Annulation commande avec mot de passe ─────────────────
  const openCancelOrder = (order: Order) => {
    setCancelTargetOrder(order);
    setCancelPassword('');
    setCancelPasswordError('');
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!cancelTargetOrder) return;
    try {
      const { cancelOrder } = await import('@/utils/orderStore');
      await cancelOrder(cancelTargetOrder.id);
      setOrders(prev => prev.filter(o => o.id !== cancelTargetOrder.id));
      setManagedTables(prev => prev.map(table =>
        table.number === cancelTargetOrder.tableNumber
          ? { ...table, status: 'libre' as const, currentOrder: undefined }
          : table
      ));
      setShowCancelModal(false);
      setShowOrderDetail(null);
      setCancelTargetOrder(null);
    } catch (e) {
      console.error('Erreur annulation commande:', e);
    }
  };

  // ── Commandes persistées depuis IndexedDB ──────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);

  // Charger les commandes actives au démarrage
  useEffect(() => {
    loadActiveOrders().then(active => {
      setOrders(active.map(toOrder));
    });
    loadOrderHistory(30).then(hist => {
      setHistory(hist.map(toOrder));
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showArdoise, setShowArdoise] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [managedTables, setManagedTables] = useState<TableStatus[]>(defaultTables);
  const [showValidationChoice, setShowValidationChoice] = useState(false);
  const [showTableManager, setShowTableManager] = useState(false);
  const [editingTable, setEditingTable] = useState<TableStatus | null>(null);
  const [tableForm, setTableForm] = useState({ number: '', seats: '4', status: 'libre' as TableStatus['status'] });
  const [showOrderDetail, setShowOrderDetail] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { barInfo } = useBarInfo();

  useEffect(() => {
    if (products && products.length > 0) setIsLoading(false);
  }, [products]);

  useEffect(() => {
    setSelectedSupplements([]);
  }, [selectedProduct]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const safeProducts = products || [];
  const filteredProducts = safeProducts.filter(p => {
    if (!p) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const isProductOutOfStock = (product: Product): boolean => {
    if (product.stock <= 0) return true;
    try {
      const prediction = predictStockRupture(product);
      return prediction.status === 'rupture';
    } catch {
      return product.stock <= 0;
    }
  };

  const isCaisseOpen = (): boolean => {
    if (!caisseSession.isOpen) {
      setErrorMessage("🔒 Ouvrez d'abord la caisse pour commencer le service !");
      setShowCaisseModal(true);
      return false;
    }
    return true;
  };

  const isTableSelected = (): boolean => {
    if (!isCaisseOpen()) return false;
    if (selectedTable === null) {
      setErrorMessage("❌ Veuillez d'abord sélectionner une table !");
      setShowTablePicker(true);
      return false;
    }
    return true;
  };

  const addToCart = useCallback((product: Product, format: keyof Product['prices'] = 'bouteille', supplements: string[] = []) => {
    if (!caisseSession.isOpen) {
      setErrorMessage("🔒 Ouvrez d'abord la caisse pour commencer le service !");
      setShowCaisseModal(true);
      return;
    }
    if (!isTableSelected()) return;
    if (isProductOutOfStock(product)) return;
    const price = product.prices?.[format] || 0;
    if (price === 0) return;

    // Calcul du volume en cl déduit pour ce format (0 si pas de volumeConfig)
    const clDeduitsParUnite = product.volumeConfig
      ? getClPourFormat(format as OrderItem['format'], product.volumeConfig)
      : 0;

    const existingIdx = cartItems.findIndex(i => i.productId === product.id && i.format === format);
    if (existingIdx >= 0) {
      const newItems = [...cartItems];
      newItems[existingIdx] = {
        ...newItems[existingIdx],
        quantity: newItems[existingIdx].quantity + 1,
        supplements: supplements.length > 0 ? supplements : newItems[existingIdx].supplements,
      };
      setCartItems(newItems);
    } else {
      setCartItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        format: format as OrderItem['format'],
        unitPrice: price,
        supplements: supplements.length > 0 ? supplements : undefined,
        clDeduitsParUnite: clDeduitsParUnite > 0 ? clDeduitsParUnite : undefined,
      }]);
    }
  }, [cartItems, selectedTable]);

  const updateQty = (idx: number, delta: number) => {
    const newItems = [...cartItems];
    const newQty = newItems[idx].quantity + delta;
    if (newQty <= 0) {
      setCartItems(newItems.filter((_, i) => i !== idx));
    } else {
      newItems[idx] = { ...newItems[idx], quantity: newQty };
      setCartItems(newItems);
    }
  };

  // ── Créer et persister une commande ───────────────────────
  const createOrder = async (flow: 'later' | 'now') => {
    if (!selectedTable) return;
    const total = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Ardoise existante sur la table ?
    const existingOrder = orders.find(o =>
      o.tableNumber === selectedTable &&
      (o.status === 'en_attente' || o.status === 'en_cours')
    );

    if (existingOrder && flow === 'later') {
      // Fusionner avec l'ardoise existante
      const mergedItems = [...existingOrder.items];
      cartItems.forEach(newItem => {
        const idx = mergedItems.findIndex(i => i.productId === newItem.productId && i.format === newItem.format);
        if (idx >= 0) {
          mergedItems[idx] = { ...mergedItems[idx], quantity: mergedItems[idx].quantity + newItem.quantity };
        } else {
          mergedItems.push(newItem as any);
        }
      });
      const newTotal = mergedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const updated: PersistedOrder = {
        id: existingOrder.id,
        items: mergedItems,
        tableNumber: existingOrder.tableNumber,
        server: existingOrder.server,
        status: 'en_attente',
        createdAt: existingOrder.createdAt.toISOString(),
        total: newTotal,
        comment: existingOrder.comment,
      };
      await saveOrder(updated);
      setOrders(prev => prev.map(o => o.id === existingOrder.id ? toOrder(updated) : o));
      setCartItems([]);
      setShowCartSheet(false);
      setShowValidationChoice(false);
      return;
    }

    const newOrderId = `CMD-${Date.now().toString(36).toUpperCase()}`;
    const persisted: PersistedOrder = {
      id: newOrderId,
      items: cartItems.map(i => ({ ...i })),
      tableNumber: selectedTable,
      server: caisseSession.serverName || 'Serveur',
      status: flow === 'later' ? 'en_attente' : 'en_cours',
      createdAt: new Date().toISOString(),
      total,
      comment: flow === 'later' ? 'Ardoise - paiement plus tard' : 'Paiement immédiat',
    };

    await saveOrder(persisted);
    const asOrder = toOrder(persisted);

    setOrders(prev => [asOrder, ...prev]);
    setManagedTables(prev => prev.map(table =>
      table.number === selectedTable
        ? { ...table, status: flow === 'later' ? 'occupée' : 'en_attente', currentOrder: newOrderId }
        : table
    ));
    setCartItems([]);
    setShowCartSheet(false);
    setShowValidationChoice(false);

    if (flow === 'now') {
      setShowOrderDetail(asOrder);
      setPayingOrder(asOrder);
      setShowPayment(true);
    }
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return;
    if (!isTableSelected()) return;
    setShowValidationChoice(true);
  };

  // ── Paiement : persiste + décrémente stock en unités ET en cl ──
  const handlePayment = async (method: string) => {
    if (!payingOrder) return;

    await payOrder(
      payingOrder.id,
      method,
      async (productId: string, deltaStock: number, deltaCl: number) => {
        // deltaStock < 0 = consommation en bouteilles/unités
        // deltaCl    < 0 = consommation en centilitres (0 si pas de volumeConfig)
        const prod = safeProducts.find(p => p.id === productId);
        if (!prod) return;

        const updatePayload: any = {
          ...prod,
          stock: Math.max(0, prod.stock + deltaStock),
        };

        // Si le produit a un stock en cl : déduire en cl (plus précis)
        if (prod.volumeConfig && prod.stockCl != null && deltaCl !== 0) {
          updatePayload.stockCl = Math.max(0, prod.stockCl + deltaCl);
          // Recalculer stock en bouteilles depuis stockCl
          updatePayload.stock = updatePayload.stockCl / prod.volumeConfig.contenanceCl;
        }

        await universalSync.updateProduit(productId, updatePayload);
      }
    );

    // Mettre à jour le state local
    const paidOrder = { ...payingOrder, status: 'payé' as const, paymentMethod: method as Order['paymentMethod'] };
    setOrders(prev => prev.map(o => o.id === payingOrder.id ? paidOrder : o));
    setHistory(prev => [paidOrder, ...prev]);

    setManagedTables(prev => prev.map(table =>
      table.number === payingOrder.tableNumber
        ? { ...table, status: 'libre', currentOrder: undefined }
        : table
    ));

    setShowPayment(false);

    // Fermer automatiquement le détail commande après paiement
    setShowOrderDetail(null);

    setPayingOrder(null);
  };

  const printTicket = (order: Order) => {
    if (order.status !== 'payé') {
      setErrorMessage("❌ Le ticket ne peut être imprimé qu'après paiement !");
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setErrorMessage("❌ Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }
    const barName = barInfo.name || 'BARFLOW';
    const barAddress = barInfo.address ? `<p>📍 ${barInfo.address}</p>` : '';
    const barPhone = barInfo.phone ? `<p>📞 ${barInfo.phone}</p>` : '';
    const barTax = barInfo.taxNumber ? `<p>🏷️ NIF: ${barInfo.taxNumber}</p>` : '';

    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Ticket - ${order.id}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h1 { font-size: 18px; margin: 0; }
        .header p { margin: 5px 0; }
        .items { width: 100%; margin: 10px 0; }
        .items th, .items td { text-align: left; padding: 4px 0; }
        .text-right { text-align: right; }
        .total { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; text-align: right; }
        .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 10px; }
      </style></head><body>
      <div class="header">
        <h1>🍺 ${barName}</h1>
        ${barAddress}${barPhone}${barTax}
        <p>Ticket de caisse</p>
        <p>${new Date(order.createdAt).toLocaleString('fr-FR')}</p>
        <p>Table ${order.tableNumber}</p>
        <p>Commande: ${order.id}</p>
      </div>
      <table class="items">
        <thead><tr><th>Produit</th><th>Qté</th><th class="text-right">Prix</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${item.productName}${(item as any).supplements ? ' (+' + (item as any).supplements.join(', ') + ')' : ''}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${item.unitPrice.toLocaleString()} F</td>
              <td class="text-right">${(item.quantity * item.unitPrice).toLocaleString()} F</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total"><strong>TOTAL: ${order.total.toLocaleString()} FCFA</strong></div>
      <div class="footer">
        <p>Merci de votre visite !</p>
        <p>Règlement par ${order.paymentMethod === 'espèces' ? 'Espèces' : order.paymentMethod === 'wave' ? 'Wave' : order.paymentMethod === 'orange_money' ? 'Orange Money' : 'Carte'}</p>
      </div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const closeOrderDetail = (order: Order) => {
    if (order.status === 'payé') {
      setShowOrderDetail(null);
    } else {
      setErrorMessage("❌ Veuillez d'abord payer la commande avant de fermer !");
    }
  };

  const startEditTable = (table: TableStatus) => {
    setEditingTable(table);
    setTableForm({ number: String(table.number), seats: String(table.seats), status: table.status });
  };

  const resetTableForm = () => {
    setEditingTable(null);
    setTableForm({ number: '', seats: '4', status: 'libre' });
  };

  const saveTable = () => {
    const number = parseInt(tableForm.number);
    const seats = parseInt(tableForm.seats);
    if (isNaN(number) || isNaN(seats) || number <= 0 || seats <= 0) return;
    if (editingTable) {
      setManagedTables(prev => prev.map(table =>
        table.number === editingTable.number
          ? { ...table, number, seats, status: tableForm.status }
          : table
      ));
      if (selectedTable === editingTable.number) setSelectedTable(number);
    } else if (!managedTables.some(table => table.number === number)) {
      setManagedTables(prev => [...prev, { number, seats, status: tableForm.status, x: 0, y: 0 }].sort((a, b) => a.number - b.number));
      setSelectedTable(number);
    }
    resetTableForm();
  };

  const deleteTable = (tableNumber: number) => {
    if (managedTables.length <= 1) return;
    if (!window.confirm(`Supprimer la table ${tableNumber} ?`)) return;
    const nextTables = managedTables.filter(table => table.number !== tableNumber);
    setManagedTables(nextTables);
    if (selectedTable === tableNumber && nextTables[0]) setSelectedTable(nextTables[0].number);
  };

  const cartTotal = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const activeOrders = orders.filter(o => o.status !== 'payé' && o.status !== 'annulé');
  const ardoises = orders.filter(o => o.status === 'en_attente');
  const allHistory = [...history.filter(o => o.status === 'payé'), ...orders.filter(o => o.status === 'payé')];

  // Recettes espèces du service courant (depuis ouverture caisse)
  const recettesEspecesService = useMemo(() => {
    const openedAt = caisseSession.openedAt ? new Date(caisseSession.openedAt) : null;
    if (!openedAt) return 0;
    return allHistory
      .filter(o => o.paymentMethod === 'espèces' && new Date(o.createdAt) >= openedAt)
      .reduce((s, o) => s + o.total, 0);
  }, [allHistory, caisseSession.openedAt]);

  const totalCaisseAttendu = caisseSession.fondCaisse + recettesEspecesService;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative overflow-hidden bg-slate-50">
      {errorMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg animate-bounce">
          {errorMessage}
        </div>
      )}

      {/* COLONNE GAUCHE : Produits */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 lg:p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Commandes</h1>
              <p className="text-xs text-slate-500">
                {caisseSession.isOpen
                  ? `🟢 Caisse ouverte${caisseSession.serverName ? ` · ${caisseSession.serverName}` : ''} · Fond : ${caisseSession.fondCaisse.toLocaleString()} FCFA`
                  : selectedTable ? `Table ${selectedTable} sélectionnée` : '🔒 Caisse fermée — ouvrez la caisse pour commencer'
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* BOUTON CAISSE */}
              {caisseSession.isOpen ? (
                <button
                  onClick={() => setShowFermetureModal(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  <DoorClosed size={16} />
                  <span className="hidden sm:inline">Fermer caisse</span>
                  <span className="sm:hidden">Caisse</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowCaisseModal(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md flex items-center gap-2 active:scale-95 transition-all animate-pulse"
                >
                  <DoorOpen size={16} />
                  <span className="hidden sm:inline">Ouvrir caisse</span>
                  <span className="sm:hidden">Caisse</span>
                </button>
              )}
              {/* Ardoise badge */}
              {ardoises.length > 0 && (
                <button
                  onClick={() => setShowArdoise(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  <BookOpen size={16} />
                  Ardoises ({ardoises.length})
                </button>
              )}
              <button
                onClick={() => setShowCaisseHistory(true)}
                className="px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 active:scale-95"
                title="Historique caisses"
              >
                <History size={15} />
                <span className="hidden sm:inline">Historique</span>
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md flex items-center gap-2 active:scale-95"
              >
                <Receipt size={16} />
                Commandes
              </button>
              <button
                onClick={() => setShowTablePicker(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md flex items-center gap-2 active:scale-95"
              >
                <Table2 size={16} />
                {selectedTable ? `Table ${selectedTable}` : 'Choisir une table'}
              </button>
            </div>
          </div>

          <div className="relative mb-2.5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95',
                  selectedCategory === cat
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200',
                )}
              >
                {cat === 'all' ? '📋 Tous' : `${getCategoryEmoji(cat) || '🏷️'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 relative">
          {/* ── CAISSE FERMÉE : overlay bloquant ──────────────── */}
          {!caisseSession.isOpen && (
            <div className="absolute inset-0 z-10 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-none">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Lock size={36} className="text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Caisse fermée</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Ouvrez la caisse et renseignez le fond de caisse pour commencer à prendre des commandes.
                </p>
                <button
                  onClick={() => setShowCaisseModal(true)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
                >
                  <DoorOpen size={20} />
                  Ouvrir la caisse
                </button>
              </div>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Search size={40} className="mb-2 opacity-30" />
              <p className="text-sm font-medium">Aucun produit trouvé</p>
              <p className="text-xs mt-1">Modifiez vos filtres ou ajoutez des produits dans Stocks</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {filteredProducts.map(product => {
                const isOutOfStock = (product.stock || 0) <= 0;
                let prediction = null;
                if (!isOutOfStock) {
                  try {
                    if (typeof predictStockRupture === 'function') {
                      prediction = predictStockRupture(product);
                    }
                  } catch {}
                }
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (!caisseSession.isOpen) {
                        setShowCaisseModal(true);
                        return;
                      }
                      if (!selectedTable) {
                        setErrorMessage("❌ Veuillez d'abord sélectionner une table !");
                        setShowTablePicker(true);
                        return;
                      }
                      if (!isOutOfStock) setSelectedProduct(product);
                    }}
                    disabled={isOutOfStock}
                    className={cn(
                      'bg-white rounded-2xl border p-3 hover:shadow-lg transition-all text-left group',
                      isOutOfStock
                        ? 'border-red-200 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-violet-200 active:scale-[0.96]'
                    )}
                  >
                    <div
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-4xl mb-2 overflow-hidden"
                      style={{ backgroundColor: isOutOfStock ? '#f1f5f9' : `${product.color || '#8B5CF6'}15` }}
                    >
                      {product.photo ? (
                        <img src={product.photo} alt="" className={cn('w-full h-full object-cover transition-transform duration-200', !isOutOfStock && 'group-hover:scale-110')} />
                      ) : (
                        <span className={cn('transition-transform duration-200', !isOutOfStock && 'group-hover:scale-110')}>
                          {product.image || '📦'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-violet-700">
                        {((product.prices?.bouteille ?? product.prices?.verre ?? product.prices?.demi ?? product.prices?.quart ?? product.prices?.canette) ?? 0).toLocaleString()} F
                      </span>
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        isOutOfStock ? 'bg-red-100 text-red-700' :
                        (product.stock || 0) <= (product.seuilCritique || 0) ? 'bg-red-100 text-red-700' :
                        (product.stock || 0) <= (product.seuilAlerte || 0) ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      )}>
                        {isOutOfStock ? 'RUPTURE' : product.volumeConfig && product.stockCl != null
                          ? `${Math.floor(product.stockCl / product.volumeConfig.contenanceCl)}btl/${Math.round(product.stockCl % product.volumeConfig.contenanceCl)}cl`
                          : product.stock}
                      </span>
                    </div>
                    {isOutOfStock ? (
                      <p className="text-[10px] text-red-600 mt-1 text-center font-medium">🔴 En rupture</p>
                    ) : (
                      prediction && prediction.status === 'critical' && (
                        <p className="text-[10px] text-amber-600 mt-1 text-center">{prediction.message}</p>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* COLONNE DROITE : Commandes en cours */}
      <div className="hidden lg:flex w-96 bg-white border-l border-slate-200 flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-violet-600" />
            <h2 className="font-semibold text-slate-900">Commandes en cours</h2>
            <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">
              {activeOrders.length} commande(s)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Cliquez sur une commande pour voir les détails</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <Receipt size={40} className="mb-2 opacity-50" />
              <p className="text-sm">Aucune commande en cours</p>
            </div>
          ) : (
            activeOrders.map(order => (
              <div
                key={order.id}
                onClick={() => setShowOrderDetail(order)}
                className={cn(
                  'rounded-xl p-3 hover:shadow-md transition-all cursor-pointer border',
                  order.status === 'en_attente'
                    ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                    : 'bg-slate-50 border-slate-200 hover:border-violet-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                      order.status === 'en_attente' ? 'bg-amber-100' : 'bg-violet-100'
                    )}>
                      {order.status === 'en_attente'
                        ? <BookOpen size={14} className="text-amber-600" />
                        : <Table2 size={14} className="text-violet-600" />
                      }
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Table {order.tableNumber}</p>
                      <p className="text-[10px] text-slate-400">{order.items.length} article(s)
                        {order.status === 'en_attente' && <span className="ml-1 text-amber-600 font-semibold">· ARDOISE</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-violet-700">{order.total.toLocaleString()} F</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-1">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <span key={idx} className="text-[10px] bg-white px-2 py-0.5 rounded-full text-slate-600">
                      {item.quantity}x {item.productName}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span className="text-[10px] text-slate-400">+{order.items.length - 3} autres</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-slate-100 bg-white flex flex-col max-h-[55%]">
            {/* Header panier */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                🛒 Panier — Table {selectedTable}
              </span>
              <span className="text-sm font-bold text-violet-700">{cartTotal.toLocaleString()} F</span>
            </div>

            {/* Liste articles scrollable */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.productName}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{item.format} · {item.unitPrice.toLocaleString()} F</p>
                  </div>
                  {/* Contrôles quantité */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, +1)}
                      className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  {/* Total ligne */}
                  <span className="text-xs font-bold text-violet-700 w-16 text-right shrink-0">
                    {(item.quantity * item.unitPrice).toLocaleString()} F
                  </span>
                  {/* Supprimer */}
                  <button
                    onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                    className="w-6 h-6 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-all shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer : total + valider */}
            <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{cartCount} article(s)</span>
                <span className="text-lg font-black text-slate-900">{cartTotal.toLocaleString()} FCFA</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCartItems([])}
                  className="px-3 py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  Vider
                </button>
                <button
                  onClick={submitOrder}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Check size={15} />
                  Valider la commande
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ARDOISES */}
      {showArdoise && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowArdoise(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-2xl w-full max-h-[80vh] shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Ardoises en cours</h3>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                  {ardoises.reduce((s, o) => s + o.total, 0).toLocaleString()} FCFA total
                </span>
              </div>
              <button onClick={() => setShowArdoise(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              ⚠️ Ces clients ont consommé mais n'ont pas encore payé. Ils règleront à la fermeture ou au départ.
            </p>
            <div className="space-y-3">
              {ardoises.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Aucune ardoise en cours</p>
              ) : ardoises.map(order => (
                <div key={order.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-slate-800">Table {order.tableNumber}</p>
                      <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                    </div>
                    <p className="text-lg font-bold text-amber-700">{order.total.toLocaleString()} F</p>
                  </div>
                  <div className="space-y-1 mb-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-600">
                        <span>{item.quantity}x {item.productName}</span>
                        <span>{(item.quantity * item.unitPrice).toLocaleString()} F</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { openCancelOrder(order); setShowArdoise(false); }}
                      className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-1.5 border border-red-200"
                    >
                      <Trash2 size={14} /> Annuler
                    </button>
                    <button
                      onClick={() => {
                        setPayingOrder(order);
                        setShowPayment(true);
                        setShowArdoise(false);
                      }}
                      className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <CreditCard size={16} /> Encaisser maintenant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DÉTAIL COMMANDE */}
      {showOrderDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowOrderDetail(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Détail de la commande</h3>
                <p className="text-xs text-slate-500">Table {showOrderDetail.tableNumber} · {showOrderDetail.id}</p>
              </div>
              <button onClick={() => setShowOrderDetail(null)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-600">📅 {new Date(showOrderDetail.createdAt).toLocaleString('fr-FR')}</span>
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full',
                showOrderDetail.status === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                showOrderDetail.status === 'en_attente' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {showOrderDetail.status === 'payé' ? '✅ Payé' : showOrderDetail.status === 'en_attente' ? '📋 Ardoise' : '🔄 En cours'}
              </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto mb-4">
              {showOrderDetail.items.map((item, idx) => {
                const product = safeProducts.find(p => p.id === item.productId);
                return (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <ProductThumb product={product || {}} size="sm" />
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.format} · {item.quantity} × {item.unitPrice.toLocaleString()} F</p>
                    </div>
                    <p className="font-bold text-violet-700">{(item.quantity * item.unitPrice).toLocaleString()} F</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">TOTAL</span>
                <span className="text-2xl font-bold text-violet-700">{showOrderDetail.total.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => printTicket(showOrderDetail)}
                disabled={showOrderDetail.status !== 'payé'}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  showOrderDetail.status === 'payé'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Printer size={16} /> Imprimer ticket
              </button>
              {showOrderDetail.status === 'payé' ? (
                <button
                  onClick={() => setShowOrderDetail(null)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md flex items-center justify-center gap-2"
                >
                  <Check size={16} /> Fermer
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { openCancelOrder(showOrderDetail); }}
                    className="py-3 px-4 rounded-xl font-semibold text-sm bg-red-50 text-red-600 border border-red-200 flex items-center justify-center gap-1.5 hover:bg-red-100 transition-all"
                  >
                    <Trash2 size={15} /> Annuler
                  </button>
                  <button
                    onClick={() => { setPayingOrder(showOrderDetail); setShowPayment(true); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md flex items-center justify-center gap-2"
                  >
                    <CreditCard size={16} /> Payer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DÉTAIL PRODUIT */}
      {selectedProduct && !isProductOutOfStock(selectedProduct) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <ProductThumb product={selectedProduct} size="lg" className="text-3xl" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedProduct.name}</h3>
                  <p className="text-xs text-slate-500 capitalize">{selectedProduct.category}</p>
                  <p className="text-xs text-slate-500">Stock: <strong className={cn(
                    selectedProduct.stock <= selectedProduct.seuilCritique ? 'text-red-600' :
                    selectedProduct.stock <= selectedProduct.seuilAlerte ? 'text-amber-600' : 'text-emerald-600'
                  )}>{selectedProduct.stock} {selectedProduct.stockUnit || 'unités'}</strong></p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>

            {selectedProduct.options?.supplements && selectedProduct.options.supplements.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">Options / Suppléments :</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.options.supplements.map((sup: string) => (
                    <button
                      key={sup}
                      onClick={() => setSelectedSupplements(prev =>
                        prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
                      )}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        selectedSupplements.includes(sup)
                          ? 'bg-violet-100 border-violet-300 text-violet-800'
                          : 'bg-white border-slate-200 text-slate-600'
                      )}
                    >
                      {selectedSupplements.includes(sup) ? '✓ ' : ''}{sup}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`grid gap-2 mb-3 ${(selectedProduct.activePriceFormats || ['bouteille']).length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {(selectedProduct.activePriceFormats || ['bouteille']).map((format) => {
                const price = selectedProduct.prices?.[format];
                if (!price) return null;
                return (
                  <button
                    key={format}
                    onClick={() => { addToCart(selectedProduct, format, selectedSupplements); setSelectedProduct(null); }}
                    className="p-3 rounded-xl border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 active:scale-[0.97] transition-all text-center"
                  >
                    <p className="text-sm font-bold text-slate-800 capitalize">{format}</p>
                    <p className="text-sm text-violet-700 font-bold mt-0.5">{price.toLocaleString()} F</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 5, 10].map(qty => {
                const defaultFormat = selectedProduct.activePriceFormats?.[0] || 'bouteille';
                return (
                  <button
                    key={qty}
                    onClick={() => {
                      for (let i = 0; i < qty; i++) addToCart(selectedProduct, defaultFormat, selectedSupplements);
                      setSelectedProduct(null);
                    }}
                    className="py-3 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 hover:bg-violet-100 active:scale-95 transition-all"
                  >
                    +{qty}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TABLE PICKER MODAL */}
      {showTablePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowTablePicker(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-2xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Plan de salle</h3>
                <p className="text-xs text-slate-500">Choisissez une table pour commencer</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTableManager(true)} className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold flex items-center gap-1.5">
                  <Settings size={14} /> Gérer
                </button>
                <button onClick={() => setShowTablePicker(false)} className="text-slate-400 p-1"><X size={20} /></button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {managedTables.map(table => (
                <button
                  key={table.number}
                  onClick={() => { setSelectedTable(table.number); setShowTablePicker(false); }}
                  className={cn(
                    'p-3 rounded-xl border-2 text-center transition-all active:scale-95',
                    selectedTable === table.number ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : '',
                    table.status === 'libre' ? 'border-emerald-200 bg-emerald-50' :
                    table.status === 'occupée' ? 'border-red-200 bg-red-50' :
                    'border-amber-200 bg-amber-50',
                  )}
                >
                  <p className="text-lg font-bold text-slate-800">{table.number}</p>
                  <p className="text-[10px] font-semibold mt-0.5">
                    {table.status === 'libre' ? 'Libre' : table.status === 'occupée' ? 'Occupé' : 'En attente'}
                  </p>
                  <p className="text-[10px] text-slate-500">{table.seats} pers.</p>
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Occupé</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> En attente</span>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-3xl w-full max-h-[80vh] shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Historique des commandes</h3>
                <p className="text-xs text-slate-500">30 derniers jours · {allHistory.length} commandes payées</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>

            {/* Résumé rapide */}
            {allHistory.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Total encaissé</p>
                  <p className="text-lg font-bold text-violet-700">
                    {allHistory.reduce((s, o) => s + o.total, 0).toLocaleString()} F
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Commandes</p>
                  <p className="text-lg font-bold text-emerald-700">{allHistory.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Ticket moyen</p>
                  <p className="text-lg font-bold text-blue-700">
                    {allHistory.length > 0 ? Math.round(allHistory.reduce((s, o) => s + o.total, 0) / allHistory.length).toLocaleString() : 0} F
                  </p>
                </div>
              </div>
            )}

            {allHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Receipt size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucune commande payée pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                  <div
                    key={order.id}
                    onClick={() => { setShowOrderDetail(order); setShowHistory(false); }}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-violet-200 hover:bg-violet-50/30 transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{order.id}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Payé</span>
                        {order.paymentMethod && (
                          <span className="text-[10px] text-slate-500">
                            {order.paymentMethod === 'wave' ? '📱 Wave' : order.paymentMethod === 'orange_money' ? '📱 OM' : order.paymentMethod === 'carte' ? '💳' : '💵'} {order.paymentMethod !== 'wave' && order.paymentMethod !== 'orange_money' && order.paymentMethod !== 'carte' ? order.paymentMethod : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Table {order.tableNumber} · {order.items.length} articles · {new Date(order.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 ml-3">{order.total.toLocaleString()} F</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VALIDATION CHOICE MODAL */}
      {showValidationChoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowValidationChoice(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Valider la commande</h3>
                <p className="text-xs text-slate-500 mt-0.5">Table {selectedTable} · {cartTotal.toLocaleString()} FCFA</p>
              </div>
              <button onClick={() => setShowValidationChoice(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            {orders.some(o => o.tableNumber === selectedTable && (o.status === 'en_attente' || o.status === 'en_cours')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-amber-800">📋 Note ouverte sur la Table {selectedTable}</p>
                <p className="text-xs text-amber-600 mt-1">Les articles seront ajoutés à l'ardoise existante.</p>
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => createOrder('later')} className="w-full p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 text-left active:scale-[0.98] transition-transform">
                <p className="text-sm font-bold text-amber-900">📋 Mettre sur ardoise</p>
                <p className="text-xs text-amber-700 mt-1">La table reste occupée. Le client paiera plus tard.</p>
              </button>
              <button onClick={() => createOrder('now')} className="w-full p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-left active:scale-[0.98] transition-transform">
                <p className="text-sm font-bold text-emerald-900">💳 Payer tout de suite</p>
                <p className="text-xs text-emerald-700 mt-1">Encaissement immédiat : Espèces, Wave ou Orange Money.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE MANAGER MODAL */}
      {showTableManager && (
        <div className="fixed inset-0 bg-black/50 z-[55] flex items-end sm:items-center justify-center" onClick={() => setShowTableManager(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-3xl w-full max-h-[85vh] shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Gestion des tables</h3>
                <p className="text-xs text-slate-500">Ajoutez, modifiez ou supprimez des tables.</p>
              </div>
              <button onClick={() => setShowTableManager(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid lg:grid-cols-[1fr_260px] gap-4">
              <div className="space-y-2">
                {managedTables.map(table => (
                  <div key={table.number} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border',
                        table.status === 'libre' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        table.status === 'occupée' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200',
                      )}>{table.number}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Table {table.number}</p>
                        <p className="text-xs text-slate-500">{table.seats} places · {table.status === 'libre' ? 'Libre' : table.status === 'occupée' ? 'Occupé' : 'En attente'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditTable(table)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1"><Edit3 size={14} /> Modifier</button>
                      <button onClick={() => deleteTable(table.number)} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1"><Trash2 size={14} /> Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 h-fit">
                <h4 className="text-sm font-bold text-slate-900 mb-3">{editingTable ? `Modifier table ${editingTable.number}` : 'Ajouter une table'}</h4>
                <div className="space-y-3">
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Numéro</label><input type="number" min={1} value={tableForm.number} onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="Ex: 16" /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Nombre de places</label><input type="number" min={1} value={tableForm.seats} onChange={(e) => setTableForm({ ...tableForm, seats: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm" /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Statut</label><select value={tableForm.status} onChange={(e) => setTableForm({ ...tableForm, status: e.target.value as TableStatus['status'] })} className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white"><option value="libre">Libre</option><option value="occupée">Occupé</option><option value="en_attente">En attente</option></select></div>
                  <button onClick={saveTable} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm">{editingTable ? 'Enregistrer' : 'Ajouter la table'}</button>
                  {editingTable && <button onClick={resetTableForm} className="w-full py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm">Annuler</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPayment && payingOrder && (
        <PaymentModal
          orderId={payingOrder.id}
          total={payingOrder.total}
          onClose={() => { setShowPayment(false); setPayingOrder(null); }}
          onConfirm={handlePayment}
          allowedMethods={['espèces', 'wave', 'orange_money']}
        />
      )}

      {/* ── MODAL ANNULATION COMMANDE (protégée par mot de passe) ── */}
      {showCancelModal && cancelTargetOrder && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 text-white text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Shield size={28} />
              </div>
              <h2 className="text-xl font-bold">Annuler la commande</h2>
              <p className="text-red-100 text-sm mt-1">Table {cancelTargetOrder.tableNumber} · {cancelTargetOrder.total.toLocaleString()} FCFA</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Rappel des articles */}
              <div className="bg-slate-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                {cancelTargetOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-600 py-0.5">
                    <span>{item.quantity}× {item.productName}</span>
                    <span>{(item.quantity * item.unitPrice).toLocaleString()} F</span>
                  </div>
                ))}
              </div>

              {/* Motif (optionnel) */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Motif de l'annulation <span className="font-normal text-slate-400">(optionnel)</span></label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie, client a changé d'avis..."
                  autoFocus
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm"
                >
                  Garder la commande
                </button>
                <button
                  onClick={confirmCancelOrder}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
                >
                  <Trash2 size={16} /> Confirmer annulation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIQUE CAISSES (35 jours) ─────────────────── */}
      {showCaisseHistory && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4" onClick={() => setShowCaisseHistory(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-2">
                <History size={20} className="text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">Historique des caisses</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">35 derniers jours</span>
              </div>
              <button onClick={() => setShowCaisseHistory(false)} className="text-slate-400"><X size={20} /></button>
            </div>

            {/* Session en cours */}
            {caisseSession.isOpen && caisseSession.openedAt && (
              <div className="mx-5 mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-emerald-800">Service en cours</span>
                    {caisseSession.serverName && <span className="text-xs text-emerald-600">· {caisseSession.serverName}</span>}
                  </div>
                  <span className="text-xs text-emerald-600">
                    Ouverture : {new Date(caisseSession.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-slate-500">Fond caisse</p>
                    <p className="font-bold text-slate-800">{caisseSession.fondCaisse.toLocaleString()} F</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-slate-500">Recettes espèces</p>
                    <p className="font-bold text-blue-700">+{recettesEspecesService.toLocaleString()} F</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-slate-500">Total attendu</p>
                    <p className="font-bold text-emerald-700">{totalCaisseAttendu.toLocaleString()} F</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {caisseHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <History size={40} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">Aucun historique disponible</p>
                  <p className="text-xs mt-1">Les sessions fermées apparaîtront ici</p>
                </div>
              ) : (
                caisseHistory.map((entry, idx) => (
                  <CaisseHistoryCard key={entry.id} entry={entry} />
                ))
              )}
            </div>

            {/* Total général */}
            {caisseHistory.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="text-slate-500">Sessions ({caisseHistory.length})</p>
                  <p className="font-bold text-slate-800">{caisseHistory.length} ouvertures</p>
                </div>
                <div>
                  <p className="text-slate-500">CA total (35j)</p>
                  <p className="font-bold text-violet-700">{caisseHistory.reduce((s, e) => s + e.caTotal, 0).toLocaleString()} F</p>
                </div>
                <div>
                  <p className="text-slate-500">Espèces totales (35j)</p>
                  <p className="font-bold text-emerald-700">{caisseHistory.reduce((s, e) => s + e.recettesEspeces, 0).toLocaleString()} F</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL OUVERTURE DE CAISSE ─────────────────────────── */}
      {showCaisseModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowCaisseModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <DoorOpen size={32} />
              </div>
              <h2 className="text-2xl font-bold">Ouverture de caisse</h2>
              <p className="text-emerald-100 text-sm mt-1">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Fond de caisse */}
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-2">
                  <Banknote size={16} className="text-emerald-600" />
                  Fond de caisse (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={fondCaisseInput}
                  onChange={e => setFondCaisseInput(e.target.value)}
                  placeholder="Ex: 50 000"
                  autoFocus
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 text-xl font-bold text-center text-slate-900 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="text-xs text-slate-500 mt-1.5 text-center">Montant en espèces dans la caisse en début de service</p>
              </div>

              {/* Nom du serveur (optionnel) */}
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-2">
                  <ClipboardList size={16} className="text-slate-500" />
                  Nom du serveur <span className="text-xs font-normal text-slate-400">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={serverNameInput}
                  onChange={e => setServerNameInput(e.target.value)}
                  placeholder="Ex: Fatou, Jean-Pierre..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-400"
                />
              </div>

              {/* Bouton ouvrir */}
              <button
                onClick={ouvrirCaisse}
                disabled={!fondCaisseInput || parseFloat(fondCaisseInput) <= 0}
                className={cn(
                  'w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all',
                  fondCaisseInput && parseFloat(fondCaisseInput) > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <Check size={20} />
                Ouvrir la caisse
              </button>

              <button onClick={() => setShowCaisseModal(false)} className="w-full py-2.5 text-sm text-slate-500 font-medium hover:text-slate-700">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FERMETURE DE CAISSE ─────────────────────────── */}
      {showFermetureModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowFermetureModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-6 text-white text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                <DoorClosed size={32} />
              </div>
              <h2 className="text-2xl font-bold">Fermeture de caisse</h2>
              <p className="text-slate-300 text-sm mt-1">
                {caisseSession.openedAt
                  ? `Ouverture : ${new Date(caisseSession.openedAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                {caisseSession.serverName ? ` · ${caisseSession.serverName}` : ''}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Récapitulatif */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Wallet size={16} className="text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Fond de caisse</span>
                  </div>
                  <span className="text-base font-bold text-slate-900">{caisseSession.fondCaisse.toLocaleString()} F</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <TrendingUp size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-blue-800 block">Recettes en espèces</span>
                      <span className="text-xs text-blue-500">{allHistory.filter(o => o.paymentMethod === 'espèces' && caisseSession.openedAt && new Date(o.createdAt) >= new Date(caisseSession.openedAt)).length} paiement(s)</span>
                    </div>
                  </div>
                  <span className="text-base font-bold text-blue-700">+{recettesEspecesService.toLocaleString()} F</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Banknote size={16} className="text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-emerald-800 block">Total attendu en caisse</span>
                      <span className="text-xs text-emerald-600">Fond + Espèces encaissées</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-700">{totalCaisseAttendu.toLocaleString()} F</span>
                </div>

                {/* Montant compté physiquement */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4">
                  <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-2">
                    <Banknote size={16} className="text-slate-500" />
                    Montant compté en caisse (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={montantCompteInput}
                    onChange={e => setMontantCompteInput(e.target.value)}
                    placeholder="Entrez le montant physique compté..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-base font-bold text-center text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                {/* Écart si montant saisi */}
                {montantCompteInput !== '' && (() => {
                  const compte = parseFloat(montantCompteInput) || 0;
                  const ecart = compte - totalCaisseAttendu;
                  const isOk = Math.abs(ecart) < 1;
                  return (
                    <div className={cn(
                      'flex justify-between items-center p-4 rounded-2xl border-2',
                      isOk ? 'bg-emerald-50 border-emerald-300' :
                      ecart < 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
                    )}>
                      <div>
                        <span className={cn('text-sm font-bold block',
                          isOk ? 'text-emerald-800' : ecart < 0 ? 'text-red-800' : 'text-amber-800'
                        )}>
                          {isOk ? '✅ Caisse exacte' : ecart < 0 ? '🔴 Trou de caisse' : '🟡 Excédent de caisse'}
                        </span>
                        <span className={cn('text-xs',
                          isOk ? 'text-emerald-600' : ecart < 0 ? 'text-red-600' : 'text-amber-600'
                        )}>
                          {isOk ? 'Tout est en ordre.' : ecart < 0
                            ? `Il manque ${Math.abs(ecart).toLocaleString()} FCFA`
                            : `Excédent de ${ecart.toLocaleString()} FCFA`}
                        </span>
                      </div>
                      <span className={cn('text-xl font-black',
                        isOk ? 'text-emerald-700' : ecart < 0 ? 'text-red-700' : 'text-amber-700'
                      )}>
                        {ecart >= 0 ? '+' : ''}{ecart.toLocaleString()} F
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Ardoises en cours ? */}
              {ardoises.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <BookOpen size={16} />
                    {ardoises.length} ardoise(s) encore ouvertes
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Montant total : {ardoises.reduce((s, o) => s + o.total, 0).toLocaleString()} FCFA — Pensez à les encaisser avant de fermer.
                  </p>
                </div>
              )}

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowFermetureModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={fermerCaisse}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  <DoorClosed size={16} />
                  Confirmer la fermeture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant carte historique caisse ────────────────────
function CaisseHistoryCard({ entry }: { entry: CaisseHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  const duration = entry.closedAt
    ? (() => {
        const ms = new Date(entry.closedAt).getTime() - new Date(entry.openedAt).getTime();
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${h}h${m.toString().padStart(2, '0')}`;
      })()
    : null;

  const dateStr = new Date(entry.openedAt).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <DoorClosed size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 capitalize">{dateStr}</p>
              <p className="text-xs text-slate-500">
                {new Date(entry.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {entry.closedAt
                  ? new Date(entry.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
                {duration && ` (${duration})`}
                {entry.serverName && ` · ${entry.serverName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-700">{entry.totalAttendu.toLocaleString()} F</p>
              <p className="text-xs text-slate-400">en caisse</p>
            </div>
            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Fond de caisse</p>
              <p className="text-base font-bold text-slate-800">{entry.fondCaisse.toLocaleString()} F</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Recettes espèces</p>
              <p className="text-base font-bold text-blue-700">+{entry.recettesEspeces.toLocaleString()} F</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Total attendu</p>
              <p className="text-base font-bold text-emerald-700">{entry.totalAttendu.toLocaleString()} F</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">CA total service</p>
              <p className="text-base font-bold text-violet-700">{entry.caTotal.toLocaleString()} F</p>
            </div>
          </div>

          {/* Montant compté + écart si disponible */}
          {entry.montantCompte !== null && entry.montantCompte !== undefined && (
            <div className={cn(
              'rounded-xl p-3 flex justify-between items-center',
              entry.ecart === 0 || (entry.ecart !== null && Math.abs(entry.ecart) < 1)
                ? 'bg-emerald-50 border border-emerald-200'
                : entry.ecart !== null && entry.ecart < 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-amber-50 border border-amber-200'
            )}>
              <div>
                <p className="text-xs font-semibold text-slate-700">Montant compté physiquement</p>
                <p className="text-base font-bold text-slate-900">{entry.montantCompte.toLocaleString()} F</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Écart</p>
                <p className={cn('text-base font-black',
                  entry.ecart !== null && Math.abs(entry.ecart) < 1 ? 'text-emerald-700' :
                  entry.ecart !== null && entry.ecart < 0 ? 'text-red-700' : 'text-amber-700'
                )}>
                  {entry.ecart !== null
                    ? `${entry.ecart >= 0 ? '+' : ''}${entry.ecart.toLocaleString()} F`
                    : '—'}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {entry.ecart !== null && Math.abs(entry.ecart) < 1 ? '✅ Exact' :
                   entry.ecart !== null && entry.ecart < 0 ? '🔴 Trou de caisse' : '🟡 Excédent'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs text-amber-700 font-medium">Nb commandes payées</span>
            <span className="text-sm font-bold text-amber-800">{entry.nbCommandes} commande(s)</span>
          </div>
        </div>
      )}
    </div>
  );
}
