import type { RowId } from '../lib/types';
import { ROWS } from '../lib/keymap/grid';
import { Key } from './Key';

export function KeyboardRow({ rowId }: { rowId: RowId }) {
  const row = ROWS[rowId];
  return (
    <div className="grid grid-cols-7 gap-2 md:grid-cols-10">
      {row.keys.map((code, degree) => (
        <Key
          key={code}
          code={code}
          row={rowId}
          degree={degree}
          className={degree >= 7 ? 'hidden md:flex' : undefined}
        />
      ))}
    </div>
  );
}
