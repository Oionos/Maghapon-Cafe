// Phase 0: build-time only. Phase 2 gives these a fetch path with the build-time snapshot as the
// fallback, which is what preserves "survive the venue". Only the runtime consumer is wired here.
import { menu, extras } from '../../data/menu.js';

/** @returns {typeof menu} the same array reference data/menu.js exports */
export function getMenu() {
  return menu;
}

/** @returns {typeof extras} the same array reference data/menu.js exports */
export function getExtras() {
  return extras;
}
