import { PrismaClient } from "@prisma/client";

const shop = process.argv[2];
if (!shop) {
  console.error("Usage: node scripts/assign-product-types.mjs <shop>");
  process.exit(1);
}

/** @type {Record<string, string>} */
const titleRules = {
  "inabel bags": "Bag",
  "assorted inabel handbags": "Bag",
  poucher: "Bag",
  "inabel pouche": "Bag",
  shoes: "Shoes",
  sandals: "Shoes",
  hat: "Hat",
  wallet: "Wallet",
  "inabel towels": "Towels",
};

function inferType(title) {
  const key = title.trim().toLowerCase();
  if (titleRules[key]) return titleRules[key];
  if (key.includes("bag") || key.includes("handbag") || key.includes("pouch")) {
    return "Bag";
  }
  if (key.includes("shoe") || key.includes("sandal")) return "Shoes";
  if (key.includes("hat")) return "Hat";
  if (key.includes("wallet")) return "Wallet";
  if (key.includes("towel")) return "Towels";
  return null;
}

const prisma = new PrismaClient();
const session = await prisma.session.findFirst({
  where: { shop, isOnline: false },
});

if (!session?.accessToken) {
  console.error("No offline session for", shop);
  process.exit(1);
}

async function adminGraphql(query, variables) {
  const response = await fetch(
    `https://${shop}/admin/api/2025-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

const data = await adminGraphql(`#graphql
  query {
    products(first: 50) {
      nodes { id title productType }
    }
  }
`);

const updates = [];
for (const product of data.products.nodes) {
  const nextType = inferType(product.title);
  if (!nextType) {
    console.log(`skip: ${product.title}`);
    continue;
  }
  if (product.productType === nextType) {
    console.log(`ok: ${product.title} → ${nextType}`);
    continue;
  }
  updates.push({ id: product.id, title: product.title, productType: nextType });
}

for (const item of updates) {
  const result = await adminGraphql(
    `#graphql
    mutation SetType($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title productType }
        userErrors { field message }
      }
    }`,
    { input: { id: item.id, productType: item.productType } },
  );

  const errors = result.productUpdate.userErrors;
  if (errors?.length) {
    console.error(`fail: ${item.title}`, errors);
  } else {
    console.log(`updated: ${item.title} → ${item.productType}`);
  }
}

console.log(`Done. Updated ${updates.length} product(s).`);
await prisma.$disconnect();
