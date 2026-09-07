import type { CSSProperties } from 'react';
import type { GalleryEntry } from '@/lib/gallery';
import { GalleryThumb } from './GalleryThumb';
import { GalleryTileLink } from './GalleryTileLink';
import { ABOVE_FOLD, ROW_SUM, packRows } from './grid-style';
import styles from './GalleryGrid.module.css';

/** Precompute all breakpoint widths; CSS chooses them before the first paint. */
export function GalleryGrid({ entries }: { entries: GalleryEntry[] }) {
  const tileStyles = new Map<string, CSSProperties & Record<string, string | number>>();
  for (const [breakpoint, target] of Object.entries(ROW_SUM)) {
    const rows = packRows(entries, (entry) => entry.media[0]?.ratio || 1, target);
    for (const row of rows) {
      const sum = row.tiles.reduce((total, tile) => total + tile.ratio, row.filler);
      const gaps = 4 * (row.tiles.length - 1 + (row.filler > 0 ? 1 : 0));
      for (const { item, ratio } of row.tiles) {
        const style = tileStyles.get(item.id) || {};
        style[`--width-${breakpoint}`] = `calc(${100 * ratio / sum}% - ${gaps * ratio / sum + 0.02}px)`;
        style[`--ratio-${breakpoint}`] = ratio;
        tileStyles.set(item.id, style);
      }
    }
  }
  return <ul className={styles.grid}>
    {entries.map((entry, index) => <li className={styles.tile} key={entry.id} style={tileStyles.get(entry.id)}>
      <GalleryTileLink id={entry.id} title={entry.title}>
        <GalleryThumb media={entry.media[0]} title={entry.title} priority={index < ABOVE_FOLD} />
      </GalleryTileLink>
    </li>)}
  </ul>;
}
