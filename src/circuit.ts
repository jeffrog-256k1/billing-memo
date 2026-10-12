let dispose = () => {};
export function drawCircuit(
  canvas: HTMLCanvasElement,
  names: string[],
  total: string,
  paused: boolean,
) {
  dispose();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = 600,
    H = 280,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  let frame = 0,
    last = 0;
  const motion = !paused && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#303d2d', '#637354', '#d5ee96', '#777d68'];
  function draw(t: number) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#abb29b';
    for (let x = 6; x < W; x += 9)
      for (let y = 6; y < H; y += 9) {
        ctx.globalAlpha = x > 360 ? 0.28 : 0.12;
        ctx.fillRect(x, y, 1, 1);
      }
    ctx.globalAlpha = 1;
    const shown = names.length ? names.slice(0, 4) : ['CLOUD', 'API', 'TOOLS', 'MAIL'];
    shown.forEach((name, i) => {
      const y = 44 + i * 59,
        mid = 222 + i * 27,
        end = 410;
      ctx.strokeStyle = '#7c856f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(146, y);
      ctx.lineTo(mid, y);
      ctx.lineTo(mid, 140);
      ctx.lineTo(end, 140);
      ctx.stroke();
      ctx.fillStyle = '#f1f2e9';
      ctx.fillRect(12, y - 18, 134, 36);
      ctx.strokeRect(12, y - 18, 134, 36);
      ctx.fillStyle = colors[i];
      ctx.fillRect(22, y - 4, 8, 8);
      ctx.fillStyle = '#242b20';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(name.toUpperCase().slice(0, 15), 40, y + 4);
      const segments = [
        [146, y, mid, y],
        [mid, y, mid, 140],
        [mid, 140, end, 140],
      ];
      const length = mid - 146 + Math.abs(140 - y) + end - mid;
      let cursor = ((motion ? t / 14 : 170) + i * 77) % length;
      for (const [x1, y1, x2, y2] of segments) {
        const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
        if (cursor <= len) {
          ctx.fillStyle = '#c35a2f';
          ctx.fillRect(
            x1 + ((x2 - x1) * cursor) / (len || 1) - 3,
            y1 + ((y2 - y1) * cursor) / (len || 1) - 3,
            6,
            6,
          );
          break;
        }
        cursor -= len;
      }
      ctx.fillStyle = '#283422';
      ctx.fillRect(mid - 2, y - 2, 4, 4);
    });
    ctx.fillStyle = '#e0efb7';
    ctx.fillRect(395, 91, 192, 99);
    ctx.strokeStyle = '#343d2b';
    ctx.strokeRect(395, 91, 192, 99);
    ctx.fillStyle = '#414b34';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MONTHLY OUT / Σ', 410, 116);
    ctx.fillStyle = '#20291b';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(total.slice(0, 15), 410, 150);
    ctx.font = '9px monospace';
    ctx.fillText('INPUT → SCHEDULE → TOTAL', 410, 174);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5c684e';
    ctx.font = '10px monospace';
    ctx.fillText('FIG. 01 / COST CIRCUIT', 584, 267);
  }
  function tick(t: number) {
    if (!document.hidden && t - last >= 40) {
      draw(t);
      last = t;
    }
    frame = requestAnimationFrame(tick);
  }
  draw(0);
  if (motion) frame = requestAnimationFrame(tick);
  dispose = () => cancelAnimationFrame(frame);
}
