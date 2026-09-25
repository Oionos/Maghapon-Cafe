// src/lib/back.js — Android hardware back routing (spec §6.6). Decision logic kept pure so
// node --test can drive it; Capacitor never appears here, because @capacitor/app is Phase 5.
export const EXIT_WINDOW_MS = 2000;

export const BACK = {
  CLOSE: 'close',
  BACK: 'back',
  ARM_EXIT: 'arm-exit',
  EXIT: 'exit',
};

export function decideBack({
  overlayOpen = false,
  canGoBack = false,
  now = 0,
  armedAt = null,
} = {}) {
  if (overlayOpen) return { action: BACK.CLOSE, armedAt: null };
  if (canGoBack) return { action: BACK.BACK, armedAt: null };
  if (armedAt !== null && now - armedAt < EXIT_WINDOW_MS) {
    return { action: BACK.EXIT, armedAt: null };
  }
  return { action: BACK.ARM_EXIT, armedAt: now };
}

export function createBackPress({
  isOverlayOpen,
  canGoBack,
  goBack,
  exit,
  notify,
  now = () => Date.now(),
}) {
  let armedAt = null;
  return {
    press() {
      const decision = decideBack({
        overlayOpen: isOverlayOpen(),
        canGoBack: canGoBack(),
        now: now(),
        armedAt,
      });
      armedAt = decision.armedAt;
      if (decision.action === BACK.CLOSE) notify(BACK.CLOSE);
      else if (decision.action === BACK.BACK) goBack();
      else if (decision.action === BACK.ARM_EXIT) notify(BACK.ARM_EXIT);
      else exit();
      return decision.action;
    },
    reset() {
      armedAt = null;
    },
  };
}
