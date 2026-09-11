export type RecommendedProduct = {
  id: string;
  title: string;
  handle: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  url: string;
  variantId: number;
  available: boolean;
  productType: string | null;
};

export type RankedProduct = RecommendedProduct & {
  reason: string;
  score: number;
};
