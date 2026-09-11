import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getBudgetSettings,
  saveBudgetSettings,
} from "../models/budget-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getBudgetSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const resultLimit = Number(formData.get("resultLimit"));
  const inStockOnly = formData.get("inStockOnly") === "on";

  if (Number.isNaN(resultLimit) || resultLimit < 1 || resultLimit > 48) {
    return { ok: false as const, error: "Result limit must be between 1 and 48." };
  }

  const settings = await saveBudgetSettings(session.shop, {
    resultLimit,
    inStockOnly,
  });

  return { ok: true as const, settings };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isSaving = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.ok) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  const current = actionData && "settings" in actionData && actionData.settings
    ? actionData.settings
    : settings;

  return (
    <s-page heading="Budget Finder settings">
      <s-section heading="Recommendation defaults">
        <s-paragraph>
          These settings control what shoppers see in the Budget Finder theme
          block on your storefront.
        </s-paragraph>

        <Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Results limit"
              name="resultLimit"
              value={String(current.resultLimit)}
              details="Maximum number of products returned (1–48)."
              autocomplete="off"
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <input
                type="checkbox"
                name="inStockOnly"
                defaultChecked={current.inStockOnly}
              />
              Only show products available for sale
            </label>

            {actionData && "error" in actionData && actionData.error ? (
              <s-banner tone="critical">{actionData.error}</s-banner>
            ) : null}

            <s-stack direction="inline" gap="base">
              <s-button type="submit" variant="primary" {...(isSaving ? { loading: true } : {})}>
                Save
              </s-button>
            </s-stack>
          </s-stack>
        </Form>
      </s-section>

      <s-section slot="aside" heading="Storefront setup">
        <s-paragraph>
          In the theme editor, add the <strong>Budget Finder</strong> app block
          to a page or section. Shoppers enter a min/max budget, browse matching
          products, and can add them to cart.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
