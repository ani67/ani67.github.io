import { Fragment } from 'react';
import type { RowId } from '../lib/types';
import { ROWS, positionToStep, mobilePositionToStep } from '../lib/keymap/grid';
import { Key } from './Key';

export function KeyboardRow({ rowId }: { rowId: RowId }) {
  const row = ROWS[rowId];
  return (
    <div className="grid grid-cols-4 gap-2 md:grid-cols-10">
      {row.keys.map((code, degree) => {
        const desktopStep = positionToStep(rowId, degree);
        if (degree < 4) {
          const mobileStep = mobilePositionToStep(rowId, degree);
          return (
            <Fragment key={code}>
              <Key code={code} row={rowId} step={mobileStep}  className="md:hidden" />
              <Key code={code} row={rowId} step={desktopStep} className="hidden md:flex" />
            </Fragment>
          );
        }
        return (
          <Key key={code} code={code} row={rowId} step={desktopStep} className="hidden md:flex" />
        );
      })}
    </div>
  );
}
