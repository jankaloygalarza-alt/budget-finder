import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getBudgetSettings } from "../models/budget-settings.server";
import { recommendProductsByBudget } from "../services/recommend.server";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.public.appProxy(request);

    if (!admin || !session) {
      return json(
        {
          error:
            "App is not installed on this shop. Open Budget Finder in Admin once, then try again.",
        },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const min = Number(url.searchParams.get("min"));
    const max = Number(url.searchParams.get("max"));
    const category = url.searchParams.get("category")?.trim() || null;

    if (
      Number.isNaN(min) ||
      Number.isNaN(max) ||
      min < 0 ||
      max <= 0 ||
      min > max
    ) {
      return json(
        {
          error:
            "Enter a valid budget range. Min and max must be numbers, and min must be less than or equal to max.",
        },
        { status: 400 },
      );
    }

    const settings = await getBudgetSettings(session.shop);
    const { products, usedAi } = await recommendProductsByBudget(
      admin,
      session.shop,
      min,
      max,
      settings,
      category,
    );

    return json({
      products,
      currency: products[0]?.currency ?? null,
      category,
      ranking: usedAi ? "ai" : "budget-fit",
    });
  } catch (error) {
    // authenticate.public.appProxy throws Response on bad HMAC — pass through
    if (error instanceof Response) throw error;

    const message =
      error instanceof Error ? error.message : "Could not load recommendations";
    console.error("[budget-finder recommend]", error);
    return json({ error: message }, { status: 500 });
  }
};
