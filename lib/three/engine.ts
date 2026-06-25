import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld, type InteractiveObject, type World } from './models';
import type { Mark } from '../marks-types';

export interface DioramaCallbacks {
  onHover: (stationId: string | null, label: string | null) => void;
  /** stationId is null when the user clicks empty space (deselect). */
  onSelect: (stationId: string | null) => void;
  onReady: () => void;
}

export interface DioramaOptions {
  /** Visitor marks (fireflies) to render on first build. */
  initialMarks?: Mark[];
}

/**
 * The diorama must stay fully visible on any aspect ratio, so we frame it to a
 * world-space box and fit by whichever dimension is limiting. On wide screens
 * the height is the limit; on tall/portrait screens the width is the limit.
 */
const FRAME_W = 24; // world units to keep visible horizontally (fills portrait better)
const FRAME_H = 17; // world units to keep visible vertically
function frustumHeight(aspect: number): number {
  return Math.max(FRAME_H, FRAME_W / aspect);
}
/** Target on-screen size of one pixel block, in CSS pixels. */
const TARGET_BLOCK_CSS = 3.5;

/** Pinch / wheel zoom limits, and the tap-vs-drag movement threshold. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.6;
const TAP_SLOP = 9; // px of movement under which a release still counts as a tap

/** Mobile-only intro: gently zoom in once the scene has loaded. */
const INTRO_ZOOM = 1.5; // target zoom (keeps every landmark on-screen)
const INTRO_DELAY = 0.4; // s to wait (let the loader fade) before zooming
const INTRO_DUR = 1.3; // s of zoom-in animation

/**
 * Vanilla three.js engine for the fixed-camera pixel-art diorama.
 * All WebGL lives here; React only drives it through callbacks.
 */
export class DioramaApp {
  private container: HTMLElement;
  private callbacks: DioramaCallbacks;
  private options: DioramaOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private composer!: EffectComposer;
  private pixelPass!: RenderPixelatedPass;

  private world!: World;
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2(-2, -2); // offscreen until first move
  private pointerActive = false;
  private _v = new THREE.Vector3(); // scratch for screen-space picking

  // pinch-zoom + drag-pan state (the iso angle never changes — only zoom + pan)
  private pointers = new Map<number, { x: number; y: number }>();
  private camZoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly rightDir = new THREE.Vector3();
  private readonly upDir = new THREE.Vector3();
  private readonly baseCamPos = new THREE.Vector3();
  private dragStart: { x: number; y: number } | null = null;
  private dragLast: { x: number; y: number } | null = null;
  private dragged = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private introActive = false;
  private introElapsed = 0;

  private hoverState = new Map<
    string,
    { obj: InteractiveObject; amount: number }
  >();
  private hoveredId: string | null = null;
  private selectedId: string | null = null;

  private rafId = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private ro?: ResizeObserver;

  constructor(container: HTMLElement, callbacks: DioramaCallbacks, options: DioramaOptions = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.options = options;
    this.init();
  }

  private init() {
    const { clientWidth: w, clientHeight: h } = this.container;
    const aspect = w / h || 1;

    // ---- renderer (AA OFF — critical for hard pixel edges) ----
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    // Stop the browser hijacking touches for scroll / double-tap zoom.
    renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // ---- scene ----
    this.scene = new THREE.Scene();

    // ---- fixed dimetric orthographic camera ----
    const fh = frustumHeight(aspect);
    this.camera = new THREE.OrthographicCamera(
      (-fh * aspect) / 2,
      (fh * aspect) / 2,
      fh / 2,
      -fh / 2,
      0.1,
      200,
    );
    // Classic 2:1-ish isometric vantage, looking at the diorama center.
    this.camera.position.set(34, 30, 34);
    this.camera.lookAt(0, 1.4, 0);
    // screen axes (for panning) — constant since the view angle never changes
    this.camera.updateMatrixWorld();
    this.rightDir.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    this.upDir.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    this.baseCamPos.copy(this.camera.position);

    // ---- build the world (lights + diorama + interactives + visitor marks) ----
    this.world = buildWorld(this.scene, this.options.initialMarks ?? []);
    for (const obj of this.world.interactives) {
      this.hoverState.set(obj.stationId, { obj, amount: 0 });
    }
    // Pick against the invisible hit proxies, which live on layer 1.
    this.raycaster.layers.set(1);

    // ---- post-processing: pixelate then color-correct ----
    const pixelSize = this.computePixelSize(dpr);
    this.composer = new EffectComposer(this.renderer);
    this.pixelPass = new RenderPixelatedPass(pixelSize, this.scene, this.camera);
    this.pixelPass.normalEdgeStrength = 0.65;
    this.pixelPass.depthEdgeStrength = 0.45;
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);

