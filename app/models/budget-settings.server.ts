import prisma from "../db.server";

export type BudgetSettingsData = {
  resultLimit: number;
  inStockOnly: boolean;
};

const DEFAULTS: BudgetSettingsData = {
  resultLimit: 12,
  inStockOnly: true,
};

export async function getBudgetSettings(
  shop: string,
): Promise<BudgetSettingsData> {
  const row = await prisma.budgetSettings.findUnique({ where: { shop } });
  if (!row) return { ...DEFAULTS };
  return {
    resultLimit: row.resultLimit,
    inStockOnly: row.inStockOnly,
  };
}

export async function saveBudgetSettings(
  shop: string,
  data: BudgetSettingsData,
): Promise<BudgetSettingsData> {
  const resultLimit = Math.min(48, Math.max(1, Math.floor(data.resultLimit)));
  const row = await prisma.budgetSettings.upsert({
    where: { shop },
    create: {
      shop,
      resultLimit,
      inStockOnly: data.inStockOnly,
    },
    update: {
      resultLimit,
      inStockOnly: data.inStockOnly,
    },
  });
  return {
    resultLimit: row.resultLimit,
    inStockOnly: row.inStockOnly,
  };
}
