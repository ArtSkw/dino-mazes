/**
 * Accessible DOM overlay: welcome, quest intro, controls, collection, settings.
 * All labels are live text (Polish/English); hit targets ≥ 56 CSS px.
 * The UI renders controller state and sends commands; it owns no game state.
 */
import type { Controller, GameEvent, Reward } from '../app/controller';
import { CHARACTERS, TREASURES, TREASURE_ORDER } from '../data/content';
import type { StringKey } from '../data/i18n';
import type { CharacterId, Lang, TreasureId } from '../domain/types';
import { ASSETS, assetUrl, friendFrame } from '../game/assets';
import type { UiBridge } from '../game/scene';
import type { OpeningStep } from '../game/opening';
import { clusterSpec, introCardRect, orientationOf, type Rect } from '../platform/layout';
import { flash, h, place, show } from './dom';
import { ICONS, type IconName } from './icons';

type Translatable = { el: HTMLElement; key: StringKey; attr?: 'aria-label' | 'title' | 'text' };

export class Ui implements UiBridge {
  private ctrl: Controller;
  private root: HTMLElement;
  private i18n: Translatable[] = [];
  private badgeHold = false;
  private lastNewTreasure: TreasureId | null = null;
  private bubbleTimer = 0;
  private bubbleHideTimer = 0;
  private bannerTimer = 0;
  private hintTimer = 0;
  private lastFocus: HTMLElement | null = null;
  private rotateDismissed = false;
  /** Screen rect of the companion's frame (from the renderer), or null when hidden. */
  private companionRect: Rect | null = null;
  private castBoxes: Rect[] = [];
  private shownScreen = '';
  surface!: HTMLDivElement;

  // Elements
  private loading!: HTMLElement;
  private loadingText!: HTMLElement;
  private loadError!: HTMLElement;
  private welcome!: HTMLElement;
  private welcomeCard!: HTMLElement;
  private signEl!: HTMLElement;
  private vines: HTMLImageElement[] = [];
  private sproutImgs: HTMLImageElement[] = [];
  private curtains!: HTMLElement;
  private curtainsOpened = false;
  private openingSkip!: HTMLButtonElement;
  private openingTimers: number[] = [];
  private playBtn!: HTMLButtonElement;
  private playLabel!: HTMLElement;
  private castLayer!: HTMLElement;
  private intro!: HTMLElement;
  private introPrompt!: HTMLElement;
  private introTreasure!: HTMLImageElement;
  private introTreasureName!: HTMLElement;
  private introRibbon!: HTMLElement;
  private goBtn!: HTMLButtonElement;
  private hud!: HTMLElement;
  private companionBtn!: HTMLButtonElement;
  private bubble!: HTMLElement;
  private bubbleText!: HTMLElement;
  private bubbleTail!: SVGSVGElement;
  private tailFill!: SVGPathElement;
  private tailEdge!: SVGPathElement;
  private cluster!: HTMLElement;
  private collectionBtn!: HTMLButtonElement;
  private badge!: HTMLElement;
  private settingsBtn!: HTMLButtonElement;
  private homeBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private resetLabel!: HTMLElement;
  private hintBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private skipLayer!: HTMLButtonElement;
  private banner!: HTMLElement;
  private collection!: HTMLElement;
  private slots: Array<{ id: TreasureId; btn: HTMLButtonElement; img: HTMLImageElement; name: HTMLElement; count: HTMLElement }> = [];
  private settings!: HTMLElement;
  private settingsLang!: HTMLButtonElement[];
  private settingsSound!: HTMLButtonElement[];
  private settingsMotion!: HTMLButtonElement[];
  private easierRow!: HTMLElement;
  private restartRow!: HTMLElement;
  private confirm!: HTMLElement;
  private live!: HTMLElement;
  private rotateToast!: HTMLElement;
  private debug: HTMLElement | null = null;

