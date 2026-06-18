import http from "node:http";
import { getProductImage } from "./catalogImageService.js";
import { getConfig } from "./config.js";
import { getCatalogProducts } from "./catalogService.js";
import { loadLocalEnv } from "./env.js";
import { sendBinary, sendJson, sendOptions, sendSvg } from "./http.js";

loadLocalEnv();

const config = getConfig();

async function handleRequest(request, response) {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing request URL" });
    return;
  }

  if (request.method === "OPTIONS") {
    sendOptions(response);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "visualet-api",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/catalog/products") {
    try {
      const payload = await getCatalogProducts(config, {
        audience: url.searchParams.get("audience") ?? "customer",
        page: url.searchParams.get("page") ?? "0",
        limit: url.searchParams.get("limit") ?? "100",
        search: url.searchParams.get("q") ?? "",
      });

      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 502, {
        error: "Unable to load catalog products",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  const imageMatch = url.pathname.match(/^\/catalog\/products\/([^/]+)\/image$/);

  if (request.method === "GET" && imageMatch) {
    const productId = imageMatch[1] ?? "";

    try {
      const image = await getProductImage(config, productId);

      if (image) {
        sendBinary(response, 200, image.bytes, {
          contentType: image.contentType,
        });
        return;
      }
    } catch (error) {
      console.warn(
        `Unable to load product image ${productId}:`,
        error instanceof Error ? error.message : error,
      );
    }

    sendSvg(response, 200, buildPlaceholderSvg(productId));
    return;
  }

  sendJson(response, 404, {
    error: "Not found",
    path: url.pathname,
  });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  });
});

server.listen(config.port, () => {
  console.log(`Visualet API listening on http://localhost:${config.port}`);
});

function buildPlaceholderSvg(productId) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="48%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#cffafe"/>
        </linearGradient>
        <linearGradient id="mark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f4c5c"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="72" fill="url(#bg)"/>
      <rect x="92" y="104" width="456" height="432" rx="48" fill="#ffffff" stroke="#dbeafe" stroke-width="6"/>
      <circle cx="320" cy="252" r="82" fill="url(#mark)" opacity="0.92"/>
      <rect x="194" y="372" width="252" height="24" rx="12" fill="#0f4c5c" opacity="0.18"/>
      <rect x="230" y="416" width="180" height="20" rx="10" fill="#0f4c5c" opacity="0.14"/>
      <text x="320" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff">FD</text>
      <text x="320" y="496" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#64748b">Producto ${productId}</text>
    </svg>
  `;
}
