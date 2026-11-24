process.env.AUTH_TRUST_HOST ??= "true";

if (process.env.NODE_ENV === "production") {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto demais. O app não inicia sem ele.");
  }
}

export {};
