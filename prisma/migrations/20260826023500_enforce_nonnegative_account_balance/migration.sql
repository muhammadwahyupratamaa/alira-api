ALTER TABLE "Account"
ADD CONSTRAINT "Account_initialBalance_nonnegative"
CHECK ("initialBalance" >= 0);
