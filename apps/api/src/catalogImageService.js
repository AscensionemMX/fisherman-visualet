import {
  downloadDolibarrProductDocument,
  listDolibarrProductDocuments,
} from "./dolibarrClient.js";

const imageCache = new Map();
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function getExtension(filename = "") {
  const normalized = String(filename).toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

function isImageDocument(document) {
  const filename = document.relativename ?? document.filename ?? document.name ?? "";
  return imageExtensions.has(getExtension(filename));
}

function getOriginalFile(document) {
  const level = document.level1name ? String(document.level1name) : "";
  const relative = document.relativename ?? document.filename ?? document.name;

  if (!level || !relative) return null;

  return `${level}/${relative}`;
}

export async function getProductImage(config, productId) {
  const cacheKey = String(productId);
  const cachedImage = imageCache.get(cacheKey);

  if (cachedImage) {
    return cachedImage;
  }

  const documents = await listDolibarrProductDocuments(config, productId);
  const imageDocument = documents.find(isImageDocument);
  const originalFile = imageDocument ? getOriginalFile(imageDocument) : null;

  if (!originalFile) {
    return null;
  }

  const image = await downloadDolibarrProductDocument(config, originalFile);

  imageCache.set(cacheKey, image);
  return image;
}
