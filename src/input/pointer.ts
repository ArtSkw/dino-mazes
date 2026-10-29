/**
 * The single Pointer Events adapter for drawing (PRD §4.3, plan §4.2).
 *
 * - Works for mouse, trackpad, pen and touch through one code path.
 * - Primary pointer only; extra fingers and non-primary mouse buttons ignored.
 * - Captures the pointer so a drag that leaves the surface keeps reporting.
 * - Coalesced samples are processed when the browser provides them.
 * - Coordinates: clientX/clientY → logical board units via the current layout
 *   transform (device pixel ratio never affects hit coordinates).
 * - Cancel, lost capture, blur and hide all end the stroke but keep the ink.
 */
import type { Controller } from '../app/controller';
import { toLogical } from '../platform/layout';
import type { Dir } from '../domain/trail';

export class PointerAdapter {
  private el: HTMLElement;
  private ctrl: Controller;
  private active: number | null = null;
  private onFirstInput: () => void;

  constructor(el: HTMLElement, ctrl: Controller, onFirstInput: () => void) {
    this.el = el;
    this.ctrl = ctrl;
    this.onFirstInput = onFirstInput;
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('lostpointercapture', this.cancel);
    el.addEventListener('keydown', this.key);
    window.addEventListener('blur', this.cancel);
  }

  private logical(e: PointerEvent): { x: number; y: number } | null {
    const layout = this.ctrl.state.layout;
    if (!layout) return null;
    return toLogical(layout.transform, e.clientX, e.clientY);
  }

  private down = (e: PointerEvent): void => {
    this.ctrl.gesture();
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // A new primary pointer means every earlier one has ended, even if the
    // browser never told us (an iPad swallowed a pointerup, 29 Oct 2026):
    // forget the stale stroke instead of ignoring the child for good.
    if (this.active !== null && this.active !== e.pointerId) this.release(this.active);
    if (this.active !== null) return;
    const p = this.logical(e);
    if (!p) return;
    e.preventDefault();
    this.onFirstInput();
    this.active = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    // A press away from the endpoint is tracked but draws nothing until the
    // pointer reaches the endpoint (or the entrance pad for a fresh start).
    this.ctrl.pointerDown(p);
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.active) return;
    const layout = this.ctrl.state.layout;
    if (!layout) return;
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = samples.length ? samples : [e];
    for (const s of list) this.ctrl.pointerMove(toLogical(layout.transform, s.clientX, s.clientY));
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.active) return;
    this.release(e.pointerId);
  };

  private cancel = (e?: Event): void => {
    if (this.active === null) return;
    const id = e instanceof PointerEvent ? e.pointerId : this.active;
    if (e instanceof PointerEvent && id !== this.active) return;
    this.release(this.active);
  };

  private release(id: number): void {
    this.active = null;
    try {
      if (this.el.hasPointerCapture(id)) this.el.releasePointerCapture(id);
    } catch {
      /* ignore */
    }
    this.ctrl.pointerUp();
  }

  /** Interrupt any stroke (UI opened, "Wróć", a new maze, leaving the maze, resize, page hidden). */
  interrupt(): void {
    if (this.active !== null) this.release(this.active);
  }

  private key = (e: KeyboardEvent): void => {
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    this.ctrl.gesture();
    this.onFirstInput();
    this.ctrl.key(dir);
  };
}
