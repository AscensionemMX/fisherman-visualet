import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function initBaseAnimations() {
  if (prefersReducedMotion) return;

  const heroItems = gsap.utils.toArray<HTMLElement>("[data-hero-reveal]");

  gsap.set(heroItems, {
    opacity: 0,
    y: 34,
    scale: 0.98,
    filter: "blur(12px)",
  });

  gsap.to(heroItems, {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    duration: 1,
    stagger: 0.1,
    ease: "power4.out",
    delay: 0.1,
  });

  gsap.to("[data-hero-float]", {
    y: -14,
    rotate: 0.35,
    duration: 4.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.utils.toArray<HTMLElement>("[data-scroll-reveal]").forEach((element) => {
    gsap.fromTo(
      element,
      {
        opacity: 0,
        y: 46,
        scale: 0.985,
        filter: "blur(12px)",
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.95,
        ease: "power4.out",
        scrollTrigger: {
          trigger: element,
          start: "top 84%",
          once: true,
        },
      },
    );
  });

  gsap.utils.toArray<HTMLElement>("[data-card-stagger]").forEach((group) => {
    const cards = group.querySelectorAll("[data-card]");

    gsap.fromTo(
      cards,
      {
        opacity: 0,
        y: 30,
        rotateX: -8,
        filter: "blur(10px)",
        transformOrigin: "top center",
      },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: "blur(0px)",
        duration: 0.85,
        stagger: 0.08,
        ease: "power4.out",
        scrollTrigger: {
          trigger: group,
          start: "top 82%",
          once: true,
        },
      },
    );
  });

  gsap.utils.toArray<HTMLElement>("[data-parallax-soft]").forEach((element) => {
    gsap.to(element, {
      yPercent: -8,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "top bottom",
        end: "bottom top",
        scrub: 1.1,
      },
    });
  });
}

