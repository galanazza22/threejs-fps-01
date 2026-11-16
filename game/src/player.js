// Emberline — the player controller: acceleration-based movement, crouch,
// jump, and mouse look. Pure simulation: it writes the player's position and
// velocity in the state store and nothing else renders here.
import { PLAYER } from './config.js';
import { collideCircle, groundHeight } from './collide.js';

const EYE_STAND = PLAYER.eyeStand;
const EYE_CROUCH = PLAYER.eyeCrouch;

// Forward vector from yaw: yaw 0 faces -Z (north, toward the defenders).
export function forwardOf(yaw, out) {
  out.x = -Math.sin(yaw);
  out.z = -Math.cos(yaw);
  return out;
}

const _fwd = { x: 0, z: 0 };

export function updatePlayer(S, dt, input, solids) {
  const p = S.player;
  if (!p.alive) return;

  // Look: mouse deltas, with unrecovered recoil pulling the pitch up.
  const look = input.consumeLook();
  p.yaw -= look.dx * 0.0021;
  p.pitch -= look.dy * 0.0021;
  const maxPitch = 1.52;
  if (p.pitch > maxPitch) p.pitch = maxPitch;
  if (p.pitch < -maxPitch) p.pitch = -maxPitch;

  // Crouch: Ctrl or C; eye height eases toward the target.
  const wantCrouch = input.key('ControlLeft') || input.key('ControlRight') || input.key('KeyC');
  p.crouch = wantCrouch;
  const targetEye = wantCrouch ? EYE_CROUCH : EYE_STAND;
  p.eyeH += (targetEye - p.eyeH) * Math.min(1, dt * 12);

  // Wish direction from WASD, relative to the view yaw.
  let wx = 0;
  let wz = 0;
  if (input.key('KeyW')) wz -= 1;
  if (input.key('KeyS')) wz += 1;
  if (input.key('KeyA')) wx -= 1;
  if (input.key('KeyD')) wx += 1;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // Forward is (-sin, -cos); right is (cos, -sin).
  const dirX = -sin * -wz + cos * wx; // = sin*wz + cos*wx
  const dirZ = -cos * -wz + -sin * wx; // = cos*wz - sin*wx
  const speed = wantCrouch ? PLAYER.crouchSpeed : PLAYER.walkSpeed;
  const moving = wl > 0;

  // Accelerate toward the wish velocity; friction when no input.
  const accel = p.onGround ? PLAYER.accel : PLAYER.airAccel;
  p.vx += dirX * accel * dt * (moving ? 1 : 0);
  p.vz += dirZ * accel * dt * (moving ? 1 : 0);
  if (!moving && p.onGround) {
    const f = Math.max(0, 1 - PLAYER.friction * dt);
    p.vx *= f;
    p.vz *= f;
  }
  const sp = Math.hypot(p.vx, p.vz);
  const cap = speed * (p.onGround ? 1 : 1.15);
  if (sp > cap) { p.vx *= cap / sp; p.vz *= cap / sp; }

  // Jump.
  if (input.key('Space') && p.onGround) {
    p.vy = PLAYER.jumpVel;
    p.onGround = false;
  }

  // Gravity and vertical motion; land on the ground or a box top.
  p.vy -= PLAYER.gravity * dt;
  p.y += p.vy * dt;
  const g = groundHeight(p.x, p.z, solids);
  if (p.y <= g) {
    p.y = g;
    p.vy = 0;
    p.onGround = true;
  } else if (p.y > g + 0.02) {
    p.onGround = false;
  }

  // Horizontal motion with wall collision.
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  collideCircle(p, PLAYER.radius, solids);

  // Recoil recovery: the camera pitch eases back as bloom decays.
  p.bloom = Math.max(0, p.bloom - dt * 0.09);
  p.recoilPitch = Math.max(0, p.recoilPitch - dt * 0.35);
}

export function eyePos(S, out) {
  const p = S.player;
  out.x = p.x;
  out.y = p.y + p.eyeH;
  out.z = p.z;
  return out;
}

// Current horizontal speed, for spread and HUD.
export function speedOf(p) {
  return Math.hypot(p.vx, p.vz);
}
