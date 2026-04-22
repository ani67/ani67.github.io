import { KeyboardRow } from './KeyboardRow';
import { ROW_IDS } from '../lib/keymap/grid';

export function Keyboard() {
  return (
    <section aria-label="scale rows" className="flex flex-col gap-2">
      {ROW_IDS.map((id) => <KeyboardRow key={id} rowId={id} />)}
    </section>
  );
}
