/**
 * Loading spinner: a ring of jungle vine (owner request, 14 Oct 2026), drawn on
 * a small canvas in the game's painted style.
 *
 * Motion follows the familiar indeterminate spinner of commercial apps: the
 * whole ring turns at a steady rate (linear is right for rotation) while the
 * vine's head grows ahead and its tail catches up (ease-in-out), so the arc
 * breathes between ~43° and ~280°. Leaves sit at fixed places along the vine:
 * they unfurl as the growing head passes them and curl away at the tail, out of
 * step with each other. A small curling tendril leads at the head.
 *
 * Every frame is a pure function of time; the loop runs only while the canvas
 * is on screen. Reduced motion draws one still, closed ring of leaves.
 */

const TAU = Math.PI * 2;
const PERIOD = 2.4; // s per grow/shrink cycle
const SPIN = 1.35; // s per full turn of the ring

const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class VineSpinner {
  readonly el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private raf = 0;
  private running = false;
  private reduced = false;
  private t0 = performance.now();

  constructor(size = 76, extraClass = '') {
    this.size = size;
    this.el = document.createElement('canvas');
    this.el.className = `vine-spinner ${extraClass}`.trim();
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.width = `${size}px`;
    this.el.style.height = `${size}px`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.el.width = Math.round(size * dpr);
    this.el.height = Math.round(size * dpr);
    this.ctx = this.el.getContext('2d') as CanvasRenderingContext2D;
    this.ctx.scale(dpr, dpr);
    this.draw(0);
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) this.draw(0);
  }

  /** Start or stop the animation loop (call when the spinner is shown or hidden). */
  setActive(active: boolean): void {
    if (active && !this.running && !this.reduced) {
      this.running = true;
      const tick = (now: number): void => {
        if (!this.running) return;
        // Stop by itself when it left the screen.
        if (!this.el.isConnected || this.el.offsetParent === null) {
          this.running = false;
          return;
        }
        this.draw((now - this.t0) / 1000);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } else if (!active || this.reduced) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.draw(0);
    }
  }

  /** Arc (radians, in the ring's frame) covered by the vine at time t. */
  private arc(t: number): { tail: number; head: number; rot: number } {
    if (this.reduced) return { tail: 0.15, head: TAU - 0.15, rot: -Math.PI / 2 };
    const cycle = t / PERIOD;
    const n = Math.floor(cycle);
    const u = cycle - n;
    const min = 0.75; // ~43°
    const max = 4.9; // ~280°
    // First half: the head races ahead; second half: the tail catches up.
    const grow = u < 0.5 ? easeInOut(u / 0.5) : 1;
    const shrink = u < 0.5 ? 0 : easeInOut((u - 0.5) / 0.5);
    // Each cycle starts where the previous tail ended, so the motion is continuous.
    const base = n * (max - min);
    const tail = base + shrink * (max - min);
    const head = base + min + grow * (max - min);
    return { tail, head, rot: (t / SPIN) * TAU - Math.PI / 2 };
  }

  private draw(t: number): void {
    const g = this.ctx;
    const s = this.size;
    const c = s / 2;
    const R = s * 0.34;
    const w = s * 0.085;
    g.clearRect(0, 0, s, s);
    const { tail, head, rot } = this.arc(t);
    const a0 = rot + tail;
    const a1 = rot + head;

    // Vine: dark outline, body, then a light highlight on the outer side.
    g.lineCap = 'round';
    g.beginPath();
    g.arc(c, c, R, a0, a1);
    g.strokeStyle = '#1f4a17';
    g.lineWidth = w + 3;
    g.stroke();
    const grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#8fcf4a');
    grad.addColorStop(1, '#3f8a2e');
    g.beginPath();
    g.arc(c, c, R, a0, a1);
    g.strokeStyle = grad;
    g.lineWidth = w;
    g.stroke();
    g.beginPath();
    g.arc(c, c, R + w * 0.18, a0 + 0.05, a1 - 0.05);
    g.strokeStyle = 'rgba(230, 255, 190, 0.55)';
    g.lineWidth = Math.max(1, w * 0.22);
    g.stroke();

    // Leaves at fixed places along the vine (in the vine's own frame).
    const spacing = 0.62;
    const first = Math.ceil(tail / spacing) * spacing;
    for (let a = first; a <= head; a += spacing) {
      const k = Math.round(a / spacing);
      // Unfurl near the growing head, curl away near the tail.
      const grow = smooth(0, 0.55, head - a) * smooth(0, 0.35, a - tail);
      if (grow <= 0.02) continue;
      const outer = k % 2 === 0;
      this.leaf(c, c, R, rot + a, outer, w, grow, Math.sin(t * 3 + k) * 0.12);
    }

    // A curling tendril leads at the head.
    if (head - tail > 0.3) {
      const ah = a1;
      const hx = c + Math.cos(ah) * R;
      const hy = c + Math.sin(ah) * R;
      const tx = Math.cos(ah + Math.PI / 2);
      const ty = Math.sin(ah + Math.PI / 2);
      const nx = Math.cos(ah);
      const ny = Math.sin(ah);
      g.beginPath();
      g.moveTo(hx, hy);
      g.bezierCurveTo(hx + tx * w * 1.6, hy + ty * w * 1.6, hx + tx * w * 2.4 + nx * w * 1.4, hy + ty * w * 2.4 + ny * w * 1.4, hx + tx * w * 1.4 + nx * w * 1.6, hy + ty * w * 1.4 + ny * w * 1.6);
      g.strokeStyle = '#4f9a2c';
      g.lineWidth = Math.max(1.2, w * 0.3);
      g.stroke();
    }
  }

  /** One painted-style leaf on the vine at angle `a`, pointing along the growth. */
  private leaf(cx: number, cy: number, R: number, a: number, outer: boolean, w: number, scale: number, wobble: number): void {
    const g = this.ctx;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const len = w * 2.6 * scale;
    const wid = w * 1.25 * scale;
    // Leaves lean forward along the vine and away from it (outer or inner side).
    const dir = a + Math.PI / 2 + (outer ? -0.75 : 0.75) + wobble;
    g.save();
    g.translate(x, y);
    g.rotate(dir);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, -wid, len, 0);
    g.quadraticCurveTo(len * 0.45, wid, 0, 0);
    g.closePath();
    const lg = g.createLinearGradient(0, -wid, len, wid);
    lg.addColorStop(0, '#a6dc5a');
    lg.addColorStop(1, '#3f8a2e');
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = '#1f4a17';
    g.lineWidth = 1.2;
    g.stroke();
    g.beginPath();
    g.moveTo(len * 0.08, 0);
    g.lineTo(len * 0.85, 0);
    g.strokeStyle = 'rgba(235, 255, 200, 0.7)';
    g.lineWidth = 0.9;
    g.stroke();
    g.restore();
  }
}