    // ---- input + resize ----
    this.bindEvents();

    // mobile only: a gentle auto zoom-in once the scene appears
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(max-width: 640px)').matches
        : this.container.clientWidth <= 640;
    this.introActive = isMobile;

    this.callbacks.onReady();
    this.clock.start();
    this.animate();
  }

  private computePixelSize(dpr: number) {
    // Keep on-screen block size stable across DPRs; integer only.
    return Math.max(2, Math.round(TARGET_BLOCK_CSS * dpr));
  }

  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('visibilitychange', this.onVisibility);

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(this.container);
  }

  // Pause the render loop when the tab/app is backgrounded (saves battery).
  private onVisibility = () => {
    if (this.disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    } else if (this.rafId === 0) {
      this.clock.getDelta(); // discard the long gap so animations don't jump hard
      this.animate();
    }
  };

  private updateNDC(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerActive = true;
  }

  /** Apply the current zoom + pan to the (fixed-angle) camera. */
  private applyCamera() {
    this.camZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camZoom));
    const visW = (this.camera.right - this.camera.left) / this.camZoom;
    const visH = (this.camera.top - this.camera.bottom) / this.camZoom;
    const maxX = Math.max(0, (this.camera.right - this.camera.left - visW) / 2);
    const maxY = Math.max(0, (this.camera.top - this.camera.bottom - visH) / 2);
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX));
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY));
    this.camera.position
      .copy(this.baseCamPos)
      .addScaledVector(this.rightDir, this.panX)
      .addScaledVector(this.upDir, this.panY);
    this.camera.zoom = this.camZoom;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(); // keep raycasts accurate after a pan
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // pinch-zoom (two pointers)
    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      this.camZoom = this.pinchStartZoom * (dist / this.pinchStartDist);
      this.applyCamera();
      return;
    }

    // drag-pan (one pointer held) — only moves the view when zoomed in
    if (this.pointers.size === 1 && this.dragStart && this.dragLast) {
      const totX = e.clientX - this.dragStart.x;
      const totY = e.clientY - this.dragStart.y;
      if (!this.dragged && Math.hypot(totX, totY) > TAP_SLOP) this.dragged = true;
      if (this.dragged && this.camZoom > 1.001) {
        const perPx =
          (this.camera.top - this.camera.bottom) /
          this.camZoom /
          this.container.clientHeight;
        this.panX -= (e.clientX - this.dragLast.x) * perPx;
        this.panY += (e.clientY - this.dragLast.y) * perPx;
        this.applyCamera();
      }
      this.dragLast = { x: e.clientX, y: e.clientY };
      return;
    }

    // plain hover (no pointer held) — drives the raycast + tooltip
    this.updateNDC(e.clientX, e.clientY);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Capture keeps move/up events flowing if a drag leaves the canvas. It can
    // throw if the pointer isn't active (rapid/synthetic events) — non-critical.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.updateNDC(e.clientX, e.clientY);
    if (this.pointers.size === 1) {
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.dragged = false;
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.pinchStartDist =
        Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      this.pinchStartZoom = this.camZoom;
      this.dragged = true; // a pinch is never a tap
      this.introActive = false; // user took over the zoom
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasTap = this.pointers.size === 1 && !this.dragged;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1) {
      // pinch -> single finger: re-anchor so the view doesn't jump
      const p = [...this.pointers.values()][0];
      this.dragStart = { x: p.x, y: p.y };
      this.dragLast = { x: p.x, y: p.y };
      this.dragged = true;
    }
    if (wasTap) {
      this.updateNDC(e.clientX, e.clientY);
      // exact proxy hit, else nearest landmark on screen (forgiving on touch)
      const hit = this.pickStation() ?? this.pickNearest();
      this.selectedId = hit;
      this.callbacks.onSelect(hit);
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
    this.pointerNDC.set(-2, -2);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.introActive = false; // user took over the zoom
    this.camZoom *= Math.exp(-e.deltaY * 0.0015);
    this.applyCamera();
  };

  /**
   * Returns the station id under the pointer by raycasting the STABLE hit
   * proxies (layer 1) rather than the animated geometry — so hover doesn't
   * flicker as animated parts move in and out from under the cursor.
   */
  private pickStation(): string | null {
    if (!this.pointerActive) return null;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.world.proxies, false);
    if (hits.length === 0) return null;
    return (hits[0].object.userData?.stationId as string | undefined) ?? null;
  }

  /**
   * Screen-space nearest landmark within a tap radius. Used only for clicks/taps
   * (not hover) so tiny props are forgiving to hit on phones. Radius scales with
   * the smaller screen dimension.
   */
  private pickNearest(): string | null {
    if (!this.pointerActive) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const px = (this.pointerNDC.x * 0.5 + 0.5) * w;
    const py = (-this.pointerNDC.y * 0.5 + 0.5) * h;
    const threshold = Math.max(36, Math.min(w, h) * 0.09);
    let best: string | null = null;
    let bestD = threshold;
    for (const io of this.world.interactives) {
      io.root.getWorldPosition(this._v);
      this._v.y += 0.8; // aim at the visual middle, not the base
      this._v.project(this.camera);
      if (this._v.z > 1) continue; // behind the camera
      const sx = (this._v.x * 0.5 + 0.5) * w;
      const sy = (-this._v.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) {
        bestD = d;
        best = io.stationId;
      }
    }
    return best;
  }

  setSelected(id: string | null) {
    this.selectedId = id;
  }

  /** Add freshly-planted visitor marks to the scene (idempotent by id). */
  syncMarks(marks: Mark[]) {
    this.world?.syncMarks(marks);
  }

  /** Tell the scene which fireflies belong to this visitor (adds a pin). */
  setMineMarks(ids: number[]) {
    this.world?.setMineMarks(ids);
  }

  /** Fire a one-shot locator on the visitor's own fireflies. */
  pingMine() {
    this.world?.pingMine();
  }

  private onResize() {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    const aspect = w / h;
    const fh = frustumHeight(aspect);
    this.camera.left = (-fh * aspect) / 2;
    this.camera.right = (fh * aspect) / 2;
    this.camera.top = fh / 2;
    this.camera.bottom = -fh / 2;
    this.applyCamera(); // re-clamp pan + re-apply zoom for the new frustum

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.pixelPass.setPixelSize(this.computePixelSize(dpr));
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // mobile intro: ease the zoom in once loaded
    if (this.introActive) {
      this.introElapsed += dt;
      const p = Math.min(1, Math.max(0, (this.introElapsed - INTRO_DELAY) / INTRO_DUR));
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      this.camZoom = 1 + (INTRO_ZOOM - 1) * eased;
      this.applyCamera();
      if (p >= 1) this.introActive = false;
    }

    // hover pick (cheap; only on pointer activity)
    const picked = this.pickStation();
    if (picked !== this.hoveredId) {
      this.hoveredId = picked;
      const obj = picked
        ? this.world.interactives.find((o) => o.stationId === picked)
        : null;
      this.callbacks.onHover(picked, obj ? obj.label : null);
      this.renderer.domElement.style.cursor = picked ? 'pointer' : 'default';
    }

    // idle + hover animation
    for (const [id, s] of this.hoverState) {
      const active = id === this.hoveredId || id === this.selectedId;
      const target = active ? 1 : 0;
      s.amount += (target - s.amount) * Math.min(1, dt * 12);
      s.obj.update(t, s.amount, id === this.selectedId);
    }

    this.world.update(t, dt);
    this.composer.render();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.ro?.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('visibilitychange', this.onVisibility);

    this.world.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (el.parentNode) el.parentNode.removeChild(el);
  }
}
