// Emberline — rendering: the three.js scene, the map meshes, bot models,
// the first-person viewmodel, tracers and explosions. Reads the state store;
// writes nothing back except visual-only scratch. All geometries and
// materials are shared; meshes are pooled, never created per frame.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { BOXES, MAP } from './map.js';
import { eyePos } from './player.js';

let renderer;
let scene;
let camera;
let container;
const mats = {};
const botMeshes = [];
let viewmodel;
let muzzleFlash;
let explosionLight;
let explosionMeshes = [];
let bombMesh;
let bombLight;
let siteRings = {};
let siteBeams = {};
const tracerPool = [];
const clockTmp = { x: 0, y: 0, z: 0 };

function mat(key) {
  if (mats[key]) return mats[key];
  const color = PALETTE[key] ?? 0x888888;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.08 });
  mats[key] = m;
  return m;
}

// A procedural concrete texture: speckle + expansion joints, drawn once on a
// canvas. No asset files, no network.
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4b5158';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 78 + Math.floor(Math.random() * 24);
    g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(20,22,26,0.7)';
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initRender(el) {
  container = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  el.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 18, 85);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 200);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(0x8fa3c7, 0x2a2118, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.position.set(-30, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 120;
  scene.add(sun);

  buildWorld();
  buildViewmodel();
  buildTracers();
  buildExplosions();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return renderer.domElement;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function addBox(x, y, z, sx, sy, sz, material, shadow = true) {
  const m = new THREE.Mesh(boxGeo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function buildWorld() {
  // Dusk sun low on the northern horizon, and the plant's distant silhouettes.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(7, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, fog: false }),
  );
  sunDisc.position.set(-6, 9, -95);
  sunDisc.lookAt(0, 9, 0);
  scene.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(13, 40),
    new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.22, fog: false }),
  );
  sunHalo.position.set(-6, 9, -96);
  sunHalo.lookAt(0, 9, 0);
  scene.add(sunHalo);
  const farMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 1 });
  for (const [tx, tz, r, h] of [[-48, -42, 6, 22], [44, -40, 5, 18], [58, 10, 4, 14]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, h, 20), farMat);
    tower.position.set(tx, h / 2, tz);
    scene.add(tower);
  }
  const farBlock = new THREE.Mesh(boxGeo, farMat);
  farBlock.scale.set(70, 9, 6);
  farBlock.position.set(0, 4.5, -62);
  scene.add(farBlock);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 54),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0.02 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Map boxes.
  for (const b of BOXES) {
    const m = addBox(b.x, b.h / 2, b.z, b.hx * 2, b.h, b.hz * 2, mat(b.mat));
    if (b.tilt) { m.rotation.x = b.tilt; m.position.y = b.h / 2 - 0.25; }
  }

  // Hazard stripes on the Crusher tops: thin amber boxes.
  addBox(-5, 3.28, 0, 6.4, 0.12, 0.5, mat('hazard'), false);
  addBox(5, 3.28, 0, 6.4, 0.12, 0.5, mat('hazard'), false);

  // Lamp posts with warm pools of light.
  const lampSpots = [[-12, 12], [12, 12], [-12, -16], [12, -16], [0, 20]];
  for (const [lx, lz] of lampSpots) {
    addBox(lx, 2.4, lz, 0.18, 4.8, 0.18, mat('concreteDark'), false);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffc06a, emissive: 0xff9a2a, emissiveIntensity: 2.2 }),
    );
    head.position.set(lx, 4.8, lz);
    scene.add(head);
    const pl = new THREE.PointLight(0xff9a2a, 18, 16, 1.8);
    pl.position.set(lx, 4.6, lz);
    scene.add(pl);
  }

  // Bomb sites: glowing ring + light beam + point light.
  for (const key of ['A', 'B']) {
    const s = MAP.sites[key];
    const color = key === 'A' ? PALETTE.siteA : PALETTE.siteB;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(s.r - 0.35, s.r, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.06, s.z);
    scene.add(ring);
    siteRings[key] = ring;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 9, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(s.x, 4.5, s.z);
    scene.add(beam);
    siteBeams[key] = beam;
    const pl = new THREE.PointLight(color, 12, 14, 1.8);
    pl.position.set(s.x, 3, s.z);
    scene.add(pl);
  }

  // The planted bomb: a small charge with a blinking light.
  bombMesh = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, mat('concreteDark'));
  body.scale.set(0.5, 0.22, 0.35);
  body.position.y = 0.11;
  bombMesh.add(body);
  bombLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 3 }),
  );
  bombLight.position.set(0, 0.28, 0);
  bombMesh.add(bombLight);
  bombMesh.visible = false;
  scene.add(bombMesh);

  // Bot meshes (pool of 4).
  for (let i = 0; i < 4; i++) botMeshes.push(buildBotMesh(i));
}

