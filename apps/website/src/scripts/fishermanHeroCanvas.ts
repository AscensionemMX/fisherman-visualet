type HeroBlob = {
  x: number;
  y: number;
  radius: number;
  baseRadius: number;
  vx: number;
  vy: number;
  color: "cyan" | "blue" | "red";
  phase: number;
};

type HeroParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

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

  const blobs: HeroBlob[] = [];
  const particles: HeroParticle[] = [];

  function randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  function makeBlob(index: number): HeroBlob {
    const colors: HeroBlob["color"][] = ["cyan", "blue", "red", "blue", "cyan"];

    return {
      x: randomBetween(0.08, 0.92),
      y: randomBetween(0.12, 0.86),
      baseRadius: randomBetween(180, 340),
      radius: randomBetween(180, 340),
      vx: randomBetween(-0.00012, 0.00012),
      vy: randomBetween(-0.0001, 0.0001),
      color: colors[index % colors.length],
      phase: Math.random() * Math.PI * 2,
    };
  }

  function makeParticle(): HeroParticle {
    return {
      x: randomBetween(0, width),
      y: randomBetween(0, height),
      vx: randomBetween(-0.18, 0.18),
      vy: randomBetween(-0.22, 0.22),
      size: randomBetween(0.8, 2.2),
      alpha: randomBetween(0.15, 0.55),
    };
  }

  function setupScene() {
    blobs.length = 0;
    particles.length = 0;

    for (let i = 0; i < 6; i += 1) {
      blobs.push(makeBlob(i));
    }

    for (let i = 0; i < 55; i += 1) {
      particles.push(makeParticle());
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    setupScene();
  }

  function getBlobColors(blob: HeroBlob) {
    if (blob.color === "red") {
      return {
        inner: "rgba(248,113,113,0.42)",
        mid: "rgba(185,28,28,0.18)",
        outer: "rgba(185,28,28,0)",
      };
    }

    if (blob.color === "blue") {
      return {
        inner: "rgba(96,165,250,0.5)",
        mid: "rgba(30,58,138,0.2)",
        outer: "rgba(30,58,138,0)",
      };
    }

    return {
      inner: "rgba(165,243,252,0.62)",
      mid: "rgba(56,189,248,0.23)",
      outer: "rgba(56,189,248,0)",
    };
  }

  function drawBlob(blob: HeroBlob, time: number) {
    const x = blob.x * width;
    const y = blob.y * height;
    const pulse = 1 + Math.sin(time * 1.2 + blob.phase) * 0.12;
    const radius = blob.radius * pulse;

    const colors = getBlobColors(blob);

    const gradient = ctx.createRadialGradient(
      x,
      y,
      radius * 0.08,
      x,
      y,
      radius,
    );

    gradient.addColorStop(0, colors.inner);
    gradient.addColorStop(0.42, colors.mid);
    gradient.addColorStop(1, colors.outer);

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWaves(time: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let i = 0; i < 5; i += 1) {
      const yBase = height * (0.22 + i * 0.13);
      const phase = time * (0.55 + i * 0.08) + i * 1.2;

      ctx.beginPath();
      ctx.moveTo(-40, yBase);

      for (let x = 0; x <= width + 40; x += 28) {
        const y =
          yBase +
          Math.sin(x * 0.01 + phase) * (18 + i * 2) +
          Math.cos(x * 0.02 - phase) * 8;

        ctx.lineTo(x, y);
      }

      ctx.strokeStyle =
        i === 3
          ? "rgba(248,113,113,0.07)"
          : "rgba(56,189,248,0.09)";

      ctx.lineWidth = i === 3 ? 2.2 : 1.7;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSoftRings(time: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < 3; i += 1) {
      const progress = (time * 0.12 + i * 0.32) % 1;
      const radius = 160 + progress * Math.min(width, height) * 0.55;
      const alpha = (1 - progress) * 0.08;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.arc(width * 0.58, height * 0.46, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const particle of particles) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(165,243,252,${particle.alpha})`;
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function updateScene(time: number) {
    for (const blob of blobs) {
      blob.x += blob.vx * 16;
      blob.y += blob.vy * 16;

      if (blob.x < -0.15 || blob.x > 1.15) blob.vx *= -1;
      if (blob.y < -0.15 || blob.y > 1.15) blob.vy *= -1;

      blob.radius = blob.baseRadius + Math.sin(time + blob.phase) * 18;
    }

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = height + 20;
      if (particle.y > height + 20) particle.y = -20;
    }
  }

  function render(now: number) {
    const time = now * 0.001;

    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "rgba(5,7,10,0.92)");
    background.addColorStop(0.48, "rgba(8,18,28,0.9)");
    background.addColorStop(1, "rgba(5,7,10,0.96)");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    drawSoftRings(time);
    drawWaves(time);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const blob of blobs) {
      drawBlob(blob, time);
    }
    ctx.restore();

    drawParticles();
    updateScene(time);

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