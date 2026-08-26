-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Category_userId_type_isActive_idx" ON "Category"("userId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Category_type_isActive_idx" ON "Category"("type", "isActive");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Protect system defaults and require ownership for custom categories.
ALTER TABLE "Category" ADD CONSTRAINT "Category_default_ownership_check"
CHECK (
    ("isDefault" = true AND "userId" IS NULL AND "isActive" = true)
    OR
    ("isDefault" = false AND "userId" IS NOT NULL)
);

ALTER TABLE "Category" ADD CONSTRAINT "Category_name_trimmed_nonempty_check"
CHECK (char_length(btrim("name")) > 0 AND "name" = btrim("name"));

ALTER TABLE "Category" ADD CONSTRAINT "Category_color_hex_check"
CHECK ("color" IS NULL OR "color" ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$');

-- Prisma cannot express partial functional indexes; these enforce
-- case-insensitive uniqueness for system and user-owned categories.
CREATE UNIQUE INDEX "Category_default_type_name_ci_key"
ON "Category" ("type", lower("name"))
WHERE "userId" IS NULL;

CREATE UNIQUE INDEX "Category_custom_user_type_name_ci_key"
ON "Category" ("userId", "type", lower("name"))
WHERE "userId" IS NOT NULL;

INSERT INTO "Category" (
    "id", "userId", "name", "type", "icon", "color",
    "isDefault", "isActive", "createdAt", "updatedAt"
) VALUES
    ('10000000-0000-4000-8000-000000000001', NULL, 'Salary', 'INCOME', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000002', NULL, 'Bonus', 'INCOME', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000003', NULL, 'Gift', 'INCOME', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000004', NULL, 'Other Income', 'INCOME', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000001', NULL, 'Food', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000002', NULL, 'Transportation', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000003', NULL, 'Bills', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000004', NULL, 'Shopping', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000005', NULL, 'Health', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000006', NULL, 'Entertainment', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000007', NULL, 'Education', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000008', NULL, 'Other Expense', 'EXPENSE', NULL, NULL, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
