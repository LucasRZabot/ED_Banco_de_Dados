process.env.AUTH_TRUST_HOST ??= "true";

// AUTH_SECRET is required at runtime (`env()` / Auth.js). Do not throw here:
// `next build` imports this module while collecting page data, and the host
// may not inject secrets until the app starts.
export {};
