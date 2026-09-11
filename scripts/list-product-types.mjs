import { PrismaClient } from "@prisma/client";

const shop = process.argv[2];
if (!shop) {
  console.error("Usage: node scripts/list-product-types.mjs <shop>");
  process.exit(1);
}

const prisma = new PrismaClient();
const session = await prisma.session.findFirst({
  where: { shop, isOnline: false },
});

if (!session?.accessToken) {
  console.error("No offline session for", shop);
  process.exit(1);
}

const response = await fetch(
  `https://${shop}/admin/api/2025-10/graphql.json`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `#graphql
        query {
          products(first: 50) {
            nodes {
              id
              title
              productType
              status
              variants(first: 1) {
                nodes { price }
              }
            }
          }
        }`,
    }),
  },
);

const json = await response.json();
if (json.errors) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}

const nodes = json.data.products.nodes;
const byType = {};
for (const p of nodes) {
  const t = p.productType || "(empty)";
  byType[t] = (byType[t] || 0) + 1;
}

console.log("Product types:", JSON.stringify(byType, null, 2));
console.log(
  "Products:",
  JSON.stringify(
    nodes.map((p) => ({
      title: p.title,
      productType: p.productType || null,
      price: p.variants.nodes[0]?.price,
      status: p.status,
    })),
    null,
    2,
  ),
);

await prisma.$disconnect();
