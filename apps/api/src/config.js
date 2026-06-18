export function getConfig() {
  return {
    port: Number.parseInt(process.env.PORT ?? "8787", 10),
    dolibarrApiUrl: process.env.DOLIBARR_API_URL ?? "",
    dolibarrApiKey: process.env.DOLIBARR_API_KEY ?? "",
    catalogCacheTtlMs: Number.parseInt(
      process.env.CATALOG_CACHE_TTL_MS ?? "300000",
      10,
    ),
  };
}

export function assertDolibarrConfig(config) {
  const missing = [];

  if (!config.dolibarrApiUrl) missing.push("DOLIBARR_API_URL");
  if (!config.dolibarrApiKey) missing.push("DOLIBARR_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
