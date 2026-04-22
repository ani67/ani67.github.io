import type { Metadata } from 'next';
import { Instrument } from './Instrument';
import './instrument.css';

export const metadata: Metadata = {
  title: 'Instrument',
  description: 'A browser-playable keyboard instrument — 12-TET and 22-śruti tunings.',
};

export default function InstrumentPage() {
  return (
    <div className="instrument-root">
      <Instrument />
    </div>
  );
}
