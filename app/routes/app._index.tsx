import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getBudgetSettings } from "../models/budget-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getBudgetSettings(session.shop);
  return { settings };
};

export default function Index() {
  const { settings } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Budget Finder">
      <s-button slot="primary-action" href="/app/settings">
        Open settings
      </s-button>

      <s-section heading="Recommend products by budget">
        <s-paragraph>
          Shoppers pick a category and set a budget with a slider on your
          storefront. The Budget Finder block returns matching products and
          lets them add items to cart.
        </s-paragraph>
      </s-section>

      <s-section heading="Current settings">
        <s-unordered-list>
          <s-list-item>Results limit: {settings.resultLimit}</s-list-item>
          <s-list-item>
            In-stock only: {settings.inStockOnly ? "Yes" : "No"}
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Add the storefront block">
        <s-ordered-list>
          <s-list-item>
            Open Online Store → Themes → Customize
          </s-list-item>
          <s-list-item>
            Add the <strong>Budget Finder</strong> app block to a template
          </s-list-item>
          <s-list-item>
            Save the theme and test a budget range on the storefront
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-paragraph>
          The theme block calls your app proxy at{" "}
          <code>/apps/budget-finder/recommend</code>, which queries active
          products in the price range and returns variant IDs for Add to cart.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
