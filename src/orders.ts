import type { Order } from '@/types';

export const staticOrders: Order[] = [
  {
    id: 'ord1',
    items: [
      { productId: 'p1', productName: 'Flag Spéciale', quantity: 24, format: 'bouteille', unitPrice: 1500 },
      { productId: 'p2', productName: 'Gazelle', quantity: 18, format: 'bouteille', unitPrice: 1200 },
      { productId: 'p4', productName: 'Cocktail Dakar Sunset', quantity: 12, format: 'verre', unitPrice: 3500 },
    ],
    tableNumber: 1,
    server: 'Jean',
    status: 'payé',
    createdAt: new Date(),
    total: 97800,
    paymentMethod: 'espèces',
  },
  {
    id: 'ord2',
    items: [
      { productId: 'p1', productName: 'Flag Spéciale', quantity: 12, format: 'bouteille', unitPrice: 1500 },
      { productId: 'p9', productName: 'Coca Cola', quantity: 8, format: 'bouteille', unitPrice: 1000 },
    ],
    tableNumber: 2,
    server: 'Marie',
    status: 'payé',
    createdAt: new Date(),
    total: 26000,
    paymentMethod: 'wave',
  },
  {
    id: 'ord3',
    items: [
      { productId: 'p5', productName: 'Mojito Sénégal', quantity: 8, format: 'verre', unitPrice: 3000 },
      { productId: 'p12', productName: 'Whisky Johnnie', quantity: 4, format: 'verre', unitPrice: 2500 },
    ],
    tableNumber: 3,
    server: 'Jean',
    status: 'payé',
    createdAt: new Date(),
    total: 34000,
    paymentMethod: 'orange_money',
  },
  {
    id: 'ord4',
    items: [
      { productId: 'p15', productName: 'Cocktail Teranga', quantity: 6, format: 'verre', unitPrice: 4000 },
      { productId: 'p3', productName: 'MBO Bière', quantity: 12, format: 'bouteille', unitPrice: 2000 },
    ],
    tableNumber: 5,
    server: 'Sophie',
    status: 'payé',
    createdAt: new Date(),
    total: 48000,
    paymentMethod: 'carte',
  },
];