  constructor(root: HTMLElement, ctrl: Controller) {
    this.root = root;
    this.ctrl = ctrl;
    this.build();
    ctrl.on((e) => this.onEvent(e));
    document.addEventListener('keydown', (e) => {
      if (this.ctrl.state.opening) {
        this.ctrl.skipOpening();
        return;
      }
      if (e.key === 'Escape') {
        if (!this.confirm.hidden) this.closeConfirm();
        else if (this.ctrl.state.overlay) this.closeOverlay();
      }
    });
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Construction

  private tr(el: HTMLElement, key: StringKey, attr: Translatable['attr'] = 'text'): HTMLElement {
    this.i18n.push({ el, key, attr });
    return el;
  }

  private button(cls: string, onClick: () => void, ...children: Array<Node | string>): HTMLButtonElement {
    const b = h('button', { class: cls, type: 'button' }, ...children);
    b.addEventListener('click', () => {
      this.ctrl.gesture();
      onClick();
    });
    return b;
  }

  /**
   * Loading indicator: the painted seedling (the same art "Graj" later sprouts
   * from) growing through its stages and swaying, instead of a flat shape.
   */
  private sproutLoader(extra = ''): HTMLElement {
    const stages = ASSETS.intro.sprout.stages.slice(0, 3);
    return h(
      'div',
      { class: `sprout-loader ${extra}`.trim(), 'aria-hidden': 'true' },
      ...stages.map((src, i) => h('img', { class: `stage s${i}`, src: assetUrl(src), alt: '', draggable: 'false' })),
    );
  }

  private icon(name: IconName): HTMLElement {
    return h('span', { class: 'icon', html: ICONS[name] });
  }

  private build(): void {
    const c = this.ctrl;
    // Loading / error
    this.loadingText = this.tr(h('p', { class: 'loading-text' }), 'loading');
    this.loadError = h(
      'div',
      { class: 'load-error', hidden: true },
      this.tr(h('p'), 'loadError'),
      this.tr(this.button('btn btn-leaf', () => window.location.reload()), 'retry'),
    );
    this.loading = h('div', { class: 'screen loading' }, this.sproutLoader(), this.loadingText, this.loadError);

    // Welcome
    this.playLabel = h('span', { class: 'label' });
    this.playBtn = this.button('btn btn-leaf btn-play', () => {
      c.sfx('tap');
      c.play();
    }, this.icon('play'), this.playLabel);
    this.castLayer = h('div', { class: 'cast-layer' });
    // Title on a wooden sign hanging from two vines (live, localized text),
    // "Graj" below it; during the opening the button sprouts from a seedling.
    const signArt = ASSETS.intro.titleSign;
    this.vines = signArt.loops.map(() => h('img', { class: 'vine', src: assetUrl(ASSETS.intro.vine.image), alt: '', draggable: 'false' }));
    this.signEl = h(
      'div',
      { class: 'sign', style: `aspect-ratio:${signArt.width}/${signArt.height}` },
      ...this.vines,
      h('img', { class: 'sign-board', src: assetUrl(signArt.image), alt: '', draggable: 'false' }),
      h(
        'div',
        { class: 'sign-text', style: `top:${(signArt.plank.top * 100).toFixed(1)}%;bottom:${((1 - signArt.plank.bottom) * 100).toFixed(1)}%` },
        this.tr(h('h1', { class: 'title' }), 'appTitle'),
        this.tr(h('p', { class: 'tagline' }), 'tagline'),
      ),
    );
    this.sproutImgs = ASSETS.intro.sprout.stages.map((src) => h('img', { class: 'sprout', src: assetUrl(src), alt: '', hidden: true, draggable: 'false' }));
    this.welcomeCard = h('div', { class: 'welcome-card' }, this.signEl, h('div', { class: 'play-wrap' }, ...this.sproutImgs, this.playBtn));
    this.welcome = h('div', { class: 'screen welcome' }, this.castLayer, this.welcomeCard);

    // Opening: closed leaf curtains (also the loading screen) and a tap-to-skip layer.
    const curtain = (side: 'left' | 'right'): HTMLImageElement => {
      const art = side === 'left' ? ASSETS.intro.curtainLeft : ASSETS.intro.curtainRight;
      return h('img', { class: `curtain ${side}`, src: assetUrl(art.image), alt: '', draggable: 'false', style: `--ar:${(art.width / art.height).toFixed(4)}` });
    };
    this.curtains = h(
      'div',
      { class: 'curtains', hidden: true, 'aria-hidden': 'true' },
      h('div', { class: 'curtain-backing' }),
      curtain('left'),
      curtain('right'),
      this.sproutLoader('curtain-spinner'),
    );
    this.openingSkip = this.button('opening-skip', () => c.skipOpening());
    this.tr(this.openingSkip, 'skip', 'aria-label');
    show(this.openingSkip, false);

    // Quest intro
    this.introRibbon = this.tr(h('div', { class: 'ribbon', hidden: true }), 'specialGuest');
    this.introPrompt = h('p', { class: 'intro-prompt', id: 'quest-prompt' });
    this.introTreasure = h('img', { class: 'intro-treasure', alt: '' });
    this.introTreasureName = h('p', { class: 'intro-treasure-name' });
    this.goBtn = this.button('btn btn-leaf btn-go', () => {
      c.sfx('pop');
      c.reveal();
      window.setTimeout(() => this.surface.focus({ preventScroll: true }), 50);
    });
    this.intro = h(
      'div',
      { class: 'screen intro', role: 'dialog', 'aria-labelledby': 'quest-prompt' },
      h(
        'div',
        { class: 'intro-card panel' },
        this.introRibbon,
        h('div', { class: 'intro-treasure-wrap' }, h('div', { class: 'treasure-halo' }), this.introTreasure),
        this.introTreasureName,
        this.introPrompt,
        this.goBtn,
      ),
    );

    // Drawing surface (the only element with touch-action: none)
    this.surface = h('div', { class: 'play-surface', tabindex: 0, role: 'application' });
    this.tr(this.surface, 'mazeLabel', 'aria-label');

    // HUD. The quest friend in the corner is the quest reminder: tapping it
    // makes it react and say a short line in a speech bubble (the quest first,
    // then friendly lines). No badge or extra emblem sits on the artwork.
    this.companionBtn = this.button('companion-btn', () => this.talk());
    this.bubbleText = h('span', { class: 'bubble-text' });
    // The tail is drawn as an SVG wedge from the bubble's edge to the friend's
    // head, so it always points at the speaker, whatever sits in between.
    const NS = 'http://www.w3.org/2000/svg';
    this.bubbleTail = document.createElementNS(NS, 'svg');
    this.bubbleTail.setAttribute('class', 'bubble-tail');
    this.tailFill = document.createElementNS(NS, 'path');
    this.tailFill.setAttribute('class', 'fill');
    this.tailEdge = document.createElementNS(NS, 'path');
    this.tailEdge.setAttribute('class', 'edge');
    this.bubbleTail.append(this.tailFill, this.tailEdge);
    this.bubble = h('div', { class: 'bubble', hidden: true, 'aria-hidden': 'true' }, this.bubbleText);
    this.bubble.append(this.bubbleTail);

    this.badge = h('span', { class: 'badge', 'aria-hidden': 'true' });
    this.collectionBtn = this.button('btn-round collection-btn', () => {
      c.sfx('tap');
      this.openOverlay('collection');
    }, this.icon('chest'), this.badge);
    this.tr(this.collectionBtn, 'myTreasures', 'aria-label');
    this.settingsBtn = this.button('btn-round settings-btn', () => {
      c.sfx('tap');
      this.openOverlay('settings');
    }, this.icon('gear'));
    this.tr(this.settingsBtn, 'settings', 'aria-label');
    this.cluster = h('div', { class: 'cluster' }, this.collectionBtn, this.settingsBtn);
    // Back to the welcome screen: beside the cluster on maze screens only
    // (never inside settings, never on the welcome screen itself).
    this.homeBtn = this.button('btn-round home-btn', () => {
      c.sfx('tap');
      c.goHome();
    }, this.icon('home'));
    this.tr(this.homeBtn, 'home', 'aria-label');

    this.resetLabel = this.tr(h('span', { class: 'label' }), 'startOver');
    this.resetBtn = this.button('btn btn-wood reset-btn', () => {
      c.sfx('tap');
      c.resetTrail();
    }, this.icon('restart'), this.resetLabel);
    this.tr(this.resetBtn, 'startOverA11y', 'aria-label');
    this.hintBtn = this.button('btn-round hint-btn', () => c.hint(), h('img', { src: assetUrl(ASSETS.foliage['butterfly']?.image ?? ''), alt: '' }));
    this.tr(this.hintBtn, 'hint', 'aria-label');
    this.nextBtn = this.button('btn btn-wood next-btn', () => {
      c.sfx('pop');
      c.next();
    }, this.tr(h('span', { class: 'label' }), 'next'), this.icon('next'));
    this.skipLayer = this.button('skip-layer', () => c.skipCelebration());
    this.tr(this.skipLayer, 'skip', 'aria-label');
    this.banner = h('div', { class: 'banner', hidden: true, 'aria-hidden': 'true' });
    this.hud = h('div', { class: 'hud' }, this.companionBtn, this.bubble, this.resetBtn, this.hintBtn, this.nextBtn, this.skipLayer, this.banner);

    // Collection overlay
    const grid = h('div', { class: 'slots' });
    for (const id of TREASURE_ORDER) {
      const img = h('img', { src: assetUrl(ASSETS.treasures[id].image), alt: '' });
      const name = h('span', { class: 'slot-name' });
      const count = h('span', { class: 'slot-count' });
      const btn = this.button('slot', () => this.tapSlot(id), h('span', { class: 'slot-nest', 'aria-hidden': 'true' }), img, name, count);
      grid.append(btn);
      this.slots.push({ id, btn, img, name, count });
    }
    const closeCollection = this.button('btn-round close-btn', () => this.closeOverlay(), this.icon('close'));
    this.tr(closeCollection, 'close', 'aria-label');
    this.collection = h(
      'div',
      { class: 'overlay collection', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'collection-title', hidden: true },
      h('div', { class: 'collection-bg', style: `background-image:url(${assetUrl(ASSETS.backgrounds.collection.image)})` }),
      h('div', { class: 'collection-inner' }, this.tr(h('h2', { id: 'collection-title' }), 'myTreasures'), grid),
      closeCollection,
    );

    // Settings overlay (for parents). The single place for language, sound,
    // difficulty and motion; nothing is duplicated on the play screens.
    const seg = (items: Array<[StringKey, () => void, IconName?]>): HTMLButtonElement[] =>
      items.map(([key, fn, icon]) => {
        const label = this.tr(h('span', { class: 'label' }), key);
        return this.button('seg', fn, ...(icon ? [this.icon(icon)] : []), label);
      });
    this.settingsLang = seg([
      ['polish', () => this.setLang('pl')],
      ['english', () => this.setLang('en')],
    ]);
    this.settingsSound = seg([
      ['on', () => c.setMuted(false), 'soundOn'],
      ['off', () => c.setMuted(true), 'soundOff'],
    ]);
    this.settingsMotion = seg([
      ['motionSystem', () => c.setMotion('system')],
      ['motionReduced', () => c.setMotion('reduced')],
    ]);
    const group = (label: StringKey, buttons: HTMLButtonElement[]): HTMLElement => {
      const g = h('div', { class: 'segmented', role: 'group' }, ...buttons);
      this.tr(g, label, 'aria-label');
      return g;
    };
    const row = (icon: IconName, label: StringKey, ...content: Node[]): HTMLElement =>
      h(
        'div',
        { class: 'setting-row' },
        h('span', { class: 'setting-label' }, this.icon(icon), this.tr(h('span'), label)),
        h('div', { class: 'setting-control' }, ...content),
      );
    const easierBtn = this.tr(this.button('btn btn-wood small', () => c.easierMaze()), 'easierMaze');
    this.easierRow = h('div', { class: 'setting-row easier', hidden: true }, easierBtn, this.tr(h('p', { class: 'note' }), 'easierMazeNote'));
    const restartBtn = this.button('link-danger', () => this.openConfirm(), this.icon('newGame'), this.tr(h('span'), 'restartGame'));
    // Only offered while a maze adventure is open (not from the welcome screen).
    this.restartRow = h('div', { class: 'setting-row actions' }, restartBtn);
    const closeSettings = this.button('btn-round small close-btn', () => this.closeOverlay(), this.icon('close'));
    this.tr(closeSettings, 'close', 'aria-label');
    this.settings = h(
      'div',
      { class: 'overlay settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title', hidden: true },
      h(
        'div',
        { class: 'settings-panel panel' },
        h('div', { class: 'panel-head' }, this.tr(h('h2', { id: 'settings-title' }), 'forParents'), closeSettings),
        h(
          'div',
          { class: 'settings-body' },
          row('language', 'language', group('language', this.settingsLang)),
          row('soundOn', 'sound', group('sound', this.settingsSound)),
          row('motion', 'motion', group('motion', this.settingsMotion)),
          this.easierRow,
          this.restartRow,
          this.tr(h('p', { class: 'note' }), 'parentHelp'),
          this.tr(h('p', { class: 'note' }), 'privacyNote'),
        ),
      ),
    );

    // Confirmation for clearing the collection
    this.confirm = h(
      'div',
      { class: 'overlay confirm', role: 'alertdialog', 'aria-modal': 'true', hidden: true },
      h(
        'div',
        { class: 'confirm-panel panel' },
        this.tr(h('p'), 'restartGameConfirm'),
        h(
          'div',
          { class: 'confirm-actions' },
          this.tr(this.button('btn btn-wood small', () => this.closeConfirm()), 'cancel'),
          this.tr(this.button('btn btn-danger small', () => {
            show(this.confirm, false);
            c.restartGame();
          }), 'yesRestart'),
        ),
      ),
    );

    this.rotateToast = h('div', { class: 'toast rotate', hidden: true }, this.tr(h('span'), 'rotate'));
    const dismiss = this.button('toast-close', () => {
      this.rotateDismissed = true;
      this.render();
    }, this.icon('close'));
    this.tr(dismiss, 'close', 'aria-label');
    this.rotateToast.append(dismiss);

    this.live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });

