/**
 * Sample a dominant accent color from an image at runtime and apply it as
 * the `--inst-highlight` CSS variable. Keeps the key-highlight colour in visual
 * sync with whatever background image is currently set.
 *
 * Strategy: downsample to ~80×80, drop shadows / highlights / desaturated
 * pixels (noise), bucket remaining pixels by hue, pick the bucket with the
 * greatest saturation-weighted mass, return its mean HSL.
 */

interface HSL { h: number; s: number; l: number; }  // h: 0–360, s/l: 0–1

function rgbToHsl(r: number, g: number, b: number): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else                h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export async function extractAccent(url: string): Promise<HSL | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();

    const SIZE = 80;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    const HUE_BUCKETS = 36;                 // 10° each
    const bucketW = 360 / HUE_BUCKETS;
    const buckets = Array.from({ length: HUE_BUCKETS }, () => ({
      count: 0, weight: 0, sumH: 0, sumS: 0, sumL: 0,
    }));

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const hsl = rgbToHsl(r, g, b);

      // Drop shadows, highlights, and muddy/desaturated pixels.
      if (hsl.l < 0.3 || hsl.l > 0.85) continue;
      if (hsl.s < 0.35) continue;

      const bi = Math.floor(hsl.h / bucketW) % HUE_BUCKETS;
      const bk = buckets[bi];
      bk.count  += 1;
      bk.weight += hsl.s;                   // prefer vivid hues
      bk.sumH   += hsl.h;
      bk.sumS   += hsl.s;
      bk.sumL   += hsl.l;
    }

    let bestIdx = -1;
    let bestWeight = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].weight > bestWeight) {
        bestWeight = buckets[i].weight;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return null;

    const b = buckets[bestIdx];
    return {
      h: b.sumH / b.count,
      s: b.sumS / b.count,
      l: b.sumL / b.count,
    };
  } catch {
    return null;
  }
}

/**
 * Write the extracted HSL into `--inst-highlight` and a deeper `--inst-highlight-soft`
 * companion on the root element. Lightness + saturation are clamped to keep
 * the accent readable no matter what the image gives us.
 */
export function applyAccent(hsl: HSL): void {
  const h      = Math.round(hsl.h);
  const s      = Math.round(Math.min(Math.max(hsl.s * 100, 55), 90));
  const l      = Math.round(Math.min(Math.max(hsl.l * 100, 62), 78));
  const softS  = Math.round(s * 0.55);
  document.documentElement.style.setProperty('--inst-highlight',      `${h} ${s}% ${l}%`);
  document.documentElement.style.setProperty('--inst-highlight-soft', `${h} ${softS}% 22%`);
}
