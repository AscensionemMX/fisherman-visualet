export type CatalogCategory = "todos" | string;

export type CatalogAvailabilityFilter =
  | "todos"
  | "disponible"
  | "pocas"
  | "no-disponible";

export type CatalogProduct = {
  id: string;
  dolibarrProductId?: string;
  name: string;
  category: string;
  tag: string;
  description: string;
  priceText: string;
  priceValue?: number;
  priceIncludesTax?: boolean;
  availability?: string;
  imageUrl?: string;
  categories?: string[];
  lastSyncedAt?: string;
};

export type CartItem = CatalogProduct & {
  quantity: number;
};
