-- CreateTable
CREATE TABLE "BudgetSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "resultLimit" INTEGER NOT NULL DEFAULT 12,
    "inStockOnly" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
