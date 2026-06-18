let audioContext: AudioContext | null = null;
let isInitialized = false;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

async function unlockAudioContext() {
  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return ctx;
}

function playFishermanClick() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  oscillator.type = "square";

  oscillator.frequency.setValueAtTime(760, now);
  oscillator.frequency.exponentialRampToValueAtTime(280, now + 0.06);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, now);
  filter.frequency.exponentialRampToValueAtTime(900, now + 0.07);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

function isClickableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("[data-fisherman-click]") ||
      target.closest(".fisherman-button-primary") ||
      target.closest(".fisherman-button-secondary"),
  );
}

function initFishermanUiSounds() {
  if (isInitialized) return;

  isInitialized = true;

  document.addEventListener(
    "pointerdown",
    async (event) => {
      if (!isClickableElement(event.target)) return;

      try {
        await unlockAudioContext();
        playFishermanClick();
      } catch (error) {
        console.warn("Fisherman UI sound could not play:", error);
      }
    },
    { passive: true },
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFishermanUiSounds, {
    once: true,
  });
} else {
  initFishermanUiSounds();
}

document.addEventListener("astro:page-load", initFishermanUiSounds);