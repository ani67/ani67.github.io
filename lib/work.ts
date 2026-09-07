import fs from 'node:fs';
import path from 'node:path';
import { getGallery } from './gallery';

export const WORK_DETAILS: Record<string, { heading: string; text: string }[]> = {
  'urban-trees-in-india': [
    { heading: 'A report made spatial', text: 'Urban Trees in India brings tree laws, satellite change data and press clippings into a single zoomable canvas. The website draws on the Urban Trees Report by Kanchi Kohli and Manju Menon, bringing different kinds of evidence into the same space.' },
    { heading: 'Design and development', text: 'I designed and developed the website end to end in cables.gl. Readers can scroll to zoom, drag to move through the canvas, or use the menu to jump to a section. The project was made for Heinrich Böll Stiftung’s Regional Office New Delhi.' },
  ],
  veha: [
    { heading: 'Connectivity as infrastructure', text: 'Veha addresses habitat fragmentation at planetary scale. The project maps connectivity corridors across Russia and treats the Half-Earth concept as an infrastructure question: how can disconnected habitats become a connected system?' },
    { heading: 'A collaborative proposal', text: 'Developed with Liudmila Gridneva and Tatiana Lyubimova during The Terraforming at Strelka, Veha combines speculative cartography with a proposal for ecological connectivity. The work was presented at the Tbilisi Architecture Biennale.' },
  ],
  'terra-nova': [
    { heading: 'A speculative atlas', text: 'Terra Nova is set in 2250, after the first galactic sector has been mapped and new worlds marked for terraforming. Each generated planet offers a view into that imagined survey.' },
    { heading: 'Six procedural layers', text: 'Six layers driven by noise build the planets without external textures. The live work allows the viewer to move through the environment, change its colour palette, toggle groups of layers and rotate the view. The fxhash collection contains 255 iterations.' },
  ],
  chaos: [
    { heading: 'Finding possibility in disorder', text: 'Chaos celebrates the possibility that disorder can become beautiful. Made amid tumultuous times, it approaches chaos as a source of hope as well as destruction.' },
    { heading: 'A generative collection', text: 'Built in cables.gl and released on fxhash, Chaos is an open edition of 1,024 iterations. The gallery lets you explore the collection and open individual live works; the collection link leads to its editions on objkt.' },
  ],
  'lost-in-a-dreamscape': [
    { heading: 'An alternate imaginary', text: 'Lost in a Dreamscape is a navigable red world made for “Fissure”, curated by Shaleen Wadhwana. It responds to 2020 as a time experienced as both dream and nightmare, offering an alternate imaginary through an interactive environment.' },
    { heading: 'Moving through the work', text: 'Built in cables.gl, the experience uses movement, changes of direction and interaction with objects to explore its world. The work appeared at Pollinator Virtual Nursery and Processing Community Day in Porto. Its camera and microphone inputs drive an audio-reactive camera; the project notes state that no image, audio or video is captured.' },
  ],
};

export function getWorkProjects() {
  return getGallery().filter((entry) => !entry.hidden && Object.hasOwn(WORK_DETAILS, entry.id));
}

export function projectImages(id: string): { src: string; alt: string }[] {
  const entry = getWorkProjects().find((entry) => entry.id === id);
  if (!entry) return [];
  const media = entry.media[0];
  const hero = media?.type === 'image' ? media.src : media?.poster;
  const images = hero ? [{ src: hero, alt: media?.type === 'image' ? media.alt || entry.title : entry.title }] : [];
  if (entry.collection) {
    const collection = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/collections', `${entry.collection.file}.json`), 'utf8')) as { items: { c?: string; i: number }[] };
    for (const item of collection.items) {
      if (item.c && !images.some((image) => image.src === item.c)) images.push({ src: item.c, alt: `${entry.title} — collection image ${item.i}` });
      if (images.length >= 4) break;
    }
  }
  return images;
}