type PlasmaBlob = {
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  vx: number;
  vy: number;
  hue: "cyan" | "blue" | "red";
  pulseOffset: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

function initEpicCanvas() {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-epic-canvas]");

  if (!canvas || prefersReducedMotion || canvas.dataset.initialized === "true") {
    return;
  }

  canvas.dataset.initialized = "true";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let animationFrame = 0;

  const blobs: PlasmaBlob[] = [];
  const sparks: Spark[] = [];

  function randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  function makeBlob(index: number): PlasmaBlob {
    const hueCycle: PlasmaBlob["hue"][] = ["cyan", "blue", "red"];
    const hue = hueCycle[index % hueCycle.length];

    return {
      x: randomBetween(0.1, 0.9),
      y: randomBetween(0.12, 0.88),
      baseRadius: randomBetween(150, 320),
      radius: randomBetween(150, 320),
      vx: randomBetween(-0.00018, 0.00018),
      vy: randomBetween(-0.00018, 0.00018),
      hue,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }

  function makeSpark(): Spark {
    const edge = Math.floor(Math.random() * 4);

    if (edge === 0) {
      return {
        x: Math.random() * width,
        y: -20,
        vx: randomBetween(-0.35, 0.35),
        vy: randomBetween(0.7, 1.9),
        size: randomBetween(1.2, 3.4),
        alpha: randomBetween(0.25, 0.9),
      };
    }

    if (edge === 1) {
      return {
        x: width + 20,
        y: Math.random() * height,
        vx: randomBetween(-1.6, -0.4),
        vy: randomBetween(-0.3, 0.3),
        size: randomBetween(1.2, 3.4),
        alpha: randomBetween(0.25, 0.9),
      };
    }

    if (edge === 2) {
      return {
        x: Math.random() * width,
        y: height + 20,
        vx: randomBetween(-0.35, 0.35),
        vy: randomBetween(-1.9, -0.7),
        size: randomBetween(1.2, 3.4),
        alpha: randomBetween(0.25, 0.9),
      };
    }

    return {
      x: -20,
      y: Math.random() * height,
      vx: randomBetween(0.4, 1.6),
      vy: randomBetween(-0.3, 0.3),
      size: randomBetween(1.2, 3.4),
      alpha: randomBetween(0.25, 0.9),
    };
  }

  function setupScene() {
    blobs.length = 0;
    sparks.length = 0;

    for (let i = 0; i < 8; i += 1) {
      blobs.push(makeBlob(i));
    }

    for (let i = 0; i < 110; i += 1) {
      sparks.push(makeSpark());
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    setupScene();
  }

  function drawGlowBlob(blob: PlasmaBlob, time: number) {
    const px = blob.x * width;
    const py = blob.y * height;

    let inner = "rgba(56,189,248,0.6)";
    let mid = "rgba(56,189,248,0.24)";
    let outer = "rgba(56,189,248,0)";

    if (blob.hue === "blue") {
      inner = "rgba(96,165,250,0.62)";
      mid = "rgba(30,58,138,0.26)";
      outer = "rgba(30,58,138,0)";
    }

    if (blob.hue === "red") {
      inner = "rgba(248,113,113,0.56)";
      mid = "rgba(185,28,28,0.22)";
      outer = "rgba(185,28,28,0)";
    }

    const pulse = 1 + Math.sin(time * 1.8 + blob.pulseOffset) * 0.18;
    const radius = blob.radius * pulse;

    const gradient = ctx.createRadialGradient(px, py, radius * 0.1, px, py, radius);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.42, mid);
    gradient.addColorStop(1, outer);

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnergyRings(time: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < 4; i += 1) {
      const progress = ((time * 0.22 + i * 0.22) % 1);
      const radius = 120 + progress * Math.min(width, height) * 0.52;
      const alpha = (1 - progress) * 0.18;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 1.2 + (1 - progress) * 2;
      ctx.arc(width * 0.5, height * 0.42, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEnergyBeams(time: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const beamOffset = Math.sin(time * 0.8) * 40;
    const redOffset = Math.cos(time * 0.7) * 34;

    const beamA = ctx.createLinearGradient(0, height * 0.26 + beamOffset, width, height * 0.4 + beamOffset);
    beamA.addColorStop(0, "rgba(56,189,248,0)");
    beamA.addColorStop(0.28, "rgba(56,189,248,0.04)");
    beamA.addColorStop(0.5, "rgba(165,243,252,0.18)");
    beamA.addColorStop(0.72, "rgba(56,189,248,0.04)");
    beamA.addColorStop(1, "rgba(56,189,248,0)");

    ctx.fillStyle = beamA;
    ctx.fillRect(-width * 0.1, height * 0.1, width * 1.2, 140);

    const beamB = ctx.createLinearGradient(0, height * 0.72 + redOffset, width, height * 0.56 + redOffset);
    beamB.addColorStop(0, "rgba(185,28,28,0)");
    beamB.addColorStop(0.25, "rgba(185,28,28,0.04)");
    beamB.addColorStop(0.5, "rgba(248,113,113,0.16)");
    beamB.addColorStop(0.75, "rgba(185,28,28,0.04)");
    beamB.addColorStop(1, "rgba(185,28,28,0)");

    ctx.fillStyle = beamB;
    ctx.fillRect(-width * 0.1, height * 0.48, width * 1.2, 180);

    ctx.restore();
  }

  function drawVeins(time: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let i = 0; i < 7; i += 1) {
      const startY = height * (0.16 + i * 0.1);
      const phase = time * (0.9 + i * 0.08) + i * 0.8;

      ctx.beginPath();
      ctx.moveTo(-40, startY);

      for (let x = 0; x <= width + 40; x += 24) {
        const y =
          startY +
          Math.sin(x * 0.012 + phase) * (18 + i * 2) +
          Math.cos(x * 0.024 - phase * 0.8) * 10;

        ctx.lineTo(x, y);
      }

      const isRed = i % 3 === 2;
      ctx.strokeStyle = isRed
        ? "rgba(248,113,113,0.08)"
        : "rgba(56,189,248,0.1)";
      ctx.lineWidth = isRed ? 2.2 : 1.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSparks() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const spark of sparks) {
      const tailX = spark.x - spark.vx * 12;
      const tailY = spark.y - spark.vy * 12;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(165,243,252,${spark.alpha * 0.26})`;
      ctx.lineWidth = spark.size * 0.55;
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${spark.alpha})`;
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
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

      blob.radius =
        blob.baseRadius +
        Math.sin(time * 1.3 + blob.pulseOffset) * 24;
    }

    for (let i = 0; i < sparks.length; i += 1) {
      const spark = sparks[i];
      spark.x += spark.vx;
      spark.y += spark.vy;

      if (
        spark.x < -40 ||
        spark.x > width + 40 ||
        spark.y < -40 ||
        spark.y > height + 40
      ) {
        sparks[i] = makeSpark();
      }
    }
  }

  function render(now: number) {
    const time = now * 0.001;

    ctx.clearRect(0, 0, width, height);

    drawEnergyBeams(time);
    drawEnergyRings(time);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const blob of blobs) {
      drawGlowBlob(blob, time);
    }
    ctx.restore();

    drawVeins(time);
    drawSparks();
    updateScene(time);

    animationFrame = window.requestAnimationFrame(render);
  }

  resize();
  animationFrame = window.requestAnimationFrame(render);

  const handleResize = () => resize();

  window.addEventListener("resize", handleResize);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function initFishermanAnimations() {
  initBaseAnimations();
  initEpicCanvas();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFishermanAnimations, {
    once: true,
  });
} else {
  initFishermanAnimations();
}

document.addEventListener("astro:page-load", initFishermanAnimations);