function buildBotMesh(i) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.botBody, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: PALETTE.botDark, roughness: 0.9 });
  const torso = new THREE.Mesh(boxGeo, bodyMat);
  torso.scale.set(0.62, 0.72, 0.34);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const vest = new THREE.Mesh(boxGeo, darkMat);
  vest.scale.set(0.5, 0.4, 0.4);
  vest.position.set(0, 1.12, 0.02);
  g.add(vest);
  const head = new THREE.Mesh(boxGeo, darkMat);
  head.scale.set(0.34, 0.32, 0.32);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const visor = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
    color: 0x332200, emissive: PALETTE.visor, emissiveIntensity: 1.6,
  }));
  visor.scale.set(0.3, 0.09, 0.05);
  visor.position.set(0, 1.64, -0.17);
  g.add(visor);
  const legL = new THREE.Mesh(boxGeo, darkMat);
  legL.scale.set(0.22, 0.72, 0.24);
  legL.position.set(-0.16, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(boxGeo, bodyMat);
  armL.scale.set(0.16, 0.6, 0.18);
  armL.position.set(-0.4, 1.05, -0.1);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  const gun = new THREE.Mesh(boxGeo, darkMat);
  gun.scale.set(0.09, 0.12, 0.85);
  gun.position.set(0.18, 1.25, -0.45);
  g.add(gun);
  // Number tag above the head: a small emissive plate so bots read at a glance.
  const tag = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: PALETTE.ember, emissiveIntensity: 0.8,
  }));
  tag.scale.set(0.22, 0.06, 0.02);
  tag.position.set(0, 1.86, 0);
  g.add(tag);
  g.userData = { legL, legR, armL, armR, torso };
  g.visible = false;
  scene.add(g);
  return g;
}

function buildViewmodel() {
  viewmodel = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.45, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.ember, roughness: 0.5, metalness: 0.4, emissive: PALETTE.ember, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(boxGeo, gunMat);
  body.scale.set(0.09, 0.14, 0.62);
  viewmodel.add(body);
  const barrel = new THREE.Mesh(boxGeo, gunMat);
  barrel.scale.set(0.05, 0.05, 0.34);
  barrel.position.set(0, 0.02, -0.45);
  viewmodel.add(barrel);
  const sight = new THREE.Mesh(boxGeo, accentMat);
  sight.scale.set(0.02, 0.05, 0.12);
  sight.position.set(0, 0.1, -0.1);
  viewmodel.add(sight);
  const grip = new THREE.Mesh(boxGeo, gunMat);
  grip.scale.set(0.08, 0.2, 0.1);
  grip.position.set(0, -0.14, 0.12);
  grip.rotation.x = 0.35;
  viewmodel.add(grip);
  const mag = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.6, metalness: 0.2 }));
  mag.scale.set(0.06, 0.18, 0.1);
  mag.position.set(0, -0.16, -0.05);
  mag.rotation.x = 0.12;
  viewmodel.add(mag);
  muzzleFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  muzzleFlash.position.set(0, 0.02, -0.66);
  viewmodel.add(muzzleFlash);
  viewmodel.position.set(0.28, -0.24, -0.55);
  camera.add(viewmodel);
}

function buildTracers() {
  for (let i = 0; i < 24; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0 }));
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracerPool.push(line);
  }
}

