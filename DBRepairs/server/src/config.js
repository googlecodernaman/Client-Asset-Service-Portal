export function loadConfig(env = process.env) {
  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: Number(env.PORT) || 3000,
    database: { path: env.DATABASE_PATH || undefined },
    trustProxy: env.TRUST_PROXY === "true",
  };
}
