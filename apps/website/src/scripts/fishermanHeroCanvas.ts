import {
  CHIAPAS_PLACES,
  CHIAPAS_ROUTES,
  type ChiapasCoord,
  type ChiapasRoute,
  projectChiapasToUnit,
} from "../data/chiapasMap";

type ScreenPoint = {
  x: number;
  y: number;
};

type RoutePulse = {
  routeIndex: number;
  speed: number;
  delay: number;
};

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const chiapasShape = [
  [0.21, 0.21],
  [0.32, 0.13],
  [0.49, 0.16],
  [0.58, 0.25],
  [0.7, 0.28],
  [0.81, 0.4],
  [0.84, 0.58],
  [0.75, 0.79],
  [0.62, 0.85],
  [0.52, 0.8],
  [0.4, 0.87],
  [0.27, 0.76],
  [0.17, 0.64],
  [0.14, 0.45],
];

const reliefLines = [
  [
    [0.22, 0.34],
    [0.34, 0.25],
    [0.48, 0.28],
    [0.6, 0.4],
    [0.74, 0.45],
  ],
  [
    [0.25, 0.52],
    [0.38, 0.48],
    [0.52, 0.55],
    [0.66, 0.62],
    [0.76, 0.7],
  ],
  [
    [0.34, 0.2],
    [0.44, 0.32],
    [0.54, 0.38],
    [0.68, 0.35],
  ],
  [
    [0.18, 0.66],
    [0.3, 0.68],
    [0.43, 0.76],
    [0.56, 0.82],
  ],
];

