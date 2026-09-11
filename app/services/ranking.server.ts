import type { RecommendedProduct, RankedProduct } from "./recommend.types";

export type { RankedProduct };

type Scored = RankedProduct;

function scoreForBudget(price: number, budget: number): number {
  if (budget <= 0 || price <= 0) return 0;
  const utilization = price / budget;
  const closeness = 1 - Math.abs(budget - price) / budget;
  return utilization * 0.55 + closeness * 0.45;
}

function assignHeuristicReasons(items: Scored[], budget: number): Scored[] {
  if (!items.length) return items;

  const byFit = [...items].sort((a, b) => b.score - a.score);
  const byValue = [...items].sort(
    (a, b) => Number(a.price) - Number(b.price),
  );

  const bestFitId = byFit[0]?.id;
  const bestValueId = byValue[0]?.id;

  return items.map((item) => {
    const price = Number(item.price);
    let reason = "Solid pick under your budget";

    if (item.id === bestFitId) {
      reason = "Great fit for your budget";
    } else if (item.id === bestValueId && bestValueId !== bestFitId) {
      reason = "Best value pick";
    } else if (price >= budget * 0.7) {
      reason = "Popular near this range";
    } else if (price <= budget * 0.4) {
      reason = "Leaves room in your budget";
    }

    return { ...item, reason };
  });
}

/** Rank products for a budget and attach one-line reasons. Always works offline. */
export function rankProductsForBudget(
  products: RecommendedProduct[],
  budget: number,
): RankedProduct[] {
  const scored: Scored[] = products.map((product) => {
    const price = Number(product.price);
    const availabilityBoost = product.available ? 0.05 : -0.2;
    return {
      ...product,
      score: scoreForBudget(price, budget) + availabilityBoost,
      reason: "Solid pick under your budget",
    };
  });

  scored.sort((a, b) => b.score - a.score || Number(a.price) - Number(b.price));
  return assignHeuristicReasons(scored, budget);
}

type AiRankItem = { id: string; reason: string };

export type AiRankResult = {
  products: RankedProduct[];
  /** True only when OpenAI successfully re-ranked the list. */
  usedAi: boolean;
};

/**
 * Optional OpenAI re-rank. Falls back silently if no key / request fails.
 * Set OPENAI_API_KEY in the environment to enable.
 */
export async function maybeRankWithAi(
  products: RankedProduct[],
  budget: number,
  category: string | null,
): Promise<AiRankResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || products.length < 2) {
    return { products, usedAi: false };
  }

  const payload = products.slice(0, 12).map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price),
    productType: p.productType,
  }));

  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rank Shopify products for a shopper budget. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              budget,
              category: category || "all",
              instruction:
                "Reorder products best-for-budget first. For each, give one short reason (max 8 words), shopper-facing, no hype.",
              products: payload,
              response_shape: {
                ranked: [{ id: "product-id", reason: "short reason" }],
              },
            }),
          },
        ],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn("[budget-finder ai] OpenAI HTTP", response.status);
      return { products, usedAi: false };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { products, usedAi: false };

    const parsed = JSON.parse(content) as { ranked?: AiRankItem[] };
    const ranked = parsed.ranked;
    if (!Array.isArray(ranked) || !ranked.length) {
      return { products, usedAi: false };
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const used = new Set<string>();
    const result: RankedProduct[] = [];

    for (const row of ranked) {
      const product = byId.get(row.id);
      if (!product || used.has(row.id)) continue;
      used.add(row.id);
      result.push({
        ...product,
        reason: (row.reason || product.reason).trim().slice(0, 80),
      });
    }

    for (const product of products) {
      if (!used.has(product.id)) result.push(product);
    }

    console.info(
      `[budget-finder ai] re-ranked ${result.length} products with ${model}`,
    );
    return { products: result, usedAi: true };
  } catch (error) {
    console.warn("[budget-finder ai] fallback to heuristic", error);
    return { products, usedAi: false };
  }
}

/** Public API shape: keep reason, drop internal score. */
export function toPublicProducts(products: RankedProduct[]) {
  return products.map(({ score: _score, ...product }) => product);
}
