import {
  CHIAPAS_PLACES,
  CHIAPAS_ROUTES,
  type ChiapasCoord,
  type ChiapasRoute,
  projectChiapasToUnit,
} from "../data/chiapasMap";

type Point = {
  x: number;
  y: number;
};

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const chiapasShape: Point[] = [
  { x: 0.2, y: 0.22 },
  { x: 0.31, y: 0.13 },
  { x: 0.46, y: 0.16 },
  { x: 0.55, y: 0.25 },
  { x: 0.68, y: 0.27 },
  { x: 0.79, y: 0.4 },
  { x: 0.83, y: 0.58 },
  { x: 0.74, y: 0.78 },
  { x: 0.61, y: 0.84 },
  { x: 0.51, y: 0.79 },
  { x: 0.39, y: 0.86 },
  { x: 0.27, y: 0.76 },
  { x: 0.17, y: 0.64 },
  { x: 0.14, y: 0.45 },
];

const reliefLines: Point[][] = [
  [
    { x: 0.2, y: 0.36 },
    { x: 0.34, y: 0.27 },
    { x: 0.48, y: 0.3 },
    { x: 0.62, y: 0.42 },
    { x: 0.76, y: 0.48 },
  ],
  [
    { x: 0.23, y: 0.52 },
    { x: 0.38, y: 0.5 },
    { x: 0.52, y: 0.58 },
    { x: 0.67, y: 0.66 },
  ],
  [
    { x: 0.33, y: 0.2 },
    { x: 0.44, y: 0.34 },
    { x: 0.58, y: 0.37 },
    { x: 0.72, y: 0.35 },
  ],
  [
    { x: 0.18, y: 0.66 },
    { x: 0.31, y: 0.7 },
    { x: 0.45, y: 0.78 },
    { x: 0.58, y: 0.83 },
  ],
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp((value - edge0) / (edge1 - edge0));

  return x * x * (3 - 2 * x);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function initScrollStoryBackground() {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-scroll-story-canvas]");

  if (!canvas || prefersReducedMotion || canvas.dataset.initialized === "true") {
    return;
  }

  canvas.dataset.initialized = "true";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  let scrollProgress = 0;
  let renderedProgress = 0;
  let frame = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateScrollProgress() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    scrollProgress = clamp(window.scrollY / maxScroll);
  }

  function mapFrame(progress: number) {
    const scale = Math.min(width * lerp(1.18, 0.92, progress), height * lerp(1.28, 0.98, progress));
    const mapWidth = scale;
    const mapHeight = scale * 0.72;

    return {
      x: width * lerp(0.5, 0.44, progress) - mapWidth * 0.5,
      y: height * lerp(0.48, 0.42, progress) - mapHeight * 0.48,
      width: mapWidth,
      height: mapHeight,
    };
  }

  function mapPoint(coord: ChiapasCoord, progress: number): Point {
    const unit = projectChiapasToUnit(coord);
    const frameBox = mapFrame(progress);

    return {
      x: frameBox.x + unit.x * frameBox.width,
      y: frameBox.y + unit.y * frameBox.height,
    };
  }

  function shapePoint(point: Point, progress: number): Point {
    const frameBox = mapFrame(progress);

    return {
      x: frameBox.x + point.x * frameBox.width,
      y: frameBox.y + point.y * frameBox.height,
    };
  }

  function drawBackdrop(time: number, progress: number) {
    const colorShift = smoothstep(0.48, 0.72, progress);
    const background = ctx.createLinearGradient(0, 0, width, height);

    background.addColorStop(0, `rgba(${Math.round(4 + colorShift * 232)}, ${Math.round(7 + colorShift * 243)}, ${Math.round(12 + colorShift * 248)}, 0.98)`);
    background.addColorStop(0.5, `rgba(${Math.round(6 + colorShift * 232)}, ${Math.round(17 + colorShift * 238)}, ${Math.round(26 + colorShift * 242)}, 0.98)`);
    background.addColorStop(1, `rgba(${Math.round(5 + colorShift * 235)}, ${Math.round(7 + colorShift * 243)}, ${Math.round(10 + colorShift * 245)}, 0.98)`);

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = colorShift > 0.5 ? "rgba(15,76,92,0.42)" : "rgba(103,232,249,0.26)";
    ctx.lineWidth = 1;

    const gridSize = Math.max(64, Math.min(96, width / 15));
    const offset = (time * 3.2 + progress * 120) % gridSize;

    for (let x = -gridSize + offset; x < width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = -gridSize + offset; y < height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRoute(route: ChiapasRoute, progress: number, time: number, index: number) {
    const reveal = smoothstep(0.03 + index * 0.025, 0.28 + index * 0.025, progress);
    const fade = 1 - smoothstep(0.82, 1, progress);

    if (reveal <= 0.01 || fade <= 0.01) return;

    const points = route.coords.map((coord) => mapPoint(coord, progress));
    const maxIndex = Math.max(2, Math.floor(points.length * reveal));

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle =
      route.tone === "promo"
        ? "rgba(252,211,77,0.32)"
        : route.tone === "primary"
          ? "rgba(103,232,249,0.34)"
          : "rgba(103,232,249,0.24)";
    ctx.lineWidth = route.tone === "primary" ? 2.4 : 1.6;
    ctx.setLineDash(route.tone === "primary" ? [20, 18] : [12, 18]);
    ctx.lineDashOffset = -time * 12 - index * 20;

    ctx.beginPath();
    points.slice(0, maxIndex).forEach((point, pointIndex) => {
      if (pointIndex === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawMap(progress: number, time: number) {
    const mapAlpha = 0.5 * (1 - smoothstep(0.88, 1, progress));

    if (mapAlpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = mapAlpha;
    ctx.beginPath();
    chiapasShape.forEach((point, index) => {
      const screen = shapePoint(point, progress);

      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();

    const frameBox = mapFrame(progress);
    const fill = ctx.createLinearGradient(frameBox.x, frameBox.y, frameBox.x + frameBox.width, frameBox.y + frameBox.height);
    fill.addColorStop(0, "rgba(103,232,249,0.22)");
    fill.addColorStop(0.5, "rgba(15,76,92,0.32)");
    fill.addColorStop(1, "rgba(2,6,23,0.62)");

    ctx.shadowColor = "rgba(103,232,249,0.2)";
    ctx.shadowBlur = 44;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(226,232,240,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    reliefLines.forEach((line, index) => {
      ctx.beginPath();
      line.forEach((point, pointIndex) => {
        const screen = shapePoint(
          { x: point.x + Math.sin(time * 0.1 + index) * 0.004, y: point.y },
          progress,
        );

        if (pointIndex === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.strokeStyle = index % 2 === 0 ? "rgba(226,232,240,0.18)" : "rgba(6,182,212,0.16)";
      ctx.lineWidth = index % 2 === 0 ? 2.1 : 1.35;
      ctx.stroke();
    });
    ctx.restore();

    CHIAPAS_ROUTES.forEach((route, index) => drawRoute(route, progress, time, index));
    drawHub(progress, time);
  }

  function drawHub(progress: number, time: number) {
    const hub = mapPoint(CHIAPAS_PLACES.comitan.coord, progress);
    const alpha = 0.9 * (1 - smoothstep(0.84, 1, progress));
    const pulse = 0.5 + Math.sin(time * 0.75) * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 10 + pulse * 8;
    ctx.arc(hub.x, hub.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCatalogSignal(progress: number, time: number) {
    const alpha = smoothstep(0.24, 0.52, progress) * (1 - smoothstep(0.78, 0.94, progress));

    if (alpha <= 0.01) return;

    const hub = mapPoint(CHIAPAS_PLACES.comitan.coord, progress);
    const radius = Math.min(width, height) * 0.15;
    const labels = ["Promociones", "Catalogo", "Solicitud"];

    ctx.save();
    ctx.globalAlpha = alpha;
    labels.forEach((label, index) => {
      const angle = time * 0.16 + index * ((Math.PI * 2) / labels.length);
      const x = hub.x + Math.cos(angle) * radius;
      const y = hub.y + Math.sin(angle) * radius * 0.62;
      const isPromo = label === "Promociones";

      ctx.beginPath();
      ctx.fillStyle = isPromo ? "rgba(252,211,77,0.13)" : "rgba(103,232,249,0.1)";
      ctx.strokeStyle = isPromo ? "rgba(252,211,77,0.34)" : "rgba(103,232,249,0.22)";
      ctx.lineWidth = 1;
      ctx.roundRect(x - 66, y - 20, 132, 40, 16);
      ctx.fill();
      ctx.stroke();

      if (width > 760) {
        ctx.font = "800 11px Inter, Arial, sans-serif";
        ctx.fillStyle = isPromo ? "rgba(252,211,77,0.82)" : "rgba(226,232,240,0.68)";
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + 4);
      }
    });
    ctx.restore();
  }

  function drawFinalSignal(progress: number, time: number) {
    const alpha = smoothstep(0.72, 0.98, progress);

    if (alpha <= 0.01) return;

    const centerX = width * 0.5;
    const centerY = height * 0.44;
    const radius = Math.min(width, height) * (0.12 + Math.sin(time * 0.4) * 0.01);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(103,232,249,0.22)";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + i * 46 + (time * 8) % 46, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function render(now: number) {
    const time = now * 0.001;

    renderedProgress += (scrollProgress - renderedProgress) * 0.075;

    ctx.clearRect(0, 0, width, height);
    drawBackdrop(time, renderedProgress);
    drawMap(renderedProgress, time);
    drawCatalogSignal(renderedProgress, time);
    drawFinalSignal(renderedProgress, time);

    frame = window.requestAnimationFrame(render);
  }

  resize();
  updateScrollProgress();
  frame = window.requestAnimationFrame(render);

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", updateScrollProgress, { passive: true });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", updateScrollProgress);
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
  initScrollStoryBackground();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

document.addEventListener("astro:page-load", init);
