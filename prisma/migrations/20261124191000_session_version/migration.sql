-- JWT antigo da conta deixa de valer depois que a TI redefine a senha.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
