-- Foreign keys cannot express that referenced Account/Category rows belong to
-- the Transaction user. Keep this database boundary for every API and direct write.
CREATE FUNCTION enforce_transaction_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    account_valid boolean;
    category_valid boolean;
BEGIN
    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I."Account" WHERE "id" = $1 AND "userId" = $2)',
        TG_TABLE_SCHEMA
    ) INTO account_valid USING NEW."accountId", NEW."userId";
    IF NOT account_valid THEN
        RAISE EXCEPTION 'Transaction account must belong to the transaction user'
            USING ERRCODE = '23514';
    END IF;

    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I."Category" WHERE "id" = $1 AND "type" = $2 AND ("userId" = $3 OR ("userId" IS NULL AND "isDefault" = true)))',
        TG_TABLE_SCHEMA
    ) INTO category_valid USING NEW."categoryId", NEW."type", NEW."userId";
    IF NOT category_valid THEN
        RAISE EXCEPTION 'Transaction category must be visible to the user and match its type'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Transaction_integrity_check"
BEFORE INSERT OR UPDATE OF "userId", "accountId", "categoryId", "type"
ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION enforce_transaction_integrity();
