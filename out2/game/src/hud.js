// Emberline — the HUD: health, ammo, timer, score, money, kill feed,
// crosshair, buy menu and the start / round / match overlays. It polls the
// state store each frame and writes the DOM only when a value changed.
import { WEAPONS, GRENADE_PRICE, ARMOR_PRICE } from './config.js';
import { buyWeapon, buyGrenade, buyArmor, crosshairGap } from './weapons.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const els = {};
let last = {};
let buyBuilt = false;
let buyNotice = '';

export function initHud(S, hooks) {
  for (const id of [
    'health-num', 'health-fill', 'armor-tag', 'ammo-mag', 'ammo-reserve',
    'weapon-name', 'money', 'timer', 'round-score', 'alive', 'feed', 'message',
    'crosshair', 'hitmarker', 'damage', 'plant-wrap', 'plant-fill', 'bomb-status',
    'buy', 'buy-money', 'buy-list', 'buy-notice', 'menu', 'end', 'end-title',
    'end-copy', 'play', 'restart', 'deploy', 'phase-label', 'grenade-count',
  ]) els[id] = $(id);

  els.play.addEventListener('click', () => hooks.onPlay());
  els.restart.addEventListener('click', () => hooks.onRestart());
  els.deploy.addEventListener('click', () => hooks.onDeploy());
  buildBuy(S);
}

function buildBuy(S) {
  if (buyBuilt) return;
  buyBuilt = true;
  const list = els['buy-list'];
  const mk = (key, name, price, note) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'buy-item';
    b.dataset.key = key;
    b.innerHTML = `<span class="buy-name">${name}</span><span class="buy-note">${note}</span><span class="buy-price">$${price}</span>`;
    b.addEventListener('click', () => {
      let err = '';
      if (key === 'grenade') err = buyGrenade(S);
      else if (key === 'armor') err = buyArmor(S);
      else err = buyWeapon(S, key);
      buyNotice = err || 'Purchased';
      if (err) sfx.denied();
    });
    list.appendChild(b);
    return b;
  };
  mk('p9', 'P9 Sidearm', 0, '12-round pistol · starter');
  mk('vk9', 'VK-9 Ripper', 1500, 'Fast SMG · close quarters');
  mk('ar77', 'AR-77 Longshot', 2700, 'Accurate rifle · long lanes');
  mk('sg12', 'SG-12 Breacher', 1700, '8-pellet shotgun · corners');
  mk('grenade', 'Frag Grenade', GRENADE_PRICE, 'Bounce, fuse, blast');
  mk('armor', 'Kevlar Vest', ARMOR_PRICE, 'Absorbs 40% of damage');
}

function setText(key, el, value) {
  if (last[key] !== value) { last[key] = value; el.textContent = value; }
}

function setVisible(key, el, show) {
  const v = show ? '1' : '0';
  if (last[key] !== v) { last[key] = v; el.classList.toggle('hidden', !show); }
}

export function updateHud(S) {
  const p = S.player;
  // Health + armour.
  setText('hp', els['health-num'], String(Math.ceil(p.hp)));
  const hpPct = Math.max(0, p.hp) + '%';
  if (last.hpFill !== hpPct) {
    last.hpFill = hpPct;
    els['health-fill'].style.width = hpPct;
    els['health-fill'].classList.toggle('low', p.hp <= 30);
  }
  setVisible('armor', els['armor-tag'], p.armor);
  // Ammo + weapon.
  setText('mag', els['ammo-mag'], p.reloading > 0 ? '--' : String(p.mag));
  setText('res', els['ammo-reserve'], '/ ' + String(p.reserve));
  setText('wname', els['weapon-name'], WEAPONS[p.weapon].name);
  setText('money', els['money'], '$' + S.money);
  setText('gren', els['grenade-count'], 'G ×' + p.grenades);
  // Timer + score.
  const t = Math.max(0, Math.ceil(S.phase === 'live' ? S.timer : S.buyTime));
  setText('timer', els['timer'], String(t).padStart(2, '0') + 's');
  setText('score', els['round-score'], `Vanguard ${S.wins} — ${S.losses} Wardens`);
  const alive = S.bots.filter((b) => b.alive).length;
  setText('alive', els['alive'], `Wardens ${alive} · Round ${S.round}`);
  setText('phase', els['phase-label'], S.phase === 'buy' ? 'BUY PHASE' : S.phase === 'live' ? 'ROUND LIVE' : S.phase.toUpperCase());
  // Crosshair gap follows the live spread.
  const gap = crosshairGap(S);
  if (Math.abs((last.gap ?? -1) - gap) > 0.2) {
    last.gap = gap;
    els.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
  }
  // Hitmarker + damage flash.
  setVisible('hit', els.hitmarker, S.hitmark > 0);
  els.hitmarker.classList.toggle('kill', S.hitmarkKill);
  els.damage.style.opacity = S.damageFlash > 0 ? String(Math.min(0.85, S.damageFlash)) : '0';
  // Plant progress.
  setVisible('plant', els['plant-wrap'], p.planting > 0);
  if (p.planting > 0) els['plant-fill'].style.width = (p.planting * 100).toFixed(0) + '%';
  // Bomb status line.
  let bombText = '';
  if (S.bomb.state === 'planted') bombText = `CHARGE LIVE — site ${S.bomb.site} · ${Math.ceil(S.bomb.fuse)}s · defuse ${Math.floor(S.bomb.defuse * 100)}%`;
  else if (S.bomb.state === 'carried') bombText = 'You carry the charge — hold E at a site ring to plant';
  setText('bomb', els['bomb-status'], bombText);
  // Centre message.
  setVisible('msg', els.message, S.messageT > 0);
  if (S.messageT > 0) setText('msgText', els.message, S.message);
  // Kill feed (last 5, newest last).
  const feedText = S.feed.map((f) => f.text).join('\n');
  setText('feed', els.feed, feedText);
  // Buy menu.
  const inBuy = S.phase === 'buy';
  setVisible('buy', els.buy, inBuy);
  if (inBuy) {
    setText('buyMoney', els['buy-money'], 'Funds: $' + S.money);
    setText('buyNotice', els['buy-notice'], buyNotice);
    for (const b of els['buy-list'].children) {
      const key = b.dataset.key;
      const owned = key === 'p9' || key === 'grenade' || key === 'armor'
        ? false : !!p.owned[key];
      b.classList.toggle('owned', owned);
      const price = key === 'grenade' ? GRENADE_PRICE : key === 'armor' ? ARMOR_PRICE : WEAPONS[key].price;
      b.classList.toggle('poor', S.money < price && !owned);
    }
  }
  // Start overlay / end overlay.
  setVisible('menu', els.menu, S.phase === 'menu');
  const showEnd = S.phase === 'matchEnd';
  setVisible('end', els.end, showEnd);
  if (showEnd) {
    const won = S.matchWinner === 'attack';
    setText('endTitle', els['end-title'], won ? 'Yard taken — you win the match' : 'The Wardens hold the yard');
    setText('endCopy', els['end-copy'], `Final score ${S.wins} — ${S.losses} · ${S.player.kills} eliminations · Play again to run it back.`);
  }
}

export function clearBuyNotice() { buyNotice = ''; }
