// Clip backdrop blur to the loaded font's glyphs, without blurring the title's rectangle.
// The mask is rebuilt only when the title/font changes size; the world remains live behind it.
(() => {
  document.querySelectorAll('#cover .title, #cover .wordmark-cta, :is(#ship,#planet,#brand) .ship-title, :is(#ship,#planet) .wordmark-cta, #room .dialog-title').forEach(title => {
  const isCta = title.classList.contains('wordmark-cta');
  const hasEcho = isCta || title.matches(':is(#ship,#planet) .ship-brand');
  const mask = document.createElement('canvas');
  let frame = null;
  function drawMask() {
    frame = null;
    // Fit the title with breathing room around its overlapping, individually outlined letters.
    if (title.matches('#cover .title')) {
    const measure = mask.getContext('2d');
    const desired = Math.min(324, Math.max(80, innerWidth * .20));
    measure.font = `400 ${desired}px Kilo`;
    measure.letterSpacing = `${desired * -.3}px`;
    const widest = Math.max(...[...title.querySelectorAll('.title-line')].map(line => { const m = measure.measureText(line.textContent); return Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight); }));
    const fitted = .79 * desired * Math.min(1, (innerWidth * .9 - 24) / widest, (innerHeight * .53) / (desired * 1.1));
    title.style.fontSize = `${fitted}px`;
    }
    const box = title.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const style = getComputedStyle(title), size = parseFloat(style.fontSize), pad = Math.ceil(size*(hasEcho ? 1.8 : .6));
    const ratio = Math.min(devicePixelRatio || 1, 2);
    mask.width = Math.ceil((box.width+pad*2)*ratio);
    mask.height = Math.ceil((box.height+pad*2)*ratio);
    const ctx = mask.getContext('2d');
    ctx.scale(ratio,ratio);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.letterSpacing = style.letterSpacing;
    ctx.wordSpacing = style.wordSpacing === 'normal' ? '0px' : style.wordSpacing;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    const outline = document.createElement('canvas');
    outline.width = mask.width; outline.height = mask.height;
    let edge = outline.getContext('2d');
    edge.scale(ratio, ratio);
    edge.font = ctx.font;
    edge.textBaseline = 'alphabetic';
    edge.fillStyle = edge.strokeStyle = '#fff';
    edge.lineWidth = title.matches(':is(#ship,#planet,#brand) .ship-title, #room .dialog-title') ? Math.max(.6, size * .02) : isCta ? Math.max(1.2, size * .035) : Math.max(2.5, Math.min(4, innerWidth * .0028));
    edge.lineJoin = 'round';
    const dimOutline = document.createElement('canvas');
    dimOutline.width = mask.width; dimOutline.height = mask.height;
    const dimEdge = dimOutline.getContext('2d');
    dimEdge.scale(ratio, ratio);
    for (const property of ['font', 'textBaseline', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin']) dimEdge[property] = edge[property];
    let gradientPass = title.matches('#cover .title, :is(#ship,#planet,#brand) .ship-title, #room .dialog-title');
    function paintSplitI(x, y) {
      // Split the disconnected stroke contours, so dot and stem each span all stops.
      const bounds = edge.measureText('i'), margin = edge.lineWidth + 2;
      const left = x - bounds.actualBoundingBoxLeft - margin;
      const top = y - bounds.actualBoundingBoxAscent - margin;
      const part = document.createElement('canvas');
      part.width = Math.ceil((bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight + margin * 2) * ratio);
      part.height = Math.ceil((bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent + margin * 2) * ratio);
      const ink = part.getContext('2d');
      ink.scale(ratio, ratio); ink.font = edge.font; ink.lineWidth = edge.lineWidth;
      ink.lineJoin = 'round'; ink.strokeStyle = '#fff';
      ink.strokeText('i', x - left, y - top);
      const pixels = ink.getImageData(0, 0, part.width, part.height);
      const data = pixels.data, width = part.width, height = part.height;
      const seen = new Uint8Array(width * height);
      const dx = Math.cos(Math.PI / 6), dy = Math.sin(Math.PI / 6);
      for (let start = 0; start < seen.length; start++) {
        if (seen[start] || !data[start * 4 + 3]) continue;
        const component = [start]; seen[start] = 1;
        let low = Infinity, high = -Infinity;
        for (let head = 0; head < component.length; head++) {
          const pixel = component[head], px = pixel % width, py = Math.floor(pixel / width);
          const projected = px * dx + py * dy;
          low = Math.min(low, projected); high = Math.max(high, projected);
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = px + ox, ny = py + oy, next = ny * width + nx;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || seen[next] || !data[next * 4 + 3]) continue;
            seen[next] = 1; component.push(next);
          }
        }
        for (const pixel of component) {
          const t = ((pixel % width) * dx + Math.floor(pixel / width) * dy - low) / Math.max(1, high - low);
          const alpha = t < .25 ? 1 - t / .25 : t < .5 ? 0 : (t - .5) / .5;
          const colour = t < .25 ? 255 : 0;
          data[pixel * 4] = data[pixel * 4 + 1] = data[pixel * 4 + 2] = colour;
          data[pixel * 4 + 3] *= alpha;
        }
      }
      ink.putImageData(pixels, 0, 0);
      edge.drawImage(part, left, top, part.width / ratio, part.height / ratio);
    }
    function paintGlyph(glyph, x, y) {
      paintGlyphPass(glyph, x, y);
      if (isCta) {
        const original = edge;
        edge = dimEdge; gradientPass = true;
        paintGlyphPass(glyph, x, y);
        edge = original; gradientPass = false;
      }
    }
    function paintGlyphPass(glyph, x, y) {
      edge.globalCompositeOperation = 'destination-out';
      edge.fillText(glyph, x, y);
      edge.globalCompositeOperation = 'source-over';
      if (gradientPass && glyph === 'i') { paintSplitI(x, y); return; }
      if (gradientPass) {
        const bounds = edge.measureText(glyph);
        const top = y - bounds.actualBoundingBoxAscent - edge.lineWidth / 2;
        const bottom = y + bounds.actualBoundingBoxDescent + edge.lineWidth / 2;
        // 30 degrees below horizontal, fitted to each glyph's projected bounds.
        const left = x - bounds.actualBoundingBoxLeft - edge.lineWidth / 2;
        const right = x + bounds.actualBoundingBoxRight + edge.lineWidth / 2;
        const dx = Math.cos(Math.PI / 6), dy = Math.sin(Math.PI / 6);
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        const half = Math.max(1, ((right - left) * dx + (bottom - top) * dy) / 2);
        const gradient = edge.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(.25, 'rgba(255,255,255,0)');
        gradient.addColorStop(.5, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        edge.strokeStyle = gradient;
      }
      edge.strokeText(glyph, x, y);
    }
    let inkTop = Infinity, inkBottom = -Infinity, inkLeft = Infinity;
    // Paint Racers last so it sits in front of Galactic.
    for (const line of title.querySelectorAll('.title-line')) {
      const foregroundGlyphs = [];
      const range = document.createRange();range.selectNodeContents(line);
      const rect = range.getBoundingClientRect(), text = line.textContent;
      const metrics = ctx.measureText(text);
      const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      const x = (box.width-inkWidth)/2+metrics.actualBoundingBoxLeft+pad;
      const y = rect.top-box.top+pad+metrics.fontBoundingBoxAscent;
      inkLeft = Math.min(inkLeft, x - metrics.actualBoundingBoxLeft);
      inkTop = Math.min(inkTop, y - metrics.actualBoundingBoxAscent);
      inkBottom = Math.max(inkBottom, y + metrics.actualBoundingBoxDescent);
      ctx.fillText(text,x,y);
      // Each foreground letter hides outlines behind it, then draws its own edge.
      // The shared glass mask stays continuous without double-opacity intersections.
      // Preserve positions, but paint from last to first so earlier letters sit on top.
      let prefix = '';
      const glyphs = [...text].map(glyph => {
        const offset = prefix ? ctx.measureText(prefix).width : 0;
        prefix += glyph;
        return { glyph, offset };
      });
      for (const { glyph, offset } of glyphs.reverse()) {
        if ((title.matches('#cover .title') && glyph === 'i') || (!title.closest('#cover') && (glyph === 'i' || glyph === 'e'))) foregroundGlyphs.push({ glyph, x: x+offset, y });
        else paintGlyph(glyph, x+offset, y);
      }
      // Raise i and e within their own word, preserving the line stacking order.
      for (const { glyph, x, y } of foregroundGlyphs) paintGlyph(glyph, x, y);
    }
    if (hasEcho) {
      const echoes = title.querySelector('.cta-echoes');
      echoes.replaceChildren();
      // Scale the fused silhouette first, then form each outline at a fixed pixel width.
      // Only opacity animates; scaling a finished stroke would change its thickness.
      for (let i = 0; i < 4; i++) {
        const scale = 1.08 + i * .08;
        const shape = document.createElement('canvas');
        shape.width = mask.width; shape.height = mask.height;
        const shapeCtx = shape.getContext('2d');
        shapeCtx.drawImage(mask, (mask.width*(1-scale))/2, (mask.height*(1-scale))/2, mask.width*scale, mask.height*scale);
        const ring = document.createElement('canvas');
        ring.width = mask.width; ring.height = mask.height;
        const ringCtx = ring.getContext('2d');
        const stroke = 1.5 * ratio;
        for (let step = 0; step < 24; step++) {
          const angle = step * Math.PI * 2 / 24;
          ringCtx.drawImage(shape, Math.cos(angle)*stroke, Math.sin(angle)*stroke);
        }
        ringCtx.globalCompositeOperation = 'destination-out';
        ringCtx.drawImage(shape, 0, 0);
        ringCtx.drawImage(mask, 0, 0);
        const echo = document.createElement('span');
        echo.className = 'cta-echo';
        echo.style.setProperty('--echo-mask', `url("${ring.toDataURL()}")`);
        echo.style.setProperty('--echo-opacity', [.55, .38, .23, .12][i]);
        echo.style.setProperty('--echo-delay', `${i*65}ms`);
        echoes.append(echo);
      }
    }
    if (title.matches(':is(#ship,#planet) .ship-brand, #brand .race-brand')) {
      title.style.setProperty('--brand-offset-x', `${pad - inkLeft + edge.lineWidth / 2}px`);
      title.style.setProperty('--brand-offset-y', `${pad - inkTop + edge.lineWidth / 2}px`);
    }
    title.style.setProperty('--title-ink-top', `${inkTop - edge.lineWidth / 2}px`);
    title.style.setProperty('--title-ink-height', `${inkBottom - inkTop + edge.lineWidth}px`);
    if (isCta) title.style.setProperty('--dim-outline', `url("${dimOutline.toDataURL()}")`);
    title.style.setProperty('--title-outline', `url("${outline.toDataURL()}")`);
    title.style.setProperty('--title-blur-pad',`${pad}px`);
    title.style.setProperty('--title-mask',`url("${mask.toDataURL()}")`);
  }
  function schedule(){if(frame===null)frame=requestAnimationFrame(drawMask);}
  document.fonts.load('16px Kilo').then(schedule);
  new ResizeObserver(schedule).observe(title);
  for (const line of title.querySelectorAll('.title-line')) new MutationObserver(schedule).observe(line, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize',schedule);
  });
})();
