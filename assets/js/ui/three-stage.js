/* ==========================================================================
   ui/three-stage.js — Three.js 舞台樣板
   統一處理：相機、燈光、觸控旋轉／縮放、RWD 尺寸、效能降級、動畫迴圈。
   各章的 sim/chXX.js 只要拿 stage.scene 往裡面加物件就好。

   注意：three 與 OrbitControls 由頁面上的 <script type="importmap"> 指到
        assets/vendor/ 之下的本機檔案（因此可完全離線使用）。
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { motionOff } from '../core.js';

export { THREE };

/** 依裝置能力決定畫質等級：'high' | 'mid' | 'low' */
export function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 500;
  if (cores <= 2 || mem <= 2) return 'low';
  if (narrow || cores <= 4) return 'mid';
  return 'high';
}

/**
 * 建立一個 3D 舞台
 * @param {HTMLElement} container 舞台容器（.stage-canvas）
 * @param {Object} opts { cameraPos:[x,y,z], fov, target:[x,y,z],
 *                        enablePan, minDistance, maxDistance, background }
 */
export function createStage(container, opts = {}) {
  const quality = opts.quality || detectQuality();
  const dprCap = { high: 2, mid: 1.5, low: 1 }[quality];

  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth || 640, container.clientHeight || 400, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.setAttribute('aria-label', opts.ariaLabel || '3D 互動舞台，可用滑鼠或單指拖曳旋轉、雙指或滾輪縮放');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (opts.background) scene.background = new THREE.Color(opts.background);

  const camera = new THREE.PerspectiveCamera(
    opts.fov || 45,
    (container.clientWidth || 640) / (container.clientHeight || 400),
    0.05, 2000
  );
  const cp = opts.cameraPos || [0, 3, 9];
  camera.position.set(cp[0], cp[1], cp[2]);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = !!opts.enablePan;
  controls.minDistance = opts.minDistance ?? 2;
  controls.maxDistance = opts.maxDistance ?? 60;
  if (opts.target) controls.target.set(...opts.target);
  if (opts.autoRotate && !motionOff()) { controls.autoRotate = true; controls.autoRotateSpeed = opts.autoRotate; }
  controls.update();

  /* ---- 明亮通透的打光（呼應整站陽光風格）---- */
  const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xCFE8DA, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xFFF6E0, 1.05);
  key.position.set(6, 10, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xCDEBF5, 0.5);
  fill.position.set(-7, 3, -6);
  scene.add(fill);
  const amb = new THREE.AmbientLight(0xFFFFFF, 0.35);
  scene.add(amb);

  /* ---- 尺寸自動跟隨容器 ---- */
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---- 動畫迴圈（含低效能自動降級）---- */
  let raf = 0, running = false, tick = null, last = performance.now();
  let fpsAcc = 0, fpsN = 0, degraded = false;
  const clock = { dt: 0, t: 0 };

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.dt = dt; clock.t += dt;

    // 偵測效能：連續 90 幀平均低於 30fps 就自動降畫質
    if (!degraded) {
      fpsAcc += dt; fpsN++;
      if (fpsN >= 90) {
        const fps = fpsN / fpsAcc;
        if (fps < 30) {
          degraded = true;
          renderer.setPixelRatio(1);
          container.dispatchEvent(new CustomEvent('stage:degrade', { detail: { fps } }));
        }
        fpsAcc = 0; fpsN = 0;
      }
    }

    controls.update();
    if (tick) tick(clock);
    renderer.render(scene, camera);
  }

  const stage = {
    THREE, scene, camera, renderer, controls, quality,
    get degraded() { return degraded; },
    /** 傳入每幀要跑的函式 */
    start(fn) { tick = fn || tick; if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
    /** 清掉場景中除了燈光以外的所有物件（切換情境時用）*/
    clearObjects() {
      const keep = new Set([hemi, key, fill, amb]);
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const o = scene.children[i];
        if (keep.has(o)) continue;
        disposeDeep(o);
        scene.remove(o);
      }
    },
    dispose() {
      stage.stop(); ro.disconnect(); controls.dispose();
      stage.clearObjects();
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    },
  };
  return stage;
}

