export type DVLike = {
  id?: string;
  kind?: string;
  traits?: string[];
  labels?: string[];
  meta?: Record<string, any>;
  attrs?: Record<string, any>;
  [key: string]: any;
};

export type FalconStoreItem = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  image: string;
  images: string[];
  category: string;
  tags: string[];
  sellerId?: string;
  sellerName?: string;
  sourceNode?: string;
  href?: string;
  featured?: boolean;
  inStock?: boolean;
  score?: number;
  raw?: any;
};

export type FalconStoreCollection = {
  key: string;
  title: string;
  subtitle: string;
  items: FalconStoreItem[];
};