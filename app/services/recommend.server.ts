import type { BudgetSettingsData } from "../models/budget-settings.server";
import type { RecommendedProduct, RankedProduct } from "./recommend.types";
import {
  maybeRankWithAi,
  rankProductsForBudget,
  toPublicProducts,
} from "./ranking.server";

export type { RecommendedProduct, RankedProduct };

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  productType?: string | null;
  featuredImage?: { url: string } | null;
  variants: {
    nodes: Array<{
      id: string;
      price: string;
      availableForSale: boolean;
    }>;
  };
};

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  backpacks: ["backpack", "backpacks", "pack"],
  "bath towels": ["bath towel", "bath towels", "towel", "towels"],
  "coin purses": [
    "coin purse",
    "coin purses",
    "purse",
    "purses",
    "pouch",
    "pouche",
    "poucher",
  ],
  "cross body bags": [
    "cross body",
    "crossbody",
    "cross-body",
    "cross body bag",
    "cross body bags",
    "handbag",
    "handbags",
  ],
  sandals: ["sandal", "sandals"],
  // legacy / demo
  bag: ["bag", "bags", "handbag", "handbags", "pouch", "pouche", "poucher"],
  shoes: ["shoe", "shoes", "sandal", "sandals"],
  hat: ["hat", "hats", "cap"],
  wallet: ["wallet", "wallets"],
  towels: ["towel", "towels"],
  "t-shirt": ["t-shirt", "tshirt", "tee", "shirt"],
  snowboard: ["snowboard", "board"],
  accessories: ["accessor"],
};

function gidToNumericId(gid: string): number {
  const parts = gid.split("/");
  return Number(parts[parts.length - 1]);
}

function pickVariant(
  product: ProductNode,
  min: number,
  max: number,
  inStockOnly: boolean,
) {
  return product.variants.nodes.find((variant) => {
    const price = Number(variant.price);
    if (Number.isNaN(price) || price < min || price > max) return false;
    if (inStockOnly && !variant.availableForSale) return false;
    return true;
  });
}

function categoryTokens(category: string): string[] {
  const key = category.trim().toLowerCase();
  const extras = CATEGORY_SYNONYMS[key] ?? [];
  return Array.from(new Set([key, ...extras]));
}

/** Match product type, title, or known synonyms (e.g. Bag → handbags). */
export function matchesCategory(
  product: { title: string; productType?: string | null },
  category?: string | null,
): boolean {
  const trimmed = category?.trim();
  if (!trimmed) return true;

  const tokens = categoryTokens(trimmed);
  const type = (product.productType || "").toLowerCase();
  const title = product.title.toLowerCase();

  return tokens.some(
    (token) =>
      type === token ||
      type.includes(token) ||
      title.includes(token),
  );
}

function buildProductQuery(min: number, max: number) {
  // Category is applied in-app so title/synonym matches work without product type.
  return `price:>=${min} price:<=${max} status:active`;
}

export async function recommendProductsByBudget(
  admin: AdminGraphql,
  _shop: string,
  min: number,
  max: number,
  settings: BudgetSettingsData,
  category?: string | null,
) {
  const query = buildProductQuery(min, max);
  const response = await admin.graphql(
    `#graphql
    query BudgetProducts($first: Int!, $query: String!) {
      shop {
        currencyCode
      }
      products(first: $first, query: $query, sortKey: TITLE) {
        nodes {
          id
          title
          handle
          productType
          featuredImage {
            url
          }
          variants(first: 50) {
            nodes {
              id
              price
              availableForSale
            }
          }
        }
      }
    }`,
    {
      variables: {
        first: Math.min(50, Math.max(settings.resultLimit * 5, 25)),
        query,
      },
    },
  );

  const json = await response.json();
  if (json.errors?.length) {
    const message = json.errors
      .map((error: { message?: string }) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(message || "Product search failed");
  }

  const currency: string = json.data?.shop?.currencyCode ?? "USD";
  const nodes: ProductNode[] = json.data?.products?.nodes ?? [];

  const results: RecommendedProduct[] = [];

  for (const product of nodes) {
    if (results.length >= settings.resultLimit) break;
    if (!matchesCategory(product, category)) continue;
    const variant = pickVariant(product, min, max, settings.inStockOnly);
    if (!variant) continue;

    results.push({
      id: product.id,
      title: product.title,
      handle: product.handle,
      price: variant.price,
      currency,
      imageUrl: product.featuredImage?.url ?? null,
      url: `/products/${product.handle}`,
      variantId: gidToNumericId(variant.id),
      available: variant.availableForSale,
      productType: product.productType ?? null,
    });
  }

  const ranked = rankProductsForBudget(results, max);
  const { products: withAi, usedAi } = await maybeRankWithAi(
    ranked,
    max,
    category ?? null,
  );
  return { products: toPublicProducts(withAi), usedAi };
}
