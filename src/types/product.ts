// src/types/product.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  stockUnit?: string;
  seuilAlerte?: number;
  seuilCritique?: number;
  image?: string;
  color?: string;
  popularite?: number;
  activePriceFormats?: string[];
  prices?: {
    bouteille?: number;
    demi?: number;
    quart?: number;
    verre?: number;
    canette?: number;
  };
  options?: {
    bottleSize?: string;
    supplements?: string[];
    notes?: string;
  };
}