import type { ReactNode } from 'react';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Canvas — Browser Drawing Tool', 'Draw, arrange shapes, add text and images, and organize ideas on an infinite canvas in your browser. Built by Ani Dalal.', '/canvas/');

export default function CanvasLayout({ children }: { children: ReactNode }) {
  return <>{children}<details className="fixed bottom-6 left-6 z-50 max-w-sm rounded-xl bg-background/95 p-3 text-sm text-ink shadow-lg">
    <summary className="cursor-pointer">About this canvas</summary>
    <h1 className="mt-3 text-lg">Canvas — a browser drawing tool</h1>
    <p className="mt-2">Draw freehand, arrange shapes, add text and images, and organize your work in frames. Use the toolbar to choose a tool and scroll to move around.</p>
  </details></>;
}
