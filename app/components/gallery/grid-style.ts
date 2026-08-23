import type { CSSProperties } from 'react';

/**
 * Grid geometry for the gallery.
 *
 * Two layouts share this file. The public grid packs tiles into rows of equal
 * height, keeping each piece close to its true proportions — see `packRows`.
 * The editor uses a plain wrapping grid of identical tiles, because while
 * you're dragging cards around, a stable checkerboard is easier to aim at than
 * a layout that reflows on every drop.
 */

/**
 * Nominal row height in px — the grid's density dial.
 *
 * Rows justify to a common height, so this really controls how many tiles fit
 * across, and the count then decides how tall they render. The steps are
 * discrete, not continuous: on a ~2000px viewport, above 400 gives three per
 * row, 340–398 gives five, and below ~332 gives six.
 */
const ROW_HEIGHT = 380;

/** Near-full bleed: a 4px frame matching the 4px gaps, even all the way round. */
export const GRID_CLASS = 'flex flex-wrap gap-1 px-1';

/** A single tile's box. Width comes from the inline style below. */
export const TILE_CLASS = 'group relative block h-full w-full overflow-hidden rounded-sm bg-surface';

/** How many tiles load eagerly — roughly the first row. */
export const ABOVE_FOLD = 5;

/**
 * The one shape every tile takes in the grid.
 *
 * Rows justify to a common height, so a row's height falls out of the shapes
 * that happen to land in it — mixed ratios mean every row is a different
 * height. Giving all tiles one ratio makes the count per row constant and so
 * the height constant too, at the cost of cropping: tiles are `object-cover`,
 * so a wide photograph loses its edges rather than distorting.
 *
 * This is grid-only. Open a piece and the overlay shows it at its true
 * proportions, measured from the file itself.
 */
export const TILE_RATIO = 1.34;

/**
 * Per-item flex sizing. Every tile is identical, so each row takes the same
 * number of tiles and therefore resolves to the same height.
 */
export function tileStyle(): CSSProperties {
  return {
    flexGrow: TILE_RATIO,
    flexBasis: `${Math.round(TILE_RATIO * ROW_HEIGHT)}px`,
    aspectRatio: `${TILE_RATIO}`,
  };
}

/**
 * Invisible items that absorb the leftover space on the final row, so a short
 * last row isn't stretched to full width. They occupy no vertical space.
 *
 * @param count - How many spacers to emit
 */
export function fillerStyles(count = 6): CSSProperties[] {
  return Array.from({ length: count }, () => ({
    flexGrow: 1,
    flexBasis: `${ROW_HEIGHT}px`,
    height: 0,
  }));
}

/**
 * Row packing for a constant-height grid.
 *
 * A justified row's height is `(rowWidth - gaps) / sum of ratios`. So if every
 * row is packed to the same ratio sum, every row lands on the same height — at
 * any viewport width, with no measurement and no resize listener. That is the
 * whole trick; the rest is deciding who absorbs the rounding.
 *
 * A row rarely sums to the target exactly, so the shortfall is spread across
 * its tiles by how much distortion each can take. Weighting by ratio squared
 * means a 16:9 frame absorbs roughly ten times what a 9:16 portrait does:
 * cropping the sides of a landscape costs little, squeezing a portrait is
 * immediately obvious.
 */
export interface PackedTile<T> { item: T; ratio: number }
export interface PackedRow<T> { tiles: PackedTile<T>[]; filler: number }

/** How hard a tile resists being reshaped. Wide gives, tall holds. */
const malleability = (r: number) => r * r;

/** How far a single nudge may take a tile from its true shape. */
const MAX_NUDGE = 0.28;

/**
 * Shapes a tile may take in the grid.
 *
 * A handful of pieces are captures of whole Behance boards, several thousand
 * pixels tall — one is 1:6.7. Left alone it would pack as a hairline column and
 * drag the rest of its row down with it. Clamping the layout ratio shows the
 * head of the board instead, which is the part worth seeing; the overlay still
 * opens it at full length.
 */
const MIN_RATIO = 0.62;
const MAX_RATIO = 2.1;
export const displayRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));

export function packRows<T>(
  items: T[],
  ratioOf: (item: T) => number,
  targetSum: number,
): PackedRow<T>[] {
  const rows: PackedRow<T>[] = [];
  let current: T[] = [];
  let sum = 0;

  const flush = (isLast: boolean) => {
    if (!current.length) return;
    const ratios = current.map((item) => displayRatio(ratioOf(item)));
    const total = ratios.reduce((a, b) => a + b, 0);

    // The final row keeps its true proportions and lets an invisible filler
    // take the slack, so a short row isn't stretched to fill the width.
    if (isLast && total < targetSum * 0.92) {
      rows.push({
        tiles: current.map((item, i) => ({ item, ratio: ratios[i] })),
        filler: targetSum - total,
      });
      current = []; sum = 0;
      return;
    }

    // First pass: hand the difference to whoever can carry it, capped so no
    // single tile is mangled.
    const deficit = targetSum - total;
    const weights = ratios.map(malleability);
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    const nudged = ratios.map((r, i) => {
      const share = (deficit * weights[i]) / weightSum;
      const capped = Math.max(-r * MAX_NUDGE, Math.min(r * MAX_NUDGE, share));
      return r + capped;
    });

    // Second pass: whatever the caps refused to absorb is corrected by scaling
    // the row uniformly. Equal heights are the promise being kept here, so the
    // row must sum to the target exactly — and after the weighted pass this
    // correction is small enough to be invisible.
    const nudgedTotal = nudged.reduce((a, b) => a + b, 0) || 1;
    const k = targetSum / nudgedTotal;

    rows.push({
      tiles: current.map((item, i) => ({ item, ratio: nudged[i] * k })),
      filler: 0,
    });
    current = []; sum = 0;
  };

  items.forEach((item) => {
    const r = displayRatio(ratioOf(item));
    // Break where the row lands closest to the target, rather than always
    // overshooting it.
    if (current.length && Math.abs(sum + r - targetSum) > Math.abs(sum - targetSum)) {
      flush(false);
    }
    current.push(item);
    sum += r;
  });
  flush(true);
  return rows;
}

/** Ratio sum per row at each breakpoint — effectively "tiles across". */
export const ROW_SUM = { sm: 2.1, md: 3.4, lg: 5.2 } as const;

/** Rows stack; each row is its own flex line. */
export const ROWS_CLASS = 'flex flex-col gap-1 px-1';
export const ROW_CLASS = 'flex gap-1';
