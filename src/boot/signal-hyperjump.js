import * as THREE from "../../assets/vendor/three/three.module.min.js";

const COLORS = [0xbfbfbf, 0xe6d719, 0x19bed1, 0x00a95c, 0xca29b8, 0xef4135, 0x1457ff];
const MAX_DURATION = 2450;
const HIDDEN_TIMEOUT = 30_000;

const disposeMaterial = material => {
  if (!material) return;
  for (const value of Object.values(material)) {
    if (value && typeof value.dispose === "function") value.dispose();
  }
  material.dispose?.();
};

export class SignalHyperjump {
  constructor({
    screen,
    mount,
    skipButton,
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
    disabled = false,
  } = {}) {
    this.screen = screen;
    this.mount = mount;
    this.skipButton = skipButton;
    this.reducedMotion = reducedMotion;
    this.disabled = disabled;
    this.frameId = 0;
    this.finished = false;
    this.cleanupFns = [];
  }

  async play() {
    if (!this.screen) return;
    if (this.disabled) {
      this.finished = true;
      this.screen.hidden = true;
      return;
    }
    if (this.reducedMotion || !this.mount || !this.supported()) {
      await this.cssFallback();
      return;
    }

    try {
      await this.webglSequence();
    } catch (error) {
      console.warn("CATODO boot animation fell back to CSS", error);
      await this.cssFallback();
    } finally {
      this.dispose();
    }
  }

  supported() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch (_) {
      return false;
    }
  }

  cssFallback() {
    return new Promise(resolve => {
      const finish = () => {
        if (this.finished) return;
        this.finished = true;
        this.exit(resolve);
      };
      const timeout = setTimeout(finish, this.reducedMotion ? 280 : 1150);
      this.bindSkip(() => {
        clearTimeout(timeout);
        finish();
      });
    });
  }

  webglSequence() {
    return new Promise((resolve, reject) => {
      const width = Math.max(1, this.mount.clientWidth || innerWidth);
      const height = Math.max(1, this.mount.clientHeight || innerHeight);
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x050507, 0);
      this.renderer = renderer;
      this.mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050507, 0.045);
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 120);
      camera.position.set(0, 0, 13);
      this.camera = camera;

      const ribbons = new THREE.Group();
      scene.add(ribbons);
      COLORS.forEach((color, index) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3((index - 3) * 1.18, 6.5, -10),
          new THREE.Vector3(Math.sin(index) * 2.8, 2.2, -4),
          new THREE.Vector3(Math.cos(index * 1.3) * 3.4, -1.2, 1),
          new THREE.Vector3(Math.sin(index * 0.8) * 1.6, -5.5, 5),
        ]);
        const geometry = new THREE.TubeGeometry(curve, 44, 0.13, 4, false);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94 });
        const ribbon = new THREE.Mesh(geometry, material);
        ribbon.userData.phase = index * 0.36;
        ribbons.add(ribbon);
      });
      this.ribbons = ribbons;

      const starsGeometry = new THREE.BufferGeometry();
      const starCount = 220;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i += 1) {
        starPositions[i * 3] = (Math.random() - 0.5) * 26;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        starPositions[i * 3 + 2] = -Math.random() * 45;
      }
      starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.72 }));
      scene.add(stars);

      const resize = () => {
        const w = Math.max(1, this.mount.clientWidth || innerWidth);
        const h = Math.max(1, this.mount.clientHeight || innerHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      const lose = event => {
        event.preventDefault();
        reject(new Error("WebGL context lost"));
      };
      addEventListener("resize", resize, { passive: true });
      renderer.domElement.addEventListener("webglcontextlost", lose, false);
      this.cleanupFns.push(() => removeEventListener("resize", resize));
      this.cleanupFns.push(() => renderer.domElement.removeEventListener("webglcontextlost", lose));

      const start = performance.now();
      let hiddenAt = 0;
      let hiddenDuration = 0;
      const finish = () => {
        if (this.finished) return;
        this.finished = true;
        this.exit(resolve);
      };
      this.bindSkip(finish);

      const visibility = () => {
        if (document.hidden) {
          hiddenAt = performance.now();
          cancelAnimationFrame(this.frameId);
          this.frameId = 0;
          return;
        }
        if (hiddenAt) {
          hiddenDuration += Math.min(HIDDEN_TIMEOUT, performance.now() - hiddenAt);
          hiddenAt = 0;
        }
        if (!this.finished && !this.frameId) this.frameId = requestAnimationFrame(draw);
      };
      document.addEventListener("visibilitychange", visibility);
      this.cleanupFns.push(() => document.removeEventListener("visibilitychange", visibility));

      const draw = now => {
        this.frameId = 0;
        if (this.finished || document.hidden) return;
        const elapsed = now - start - hiddenDuration;
        const progress = Math.min(1, elapsed / MAX_DURATION);
        const ease = 1 - Math.pow(1 - progress, 3);
        ribbons.rotation.z = Math.sin(progress * Math.PI) * 0.58;
        ribbons.rotation.y = progress * 1.45;
        ribbons.scale.setScalar(1 + ease * 0.28);
        ribbons.children.forEach(ribbon => {
          ribbon.rotation.y = Math.sin(progress * 7 + ribbon.userData.phase) * 0.22;
          ribbon.material.opacity = progress > 0.82 ? (1 - progress) / 0.18 : 0.94;
        });
        camera.position.z = 13 - ease * 8.7;
        camera.rotation.z = Math.sin(progress * Math.PI * 2) * 0.08;
        stars.position.z = progress * 23;
        renderer.render(scene, camera);
        if (progress >= 1) finish();
        else this.frameId = requestAnimationFrame(draw);
      };
      this.frameId = requestAnimationFrame(draw);
    });
  }

  bindSkip(handler) {
    if (!this.skipButton) return;
    this.skipButton.addEventListener("click", handler, { once: true });
    this.cleanupFns.push(() => this.skipButton.removeEventListener("click", handler));
  }

  exit(resolve) {
    this.screen.classList.add("is-exiting");
    setTimeout(() => {
      this.screen.hidden = true;
      this.dispose();
      resolve?.();
    }, 360);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.cleanupFns.splice(0).forEach(fn => fn());
    this.scene?.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
      else disposeMaterial(object.material);
    });
    try {
      this.renderer?.dispose();
      this.renderer?.forceContextLoss();
    } catch (_) {}
    this.renderer?.domElement?.remove();
    this.scene = null;
    this.renderer = null;
  }
}

export const playSignalHyperjump = options => new SignalHyperjump(options).play();
