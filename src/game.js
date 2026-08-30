import {
  applyEvent,
  createPlatformSequence,
  createSeededRandom,
  eventForPlatform,
  landsOnPlatform,
  nextRival,
  updateHorizontalMotion,
  swipeDirection,
  hudValues,
  advanceScroll,
  floorAtDepth,
  platformImpact,
  createNpcAnimation,
  createLossAnimation,
  lossPresentation,
  overworkMarkerY,
  platformTopY,
  standingPlayerY,
  playerSpriteY,
  actorProfile,
  eventPresentation,
  npcAnimationPhase,
  recoveryParticleKind,
  RIVALS,
  createPlayerReaction,
  advancePlayerReaction,
  officeThemeForFloor,
  fallingPose,
  resolveLandingCombo,
  createLandingReaction,
  advanceLandingReaction,
  createRunSeed,
} from './game-core.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const playfield = document.querySelector('#playfield');
const introPanel = document.querySelector('#intro-panel');
const resultPanel = document.querySelector('#result-panel');
const swipeHint = document.querySelector('#swipe-hint');
const scoreNode = document.querySelector('#score');
const sanityNumber = document.querySelector('#sanity-number');
const sanityFill = document.querySelector('#sanity-fill');
const eventToast = document.querySelector('#event-toast');
const eventSpeaker = document.querySelector('#event-speaker');
const eventLine = document.querySelector('#event-line');
const eventImpact = document.querySelector('#event-impact');
const rivalToast = document.querySelector('#rival-toast');
const startButton = document.querySelector('#start-button');
const retryButton = document.querySelector('#retry-button');
const soundButton = document.querySelector('#sound-button');

const rivals = RIVALS;

const colors = {
  ink: '#20231f', paper: '#fffaf0', wall: '#e8dfcf', orange: '#e75a32',
  orangeDark: '#b83c1f', green: '#2d8564', yellow: '#efbc45', blue: '#547c92',
};

let state;
let animationId;
let previousTime = 0;
let toastTimer;
let rivalTimer;
let soundOn = true;
let audioContext;
let runNumber = 0;
const input = { left: false, right: false };
const swipe = { pointerId: null, lastX: 0 };
let swipeHintDismissed = false;