/** 遞迴釋放 geometry / material，避免切換情境時記憶體一直漲 */
export function disposeDeep(obj) {
  obj.traverse?.(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { for (const k in m) { if (m[k]?.isTexture) m[k].dispose(); } m.dispose(); });
    }
  });
}

/* ==========================================================================
   常用材質與物件的小工廠
   ========================================================================== */

/** 有點光澤但不刺眼的球體材質（原子）*/
export function atomMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.35, metalness: opts.metalness ?? 0.15,
    transparent: opts.opacity !== undefined, opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

/** 建立一顆原子（球）*/
export function atom(radius, color, seg = 20, opts = {}) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg), atomMaterial(color, opts));
}

/** 建立一根鍵（圓柱），會自動對齊 a → b */
export function bond(a, b, radius = 0.06, color = 0xBFCFC7) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .05 }));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

/** 半透明的容器盒（線框 + 玻璃面）*/
export function glassBox(w, h, d, color = 0x1E9EB3) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity: 0.06, roughness: 0.1,
      transmission: 0.6, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  g.add(box, edges);
  return g;
}

/** 產生一張圓形柔邊貼圖，用於 Points（電子雲、粒子）*/
let _sprite = null;
export function softDot() {
  if (_sprite) return _sprite;
  const s = 64, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  _sprite = new THREE.CanvasTexture(cv);
  return _sprite;
}

/** 產生文字告示牌（Sprite），用於標示分子名稱 */
export function textSprite(text, opts = {}) {
  const pad = 12, fs = opts.fontSize || 44;
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');
  c.font = `700 ${fs}px "Noto Sans TC", system-ui, sans-serif`;
  const w = Math.ceil(c.measureText(text).width) + pad * 2;
  const h = fs + pad * 2;
  cv.width = w; cv.height = h;
  const c2 = cv.getContext('2d');
  c2.font = `700 ${fs}px "Noto Sans TC", system-ui, sans-serif`;
  c2.fillStyle = opts.bg || 'rgba(255,255,255,.88)';
  c2.beginPath();
  const r = 14;
  c2.moveTo(r, 0); c2.arcTo(w, 0, w, h, r); c2.arcTo(w, h, 0, h, r);
  c2.arcTo(0, h, 0, 0, r); c2.arcTo(0, 0, w, 0, r); c2.closePath(); c2.fill();
  c2.fillStyle = opts.color || '#123B2E';
  c2.textBaseline = 'middle'; c2.textAlign = 'center';
  c2.fillText(text, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 2;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: opts.depthTest !== false }));
  const scale = opts.scale || 0.011;
  sp.scale.set(w * scale, h * scale, 1);
  return sp;
}

/** 常見元素的顯示顏色與半徑（CPK 風格，稍微調亮以符合整站色調）*/
export const ELEMENT_STYLE = {
  H:  { color: 0xF2F6F4, r: 0.30 },
  C:  { color: 0x4A5B54, r: 0.42 },
  N:  { color: 0x4C7DE0, r: 0.40 },
  O:  { color: 0xFF6B5B, r: 0.38 },
  F:  { color: 0x8FE04C, r: 0.35 },
  Na: { color: 0xA97BE0, r: 0.48 },
  Mg: { color: 0x7ED08A, r: 0.46 },
  S:  { color: 0xFFC93C, r: 0.45 },
  Cl: { color: 0x5FD08A, r: 0.44 },
  K:  { color: 0x9B6BD6, r: 0.52 },
  Ca: { color: 0x6FC6A8, r: 0.50 },
  Fe: { color: 0xD1885B, r: 0.46 },
  Cu: { color: 0xE08A4C, r: 0.45 },
  Zn: { color: 0x9AB4C4, r: 0.45 },
  Ag: { color: 0xCFD8DC, r: 0.48 },
  Au: { color: 0xFFC93C, r: 0.48 },
  Pb: { color: 0x8E9BA6, r: 0.50 },
  Ti: { color: 0xCFC6BC, r: 0.47 },
  Al: { color: 0xBFD3DB, r: 0.45 },
  Pt: { color: 0xD8DEE3, r: 0.47 },
  e:  { color: 0x1E9EB3, r: 0.14 },
};
