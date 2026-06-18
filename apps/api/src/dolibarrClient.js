import { assertDolibarrConfig } from "./config.js";

function buildDolibarrUrl(config, path, params) {
  const baseUrl = config.dolibarrApiUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export async function listDolibarrProducts(config, options = {}) {
  assertDolibarrConfig(config);

  const url = buildDolibarrUrl(config, "/products", {
    sortfield: options.sortfield ?? "t.label",
    sortorder: options.sortorder ?? "ASC",
    limit: options.limit ?? 100,
    page: options.page ?? 0,
    mode: 1,
    includestockdata: 1,
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      DOLAPIKEY: config.dolibarrApiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Dolibarr products request failed: ${response.status} ${response.statusText} ${responseText}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Dolibarr products response is not an array");
  }

  return data;
}

export async function listDolibarrCategories(config, options = {}) {
  assertDolibarrConfig(config);

  const url = buildDolibarrUrl(config, "/categories", {
    limit: options.limit ?? 1000,
    type: options.type ?? "product",
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      DOLAPIKEY: config.dolibarrApiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Dolibarr categories request failed: ${response.status} ${response.statusText} ${responseText}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Dolibarr categories response is not an array");
  }

  return data;
}

export async function listDolibarrCategoryProducts(config, categoryId, options = {}) {
  assertDolibarrConfig(config);

  const url = buildDolibarrUrl(config, `/categories/${categoryId}/objects`, {
    type: "product",
    limit: options.limit ?? 5000,
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      DOLAPIKEY: config.dolibarrApiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Dolibarr category objects request failed: ${response.status} ${response.statusText} ${responseText}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Dolibarr category objects response is not an array");
  }

  return data;
}

export async function listDolibarrProductDocuments(config, productId) {
  assertDolibarrConfig(config);

  const url = buildDolibarrUrl(config, "/documents", {
    modulepart: "product",
    id: productId,
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      DOLAPIKEY: config.dolibarrApiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Dolibarr product documents request failed: ${response.status} ${response.statusText} ${responseText}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Dolibarr product documents response is not an array");
  }

  return data;
}

export async function downloadDolibarrProductDocument(config, originalFile) {
  assertDolibarrConfig(config);

  const url = buildDolibarrUrl(config, "/documents/download", {
    modulepart: "product",
    original_file: originalFile,
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      DOLAPIKEY: config.dolibarrApiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Dolibarr document download failed: ${response.status} ${response.statusText} ${responseText}`,
    );
  }

  const data = await response.json();

  if (!data?.content || !data?.["content-type"]) {
    throw new Error("Dolibarr document download response is missing content");
  }

  return {
    filename: data.filename,
    contentType: data["content-type"],
    bytes: Buffer.from(data.content, "base64"),
  };
}