function buildExplosions() {
  explosionLight = new THREE.PointLight(0xff7a2a, 0, 20, 1.5);
  scene.add(explosionLight);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    explosionMeshes.push(m);
  }
}

// Per-frame render from the state store. `time` is wall-clock seconds.
export function renderFrame(S, time) {
  const p = S.player;
  eyePos(S, clockTmp);
  // Camera: eye position, view yaw/pitch plus unrecovered recoil, plus shake.
  camera.position.set(clockTmp.x, clockTmp.y, clockTmp.z);
  const shakeX = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 0.05 : 0;
  const shakeY = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 0.05 : 0;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = p.yaw + shakeX;
  camera.rotation.x = p.pitch + p.recoilPitch * 0.4 + shakeY;
  camera.rotation.z = 0;

  // Bots.
  for (let i = 0; i < S.bots.length; i++) {
    const bot = S.bots[i];
    const mesh = botMeshes[i];
    if (!bot || !bot.alive) { mesh.visible = false; continue; }
    mesh.visible = true;
    mesh.position.set(bot.x, bot.y, bot.z);
    mesh.rotation.y = bot.yaw;
    const speed = Math.hypot(bot.vx, bot.vz);
    const swing = Math.min(1, speed / 3) * Math.sin(time * 9 + i * 1.7) * 0.45;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armL.rotation.x = -swing * 0.6;
    mesh.userData.armR.rotation.x = swing * 0.6;
  }

  // Viewmodel: bob with movement, kick with recoil, dip while reloading.
  const spd = Math.hypot(p.vx, p.vz);
  const bob = Math.min(1, spd / 5) * Math.sin(time * 10) * 0.012;
  viewmodel.position.set(0.28, -0.24 + bob, -0.55 + p.recoilPitch * 0.6);
  viewmodel.rotation.x = p.recoilPitch * 1.2 + (p.reloading > 0 ? -0.5 : 0);
  muzzleFlash.material.opacity = S.flashes.length > 0 ? 0.9 : 0;

  // Tracers: one pooled line per live tracer, fading with its life.
  for (let i = 0; i < tracerPool.length; i++) {
    const t = S.tracers[i];
    const line = tracerPool[i];
    if (!t) { line.visible = false; continue; }
    line.visible = true;
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, t.x1, t.y1, t.z1);
    pos.setXYZ(1, t.x2, t.y2, t.z2);
    pos.needsUpdate = true;
    line.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
  }

  // Explosions: expanding, fading spheres + a light.
  let lightOn = false;
  for (let i = 0; i < explosionMeshes.length; i++) {
    const e = S.explosions[i];
    const m = explosionMeshes[i];
    if (!e) { m.visible = false; continue; }
    m.visible = true;
    const k = 1 - e.life / 0.8;
    const s = 0.5 + k * 5.5;
    m.scale.set(s, s, s);
    m.position.set(e.x, e.y, e.z);
    m.material.opacity = Math.max(0, e.life / 0.8) * 0.8;
    if (e.life > 0.3) {
      explosionLight.position.set(e.x, e.y + 1, e.z);
      explosionLight.intensity = 60 * (e.life / 0.8);
      lightOn = true;
    }
  }
  if (!lightOn) explosionLight.intensity = 0;

  // Bomb: visible when planted; its light blinks faster as the fuse runs out.
  const bomb = S.bomb;
  if (bomb.state === 'planted') {
    bombMesh.visible = true;
    bombMesh.position.set(bomb.x, 0, bomb.z);
    const blink = bomb.fuse < 10 ? (Math.sin(time * 16) > 0 ? 3 : 0.2) : (Math.sin(time * 5) > 0 ? 3 : 0.2);
    bombLight.material.emissiveIntensity = blink;
    siteRings[bomb.site].material.opacity = 0.95;
    siteBeams[bomb.site].material.opacity = 0.28;
  } else {
    bombMesh.visible = false;
    siteRings.A.material.opacity = 0.75;
    siteRings.B.material.opacity = 0.75;
    siteBeams.A.material.opacity = 0.1;
    siteBeams.B.material.opacity = 0.1;
  }

  renderer.render(scene, camera);
}

export function rendererDom() { return renderer.domElement; }