    this.root.append(this.loading, this.welcome, this.intro, this.surface, this.hud, this.cluster, this.homeBtn, this.collection, this.settings, this.confirm, this.rotateToast, this.curtains, this.openingSkip, this.live);

    if (new URLSearchParams(window.location.search).has('debug')) {
      this.debug = h('pre', { class: 'debug' });
      this.root.append(this.debug);
      window.setInterval(() => this.renderDebug(), 500);
    }
  }

  // ---------------------------------------------------------------------------
  // Commands

  private setLang(lang: Lang): void {
    this.ctrl.sfx('tap');
    this.ctrl.setLang(lang);
  }

  private openOverlay(o: 'collection' | 'settings'): void {
    this.lastFocus = document.activeElement as HTMLElement | null;
    this.ctrl.openOverlay(o);
    const target = o === 'collection' ? this.collection : this.settings;
    window.setTimeout(() => target.querySelector<HTMLElement>('.close-btn')?.focus(), 30);
  }

  private closeOverlay(): void {
    this.ctrl.sfx('tap');
    this.ctrl.closeOverlay();
    this.lastNewTreasure = null;
    this.lastFocus?.focus?.({ preventScroll: true });
  }

  private openConfirm(): void {
    show(this.confirm, true);
    window.setTimeout(() => this.confirm.querySelector<HTMLElement>('button')?.focus(), 30);
  }

  private closeConfirm(): void {
    show(this.confirm, false);
    this.settings.querySelector<HTMLElement>('.link-danger')?.focus();
  }

  private tapSlot(id: TreasureId): void {
    const save = this.ctrl.store.get();
    if (!(save.collection[id]?.count ?? 0)) return;
    const slot = this.slots.find((s) => s.id === id);
    if (slot) flash(slot.img, `motion-${TREASURES[id].motion}`, 1000);
    this.ctrl.tapTreasure(id);
  }

  /** Tap on the corner friend: it says one short line in a speech bubble. */
  private talk(): void {
    const text = this.ctrl.talk();
    if (!text) return;
    this.say(text);
    this.announce(`${this.ctrl.characterName()}: ${text}`);
  }

  private say(text: string): void {
    window.clearTimeout(this.bubbleTimer);
    window.clearTimeout(this.bubbleHideTimer);
    this.bubbleText.textContent = text;
    this.bubble.classList.remove('leaving');
    show(this.bubble, true);
    this.placeBubble();
    flash(this.bubble, 'bubble-in', 320);
    // Long enough for a parent to read it aloud.
    const ms = Math.min(7000, Math.max(3600, 2400 + text.length * 55));
    this.bubbleTimer = window.setTimeout(() => this.hideBubble(), ms);
  }

  private hideBubble(immediate = false): void {
    window.clearTimeout(this.bubbleTimer);
    window.clearTimeout(this.bubbleHideTimer);
    if (this.bubble.hidden) return;
    if (immediate || this.ctrl.state.reducedMotion) {
      show(this.bubble, false);
      return;
    }
    // Exit is softer and shorter than the entrance.
    this.bubble.classList.add('leaving');
    this.bubbleHideTimer = window.setTimeout(() => {
      this.bubble.classList.remove('leaving');
      show(this.bubble, false);
    }, 160);
  }

  /** Place the companion's hit area over the painted friend, and its speech bubble. */
  private placeCompanion(): void {
    const L = this.ctrl.state.layout;
    if (!this.companionRect || !L) {
      show(this.companionBtn, false);
      return;
    }
    // Hit area: the friend's painted upper body, kept on screen and off the board.
    const v = L.friendVisible;
    const vh = window.innerHeight;
    const hit = { x: v.x, y: v.y, w: v.w, h: Math.min(v.h * 0.85, vh - v.y - 4) };
    if (L.orientation === 'landscape') {
      if (L.corner === 'left') hit.w = Math.min(hit.w, L.board.x - 6 - hit.x);
      else {
        const right = hit.x + hit.w;
        hit.x = Math.max(hit.x, L.board.x + L.board.w + 6);
        hit.w = right - hit.x;
      }
    } else {
      const bottom = hit.y + hit.h;
      hit.y = Math.max(hit.y, L.board.y + L.board.h + 6);
      hit.h = bottom - hit.y;
    }
    hit.x = Math.max(0, hit.x);
    hit.w = Math.max(56, hit.w);
    hit.h = Math.max(56, hit.h);
    place(this.companionBtn, hit);
    show(this.companionBtn, true);
    if (!this.bubble.hidden) this.placeBubble();
  }

  private placeBubble(): void {
    const L = this.ctrl.state.layout;
    const session = this.ctrl.state.session;
    if (!this.companionRect || !L) return;
    const r = L.friendVisible;
    if (session) this.bubble.style.setProperty('--accent', CHARACTERS[session.characterId].accent);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const area = L.speech;
    const headTop = Math.min(r.y + r.h * 0.04, area.y + area.h);
    const headX = Math.min(area.x + area.w - 20, Math.max(area.x + 20, r.x + r.w * (L.corner === 'left' ? 0.6 : 0.4)));
    const b = this.bubble;
    b.style.right = '';
    b.style.bottom = '';
    b.style.top = '';
    const beside = area.side === 'beside' && area.w >= 170;
    if (beside) {
      const w = Math.min(320, area.w);
      b.style.maxWidth = '';
      b.style.width = `${Math.round(w)}px`;
      b.style.left = `${Math.round(L.corner === 'left' ? area.x : area.x + area.w - w)}px`;
      b.style.top = `${Math.round(Math.max(area.y, Math.min(r.y + r.h * 0.1, area.y + area.h - b.offsetHeight, vh - b.offsetHeight - 12)))}px`;
    } else {
      // Shrink-wrap the text, then keep the bubble inside the friend's strip.
      const maxW = Math.max(150, Math.min(300, area.w));
      b.style.width = 'max-content';
      b.style.maxWidth = `${Math.round(maxW)}px`;
      b.style.left = '0px';
      const w = b.offsetWidth;
      const minX = area.w >= w ? area.x : Math.max(12, L.corner === 'left' ? 12 : vw - w - 12);
      const maxX = area.w >= w ? area.x + area.w - w : minX;
      const left = Math.min(maxX, Math.max(minX, headX - w / 2));
      b.style.left = `${Math.round(left)}px`;
      b.style.bottom = `${Math.round(vh - headTop + 16)}px`;
    }
    this.drawTail(beside, L.corner, r);
  }

  /** Wedge from the bubble's edge to the friend's head, passing beside the butterfly. */
  private drawTail(beside: boolean, corner: 'left' | 'right', head: Rect): void {
    const box = this.bubble.getBoundingClientRect();
    const half = 11;
    let tip: { x: number; y: number };
    let a: { x: number; y: number };
    let c: { x: number; y: number };
    if (beside) {
      tip = { x: corner === 'left' ? head.x + head.w * 0.85 : head.x + head.w * 0.15, y: head.y + head.h * 0.15 };
      const ex = corner === 'left' ? box.left : box.right;
      const by = Math.min(box.bottom - 22, Math.max(box.top + 22, tip.y));
      a = { x: ex, y: by - half };
      c = { x: ex, y: by + half };
    } else {
      tip = { x: head.x + head.w * (corner === 'left' ? 0.6 : 0.4), y: head.y + head.h * 0.05 };
      let bx = Math.min(box.right - 26, Math.max(box.left + 26, tip.x));
      // Keep the wedge's base off the butterfly so it clearly comes from the friend.
      if (!this.hintBtn.hidden) {
        const hb = this.hintBtn.getBoundingClientRect();
        if (bx > hb.left - 16 && bx < hb.right + 16) {
          const toRight = hb.left + hb.width / 2 < box.left + box.width / 2;
          bx = toRight ? Math.min(box.right - 26, hb.right + 18) : Math.max(box.left + 26, hb.left - 18);
        }
      }
      a = { x: bx - half, y: box.bottom };
      c = { x: bx + half, y: box.bottom };
    }
    // Local coordinates inside the bubble (the SVG overflows it).
    const ox = box.left;
    const oy = box.top;
    const pts = [a, tip, c].map((p) => `${(p.x - ox).toFixed(1)},${(p.y - oy).toFixed(1)}`);
    // The fill starts 3px inside the bubble to hide the ring under the wedge's base.
    const inset = beside ? (corner === 'left' ? 3 : -3) : 0;
    const a0 = beside ? `${(a.x - ox + inset).toFixed(1)},${(a.y - oy).toFixed(1)}` : `${(a.x - ox).toFixed(1)},${(a.y - oy - 3).toFixed(1)}`;
    const c0 = beside ? `${(c.x - ox + inset).toFixed(1)},${(c.y - oy).toFixed(1)}` : `${(c.x - ox).toFixed(1)},${(c.y - oy - 3).toFixed(1)}`;
    this.tailFill.setAttribute('d', `M${a0} L${pts[0]} L${pts[1]} L${pts[2]} L${c0} Z`);
    this.tailEdge.setAttribute('d', `M${pts[0]} L${pts[1]} L${pts[2]}`);
  }

  /**
   * Centre the welcome card in the empty space the child sees: between the top
   * controls (and the backdrop's top foliage) and the highest painted friend.
   */
  private placeWelcomeCard(): void {
    if (this.welcome.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = this.welcomeCard;
    const cluster = this.cluster.getBoundingClientRect();
    const regionTop = Math.max(cluster.bottom + 12, vh * 0.09);
    // Size the sign so sign + button fit between the top and the friends' heads.
    const lowestHead = this.castBoxes.length ? Math.min(...this.castBoxes.map((b) => b.y)) - 12 : vh - 16;
    const art = ASSETS.intro.titleSign;
    const buttonH = this.playBtn.offsetHeight || 84;
    const fitW = ((lowestHead - regionTop - buttonH - 12) * art.width) / art.height;
    card.style.width = `${Math.round(Math.max(260, Math.min(600, vw * 0.74, fitW)))}px`;
    const ch = card.offsetHeight;
    const cw = card.offsetWidth;
    const cardX0 = (vw - cw) / 2;
    const cardX1 = cardX0 + cw;
    // The empty space ends at the heads of the friends standing under the card.
    const under = this.castBoxes.filter((b) => {
      const cx = b.x + b.w / 2;
      return cx > cardX0 && cx < cardX1;
    });
    const heads = under.length ? under : this.castBoxes;
    const regionBottom = heads.length ? Math.min(...heads.map((b) => b.y)) - 12 : vh - 16;
    let top = regionTop + Math.max(0, (regionBottom - regionTop - ch) / 2);
    // Never touch any painted friend (e.g. a big neighbour reaching under a corner).
    for (const b of this.castBoxes) {
      if (b.x < cardX1 + 8 && b.x + b.w > cardX0 - 8) top = Math.min(top, Math.max(regionTop, b.y - 12 - ch));
    }
    card.style.top = `${Math.round(top)}px`;
    this.placeVines(Math.round(top));
  }

  /** Vines run from above the screen edge down to the sign's rope loops. */
  private placeVines(cardTop: number): void {
    const signW = this.signEl.offsetWidth;
    const signH = this.signEl.offsetHeight;
    if (!signW || !signH) return;
    this.signEl.style.setProperty('--sign-w', `${signW}px`);
    const art = ASSETS.intro.vine;
    const vineW = signW * 0.085;
    const natural = (vineW * art.height) / art.width;
    ASSETS.intro.titleSign.loops.forEach((loop, i) => {
      const v = this.vines[i];
      if (!v) return;
      const bottom = loop.y * signH + signH * 0.05;
      const needed = cardTop + bottom + 12;
      const height = Math.max(natural * 0.5, needed);
      v.style.width = `${vineW}px`;
      v.style.height = `${height}px`;
      v.style.left = `${loop.x * signW - vineW * art.bottomX}px`;
      v.style.top = `${bottom - height}px`;
    });
  }


  private announce(text: string): void {
    this.live.textContent = '';
    window.setTimeout(() => {
      this.live.textContent = text;
    }, 30);
  }

  // ---------------------------------------------------------------------------
  // UiBridge (used by the renderer)

  rectOf(name: 'collection' | 'reset' | 'hint'): DOMRect | null {
    const el = name === 'collection' ? this.collectionBtn : name === 'reset' ? this.resetBtn : this.hintBtn;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return null;
    return el.getBoundingClientRect();
  }

  pulse(name: 'collection' | 'reset'): void {
    if (name === 'collection') {
      this.badgeHold = false;
      this.renderBadge();
      flash(this.collectionBtn, 'pulse', 900);
    } else flash(this.resetBtn, 'pulse-glow', 2200);
  }

  setCastRects(rects: Array<{ id: CharacterId; rect: Rect }>): void {
    this.castLayer.replaceChildren(
      ...rects.map(({ id, rect }) => {
        const b = this.button('cast-btn', () => this.ctrl.wave(id));
        b.dataset['id'] = id;
        b.setAttribute('aria-label', CHARACTERS[id].name[this.ctrl.lang]);
        // Hit area: the painted upper body, not the foliage strip.
        const c = ASSETS.characters[id].content;
        place(b, { x: Math.max(0, rect.x + rect.w * (c.x + c.w * 0.1)), y: rect.y + 8 + rect.h * c.y, w: rect.w * c.w * 0.8, h: rect.h * c.h * 0.72 });
        return b;
      }),
    );
    // Painted boxes of the cast (sprites sit 8px below their slots).
    this.castBoxes = rects.map(({ id, rect }) => {
      const c = ASSETS.characters[id].content;
      return { x: rect.x + rect.w * c.x, y: rect.y + 8 + rect.h * c.y, w: rect.w * c.w, h: rect.h * c.h };
    });
    this.placeWelcomeCard();
  }

  hintLanded(): void {
    window.clearTimeout(this.hintTimer);
    if (!this.hintBtn.classList.contains('hint-waiting')) return;
    this.hintBtn.classList.remove('hint-waiting');
    flash(this.hintBtn, 'hint-arrive', 500);
  }

  /** DOM side of the opening (driven by the renderer's timeline). */
  openingStep(step: OpeningStep, ms: number): void {
    const later = (fn: () => void, delay: number): void => {
      this.openingTimers.push(window.setTimeout(fn, delay));
    };
    if (step === 'curtains') {
      this.curtainsOpened = true;
      const c = this.curtains;
      if (ms <= 0) {
        c.classList.remove('open', 'fade');
        show(c, false);
        return;
      }
      c.style.setProperty('--ms', `${ms}ms`);
      void c.offsetWidth;
      c.classList.add(this.ctrl.state.opening === 'fade' ? 'fade' : 'open');
      later(() => {
        c.classList.remove('open', 'fade');
        show(c, false);
      }, ms + 60);
      return;
    }
    if (step === 'sign') {
      this.signEl.classList.add('shown');
      this.placeWelcomeCard();
      if (ms <= 0 || this.ctrl.state.reducedMotion) return;
      const rect = this.welcomeCard.getBoundingClientRect();
      const d = rect.bottom + 40;
      this.signEl.animate(
        [
          { transform: `translateY(${-d}px) rotate(-3deg)` },
          { transform: 'translateY(16px) rotate(1.6deg)', offset: 0.62 },
          { transform: 'translateY(-6px) rotate(-0.9deg)', offset: 0.8 },
          { transform: 'translateY(2px) rotate(0.3deg)', offset: 0.92 },
          { transform: 'none' },
        ],
        { duration: ms, easing: 'cubic-bezier(0.35, 0.6, 0.4, 1)' },
      );
      return;
    }
    if (step === 'sprout') {
      const btn = this.playBtn;
      if (ms <= 0 || this.ctrl.state.reducedMotion) {
        for (const img of this.sproutImgs) show(img, false);
        btn.classList.add('shown');
        return;
      }
      const each = (ms * 0.7) / this.sproutImgs.length;
      this.sproutImgs.forEach((_, i) =>
        later(() => {
          this.sproutImgs.forEach((o, j) => show(o, j === i));
          if (i === 0) this.ctrl.sfx('sparkle');
        }, i * each),
      );
      later(() => {
        btn.classList.add('shown', 'sprouted');
        later(() => {
          for (const img of this.sproutImgs) show(img, false);
        }, 180);
      }, ms * 0.7);
      return;
    }
    // finish (or skip): everything in place, controls back.
    for (const t of this.openingTimers) window.clearTimeout(t);
    this.openingTimers = [];
    for (const img of this.sproutImgs) show(img, false);
    this.curtains.classList.remove('open', 'fade');
    show(this.curtains, false);
    this.signEl.getAnimations().forEach((a) => a.finish());
    this.signEl.classList.add('shown');
    this.playBtn.classList.add('shown');
    this.placeWelcomeCard();
  }

  setCompanionRect(rect: Rect | null): void {
    this.companionRect = rect;
    this.placeCompanion();
  }

  celebrationBanner(reward: Reward): void {
    const lang = this.ctrl.lang;
    this.banner.replaceChildren(
      h('img', { src: assetUrl(ASSETS.treasures[reward.treasureId].image), alt: '' }),
      h('span', {}, `${this.ctrl.tr(reward.firstFind ? 'newTreasure' : 'treasureAgain')} ${TREASURES[reward.treasureId].name[lang]}`),
    );
    if (reward.firstFind) this.lastNewTreasure = reward.treasureId;
    this.badgeHold = true;
    this.renderBadge();
    show(this.banner, true);
    flash(this.banner, 'banner-in', 2600);
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => show(this.banner, false), 2600);
  }

  // ---------------------------------------------------------------------------
  // Rendering

  private onEvent(e: GameEvent): void {
    if (e.type === 'maze') {
      this.hideBubble(true);
      window.clearTimeout(this.hintTimer);
      this.hintBtn.classList.remove('hint-waiting');
    }
    if (e.type === 'state' || e.type === 'layout' || e.type === 'maze') this.render();
    if (e.type === 'announce') this.announce(e.text);
    if (e.type === 'hint-ready') {
      // Invisible until the arriving butterfly lands on this spot (renderer);
      // a fallback reveals it if the flight never happens.
      this.hintBtn.classList.add('hint-waiting');
      this.render();
      window.clearTimeout(this.hintTimer);
      this.hintTimer = window.setTimeout(() => this.hintLanded(), 4500);
    }
    if (e.type === 'collection-pulse') {
      this.badgeHold = false;
      this.renderBadge();
    }
  }

  private renderBadge(): void {
    const save = this.ctrl.store.get();
    let found = TREASURE_ORDER.filter((t) => (save.collection[t]?.count ?? 0) > 0).length;
    const reward = this.ctrl.state.reward;
    if (this.badgeHold && reward?.firstFind) found -= 1;
    this.badge.textContent = found > 0 ? String(found) : '';
    show(this.badge, found > 0);
  }

  render(): void {
    const s = this.ctrl.state;
    const lang = s.settings.lang;
    document.documentElement.lang = lang;
    document.title = this.ctrl.tr('appTitle');
    for (const { el, key, attr } of this.i18n) {
      const text = this.ctrl.tr(key);
      if (attr === 'text') el.textContent = text;
      else el.setAttribute(attr ?? 'aria-label', text);
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const screen = s.screen;

    // Screens
    const curtainsClosed = !s.loadError && ((screen === 'loading' && !!s.openingPlan) || (!!s.opening && !this.curtainsOpened));
    show(this.curtains, curtainsClosed || this.curtains.classList.contains('open') || this.curtains.classList.contains('fade'));
    show(this.loading, screen === 'loading' && (!s.openingPlan || s.loadError));
    show(this.loadError, s.loadError);
    show(this.loadingText, !s.loadError);
    show(this.openingSkip, !!s.opening);
    this.root.classList.toggle('opening', !!s.opening);
    show(this.welcome, screen === 'welcome');
    this.playLabel.textContent = this.ctrl.tr(s.canContinue ? 'continue' : 'play');
    show(this.intro, screen === 'intro');
    const inGame = screen === 'play' || screen === 'reward';
    show(this.hud, inGame);
    show(this.surface, inGame);
    show(this.cluster, screen !== 'loading');
    const mazeScreen = screen === 'intro' || inGame;
    show(this.homeBtn, mazeScreen && !!s.layout);
    if (mazeScreen && s.layout) {
      place(this.homeBtn, s.layout.home);
      this.homeBtn.style.setProperty('--btn', `${s.layout.cluster.size}px`);
    }
    if (screen !== this.shownScreen) {
      this.shownScreen = screen;
      if (!inGame) this.hideBubble(true);
    }

    // Settings state (the only place for language and sound).
    const pressed = (btns: HTMLButtonElement[], i: number): void => btns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    pressed(this.settingsLang, lang === 'pl' ? 0 : 1);
    pressed(this.settingsSound, s.settings.muted ? 1 : 0);
    pressed(this.settingsMotion, s.settings.motion === 'system' ? 0 : 1);
    show(this.easierRow, this.ctrl.canUseEasierMaze());
    show(this.restartRow, (screen === 'intro' || screen === 'play' || screen === 'reward') && !!s.session);
    this.root.classList.toggle('reduced-motion', s.reducedMotion);
    this.renderBadge();
    for (const b of this.castLayer.querySelectorAll<HTMLElement>('.cast-btn')) {
      const id = b.dataset['id'] as CharacterId | undefined;
      if (id) b.setAttribute('aria-label', CHARACTERS[id].name[lang]);
    }

    // Overlays
    show(this.collection, s.overlay === 'collection');
    show(this.settings, s.overlay === 'settings');
    if (s.overlay === 'collection') this.renderCollection();
    if (s.overlay) this.hideBubble(true);

    // Cluster: same size and place on every screen (top-right row of equal
    // round buttons); a column only where the side rail is too narrow.
    const L = s.layout;
    const spec = clusterSpec(vw, vh);
    this.cluster.classList.toggle('column', spec.direction === 'column');
    this.cluster.style.setProperty('--btn', `${spec.size}px`);
    this.cluster.style.setProperty('--cluster-gap', `${spec.gap}px`);
    this.cluster.style.top = `${spec.rect.y}px`;
    this.cluster.style.right = `${vw - (spec.rect.x + spec.rect.w)}px`;
    this.placeWelcomeCard();

    // Quest intro
    const session = s.session;
    if (session && (screen === 'intro' || inGame)) {
      this.introPrompt.textContent = this.ctrl.questPrompt();
      this.introTreasure.src = assetUrl(ASSETS.treasures[session.treasureId].image);
      this.introTreasureName.textContent = TREASURES[session.treasureId].name[lang];
      this.introRibbon.hidden = !session.special;
      this.goBtn.textContent = this.ctrl.tr('letsLook');
      place(this.intro.firstElementChild as HTMLElement, introCardRect(vw, vh, friendFrame(session.characterId)));
      this.companionBtn.setAttribute('aria-label', this.ctrl.tr('talkTo', { name: CHARACTERS[session.characterId].name[lang] }));
    }

    // In-game controls
    if (inGame && L) {
      place(this.surface, L.boardArea);
      place(this.resetBtn, L.reset);
      place(this.hintBtn, L.hint);
      place(this.nextBtn, L.next);
      const banner = { x: L.board.x + L.board.w / 2 - 170, y: Math.max(8, L.board.y + 12), w: 340, h: 74 };
      place(this.banner, banner);
      const playing = screen === 'play' && !s.celebrating;
      show(this.resetBtn, playing);
      show(this.hintBtn, playing && this.ctrl.hintAvailable());
      show(this.nextBtn, screen === 'reward');
      show(this.skipLayer, s.celebrating);
      this.surface.classList.toggle('drawing', s.drawing);
      this.placeCompanion();
    }

    // Gentle rotate suggestion (never blocks play; hides itself after a while).
    const wantRotate = inGame && orientationOf(vw, vh) === 'portrait' && !this.rotateDismissed;
    if (wantRotate && this.rotateToast.hidden) {
      window.setTimeout(() => {
        this.rotateDismissed = true;
        this.render();
      }, 9000);
    }
    show(this.rotateToast, wantRotate);
    if (wantRotate && L) {
      // Between the butterfly's corner and the right-hand buttons.
      const left = L.hint.x + L.hint.w + 10;
      this.rotateToast.style.left = `${left}px`;
      this.rotateToast.style.maxWidth = `${Math.max(160, Math.min(L.home.x, L.clusterRect.x) - 10 - left)}px`;
    }
  }

  private renderCollection(): void {
    const save = this.ctrl.store.get();
    const lang = this.ctrl.lang;
    for (const slot of this.slots) {
      const count = save.collection[slot.id]?.count ?? 0;
      const found = count > 0;
      slot.btn.classList.toggle('found', found);
      slot.btn.classList.toggle('just-found', found && this.lastNewTreasure === slot.id);
      slot.name.textContent = found ? TREASURES[slot.id].name[lang] : '';
      slot.count.textContent = count > 1 ? `×${count}` : '';
      slot.btn.setAttribute(
        'aria-label',
        found ? `${TREASURES[slot.id].name[lang]}. ${this.ctrl.tr('foundTimes', { n: count })}` : this.ctrl.tr('notFoundYet'),
      );
      slot.btn.setAttribute('aria-disabled', String(!found));
    }
  }

  private renderDebug(): void {
    if (!this.debug) return;
    const info = this.ctrl.debugInfo();
    this.debug.textContent = Object.entries(info)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }
}