function dailySeed() {
  const date = new Date();
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`);
}

function runEntropy() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

function resizeCanvas() {
  const rect = playfield.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  canvas.logicalWidth = rect.width;
  canvas.logicalHeight = rect.height;
}

function runtimePlatform(platform, visualRandom) {
  return {
    ...platform,
    width: platform.id < 4 ? 34 : Math.max(23, 34 - Math.floor(platform.id / 12)),
    hit: false,
    broken: false,
    phase: visualRandom() * Math.PI * 2,
  };
}

function appendPlatforms(count) {
  for (let index = 0; index < count; index += 1) {
    state.platforms.push(runtimePlatform(state.nextPlatform(), state.visualRandom));
  }
}

function resetGame() {
  runNumber += 1;
  const runSeed = createRunSeed(dailySeed(), runNumber, runEntropy());
  const nextPlatform = createPlatformSequence(createSeededRandom(runSeed));
  const visualRandom = createSeededRandom((runSeed ^ 0xa5a5a5a5) >>> 0);
  const plan = Array.from({ length: 120 }, () => runtimePlatform(nextPlatform(), visualRandom));
  state = {
    runSeed,
    running: true,
    sanity: 100,
    score: 0,
    cameraY: 0,
    elapsed: 0,
    scrollSpeed: 26,
    controlLock: 0,
    shake: 0,
    flash: 0,
    onPlatformId: null,
    particles: [],
    npcAnimations: [],
    playerReaction: null,
    landingCombo: 0,
    landingReaction: null,
    lossAnimation: null,
    lastReason: '掉出辦公大樓',
    crossedRivals: new Set(),
    nextPlatform,
    visualRandom,
    platforms: plan,
    player: { x: 50, y: 32, previousY: 32, vx: 0, vy: 0, width: 12, height: 18 },
  };
  canvas.dataset.runSeed = String(runSeed);
  updateHud();
}

function startGame() {
  introPanel.hidden = true;
  resultPanel.hidden = true;
  swipeHint.hidden = swipeHintDismissed;
  resetGame();
  previousTime = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
  beep(420, .05, 'square');
}

function update(dt, time) {
  if (state.lossAnimation) {
    state.lossAnimation.elapsed += dt;
    if (state.lossAnimation.elapsed >= state.lossAnimation.duration) finalizeEndGame();
    return;
  }
  if (!state.running) return;
  state.elapsed += dt;
  state.controlLock = Math.max(0, state.controlLock - dt);
  state.shake = Math.max(0, state.shake - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.playerReaction = advancePlayerReaction(state.playerReaction, dt);
  state.landingReaction = advanceLandingReaction(state.landingReaction, dt);

  const scroll = advanceScroll(state.cameraY, state.score, dt);
  state.cameraY = scroll.cameraY;
  state.scrollSpeed = scroll.speed;
  if (state.platforms.length < state.score + 60) appendPlatforms(60);

  for (const platform of state.platforms) {
    if (platform.breakAt && state.elapsed >= platform.breakAt) {
      platform.broken = true;
      if (state.onPlatformId === platform.id) state.onPlatformId = null;
    }
    platform.previousRenderX = platform.renderX ?? platform.x;
    platform.renderX = platform.x;
    platform.movementDirection = 0;
  }

  if (state.onPlatformId !== null) {
    const platform = state.platforms[state.onPlatformId];
    if (platform?.effectKind === 'chair' && !platform.broken && platform.hit) {
      state.player.x = Math.max(8, Math.min(92, state.player.x + platform.renderX - platform.previousRenderX));
    }
  }

  const requestedDirection = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const direction = state.controlLock > 0 ? 0 : requestedDirection;
  const horizontal = updateHorizontalMotion(state.player, direction, dt);
  state.player.x = horizontal.x;
  state.player.vx = horizontal.vx;
  state.player.previousY = state.player.y;

  let supported = false;
  if (state.onPlatformId !== null) {
    const platform = state.platforms[state.onPlatformId];
    const platformX = platform?.renderX ?? platform?.x;
    const overlaps = platform
      && state.player.x + state.player.width / 2 >= platformX
      && state.player.x - state.player.width / 2 <= platformX + platform.width;
    if (platform && !platform.broken && overlaps) {
      state.player.y = standingPlayerY(platform, state.player.height);
      state.player.vy = 0;
      supported = true;
    } else {
      state.onPlatformId = null;
    }
  }

  if (!supported) {
    state.player.vy = Math.min(172, state.player.vy + 205 * dt);
    state.player.y += state.player.vy * dt;

    for (const platform of state.platforms) {
      if (platform.broken) continue;
      const previousBottom = state.player.previousY + state.player.height / 2;
      const bottom = state.player.y + state.player.height / 2;
      if (!landsOnPlatform(
        { x: state.player.x, previousBottom, bottom, vy: state.player.vy },
        { ...platform, x: platform.renderX, y: platformTopY(platform) },
      )) continue;

      state.player.y = standingPlayerY(platform, state.player.height);
      state.player.vy = 0;
      state.onPlatformId = platform.id;
      const firstHit = !platform.hit;
      let landingResult = null;
      if (firstHit) {
        platform.hit = true;
        const npc = createNpcAnimation(platform, state.player.x);
        if (npc) state.npcAnimations.push(npc);

        if (platform.eventKind !== 'none') {
          triggerPlatformEvent(platform);
          if (!state.running) return;
          if (platform.eventKind === 'recovery') {
            spawnCheers(state.player.x, platform.y, recoveryParticleKind(platform.actor));
          }
        }

        if (platform.eventKind === 'damage') {
          const impact = platformImpact(platform.effectKind, state.player.vx, requestedDirection || 1);
          if (platform.effectKind === 'documents') {
            state.player.vy = impact.vy;
            state.player.vx = impact.vx;
            state.onPlatformId = null;
            state.controlLock = impact.lockSeconds;
            state.shake = impact.shakeSeconds;
            state.flash = 0.16;
            spawnPapers(state.player.x, platform.y);
          } else if (platform.effectKind === 'chair') {
            state.player.vx = impact.vx;
          } else if (platform.effectKind === 'box') {
            platform.breakAt = state.elapsed + impact.breakDelay;
            beep(170, 0.08, 'square');
          }
        }

        landingResult = resolveLandingCombo(
          state.landingCombo,
          state.player.x,
          { ...platform, x: platform.renderX },
          state.sanity,
        );
        state.landingCombo = landingResult.combo;
        state.sanity = landingResult.sanity;
        if (landingResult.sanityGain > 0) updateHud();
      }

      state.landingReaction = createLandingReaction(
        landingResult?.centered ?? false,
        landingResult?.combo ?? state.landingCombo,
        landingResult?.earned ?? false,
      );

      beep(platform.eventKind === 'recovery' ? 650 : 250, 0.04, 'sine');
      break;
    }
  }

  const deepestFloor = floorAtDepth(state.player.y);
  if (deepestFloor > state.score) {
    state.score = deepestFloor;
    updateHud();
    checkRivals();
  }

  updateParticles(dt);
  updateNpcAnimations(dt);
  const screenY = state.player.y - state.cameraY;
  const height = canvas.logicalHeight || 700;
  if (screenY < -30) endGame('下輩子，再也不工作了。');
  if (screenY > height + 70) endGame('你一路掉出辦公大樓。');
}

function spawnPapers(x, y) {
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * (18 + index % 4 * 5),
      vy: Math.sin(angle) * 54 - 28,
      spin: index * 0.7,
      life: 0.75,
      kind: 'paper',
    });
  }
}

function spawnCheers(x, y, kind = 'sparkle') {
  const count = kind === 'money' ? 16 : 10;
  for (let index = 0; index < count; index += 1) {
    state.particles.push({
      x: x + (index - (count - 1) / 2) * 1.6, y: y - 8,
      vx: (index - (count - 1) / 2) * 3,
      vy: -34 - (index % 3) * 9,
      spin: index * 0.4,
      life: kind === 'money' ? 1 : 0.8,
      kind,
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 130 * dt;
    particle.spin += dt * 8;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateNpcAnimations(dt) {
  for (const npc of state.npcAnimations) {
    npc.elapsed += dt;
    npc.phase = npcAnimationPhase(npc.elapsed, npc.duration);
  }
  state.npcAnimations = state.npcAnimations.filter((npc) => npc.elapsed < npc.duration);
}

function triggerPlatformEvent(platform) {
  const event = eventForPlatform(platform);
  if (!event) return;
  const outcome = applyEvent(state.sanity, event);
  state.sanity = outcome.sanity;
  state.lastReason = event.line;
  state.playerReaction = createPlayerReaction(
    event.amount,
    state.player.x - (platform.renderX ?? platform.x),
  );
  showEvent(eventPresentation(event));
  updateHud();
  if (event.amount < 0) {
    navigator.vibrate?.(45);
    beep(115, .12, 'sawtooth');
  } else {
    beep(720, .12, 'sine');
  }
  if (outcome.gameOver) endGame(event.line);
}

function checkRivals() {
  for (const rival of rivals) {
    if (state.score > rival.score && !state.crossedRivals.has(rival.name)) {
      state.crossedRivals.add(rival.name);
      showRival(`你比 ${rival.name} 早下班了！`);
      beep(820, .08, 'square');
    }
  }
}

function updateHud() {
  const values = hudValues(state ?? { score: 0, sanity: 100 });
  scoreNode.textContent = values.score;
  sanityNumber.textContent = values.sanity;
  sanityFill.style.width = values.fill;
  sanityFill.style.background = values.tone === 'healthy'
    ? colors.green
    : values.tone === 'warning' ? colors.yellow : colors.orange;
}

function showEvent(presentation) {
  clearTimeout(toastTimer);
  eventSpeaker.textContent = presentation.speaker;
  eventLine.textContent = presentation.line;
  eventImpact.textContent = presentation.impact;
  eventToast.className = `event-toast ${presentation.tone} show`;
  toastTimer = window.setTimeout(() => eventToast.classList.remove('show'), 1650);
}

function showRival(text) {
  clearTimeout(rivalTimer);
  rivalToast.textContent = text;
  rivalToast.classList.add('show');
  rivalTimer = window.setTimeout(() => rivalToast.classList.remove('show'), 1400);
}

function endGame(reason) {
  if (!state?.running) return;
  state.running = false;
  state.lastReason = reason;
  state.lossAnimation = createLossAnimation(state.sanity);
  if (state.lossAnimation) {
    state.npcAnimations = [];
    beep(90, .35, 'sawtooth');
    return;
  }
  finalizeEndGame();
}

function finalizeEndGame() {
  state.lossAnimation = null;
  cancelAnimationFrame(animationId);
  const presentation = lossPresentation(state.sanity, state.lastReason);
  document.querySelector('#final-score').textContent = state.score;
  document.querySelector('#death-reason').textContent = presentation.reason;
  const rival = nextRival(state.score, rivals);
  document.querySelector('#next-target').textContent = rival
    ? `再下 ${rival.gap} 層，就能超過 ${rival.name}。`
    : '你已經比今天所有同事早下班。';
  document.querySelector('#result-title').textContent = presentation.title;
  resultPanel.hidden = false;
  beep(90, .35, 'sawtooth');
}

function loop(time) {
  const dt = Math.min(.033, (time - previousTime) / 1000);
  previousTime = time;
  update(dt, time);
  draw(time);
  if (state.running || state.lossAnimation) animationId = requestAnimationFrame(loop);
}

function worldToScreenY(y) { return y - (state?.cameraY || 0); }
function unitX(value) { return value / 100 * (canvas.logicalWidth || 390); }

function draw(time = 0) {
  const width = canvas.logicalWidth || 390;
  const height = canvas.logicalHeight || 720;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  if (state?.shake > 0) {
    const strength = 4 * Math.min(1, state.shake / 0.3);
    ctx.translate(Math.sin(time * 0.09) * strength, Math.cos(time * 0.12) * strength * 0.55);
  }
  drawOffice(width, height);
  if (!state) {
    ctx.restore();
    return;
  }

  drawPressure(width);
  for (const platform of state.platforms) drawPlatform(platform, height, time);
  drawParticles();
  drawNpcAnimations(time);
  if (state.lossAnimation) drawCollapsedPlayer(state.player);
  else drawPlayer(state.player, time);
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(231,90,50,${Math.min(0.22, state.flash)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawPressure(width) {
  const playerY = worldToScreenY(state.player.y);
  const urgent = playerY < 105;
  ctx.save();
  ctx.fillStyle = urgent ? colors.orange : 'rgba(231,90,50,.62)';
  ctx.fillRect(0, 0, width, urgent ? 6 : 3);
  ctx.fillStyle = urgent ? colors.orangeDark : 'rgba(184,60,31,.62)';
  ctx.font = '800 10px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(urgent ? '工作追上來了 ↓  快走' : '↓ 畫面持續上捲', width / 2, 18);
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    const y = worldToScreenY(particle.y);
    if (y < -20 || y > (canvas.logicalHeight || 700) + 20) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.translate(unitX(particle.x), y);
    ctx.rotate(particle.spin);
    if (particle.kind === 'sparkle') {
      ctx.fillStyle = colors.yellow;
      ctx.strokeStyle = colors.ink;
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(2, -1); ctx.lineTo(5, 0); ctx.lineTo(2, 2);
      ctx.lineTo(0, 6); ctx.lineTo(-2, 2); ctx.lineTo(-5, 0); ctx.lineTo(-2, -1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (particle.kind === 'money') {
      ctx.fillStyle = colors.yellow;
      ctx.strokeStyle = colors.ink;
      ctx.fillRect(-6, -3, 12, 6);
      ctx.strokeRect(-6, -3, 12, 6);
      ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = colors.orangeDark;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.strokeRect(-5, -3, 10, 6);
    }
    ctx.restore();
  }
}

function drawNpcAnimations(time) {
  for (const npc of state.npcAnimations) {
    const t = npc.elapsed / npc.duration;
    const approach = Math.min(1, t / 0.18);
    const leave = Math.max(0, (t - 0.78) / 0.22);
    const nearX = npc.targetX - npc.direction * 13;
    const startX = npc.x - npc.direction * 24;
    const worldX = startX + (nearX - startX) * approach + npc.direction * 28 * leave;
    const y = worldToScreenY(npc.y - 15);
    if (y < -35 || y > (canvas.logicalHeight || 700) + 35) continue;
    drawNpc(npc, unitX(worldX), y, leave, time);
  }
}

function drawNpc(npc, x, y, leave, time) {
  const profile = actorProfile(npc.actor);
  const shirts = {
    annoyingCoworker: '#826d5d',
    annoyingManager: '#735844',
    badBoss: '#61483a',
    difficultClient: '#547c92',
    cuteCoworker: '#d79548',
    kindManager: '#4f826b',
    bossDad: '#9a7542',
  };
  const acting = npc.phase === 'act';
  const pulse = acting ? (Math.sin(time * 0.024) + 1) / 2 : 0;

  ctx.save();
  ctx.globalAlpha = 1 - leave * 0.75;
  ctx.translate(x, y);
  ctx.scale(npc.direction, 1);

  ctx.fillStyle = shirts[npc.actor] || '#735844';
  ctx.fillRect(-7, 0, 14, 15);
  ctx.fillStyle = '#efb88e';
  ctx.beginPath(); ctx.arc(0, -7, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-6, -13, 12, 4);
  ctx.fillRect(2, -8, 2, 2);

  ctx.strokeStyle = colors.ink;
  ctx.fillStyle = colors.paper;
  ctx.lineWidth = 1.5;
  if (profile.gesture === 'handoff') {
    ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(11 + pulse * 3, 0); ctx.stroke();
    ctx.fillRect(9 + pulse * 3, -4, 9, 7);
    ctx.strokeRect(9 + pulse * 3, -4, 9, 7);
    ctx.beginPath(); ctx.moveTo(11 + pulse * 3, -1); ctx.lineTo(16 + pulse * 3, -1); ctx.stroke();
  } else if (profile.gesture === 'point') {
    ctx.beginPath();
    ctx.moveTo(6, 4); ctx.lineTo(13 + pulse * 4, -3 - pulse * 2); ctx.lineTo(17 + pulse * 4, -4 - pulse * 2);
    ctx.stroke();
  } else if (profile.gesture === 'command') {
    ctx.beginPath();
    ctx.moveTo(-6, 4); ctx.lineTo(-12, -2 - pulse * 4);
    ctx.moveTo(6, 4); ctx.lineTo(12, -2 - pulse * 4);
    ctx.stroke();
  } else if (profile.gesture === 'revision') {
    ctx.beginPath();
    ctx.moveTo(-6, 3); ctx.lineTo(7, 10);
    ctx.moveTo(6, 3); ctx.lineTo(-7, 10);
    ctx.stroke();
    ctx.strokeStyle = colors.orange;
    ctx.beginPath(); ctx.arc(13, -7, 4 + pulse, 0.2, Math.PI * 1.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(18, -7); ctx.lineTo(14, -7); ctx.stroke();
  } else if (profile.gesture === 'coffee') {
    ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(11 + pulse * 2, 0); ctx.stroke();
    ctx.fillStyle = colors.yellow;
    ctx.fillRect(10 + pulse * 2, -4, 8, 7);
    ctx.strokeStyle = colors.ink;
    ctx.strokeRect(10 + pulse * 2, -4, 8, 7);
    ctx.beginPath(); ctx.arc(18 + pulse * 2, -1, 3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12 + pulse * 2, -6); ctx.quadraticCurveTo(15, -10 - pulse * 2, 17, -6); ctx.stroke();
  } else if (profile.gesture === 'shield') {
    ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(11, 0); ctx.stroke();
    ctx.fillStyle = colors.green;
    ctx.beginPath();
    ctx.moveTo(13, -7 - pulse); ctx.lineTo(19, -4); ctx.lineTo(18, 3); ctx.lineTo(13, 7); ctx.lineTo(8, 3); ctx.lineTo(7, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = colors.paper;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(12, 3); ctx.lineTo(16, -2); ctx.stroke();
  } else if (profile.gesture === 'bonus') {
    ctx.beginPath();
    ctx.moveTo(-6, 4); ctx.lineTo(-12, -3 - pulse * 3);
    ctx.moveTo(6, 4); ctx.lineTo(12, -3 - pulse * 3);
    ctx.stroke();
    ctx.fillStyle = colors.yellow;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * (13 + pulse * 3), -9 - pulse * 4);
      ctx.rotate(side * 0.18);
      ctx.fillRect(-4, -3, 8, 6); ctx.strokeRect(-4, -3, 8, 6);
      ctx.restore();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(7, 3); ctx.lineTo(12, npc.eventKind === 'damage' ? -1 : 5); ctx.stroke();
  }

  ctx.scale(npc.direction, 1);
  ctx.fillStyle = colors.ink;
  ctx.font = '800 9px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(profile.label, 0, -21);
  ctx.fillStyle = npc.eventKind === 'damage' ? colors.orange : colors.green;
  ctx.beginPath(); ctx.arc(13 * npc.direction, -13 - pulse * 2, 7 + pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.paper;
  ctx.font = '900 10px "Avenir Next", sans-serif';
  ctx.fillText(npc.eventKind === 'damage' ? '!' : '+', 13 * npc.direction, -10 - pulse * 2);
  ctx.restore();
}

function drawOffice(width, height) {
  const floor = Math.floor((state?.cameraY || 0) / 92) + 1;
  const theme = officeThemeForFloor(floor);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  const offset = -((state?.cameraY || 0) * .18 % 74);
  for (let y = offset; y < height; y += 74) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.fillStyle = theme.fixture;
  for (let y = offset + 17; y < height; y += 148) {
    ctx.fillRect(14, y, 34, 20); ctx.fillRect(width - 48, y, 34, 20);
    ctx.strokeStyle = theme.border; ctx.strokeRect(14, y, 34, 20); ctx.strokeRect(width - 48, y, 34, 20);
  }
  if (theme.id === 'meeting-maze') {
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = .25;
    ctx.setLineDash([8, 5]);
    for (let x = 74; x < width; x += 112) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (theme.id === 'executive') {
    ctx.strokeStyle = theme.border;
    ctx.globalAlpha = .28;
    for (let x = 70; x < width; x += 96) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    ctx.globalAlpha = .22;
    ctx.fillStyle = theme.body;
    for (let y = offset + 52; y < height; y += 222) {
      ctx.beginPath(); ctx.arc(28, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = theme.accent; ctx.fillRect(25, y + 10, 6, 14);
      ctx.fillStyle = theme.body;
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(32,35,31,.06)';
  ctx.font = '900 50px "Avenir Next", sans-serif';
  ctx.fillText(String(floor).padStart(2, '0'), width - 76, height * .53);
  ctx.font = '800 10px "Avenir Next", sans-serif';
  ctx.fillStyle = 'rgba(32,35,31,.3)';
  ctx.fillText(theme.label, width - 82, height * .53 + 18);
}

function drawPlatform(platform, height) {
  if (platform.broken) return;
  const y = worldToScreenY(platform.y);
  if (y < -35 || y > height + 35) return;
  const x = unitX(platform.renderX ?? platform.x);
  const w = unitX(platform.width);
  const activeFloor = Math.floor((state?.cameraY || 0) / 92) + 1;
  const theme = officeThemeForFloor(activeFloor);
  ctx.save();
  const progress = platform.breakAt
    ? Math.max(0, Math.min(1, (state.elapsed - (platform.breakAt - 0.32)) / 0.32))
    : 0;
  ctx.globalAlpha = 1 - progress * 0.4;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1.5;

  if (platform.appearance === 'cabinet') {
    ctx.fillStyle = theme.body;
    ctx.fillRect(x, y - 15, w, 17);
    ctx.strokeRect(x, y - 15, w, 17);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y - 15); ctx.lineTo(x + w / 2, y + 2); ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.fillRect(x + w * .22, y - 8, 3, 2); ctx.fillRect(x + w * .72, y - 8, 3, 2);
  } else if (platform.appearance === 'printer') {
    ctx.fillStyle = theme.body;
    ctx.fillRect(x, y - 9, w, 11);
    ctx.strokeRect(x, y - 9, w, 11);
    ctx.fillStyle = theme.fixture;
    ctx.fillRect(x + w * .25, y - 17, w * .5, 8);
    ctx.strokeRect(x + w * .25, y - 17, w * .5, 8);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + w - 8, y - 5, 3, 2);
  } else if (platform.appearance === 'conference-table') {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(x, y - 12, w, 5); ctx.strokeRect(x, y - 12, w, 5);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + w * .45, y - 7, w * .1, 9);
    ctx.fillRect(x + w * .2, y, w * .6, 3);
  } else if (platform.appearance === 'copier') {
    ctx.fillStyle = theme.fixture;
    ctx.fillRect(x + w * .12, y - 18, w * .76, 6); ctx.strokeRect(x + w * .12, y - 18, w * .76, 6);
    ctx.fillStyle = theme.body;
    ctx.fillRect(x, y - 12, w, 14); ctx.strokeRect(x, y - 12, w, 14);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + w * .65, y - 9, w * .18, 3);
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + w, y - 4); ctx.stroke();
  } else if (platform.appearance === 'projector-cart') {
    ctx.fillStyle = theme.fixture;
    ctx.fillRect(x + w * .18, y - 16, w * .64, 11); ctx.strokeRect(x + w * .18, y - 16, w * .64, 11);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x, y - 5, w, 5); ctx.strokeRect(x, y - 5, w, 5);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + 5, y, 3, 8); ctx.fillRect(x + w - 8, y, 3, 8);
    ctx.beginPath(); ctx.arc(x + 7, y + 9, 2, 0, Math.PI * 2); ctx.arc(x + w - 7, y + 9, 2, 0, Math.PI * 2); ctx.fill();
  } else if (platform.appearance === 'executive-desk') {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(x, y - 12, w, 6); ctx.strokeRect(x, y - 12, w, 6);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + 3, y - 6, w * .28, 11); ctx.fillRect(x + w * .68, y - 6, w * .29, 11);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + w * .42, y - 9, w * .16, 2);
  } else if (platform.appearance === 'credenza') {
    ctx.fillStyle = theme.body;
    ctx.fillRect(x, y - 16, w, 18); ctx.strokeRect(x, y - 16, w, 18);
    ctx.beginPath();
    ctx.moveTo(x + w / 3, y - 16); ctx.lineTo(x + w / 3, y + 2);
    ctx.moveTo(x + w * 2 / 3, y - 16); ctx.lineTo(x + w * 2 / 3, y + 2); ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + w * .29, y - 8, 2, 3); ctx.fillRect(x + w * .63, y - 8, 2, 3);
  } else if (platform.appearance === 'lounge') {
    ctx.fillStyle = theme.body;
    ctx.fillRect(x + 2, y - 14, w - 4, 9); ctx.strokeRect(x + 2, y - 14, w - 4, 9);
    ctx.fillStyle = theme.surface;
    ctx.fillRect(x, y - 5, w, 7); ctx.strokeRect(x, y - 5, w, 7);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(x + 3, y + 2, 3, 7); ctx.fillRect(x + w - 6, y + 2, 3, 7);
  } else {
    ctx.fillStyle = colors.ink; ctx.fillRect(x, y - 7, w, 9);
    ctx.fillStyle = theme.accent; ctx.fillRect(x + 3, y - 10, w - 6, 4);
    ctx.fillStyle = colors.ink; ctx.fillRect(x + 5, y + 2, 3, 11); ctx.fillRect(x + w - 8, y + 2, 3, 11);
  }

  if (progress > 0) {
    ctx.lineWidth = 1 + progress * 2;
    ctx.beginPath();
    ctx.moveTo(x + w * .3, y - 10); ctx.lineTo(x + w * .48, y - 4); ctx.lineTo(x + w * .38, y + 2);
    ctx.moveTo(x + w * .7, y - 10); ctx.lineTo(x + w * .55, y - 3); ctx.lineTo(x + w * .66, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(player, time) {
  const x = unitX(player.x);
  const y = worldToScreenY(playerSpriteY(player.y, player.height));
  const low = state.sanity <= 40;
  const bob = state.onPlatformId === null ? Math.sin(time * .012) * 1.5 : 0;
  const reaction = state.playerReaction;
  const panic = fallingPose(state.sanity, player.vy, state.elapsed);
  const landing = state.landingReaction;
  const landingImpact = landing ? Math.max(0, 1 - landing.elapsed / 0.28) : 0;
  const reactionProgress = reaction ? reaction.elapsed / reaction.duration : 0;
  const reactionPower = reaction ? Math.sin(Math.PI * reactionProgress) : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  if (landingImpact > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 + landingImpact * 0.65;
    ctx.strokeStyle = landing.centered ? colors.blue : colors.ink;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 14); ctx.lineTo(-13 - landingImpact * 5, 12 - landingImpact * 2);
    ctx.moveTo(7, 14); ctx.lineTo(13 + landingImpact * 5, 12 - landingImpact * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (landing?.earned) {
    const labelProgress = landing.elapsed / landing.duration;
    ctx.save();
    ctx.globalAlpha = labelProgress < 0.7 ? 1 : Math.max(0, (1 - labelProgress) / 0.3);
    ctx.fillStyle = colors.blue;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`摸魚連段 ×${landing.combo}`, 0, -28 - Math.min(landing.elapsed, 0.4) * 8);
    ctx.restore();
  }
  ctx.save();
  ctx.rotate(Math.max(-.16, Math.min(.16, player.vx / 180)) + (panic?.armSwing ?? 0) * .035);
  if (landingImpact > 0 && !panic) {
    ctx.translate(0, 14);
    ctx.scale(1 + landingImpact * 0.12, 1 - landingImpact * 0.18);
    ctx.translate(0, -14);
  }
  if (panic) {
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 5); ctx.lineTo(-12 - panic.intensity * 3, -2 + panic.armSwing * 5);
    ctx.moveTo(5, 5); ctx.lineTo(12 + panic.intensity * 3, -2 - panic.armSwing * 5);
    ctx.moveTo(-4, 13); ctx.lineTo(-7 + panic.legSwing * 3, 20);
    ctx.moveTo(4, 13); ctx.lineTo(7 - panic.legSwing * 3, 20);
    ctx.stroke();
  }
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-7, 1, 14, 13);
  if (reaction && !panic) {
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    if (reaction.kind === 'cheer') ctx.lineTo(-10 - reactionPower * 3, -3 - reactionPower * 6);
    else ctx.lineTo(-10 + reaction.direction * reactionPower * 5, -2 - reactionPower * 4);
    ctx.moveTo(6, 4);
    if (reaction.kind === 'cheer') ctx.lineTo(10 + reactionPower * 3, -3 - reactionPower * 6);
    else ctx.lineTo(10 + reaction.direction * reactionPower * 5, -2 - reactionPower * 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#efb88e';
  ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-7, -13, 14, 5);
  ctx.fillRect(-4, -7, 2, 2); ctx.fillRect(3, -7, 2, 2);
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (panic) ctx.arc(0, -2, 2.4, 0, Math.PI * 2);
  else if (reaction?.kind === 'recoil' && reactionPower > 0.2) ctx.arc(0, -2, 2, 0, Math.PI * 2);
  else if (reaction?.kind === 'cheer' && reactionPower > 0.2) ctx.arc(0, -3, 3, 0, Math.PI);
  else if (low) ctx.arc(0, -1, 3, Math.PI, 0);
  else { ctx.moveTo(-3, -2); ctx.lineTo(3, -2); }
  ctx.stroke();
  ctx.fillStyle = colors.orange;
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(3, 8); ctx.lineTo(0, 12); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill();
  if (panic && panic.intensity > 0) {
    ctx.fillStyle = colors.blue;
    ctx.globalAlpha = .45 + panic.intensity * .45;
    ctx.beginPath();
    ctx.arc(11, -9 + panic.armSwing * 2, 1.8 + panic.intensity, 0, Math.PI * 2);
    ctx.arc(-11, -5 - panic.armSwing * 2, 1.2 + panic.intensity * .7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function drawCollapsedPlayer(player) {
  const progress = Math.min(1, state.lossAnimation.elapsed / 0.42);
  const x = unitX(player.x);
  const y = worldToScreenY(playerSpriteY(player.y, player.height)) + progress * 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(progress * Math.PI / 2);
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-7, 1, 14, 13);
  ctx.fillStyle = '#efb88e';
  ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-7, -13, 14, 5);
  ctx.fillStyle = colors.orange;
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(3, 8); ctx.lineTo(0, 12); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill();
  ctx.restore();

  const crossProgress = Math.max(0, Math.min(1, (state.lossAnimation.elapsed - 0.18) / 0.28));
  drawRedCross(x + 17, overworkMarkerY(y, crossProgress), crossProgress);
}

function drawRedCross(x, y, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = colors.paper;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colors.orange;
  ctx.fillRect(-3, -7, 6, 14);
  ctx.fillRect(-7, -3, 14, 6);
  ctx.restore();
}

function beep(frequency, duration, type) {
  if (!soundOn) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function setInput(side, active) {
  input[side] = active;
}

function stopSwipe(pointerId) {
  if (swipe.pointerId !== pointerId) return;
  swipe.pointerId = null;
  setInput('left', false);
  setInput('right', false);
}

canvas.addEventListener('pointerdown', (event) => {
  if (!state?.running || swipe.pointerId !== null) return;
  event.preventDefault();
  swipe.pointerId = event.pointerId;
  swipe.lastX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (swipe.pointerId !== event.pointerId) return;
  const direction = swipeDirection(event.clientX - swipe.lastX);
  if (direction === 0) return;
  swipeHintDismissed = true;
  swipeHint.hidden = true;
  setInput('left', direction < 0);
  setInput('right', direction > 0);
  swipe.lastX = event.clientX;
});
canvas.addEventListener('pointerup', (event) => stopSwipe(event.pointerId));
canvas.addEventListener('pointercancel', (event) => stopSwipe(event.pointerId));
canvas.addEventListener('lostpointercapture', (event) => stopSwipe(event.pointerId));

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) setInput('left', true);
  if (['ArrowRight', 'd', 'D'].includes(event.key)) setInput('right', true);
  if (event.key === ' ' && resultPanel.hidden === false) startGame();
});
window.addEventListener('keyup', (event) => {
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) setInput('left', false);
  if (['ArrowRight', 'd', 'D'].includes(event.key)) setInput('right', false);
});

startButton.addEventListener('click', startGame);
retryButton.addEventListener('click', startGame);
soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.classList.toggle('off', !soundOn);
  soundButton.setAttribute('aria-label', soundOn ? '關閉音效' : '開啟音效');
});
window.addEventListener('resize', () => { resizeCanvas(); draw(); });
resizeCanvas();
draw();
