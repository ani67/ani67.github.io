import type { CSSProperties } from 'react';

/**
 * Sizes a fixed-ratio box to fit the overlay's stage without cropping.
 *
 * `object-fit: contain` handles this for images and video, but an iframe is not
 * a replaced element and a wrapper that must crop to a declared ratio has no
 * intrinsic size of its own, so both need a real box computed for them.
 *
 * Container query units are what make that possible in CSS alone: `100cqw` and
 * `100cqh` are the stage's own width and height, so `min()` takes whichever of
 * the two limits binds first — the same result `contain` would give, and it
 * re-resolves on resize with no measuring code. Plain `aspect-ratio` with
 * `max-width`/`max-height` cannot do this: whichever limit clamps, the other
 * dimension keeps its declared size and the ratio breaks.
 *
 * Only meaningful inside an element with `container-type: size`.
 */
export function containBox(ratio: number): CSSProperties {
  return {
    width: `min(100cqw, calc(100cqh * ${ratio}))`,
    aspectRatio: `${ratio}`,
  };
}
