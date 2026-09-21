import localFont from 'next/font/local';
import { pageMetadata } from '@/lib/seo';
import { Pomodoro } from './Pomodoro';
import './pomodoro.css';

const londrina = localFont({
  src: [
    { path: '../../public/fonts/LondrinaSolid-Regular.ttf', weight: '400' },
    { path: '../../public/fonts/LondrinaSolid-Black.ttf', weight: '900' },
  ],
  variable: '--font-londrina',
  display: 'swap',
});
export const metadata = pageMetadata('Pomodoro — A Little Time to Focus', 'A quiet Pomodoro timer with illustrated scenes. Set your focus and break durations, take a breath, and make time for one thing.', '/pomodoro/', 'https://res.cloudinary.com/duw0custw/image/upload/v1790021948/web/nov%20rain/rooftops_eoqhkb.webp');
export default function PomodoroPage() {
  return <div className={londrina.variable}><Pomodoro /></div>;
}
