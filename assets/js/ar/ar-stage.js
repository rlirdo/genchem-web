/* ==========================================================================
   assets/js/ar/ar-stage.js — 共用 AR 引擎（與章節完全無關，可被任何章重用）

   對外只有一個入口：
     const session = await launchAR({ buildContent, onExit, hud });

   參數
     buildContent : () => THREE.Group   產生要放進實景的內容（呼叫端自己決定畫什麼）
     onExit       : () => void          離開 AR 時的回呼（呼叫端用來恢復頁面狀態）
     hud          : HTMLElement         疊在畫面上的控制面板 DOM（呼叫端自己組，樣式沿用 theme.css）

   回傳
     { mode: 'xr' }     WebXR immersive-ar（Android Chrome 等）
     { mode: 'camera' } 相機直通 + 陀螺儀／拖曳（iPhone Safari 等）
     { mode: 'none', reason } 兩者都不支援，由呼叫端顯示提示

   設計原則
     ‧ 不 import 專案內任何其他模組（只用 importmap 的 three 與 ARButton），確保完全解耦
     ‧ 所有錯誤都轉成中文可讀訊息顯示在畫面上，絕不留白畫面
   ========================================================================== */

import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

/* 沒偵測到平面時的等待上限（毫秒）→ 超過就退化成「放在相機正前方」*/
const HITTEST_TIMEOUT_MS = 15000;
/* 退化模式與相機直通模式下，物件距離相機的距離（公尺）*/
const FALLBACK_DIST_M = 0.6;
const CAMERA_MODE_DIST_M = 0.5;

/* ==========================================================================
   共用樣式（沿用 theme.css 的色票變數；因為是同一份文件，變數可直接解析）
   ========================================================================== */
