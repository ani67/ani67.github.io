import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { Instrument } from './Instrument';
import './instrument.css';

export const metadata = pageMetadata('Instrument — Browser Keyboard & Microtonal Synth', 'Play a browser keyboard instrument with alternate tuning systems, editable synth voices, recording and a looper. Built by Ani Dalal.', '/instrument/');

export default function InstrumentPage() {
  return (
    <div className="instrument-root">
      <Instrument />
      <details className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-black/80 p-3 text-sm text-white">
        <summary className="cursor-pointer">About this instrument</summary>
        <p className="mt-3">Play with your computer keyboard or tap the keys. Explore alternate tunings, edit synth voices, record a performance and layer loops.</p>
        <Link className="mt-3 block underline" href="/posts/vibe-coding-a-musical-instrument/">Read how it was built</Link>
      </details>
    </div>
  );
}