function initHeroCanvas() {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-canvas]");

  if (!canvas || prefersReducedMotion || canvas.dataset.initialized === "true") {
    return;
  }

  canvas.dataset.initialized = "true";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  let frame = 0;

  const pulses: RoutePulse[] = CHIAPAS_ROUTES.map((_, index) => ({
    routeIndex: index,
    speed: 0.000048 + index * 0.000007,
    delay: index * 0.15,
  }));

  function resize() {
    const rect = canvas.getBoundingClientRect();

    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function mapPoint(coord: ChiapasCoord): ScreenPoint {
    const point = projectChiapasToUnit(coord);
    const scale = Math.min(width * 0.92, height * 1.08);
    const mapWidth = scale;
    const mapHeight = scale * 0.72;
    const offsetX = width * 0.5 - mapWidth * 0.5;
    const offsetY = height * 0.5 - mapHeight * 0.48;

    return {
      x: offsetX + point.x * mapWidth,
      y: offsetY + point.y * mapHeight,
    };
  }

  function unitPoint(point: number[]): ScreenPoint {
    const scale = Math.min(width * 0.92, height * 1.08);
    const mapWidth = scale;
    const mapHeight = scale * 0.72;
    const offsetX = width * 0.5 - mapWidth * 0.5;
    const offsetY = height * 0.5 - mapHeight * 0.48;

    return {
      x: offsetX + point[0] * mapWidth,
      y: offsetY + point[1] * mapHeight,
    };
  }

  function routePoints(route: ChiapasRoute) {
    return route.coords.map(mapPoint);
  }

  function drawBackground(time: number) {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#04070C");
    background.addColorStop(0.44, "#06111A");
    background.addColorStop(1, "#05070A");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;

    const gridSize = Math.max(58, Math.min(86, width / 16));
    const offset = (time * 2.8) % gridSize;

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

  function drawMapShell(time: number) {
    ctx.save();
    ctx.beginPath();

    chiapasShape.forEach((point, index) => {
      const screen = unitPoint(point);

      if (index === 0) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    });

    ctx.closePath();

    const fill = ctx.createLinearGradient(0, height * 0.1, width, height * 0.95);
    fill.addColorStop(0, "rgba(103,232,249,0.18)");
    fill.addColorStop(0.48, "rgba(15,76,92,0.34)");
    fill.addColorStop(1, "rgba(2,6,23,0.62)");

    ctx.shadowColor = "rgba(103,232,249,0.18)";
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
        const screen = unitPoint([
          point[0] + Math.sin(time * 0.12 + index) * 0.003,
          point[1],
        ]);

        if (pointIndex === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.strokeStyle = index % 2 === 0 ? "rgba(226,232,240,0.18)" : "rgba(6,182,212,0.16)";
      ctx.lineWidth = index % 2 === 0 ? 2.2 : 1.4;
      ctx.stroke();
    });

    ctx.restore();

    const hub = mapPoint(CHIAPAS_PLACES.comitan.coord);
    const glow = ctx.createRadialGradient(
      hub.x,
      hub.y,
      10,
      hub.x,
      hub.y,
      Math.min(width, height) * (0.3 + Math.sin(time * 0.32) * 0.03),
    );

    glow.addColorStop(0, "rgba(103,232,249,0.22)");
    glow.addColorStop(0.48, "rgba(14,165,233,0.08)");
    glow.addColorStop(1, "rgba(14,165,233,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRoute(route: ChiapasRoute, time: number, index: number) {
    const points = routePoints(route);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle =
      route.tone === "promo"
        ? "rgba(252,211,77,0.36)"
        : route.tone === "primary"
          ? "rgba(103,232,249,0.38)"
          : "rgba(103,232,249,0.26)";
    ctx.lineWidth = route.tone === "primary" ? 2.6 : 1.8;
    ctx.setLineDash(route.tone === "primary" ? [22, 16] : [14, 18]);
    ctx.lineDashOffset = -time * 12 - index * 24;

    ctx.beginPath();
    points.forEach((point, pointIndex) => {
      if (pointIndex === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function pointOnPolyline(points: ScreenPoint[], progress: number) {
    const distances = points.slice(1).map((point, index) => {
      const previous = points[index];

      return Math.hypot(point.x - previous.x, point.y - previous.y);
    });
    const total = distances.reduce((sum, distance) => sum + distance, 0);
    let target = total * progress;

    for (let index = 0; index < distances.length; index += 1) {
      const distance = distances[index];

      if (target <= distance) {
        const start = points[index];
        const end = points[index + 1];
        const ratio = distance === 0 ? 0 : target / distance;

        return {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
      }

      target -= distance;
    }

    return points[points.length - 1];
  }

  function drawPulse(pulse: RoutePulse, time: number) {
    const route = CHIAPAS_ROUTES[pulse.routeIndex];
    const progress = (pulse.delay + time * pulse.speed * 60) % 1;
    const point = pointOnPolyline(routePoints(route), progress);
    const isPromo = route.tone === "promo";

    ctx.save();
    ctx.shadowColor = isPromo ? "rgba(252,211,77,0.72)" : "rgba(103,232,249,0.7)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = isPromo ? "#FCD34D" : "#67E8F9";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(point.x, point.y, isPromo ? 5.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlace(label: string, coord: ChiapasCoord, tone: "hub" | "route", time: number) {
    const point = mapPoint(coord);
    const isHub = tone === "hub";
    const pulse = Math.sin(time * 0.85 + point.x * 0.01) * 0.5 + 0.5;

    ctx.save();
    ctx.strokeStyle = isHub ? "rgba(255,255,255,0.42)" : "rgba(103,232,249,0.34)";
    ctx.fillStyle = isHub ? "#FFFFFF" : "#67E8F9";
    ctx.lineWidth = isHub ? 12 + pulse * 8 : 6 + pulse * 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, isHub ? 8 : 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    if (width > 720) {
      ctx.font = `${isHub ? "900" : "800"} ${isHub ? 14 : 11}px Inter, Arial, sans-serif`;
      ctx.fillStyle = isHub ? "rgba(255,255,255,0.92)" : "rgba(226,232,240,0.7)";
      ctx.fillText(label, point.x + 14, point.y - 12);
    }

    ctx.restore();
  }

  function drawCinematicSweep(time: number) {
    const x = width * (0.08 + ((time * 0.022) % 0.84));

    ctx.save();
    const gradient = ctx.createLinearGradient(x - 180, 0, x + 180, 0);
    gradient.addColorStop(0, "rgba(103,232,249,0)");
    gradient.addColorStop(0.5, "rgba(103,232,249,0.08)");
    gradient.addColorStop(1, "rgba(103,232,249,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 180, 0, 360, height);
    ctx.restore();
  }

  function render(now: number) {
    const time = now * 0.001;

    ctx.clearRect(0, 0, width, height);
    drawBackground(time);
    drawMapShell(time);
    drawCinematicSweep(time);

    CHIAPAS_ROUTES.forEach((route, index) => drawRoute(route, time, index));
    pulses.forEach((pulse) => drawPulse(pulse, time));
    drawPlace(CHIAPAS_PLACES.comitan.label, CHIAPAS_PLACES.comitan.coord, "hub", time);
    CHIAPAS_ROUTES.forEach((route) => {
      drawPlace(route.label, route.coords[route.coords.length - 1], "route", time);
    });

    frame = window.requestAnimationFrame(render);
  }

  resize();
  frame = window.requestAnimationFrame(render);

  const handleResize = () => resize();

  window.addEventListener("resize", handleResize);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
  initHeroCanvas();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

document.addEventListener("astro:page-load", init);