const STYLE_ID = 'ar-stage-style';
const CSS = `
.ar-root {
  position: fixed; inset: 0; z-index: 9999;
  background: #000; overflow: hidden;
  font-family: var(--font, system-ui);
}
.ar-root video.ar-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0; background: #000;
}
.ar-root canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.ar-overlay {
  position: absolute; inset: 0; z-index: 2;
  pointer-events: none;            /* 只有子元素可點，避免擋住旋轉手勢 */
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: max(3.4rem, calc(env(safe-area-inset-top) + 3rem)) .7rem max(.7rem, env(safe-area-inset-bottom));
  gap: .6rem;
}
.ar-overlay > * { pointer-events: auto; }
.ar-exit {
  position: absolute; top: max(.7rem, env(safe-area-inset-top)); right: .7rem; z-index: 5;
  pointer-events: auto;
  font: 700 .82rem/1 var(--font, system-ui);
  padding: .55rem .9rem; border-radius: var(--r-pill, 999px);
  border: 0; cursor: pointer;
  background: rgba(255,255,255,.92); color: var(--ink, #123B2E);
  box-shadow: 0 4px 14px rgba(0,0,0,.35);
}
.ar-exit:active { transform: scale(.94); }
.ar-hud {
  margin-top: auto;
  background: rgba(255,255,255,.90);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border-radius: var(--r, 14px);
  padding: .7rem .8rem;
  box-shadow: 0 8px 26px rgba(0,0,0,.32);
  color: var(--ink, #123B2E);
  font-size: .84rem; line-height: 1.6;
  max-height: 46vh; overflow-y: auto;
}
.ar-tip {
  align-self: center; margin-bottom: auto;
  background: rgba(18,59,46,.72); color: #fff;
  font-size: .78rem; line-height: 1.55;
  padding: .45rem .85rem; border-radius: var(--r-pill, 999px);
  text-align: center; max-width: 90%;
  transition: opacity .3s;
}
.ar-msg {
  position: absolute; inset: 0; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  padding: 1.4rem; background: rgba(18,59,46,.94);
}
.ar-msg .box {
  background: var(--card, #fff); color: var(--ink, #123B2E);
  border-radius: var(--r-lg, 22px); padding: 1.3rem 1.2rem;
  max-width: 22rem; box-shadow: 0 16px 40px rgba(0,0,0,.4);
  font-size: .9rem; line-height: 1.75;
}
.ar-msg .box h3 { margin: 0 0 .5rem; font-size: 1.05rem; color: var(--coral-deep, #C6412A); }
.ar-msg .box button {
  margin-top: .9rem; width: 100%;
  font: 700 .9rem/1 var(--font, system-ui);
  padding: .7rem 1rem; border-radius: var(--r-pill, 999px); border: 0; cursor: pointer;
  background: var(--leaf, #3FA34D); color: #fff;
}
/* three 的 ARButton 重新上妝（避免它預設的黑底白字破壞畫面）*/
.ar-root .ar-startbtn {
  position: absolute !important; left: 50% !important; bottom: 12vh !important;
  transform: translateX(-50%) !important;
  width: auto !important; padding: .8rem 1.6rem !important;
  background: var(--leaf, #3FA34D) !important; color: #fff !important;
  border: 0 !important; border-radius: var(--r-pill, 999px) !important;
  font: 700 .95rem/1 var(--font, system-ui) !important;
  opacity: 1 !important; z-index: 7 !important; cursor: pointer !important;
  box-shadow: 0 8px 24px rgba(0,0,0,.4) !important;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID; s.textContent = CSS;
  document.head.appendChild(s);
}

/* ==========================================================================
   小工具
   ========================================================================== */

/** 建立整個 AR 畫面的外框（含 overlay、離開鈕、提示列）*/
function buildShell(hud) {
  ensureStyle();
  const root = document.createElement('div');
  root.className = 'ar-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'AR 擴增實境檢視');

  const overlay = document.createElement('div');
  overlay.className = 'ar-overlay';

  const tip = document.createElement('div');
  tip.className = 'ar-tip';
  overlay.appendChild(tip);

  if (hud) { hud.classList.add('ar-hud'); overlay.appendChild(hud); }

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'ar-exit';
  exit.textContent = '✕ 離開 AR';
  exit.setAttribute('aria-label', '離開 AR 模式，回到網頁');
  // ★ 必須放在 overlay 內部：WebXR 的 dom-overlay 只會顯示 root 元素及其子孫，
  //   放在外面的話進入 XR 後就看不到這顆按鈕了。
  overlay.appendChild(exit);

  root.appendChild(overlay);
  document.body.appendChild(root);
  return { root, overlay, tip, exit };
}

/** 在 AR 畫面上顯示一則中文訊息（永遠不留白畫面）*/
function showMessage(root, title, body, onClose) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-msg';
  wrap.innerHTML = `<div class="box"><h3>${title}</h3><div>${body}</div>
    <button type="button">知道了，回到網頁</button></div>`;
  wrap.querySelector('button').addEventListener('click', () => { wrap.remove(); onClose && onClose(); });
  root.appendChild(wrap);
}

/** 明亮而不死黑的打光：讓 3D 物件在真實環境中看起來自然 */
function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8fbf8f, 1.0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff6e0, 1.1);
  dir.position.set(1.2, 2.4, 1.0);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xcdebf5, 0.45);
  fill.position.set(-1.4, 0.8, -1.2);
  scene.add(fill);
  return [hemi, dir, fill];
}

/** 遞迴釋放資源 */
function disposeDeep(obj) {
  obj.traverse?.(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
  });
}

/* ==========================================================================
   主入口
   ========================================================================== */
export async function launchAR({ buildContent, onExit, hud } = {}) {
  if (typeof buildContent !== 'function') {
    throw new Error('launchAR 需要 buildContent 函式');
  }

  /* ---- 1. 能力偵測（依序）---- */
  let mode = 'none';
  if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
    try {
      if (await navigator.xr.isSessionSupported('immersive-ar')) mode = 'xr';
    } catch (e) { /* 某些瀏覽器會直接拋錯，視為不支援 */ }
  }
  // 注意：iOS Safari 沒有 navigator.xr，所以上面完全不會 await，
  //       仍留在使用者手勢的執行脈絡中，下面才能成功要到陀螺儀權限。
  if (mode === 'none' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    mode = 'camera';
  }
  if (mode === 'none') {
    return {
      mode: 'none',
      reason: '這個瀏覽器既不支援 WebXR，也無法取得相機影像。',
    };
  }

  return mode === 'xr'
    ? startXR({ buildContent, onExit, hud })
    : startCameraMode({ buildContent, onExit, hud });
}

/* ==========================================================================
   模式 A：WebXR immersive-ar（含 hit-test 平面偵測）
   ========================================================================== */
function startXR({ buildContent, onExit, hud }) {
  const { root, overlay, tip, exit } = buildShell(hud);
  tip.textContent = '正在啟動 AR…請把鏡頭對準桌面並慢慢移動手機';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
  const lights = addLights(scene);

  /* ---- 平面指示環（reticle）---- */
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.055, 0.075, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3FA34D, transparent: true, opacity: 0.9 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  /* ---- 內容（延後到使用者點擊時才放置）---- */
  let content = null;
  let placed = false;
  let hitTestSource = null;
  let localSpace = null;
  let startTime = 0;
  let sawHit = false;
  let ended = false;

  function placeAt(matrix) {
    if (placed) return;
    try {
      content = buildContent();
    } catch (err) {                                    // 內容建立失敗也不能留白畫面
      console.error('[ar-stage] buildContent 失敗：', err);
      showMessage(overlay, '⚠ 內容建立失敗',
        `AR 場景無法產生：<br><code>${(err && err.message) || err}</code><br><br>已為你回到網頁模式。`,
        () => { const s = renderer.xr.getSession(); s ? s.end().catch(cleanup) : cleanup(); });
      placed = true;
      return;
    }
    if (matrix) {
      content.matrixAutoUpdate = false;
      content.matrix.copy(matrix);
      content.matrixAutoUpdate = true;
      content.matrix.decompose(content.position, content.quaternion, content.scale);
    }
    scene.add(content);
    placed = true;
    reticle.visible = false;
    tip.textContent = '已放置。走近一點看，或用下方按鈕切換金屬';
    setTimeout(() => { tip.style.opacity = '0'; }, 3500);
  }

  /** 15 秒還偵測不到平面 → 直接放在相機正前方 0.6 m */
  function fallbackPlace() {
    if (placed) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3(0, 0, -FALLBACK_DIST_M).applyMatrix4(camera.matrixWorld);
    m.makeTranslation(pos.x, pos.y, pos.z);
    placeAt(m);
    tip.style.opacity = '1';
    tip.textContent = '偵測不到平面，已改放在你面前 0.6 公尺處';
    setTimeout(() => { tip.style.opacity = '0'; }, 4000);
  }

  /* ---- select 事件：第一次放置，之後不再重複放置 ---- */
  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    if (placed) return;                       // 已放置就不再重放，互動交給 HUD
    if (reticle.visible) placeAt(reticle.matrix);
    else fallbackPlace();
  });
  scene.add(controller);

  /* ---- 建立 ARButton 並自動觸發（保留可見按鈕作為後備）---- */
  const arBtn = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: overlay },
  });
  arBtn.classList.add('ar-startbtn');
  root.appendChild(arBtn);
  // 使用者剛剛才點過按鈕，仍在手勢有效期內，通常可直接自動開始
  try { arBtn.click(); } catch (e) { /* 失敗就讓使用者自己點那顆按鈕 */ }

  /* ---- session 生命週期 ---- */
  renderer.xr.addEventListener('sessionstart', async () => {
    arBtn.style.display = 'none';
    startTime = performance.now();
    const session = renderer.xr.getSession();
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      localSpace = await session.requestReferenceSpace('local');
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      tip.textContent = '慢慢移動手機掃描桌面，出現綠色圓環後點一下畫面放置';
    } catch (e) {
      tip.textContent = '此裝置無法做平面偵測，15 秒後會自動放在你面前';
    }
  });
  renderer.xr.addEventListener('sessionend', () => cleanup());

  /* ---- 每幀更新 ---- */
  renderer.setAnimationLoop((timestamp, frame) => {
    if (frame && hitTestSource && localSpace && !placed) {
      const hits = frame.getHitTestResults(hitTestSource);
      if (hits.length) {
        sawHit = true;
        const pose = hits[0].getPose(localSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
    // 超時退化
    if (!placed && startTime && performance.now() - startTime > HITTEST_TIMEOUT_MS) {
      fallbackPlace();
    }
    if (content && content.userData.tick) content.userData.tick();
    renderer.render(scene, camera);
  });

  /* ---- 收尾 ---- */
  function cleanup() {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    try { hitTestSource && hitTestSource.cancel(); } catch (e) { }
    hitTestSource = null;
    if (content) { disposeDeep(content); scene.remove(content); }
    disposeDeep(reticle); scene.remove(reticle);
    lights.forEach(l => scene.remove(l));
    renderer.dispose();
    if (hud) { hud.classList.remove('ar-hud'); if (hud.parentElement) hud.parentElement.removeChild(hud); }
    root.remove();
    onExit && onExit();
  }

  exit.addEventListener('click', () => {
    const s = renderer.xr.getSession();
    if (s) s.end().catch(() => cleanup());
    else cleanup();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    mode: 'xr',
    close: cleanup,
    /** 讓呼叫端可以在 HUD 互動後重建內容（例如換金屬）*/
    rebuild(fn) {
      if (!content) return;
      const m = content.matrix.clone();
      disposeDeep(content); scene.remove(content);
      content = fn ? fn() : buildContent();
      content.matrixAutoUpdate = false;
      content.matrix.copy(m);
      content.matrixAutoUpdate = true;
      content.matrix.decompose(content.position, content.quaternion, content.scale);
      scene.add(content);
    },
    get content() { return content; },
  };
}

/* ==========================================================================
   模式 B：相機直通 + 陀螺儀／拖曳（iPhone Safari 等沒有 WebXR 的裝置）
   ========================================================================== */
function startCameraMode({ buildContent, onExit, hud }) {
  const { root, overlay, tip, exit } = buildShell(hud);
  tip.textContent = '正在開啟相機…';

  /* ★ iOS 必須在「使用者點擊的同一個執行脈絡」內要求陀螺儀權限，
       所以這一行要在任何 await 之前先送出去。 */
  let orientPermission = Promise.resolve('granted');
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try { orientPermission = DOE.requestPermission(); }
    catch (e) { orientPermission = Promise.resolve('denied'); }
  } else if (!DOE) {
    orientPermission = Promise.resolve('unsupported');
  }

  /* ---- 底層：相機影像 ---- */
  const video = document.createElement('video');
  video.className = 'ar-video';
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  root.insertBefore(video, root.firstChild);

  /* ---- 上層：透明的 Three.js 畫布 ---- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearAlpha(0);
  root.insertBefore(renderer.domElement, overlay);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
  const lights = addLights(scene);

  /* ---- 內容固定放在世界原點前方 0.5 m；使用者靠轉身與走近觀察 ---- */
  let content = null;
  try {
    content = buildContent();
    content.position.set(0, -0.05, -CAMERA_MODE_DIST_M);
    scene.add(content);
  } catch (err) {                                     // 內容建立失敗也不能留白畫面
    console.error('[ar-stage] buildContent 失敗：', err);
    showMessage(root, '⚠ 內容建立失敗',
      `AR 場景無法產生：<br><code>${(err && err.message) || err}</code><br><br>已為你回到網頁模式。`,
      () => cleanup());
  }

  /* ---- 相機控制 ---- */
  let useGyro = false;
  const dragState = { on: false, x: 0, y: 0, yaw: 0, pitch: 0 };
  const gyro = { alpha: 0, beta: 0, gamma: 0, screen: 0, has: false };
  let stream = null, ended = false;

  function onDeviceOrientation(e) {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    gyro.alpha = THREE.MathUtils.degToRad(e.alpha || 0);
    gyro.beta = THREE.MathUtils.degToRad(e.beta || 0);
    gyro.gamma = THREE.MathUtils.degToRad(e.gamma || 0);
    gyro.screen = THREE.MathUtils.degToRad(window.orientation || 0);
    gyro.has = true;
  }

  /** 由 deviceorientation 的 alpha/beta/gamma 算出相機四元數（three 官方 DeviceOrientationControls 的作法）*/
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // −90° 繞 X
  function applyGyro() {
    euler.set(gyro.beta, gyro.alpha, -gyro.gamma, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    camera.quaternion.multiply(q1);
    camera.quaternion.multiply(q0.setFromAxisAngle(zee, -gyro.screen));
  }
  function applyDrag() {
    camera.quaternion.setFromEuler(new THREE.Euler(dragState.pitch, dragState.yaw, 0, 'YXZ'));
  }

  function bindDrag() {
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      dragState.on = true; dragState.x = e.clientX; dragState.y = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!dragState.on) return;
      dragState.yaw -= (e.clientX - dragState.x) * 0.005;
      dragState.pitch -= (e.clientY - dragState.y) * 0.005;
      dragState.pitch = Math.max(-1.2, Math.min(1.2, dragState.pitch));
      dragState.x = e.clientX; dragState.y = e.clientY;
    });
    const up = () => { dragState.on = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /* ---- 啟動相機 ---- */
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => { });
    } catch (err) {
      const name = err && err.name;
      const msg =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? '你拒絕了相機權限，或這個網站不是以 HTTPS 開啟。<br><br>請在瀏覽器的網站設定中允許「相機」後重新整理再試一次。'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? '找不到可用的鏡頭。<br><br>請確認裝置有相機，而且沒有被其他 App 佔用。'
            : name === 'NotReadableError'
              ? '鏡頭被其他程式佔用中。<br><br>請關閉其他正在使用相機的 App 或分頁後再試。'
              : `無法開啟相機：${(err && err.message) || '未知錯誤'}`;
      showMessage(root, '📷 相機無法使用', msg, cleanup);
      return;
    }

    /* ---- 相機成功後才處理陀螺儀 ---- */
    const perm = await orientPermission.catch(() => 'denied');
    if (perm === 'granted' || perm === 'unsupported' || perm === undefined) {
      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        useGyro = true;
        tip.innerHTML = '轉動手機環顧四周，走近一點可以看得更清楚<br>（若畫面不會跟著轉，用手指拖曳也可以）';
        // 1.5 秒內若完全收不到陀螺儀事件，自動改用拖曳
        setTimeout(() => {
          if (!gyro.has) {
            useGyro = false; bindDrag();
            tip.textContent = '收不到陀螺儀資料，改用單指拖曳旋轉';
          }
        }, 1500);
      } else {
        useGyro = false; bindDrag();
        tip.textContent = '此裝置沒有方向感測器，請用單指拖曳旋轉';
      }
    } else {
      useGyro = false; bindDrag();
      tip.textContent = '未取得方向感測權限，改用單指拖曳旋轉';
    }
    setTimeout(() => { tip.style.opacity = '0'; }, 6000);
  })();

  /* ---- 動畫迴圈 ---- */
  renderer.setAnimationLoop(() => {
    if (useGyro && gyro.has) applyGyro(); else applyDrag();
    if (content && content.userData.tick) content.userData.tick();
    renderer.render(scene, camera);
  });

  /* ---- 收尾 ---- */
  function cleanup() {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    if (content) { disposeDeep(content); scene.remove(content); }
    lights.forEach(l => scene.remove(l));
    renderer.dispose();
    if (hud) { hud.classList.remove('ar-hud'); if (hud.parentElement) hud.parentElement.removeChild(hud); }
    root.remove();
    onExit && onExit();
  }
  exit.addEventListener('click', cleanup);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    mode: 'camera',
    close: cleanup,
    rebuild(fn) {
      const p = content.position.clone();
      disposeDeep(content); scene.remove(content);
      content = fn ? fn() : buildContent();
      content.position.copy(p);
      scene.add(content);
    },
    get content() { return content; },
  };
}
