// Orders.tsx - Version avec universalSync
import { useState, useCallback, useEffect } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Table2, Search,
  Check, Receipt, CreditCard, Settings, Edit3, Trash2, Printer,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { tables as defaultTables } from '@/data';
import { useCategories, getCategoryEmoji } from '@/utils/productStore';
import type { Product, OrderItem, Order, TableStatus } from '@/types';
import { PaymentModal } from '@/components/PaymentModal';
import { predictStockRupture } from '@/utils/stockPrediction';
import { useBarInfo } from '@/hooks/useBarInfo';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';

type CartItem = OrderItem & { supplements?: string[] };

export function Orders() {
  // Données en temps réel depuis universalSync
  const products = useLiveQuery(() => universalSync.getProduits(), []);
  
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [allCategories, setAllCategories] = useState<string[]>([]);

  useEffect(() => {
    const loadCats = async () => {
      const { getCategories } = await import('@/utils/productStore');
      const cats = getCategories();
      const catNames = cats.map(c => c.name);
      setAllCategories(catNames);
      setCategories(['all', ...catNames]);
    };
    loadCats();
  }, []);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
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
  const { barInfo, isLoading: barInfoLoading } = useBarInfo();

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
    } catch (error) {
      console.warn('Erreur lors de la prédiction:', error);
      return product.stock <= 0;
    }
  };

  const isTableSelected = (): boolean => {
    if (selectedTable === null) {
      setErrorMessage("❌ Veuillez d'abord sélectionner une table !");
      setShowTablePicker(true);
      return false;
    }
    return true;
  };

  const addToCart = useCallback((product: Product, format: keyof Product['prices'] = 'bouteille', supplements: string[] = []) => {
    if (!isTableSelected()) return;
    if (isProductOutOfStock(product)) return;
    
    const price = product.prices?.[format] || 0;
    if (price === 0) return;
    const existingIdx = cartItems.findIndex(i => i.productId === product.id && i.format === format);
    if (existingIdx >= 0) {
      const newItems = [...cartItems];
      newItems[existingIdx] = { 
        ...newItems[existingIdx], 
        quantity: newItems[existingIdx].quantity + 1,
        supplements: supplements.length > 0 ? supplements : newItems[existingIdx].supplements
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

  const createOrder = (flow: 'later' | 'now') => {
    if (!selectedTable) return;
    
    const total = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const existingOrder = orders.find(o =>
      o.tableNumber === selectedTable &&
      (o.status === 'en_attente' || o.status === 'en_cours')
    );

    if (existingOrder && flow === 'later') {
      const mergedItems = [...existingOrder.items];
      cartItems.forEach(newItem => {
        const existingIdx = mergedItems.findIndex(
          i => i.productId === newItem.productId && i.format === newItem.format
        );
        if (existingIdx >= 0) {
          mergedItems[existingIdx] = {
            ...mergedItems[existingIdx],
            quantity: mergedItems[existingIdx].quantity + newItem.quantity,
            supplements: newItem.supplements || [],
          };
        } else {
          mergedItems.push(newItem as any);
        }
      });

      const newTotal = mergedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      setOrders(prev => prev.map(o =>
        o.id === existingOrder.id
          ? { ...o, items: mergedItems, total: newTotal, status: 'en_attente' }
          : o
      ));
      setCartItems([]);
      setShowCartSheet(false);
      setShowValidationChoice(false);
      return;
    }

    const order: Order = {
      id: `CMD-${Date.now().toString(36).toUpperCase()}`,
      items: cartItems.map(i => ({ ...i })),
      tableNumber: selectedTable,
      server: 'Serveur 1',
      status: flow === 'later' ? 'en_attente' : 'en_cours',
      createdAt: new Date(),
      total,
      comment: flow === 'later' ? 'Ardoise - paiement plus tard' : 'Paiement immédiat',
    };

    setOrders(prev => [order, ...prev]);
    setManagedTables(prev => prev.map(table =>
      table.number === selectedTable
        ? { ...table, status: flow === 'later' ? 'occupée' : 'en_attente', currentOrder: order.id }
        : table
    ));
    setCartItems([]);
    setShowCartSheet(false);
    setShowValidationChoice(false);

    if (flow === 'now') {
      setShowOrderDetail(order);
      setPayingOrder(order);
      setShowPayment(true);
    }
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return;
    if (!isTableSelected()) return;
    setShowValidationChoice(true);
  };

  const handlePayment = (method: string) => {
    if (!payingOrder) return;
    
    const updatedOrders = orders.map(o =>
      o.id === payingOrder.id ? { ...o, status: 'payé' as const, paymentMethod: method as Order['paymentMethod'] } : o
    );
    setOrders(updatedOrders);
    
    setManagedTables(prev => prev.map(table =>
      table.number === payingOrder.tableNumber
        ? { ...table, status: 'libre', currentOrder: undefined }
        : table
    ));
    
    setShowPayment(false);
    
    if (showOrderDetail && showOrderDetail.id === payingOrder.id) {
      const updatedOrder = { ...payingOrder, status: 'payé' as const, paymentMethod: method as Order['paymentMethod'] };
      setShowOrderDetail(updatedOrder);
    }
    
    setPayingOrder(null);
  };
  
  const printTicket = (order: Order) => {
    if (order.status !== 'payé') {
      setErrorMessage("❌ Le ticket ne peut être imprimé qu'après paiement !");
      return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setErrorMessage("❌ Impossible d'ouvrir la fenêtre d'impression. Vérifiez votre bloqueur de popups.");
      return;
    }
    
    const barName = barInfo.name || 'BARFLOW';
    const barAddress = barInfo.address ? `<p>📍 ${barInfo.address}</p>` : '';
    const barPhone = barInfo.phone ? `<p>📞 ${barInfo.phone}</p>` : '';
    const barTax = barInfo.taxNumber ? `<p>🏷️ NIF: ${barInfo.taxNumber}</p>` : '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket - ${order.id}</title>
        <style>
          body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .header h1 { font-size: 18px; margin: 0; }
          .header p { margin: 5px 0; }
          .items { width: 100%; margin: 10px 0; }
          .items th, .items td { text-align: left; padding: 4px 0; }
          .items .text-right { text-align: right; }
          .total { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; text-align: right; }
          .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍺 ${barName}</h1>
          ${barAddress}
          ${barPhone}
          ${barTax}
          <p>Ticket de caisse</p>
          <p>${new Date(order.createdAt).toLocaleString('fr-FR')}</p>
          <p>Table ${order.tableNumber}</p>
          <p>Commande: ${order.id}</p>
        </div>
        <table class="items">
          <thead>
            <tr><th>Produit</th><th>Qté</th><th class="text-right">Prix</th><th class="text-right">Total</th></tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.productName}${item.supplements ? ' (+' + item.supplements.join(', ') + ')' : ''}</td>
                <td>${item.quantity}</td>
                <td class="text-right">${item.unitPrice.toLocaleString()} F</td>
                <td class="text-right">${(item.quantity * item.unitPrice).toLocaleString()} F</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">
          <strong>TOTAL: ${order.total.toLocaleString()} FCFA</strong>
        </div>
        <div class="footer">
          <p>Merci de votre visite !</p>
          <p>Règlement par ${order.paymentMethod === 'espèces' ? 'Espèces' : order.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}</p>
        </div>
      </body>
      </html>
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
  const activeOrders = orders.filter(o => o.status !== 'payé');

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
                {selectedTable ? `Table ${selectedTable} sélectionnée` : '⚠️ Aucune table sélectionnée'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md hover:shadow-xl flex items-center gap-2"
              >
                <Receipt size={16} />
                Historique
              </button>
              <button
                onClick={() => setShowTablePicker(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-xl flex items-center gap-2"
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

        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
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
    // Vérifier que predictStockRupture existe et fonctionne
    if (typeof predictStockRupture === 'function') {
      prediction = predictStockRupture(product);
    }
  } catch (error) {
    console.warn('Erreur de prédiction pour', product.name, error);
  }
}
                
                return (
                  <button
                    key={product.id}
                    onClick={() => {
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
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-4xl mb-2"
                      style={{ backgroundColor: isOutOfStock ? '#f1f5f9' : `${product.color || '#8B5CF6'}15` }}
                    >
                      <span className={cn(
                        'transition-transform duration-200',
                        !isOutOfStock && 'group-hover:scale-110'
                      )}>
                        {product.image || '📦'}
                      </span>
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
  {isOutOfStock ? 'RUPTURE' : product.stock}
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
              <p className="text-xs">Les commandes apparaîtront ici</p>
            </div>
          ) : (
            activeOrders.map(order => (
              <div 
                key={order.id} 
                onClick={() => setShowOrderDetail(order)}
                className="bg-slate-50 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer border border-slate-200 hover:border-violet-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Table2 size={14} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Table {order.tableNumber}</p>
                      <p className="text-[10px] text-slate-400">{order.items.length} article(s)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-violet-700">{order.total.toLocaleString()} F</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap gap-1">
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
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-600">Panier actuel (Table {selectedTable})</span>
              <span className="text-xl font-bold text-slate-900">{cartTotal.toLocaleString()} FCFA</span>
            </div>
            <button
              onClick={submitOrder}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Valider la commande
            </button>
          </div>
        )}
      </div>

      {/* MODAL: DÉTAIL COMMANDE - identique à l'original, gardé */}
      {showOrderDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowOrderDetail(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Détail de la commande</h3>
                <p className="text-xs text-slate-500">Table {showOrderDetail.tableNumber} · {showOrderDetail.id}</p>
              </div>
              <button onClick={() => setShowOrderDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-600">📅 Date & heure</span>
              <span className="text-sm font-medium text-slate-800">
                {new Date(showOrderDetail.createdAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <h4 className="font-semibold text-slate-800 mb-2">📦 Produits commandés</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
              {showOrderDetail.items.map((item, idx) => {
                const product = safeProducts.find(p => p.id === item.productId);
                return (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{product?.image || '🍺'}</span>
                          <p className="font-semibold text-slate-800">{item.productName}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            {product?.category || 'Produit'}
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                            Format: {item.format}
                          </span>
                          {item.supplements && item.supplements.length > 0 && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              + {item.supplements.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-violet-700">{item.unitPrice.toLocaleString()} F</p>
                        <p className="text-xs text-slate-500">x{item.quantity}</p>
                        <p className="text-sm font-bold text-slate-800">{(item.quantity * item.unitPrice).toLocaleString()} F</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">TOTAL</span>
                <span className="text-2xl font-bold text-violet-700">{showOrderDetail.total.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between items-center mt-2 text-sm">
                <span className="text-slate-500">Statut</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  showOrderDetail.status === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                  showOrderDetail.status === 'en_attente' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {showOrderDetail.status === 'payé' ? 'Payé' : 
                   showOrderDetail.status === 'en_attente' ? 'En attente' : 'En cours'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => printTicket(showOrderDetail)}
                disabled={showOrderDetail.status !== 'payé'}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  showOrderDetail.status === 'payé'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md hover:shadow-xl active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Printer size={16} />
                Imprimer ticket
              </button>
              {showOrderDetail.status === 'payé' ? (
                <button
                  onClick={() => closeOrderDetail(showOrderDetail)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  Fermer
                </button>
              ) : (
                <button
                  onClick={() => {
                    setPayingOrder(showOrderDetail);
                    setShowPayment(true);
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  Payer
                </button>
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
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${selectedProduct.color || '#8B5CF6'}20` }}>
                  {selectedProduct.image || '📦'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedProduct.name}</h3>
                  <p className="text-xs text-slate-500 capitalize">{selectedProduct.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <p className="text-sm text-slate-600">
                Stock: <strong className={cn(
                  selectedProduct.stock <= selectedProduct.seuilCritique ? 'text-red-600' :
                  selectedProduct.stock <= selectedProduct.seuilAlerte ? 'text-amber-600' : 'text-emerald-600'
                )}>
                  {selectedProduct.stock} {selectedProduct.stockUnit || 'unités'}
                </strong>
              </p>

              {selectedProduct.options?.bottleSize && (
                <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg inline-block">
                  📏 Volume/Taille : <strong>{selectedProduct.options.bottleSize}</strong>
                </p>
              )}

              {selectedProduct.options?.notes && (
                <p className="text-[10px] text-slate-400 italic bg-amber-50 border border-amber-100 p-2 rounded-lg">
                  📝 Note interne : {selectedProduct.options.notes}
                </p>
              )}

              {selectedProduct.options?.supplements && selectedProduct.options.supplements.length > 0 && (
  <div className="mt-2">
    <p className="text-xs font-semibold text-slate-700 mb-2">Options / Suppléments :</p>
    <div className="flex flex-wrap gap-2">
      {selectedProduct.options.supplements.map((sup: string) => (
        <button
          key={sup}
          onClick={() => setSelectedSupplements(prev =>
            prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
          )}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95',
            selectedSupplements.includes(sup)
              ? 'bg-violet-100 border-violet-300 text-violet-800 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:border-violet-200'
          )}
        >
          {selectedSupplements.includes(sup) ? '✓ ' : ''}{sup}
        </button>
      ))}
    </div>
  </div>
)}

              <div className={`grid gap-2 ${(selectedProduct.activePriceFormats || ['bouteille']).length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {(selectedProduct.activePriceFormats || ['bouteille']).map((format) => {
                  const price = selectedProduct.prices?.[format];
                  if (!price) return null;
                  const formatLabel = format.charAt(0).toUpperCase() + format.slice(1);
                  return (
                    <button
                      key={format}
                      onClick={() => { addToCart(selectedProduct, format, selectedSupplements); setSelectedProduct(null); }}
                      className="p-3 rounded-xl border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 active:scale-[0.97] transition-all text-center"
                    >
                      <p className="text-sm font-bold text-slate-800 capitalize">{formatLabel}</p>
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
                <button onClick={() => setShowTableManager(true)} className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform">
                  <Settings size={14} /> Gérer
                </button>
                <button onClick={() => setShowTablePicker(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
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
            <div className="flex gap-3 mt-4 text-xs text-slate-500">
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
              <h3 className="text-lg font-bold text-slate-900">Historique des commandes</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Receipt size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucune commande pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{order.id}</span>
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          order.status === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'en_attente' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'servi' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'payé' ? 'bg-violet-100 text-violet-700' : 'bg-red-100 text-red-700',
                        )}>
                          {order.status === 'en_cours' ? 'En cours' : order.status === 'en_attente' ? 'Ardoise' : order.status === 'servi' ? 'Servi' : order.status === 'payé' ? 'Payé' : 'Annulé'}
                        </span>
                        {order.paymentMethod && (
                          <span className="text-[10px] text-slate-500">
                            {order.paymentMethod === 'wave' ? '📱' : order.paymentMethod === 'orange_money' ? '📱' : order.paymentMethod === 'carte' ? '💳' : '💵'} {order.paymentMethod}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Table {order.tableNumber} · {order.items.length} articles · {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{order.total.toLocaleString()}F</p>
                    </div>
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
              <button onClick={() => setShowValidationChoice(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            {orders.some(o => o.tableNumber === selectedTable && (o.status === 'en_attente' || o.status === 'en_cours')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-amber-800">📋 Note ouverte sur la Table {selectedTable}</p>
                <p className="text-xs text-amber-600 mt-1">Si vous choisissez "Payer plus tard", les articles seront ajoutés à la note existante.</p>
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => createOrder('later')} className="w-full p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 text-left active:scale-[0.98] transition-transform">
                <p className="text-sm font-bold text-amber-900">Valider et payer plus tard</p>
                <p className="text-xs text-amber-700 mt-1">La table reste occupée et la commande passe sur l'ardoise.</p>
              </button>
              <button onClick={() => createOrder('now')} className="w-full p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-left active:scale-[0.98] transition-transform">
                <p className="text-sm font-bold text-emerald-900">Payer tout de suite</p>
                <p className="text-xs text-emerald-700 mt-1">Le mode de paiement sera obligatoire : Espèces, Wave ou Orange Money.</p>
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
                <h3 className="text-lg font-bold text-slate-900">Gestion dynamique des tables</h3>
                <p className="text-xs text-slate-500">Ajoutez, modifiez ou supprimez les tables et leurs places.</p>
              </div>
              <button onClick={() => setShowTableManager(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <div className="grid lg:grid-cols-[1fr_260px] gap-4">
              <div className="space-y-2">
                {managedTables.map(table => (
                  <div key={table.number} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border',
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
                      <button onClick={() => startEditTable(table)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"><Edit3 size={14} /> Modifier</button>
                      <button onClick={() => deleteTable(table.number)} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"><Trash2 size={14} /> Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 h-fit">
                <h4 className="text-sm font-bold text-slate-900 mb-3">{editingTable ? `Modifier table ${editingTable.number}` : 'Ajouter une table'}</h4>
                <div className="space-y-3">
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Numéro</label><input type="number" min={1} value={tableForm.number} onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" placeholder="Ex: 16" /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Nombre de places</label><input type="number" min={1} value={tableForm.seats} onChange={(e) => setTableForm({ ...tableForm, seats: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1">Statut</label><select value={tableForm.status} onChange={(e) => setTableForm({ ...tableForm, status: e.target.value as TableStatus['status'] })} className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 bg-white"><option value="libre">Libre</option><option value="occupée">Occupé</option><option value="en_attente">En attente</option></select></div>
                  <button onClick={saveTable} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm active:scale-[0.98] transition-transform">{editingTable ? 'Enregistrer les modifications' : 'Ajouter la table'}</button>
                  {editingTable && <button onClick={resetTableForm} className="w-full py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm">Annuler la modification</button>}
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
    </div>
  );
}