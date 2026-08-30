const DAMAGE_EVENTS = [
  { actor: 'annoyingCoworker', line: '在嗎？', amount: -5, tone: 'damage', weight: 3.2 },
  { actor: 'annoyingCoworker', line: '可以幫我一下嗎？', amount: -10, tone: 'damage', weight: 2.5 },
  { actor: 'annoyingCoworker', line: '這個你比較熟。', amount: -10, tone: 'damage', weight: 2 },
  { actor: 'annoyingCoworker', line: '主管說可以找你。', amount: -15, tone: 'damage', weight: 1.4 },
  { actor: 'annoyingCoworker', line: '我先丟給你囉。', amount: -10, tone: 'damage', weight: 2 },
  { actor: 'annoyingManager', line: '方便聊一下嗎？', amount: -10, tone: 'damage', weight: 2.4 },
  { actor: 'annoyingManager', line: '我們快速對一下。', amount: -10, tone: 'damage', weight: 2.2 },
  { actor: 'annoyingManager', line: '耽誤你五分鐘。', amount: -15, tone: 'damage', weight: 1.8 },
  { actor: 'annoyingManager', line: '下班前給我。', amount: -20, tone: 'damage', weight: 1.3 },
  { actor: 'annoyingManager', line: '我只改一點點。', amount: -15, tone: 'damage', weight: 1.5 },
  { actor: 'annoyingManager', line: '客戶剛剛改方向了。', amount: -25, tone: 'damage', weight: 0.7 },
  { actor: 'annoyingManager', line: '週一早上要看到。', amount: -20, tone: 'damage', weight: 0.8 },
  { actor: 'badBoss', line: '能者多勞。', amount: -20, tone: 'damage', weight: 1.4 },
  { actor: 'badBoss', line: '大家共體時艱。', amount: -20, tone: 'damage', weight: 1 },
  { actor: 'badBoss', line: '這個職位是責任制。', amount: -20, tone: 'damage', weight: 1.1 },
  { actor: 'badBoss', line: '今年先辛苦一點。', amount: -20, tone: 'damage', weight: 1.2 },
  { actor: 'badBoss', line: '年輕人不要太計較。', amount: -25, tone: 'damage', weight: 0.6 },
  { actor: 'difficultClient', line: '還是第一版比較好。', amount: -20, tone: 'damage', weight: 1.1 },
  { actor: 'difficultClient', line: '我說不上來，但感覺不對。', amount: -15, tone: 'damage', weight: 1.2 },
  { actor: 'difficultClient', line: '可以全部重做嗎？', amount: -30, tone: 'damage', weight: 0.6 },
];

const RECOVERY_EVENTS = [
  { actor: 'cuteCoworker', line: '來吃下午茶！', amount: 10, tone: 'recovery', weight: 2.5 },
  { actor: 'cuteCoworker', line: '這個我幫你。', amount: 15, tone: 'recovery', weight: 2 },
  { actor: 'cuteCoworker', line: '我幫你擋掉了。', amount: 20, tone: 'recovery', weight: 1.4 },
  { actor: 'cuteCoworker', line: '你先走，這裡有我。', amount: 20, tone: 'recovery', weight: 1 },
  { actor: 'cuteCoworker', line: '這封信我來回。', amount: 15, tone: 'recovery', weight: 1.4 },
  { actor: 'cuteCoworker', line: '我有幫你留咖啡。', amount: 10, tone: 'recovery', weight: 1.7 },
  { actor: 'kindManager', line: '會議取消。', amount: 10, tone: 'recovery', weight: 2.3 },
  { actor: 'kindManager', line: '這件事不用你處理。', amount: 15, tone: 'recovery', weight: 1.6 },
  { actor: 'kindManager', line: '不用改，這版可以。', amount: 15, tone: 'recovery', weight: 1.8 },
  { actor: 'kindManager', line: '今天準時走。', amount: 20, tone: 'recovery', weight: 1.1 },
  { actor: 'kindManager', line: '客戶那邊我來說。', amount: 20, tone: 'recovery', weight: 0.8 },
  { actor: 'bossDad', line: '來領薪水。', amount: 15, tone: 'recovery', weight: 1.2 },
  { actor: 'bossDad', line: '公司賺很多，我發獎金！', amount: 100, tone: 'bonus', weight: 0.4 },
  { actor: 'bossDad', line: '今年幫大家加薪。', amount: 30, tone: 'recovery', weight: 0.5 },
  { actor: 'bossDad', line: '不用共體時艱。', amount: 25, tone: 'recovery', weight: 0.3 },
];

export const RIVALS = Object.freeze([
  { name: 'Jason', score: 8, reason: '五分鐘就好' },
  { name: 'Amy', score: 50, reason: '快速對一下' },
  { name: 'Kevin', score: 80, reason: '客戶改方向' },
]);

const ACTOR_PROFILES = Object.freeze({
  annoyingCoworker: { label: '討厭同事', gesture: 'handoff' },
  annoyingManager: { label: '煩人主管', gesture: 'point' },
  badBoss: { label: '慣老闆', gesture: 'command' },
  difficultClient: { label: '難搞客戶', gesture: 'revision' },
  cuteCoworker: { label: '可愛同事', gesture: 'coffee' },
  kindManager: { label: '佛心主管', gesture: 'shield' },
  bossDad: { label: '老闆爸爸', gesture: 'bonus' },
});

export function actorProfile(actor) {
  return ACTOR_PROFILES[actor] ?? { label: '同事', gesture: 'talk' };
}

export function recoveryParticleKind(actor) {
  return actor === 'bossDad' ? 'money' : 'sparkle';
}

export function eventPresentation(event) {
  const profile = actorProfile(event.actor);
  const impact = event.tone === 'bonus' && event.amount >= 100
    ? '理智補滿'
    : `理智 ${event.amount > 0 ? '+' : ''}${event.amount}`;
  return {
    speaker: profile.label,
    line: event.line,
    impact,
    tone: event.tone,
  };
}

export function npcAnimationPhase(elapsed, duration = 1.35) {
  const progress = elapsed / duration;
  if (progress < 0.18) return 'enter';
  if (progress < 0.78) return 'act';
  return 'exit';
}

export function clampSanity(value) {
  return Math.max(0, Math.min(100, value));
}

export function applyEvent(currentSanity, event) {
  const sanity = clampSanity(currentSanity + event.amount);
  return { sanity, gameOver: sanity === 0 };
}

export function eventForPlatform(platform) {
  if (!platform || platform.eventKind === 'none') return null;
  const pool = platform.eventKind === 'recovery' ? RECOVERY_EVENTS : DAMAGE_EVENTS;
  return pool[platform.eventIndex % pool.length];
}

export function nextRival(score, rivals) {
  const next = rivals
    .filter((rival) => rival.score > score)
    .sort((a, b) => a.score - b.score)[0];
  return next ? { ...next, gap: next.score - score + 1 } : null;
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createRunSeed(daySeed, runNumber, entropy) {
  let seed = (daySeed ^ entropy ^ Math.imul(runNumber, 0x9e3779b9)) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x85ebca6b) >>> 0;
  seed ^= seed >>> 13;
  return seed >>> 0;
}

export function eventKindForRoll(roll) {
  if (roll < 0.3) return 'damage';
  if (roll < 0.5) return 'recovery';
  return 'none';
}

export function weightedEventIndex(pool, roll) {
  const totalWeight = pool.reduce((sum, event) => sum + event.weight, 0);
  const target = Math.max(0, Math.min(0.999999999, roll)) * totalWeight;
  let cumulative = 0;
  for (let index = 0; index < pool.length; index += 1) {
    cumulative += pool[index].weight;
    if (target < cumulative) return index;
  }
  return pool.length - 1;
}

export function createPlatformSequence(random) {
  const damageEffects = ['documents', 'chair', 'box'];
  let platformX = 35;
  let index = 0;
  return () => {
    if (index > 0) {
      const shift = 10 + Math.floor(random() * 19);
      const direction = random() < 0.5 ? -1 : 1;
      const proposedX = platformX + direction * shift;
      platformX = proposedX < 8 || proposedX > 72
        ? platformX - direction * shift
        : proposedX;
    }
    const floor = index + 1;
    const appearances = platformAppearancesForFloor(floor);
    const appearance = appearances[Math.floor(random() * appearances.length)];
    const eventRoll = index === 0 ? 1 : random();
    const eventKind = index === 0 ? 'none' : eventKindForRoll(eventRoll);
    const eventPool = eventKind === 'damage' ? DAMAGE_EVENTS : RECOVERY_EVENTS;
    const eventIndex = eventKind === 'none' ? 0 : weightedEventIndex(eventPool, random());
    const event = eventKind === 'none' ? null : eventPool[eventIndex];
    const effectKind = eventKind === 'damage'
      ? damageEffects[Math.floor(random() * damageEffects.length)]
      : 'none';
    const platform = {
      id: index,
      type: appearance,
      appearance,
      eventKind,
      eventIndex,
      effectKind,
      actor: event?.actor ?? null,
      x: platformX,
      y: 18 + index * 92,
    };
    index += 1;
    return platform;
  };
}

export function createPlatformPlan(random, count) {
  const nextPlatform = createPlatformSequence(random);
  return Array.from({ length: count }, () => nextPlatform());
}

export function updateHorizontalMotion(player, input, dt) {
  const vx = input === 0
    ? player.vx * Math.pow(0.35, dt / 0.1)
    : Math.max(-52, Math.min(52, player.vx + input * 300 * dt));
  const x = Math.max(8, Math.min(92, player.x + vx * dt));
  return { x: Number(x.toFixed(4)), vx: Number(vx.toFixed(4)) };
}

export function swipeDirection(deltaX, threshold = 10) {
  if (Math.abs(deltaX) < threshold) return 0;
  return deltaX > 0 ? 1 : -1;
}

export function landsOnPlatform(player, platform) {
  const halfPlayerWidth = 6;
  const overlaps = player.x + halfPlayerWidth >= platform.x
    && player.x - halfPlayerWidth <= platform.x + platform.width;
  return player.vy > 0
    && player.previousBottom <= platform.y
    && player.bottom >= platform.y
    && overlaps;
}

export function advanceScroll(cameraY, deepestFloor, dt) {
  const speed = Number(Math.min(120, 26 + deepestFloor * 0.72).toFixed(4));
  return { cameraY: cameraY + speed * dt, speed };
}

const OFFICE_THEMES = Object.freeze([
  Object.freeze({
    id: 'open-office', label: '一般辦公區',
    background: '#fffaf0', line: '#e3d8c6', fixture: '#eee5d6', border: '#cfc4b2', accent: '#ba8b60',
    surface: '#ba8b60', body: '#b7aa96', detail: '#716c62',
  }),
  Object.freeze({
    id: 'meeting-maze', label: '會議迷宮',
    background: '#edf4f4', line: '#bfd0d1', fixture: '#d4e3e3', border: '#718d91', accent: '#547c92',
    surface: '#6f8f94', body: '#aebfc0', detail: '#46636a',
  }),
  Object.freeze({
    id: 'executive', label: '主管樓層',
    background: '#eef1e8', line: '#cbd4c4', fixture: '#d5dfd0', border: '#62745f', accent: '#9a7a43',
    surface: '#9a7a43', body: '#71806e', detail: '#493b2b',
  }),
]);

const PLATFORM_APPEARANCES = Object.freeze({
  'open-office': Object.freeze(['desk', 'cabinet', 'printer']),
  'meeting-maze': Object.freeze(['conference-table', 'copier', 'projector-cart']),
  executive: Object.freeze(['executive-desk', 'credenza', 'lounge']),
});

export function officeThemeForFloor(floor) {
  const cycleFloor = ((Math.max(1, floor) - 1) % 90) + 1;
  if (cycleFloor >= 61) return OFFICE_THEMES[2];
  if (cycleFloor >= 31) return OFFICE_THEMES[1];
  return OFFICE_THEMES[0];
}

export function platformAppearancesForFloor(floor) {
  return [...PLATFORM_APPEARANCES[officeThemeForFloor(floor).id]];
}

export function fallingPose(sanity, verticalSpeed, elapsed) {
  if (verticalSpeed <= 0) return null;
  const lowSanityBoost = Math.max(0, Math.min(1, (30 - sanity) / 30));
  return {
    intensity: Number((0.55 + lowSanityBoost * 0.45).toFixed(4)),
    armSwing: Number(Math.sin(elapsed * Math.PI * 2).toFixed(4)),
    legSwing: Number(Math.cos(elapsed * Math.PI * 4).toFixed(4)),
  };
}

export function resolveLandingCombo(currentCombo, playerX, platform, currentSanity) {
  const platformCenter = platform.x + platform.width / 2;
  const centered = Math.abs(playerX - platformCenter) <= platform.width * 0.2;
  if (!centered) {
    return { centered: false, combo: 0, sanity: currentSanity, sanityGain: 0, earned: false };
  }
  const combo = currentCombo + 1;
  const earned = combo % 3 === 0;
  const sanity = earned ? clampSanity(currentSanity + 5) : currentSanity;
  return { centered: true, combo, sanity, sanityGain: sanity - currentSanity, earned };
}

export function createLandingReaction(centered, combo, earned) {
  return { centered, combo, earned, elapsed: 0, duration: earned ? 0.85 : 0.28 };
}

export function advanceLandingReaction(reaction, dt) {
  if (!reaction) return null;
  const elapsed = reaction.elapsed + dt;
  return elapsed >= reaction.duration ? null : { ...reaction, elapsed };
}

export function createPlayerReaction(amount, direction = 1) {
  return {
    kind: amount < 0 ? 'recoil' : 'cheer',
    direction: Math.sign(direction) || 1,
    elapsed: 0,
    duration: amount < 0 ? 0.55 : 0.65,
  };
}

export function advancePlayerReaction(reaction, dt) {
  if (!reaction) return null;
  const elapsed = reaction.elapsed + dt;
  return elapsed >= reaction.duration ? null : { ...reaction, elapsed };
}

export function floorAtDepth(y) {
  return y < 18 ? 0 : Math.floor((y - 18) / 92) + 1;
}

export function platformImpact(type, currentVx, movementDirection = 1) {
  const direction = Math.sign(currentVx) || Math.sign(movementDirection) || 1;
  if (type === 'documents') {
    return { vy: -76, vx: -direction * 26, lockSeconds: 0.18, shakeSeconds: 0.3, breakDelay: null };
  }
  if (type === 'chair') {
    return { vy: 0, vx: Math.sign(movementDirection || 1) * 34, lockSeconds: 0, shakeSeconds: 0, breakDelay: null };
  }
  if (type === 'box') {
    return { vy: 0, vx: currentVx, lockSeconds: 0, shakeSeconds: 0, breakDelay: 0.32 };
  }
  return { vy: 0, vx: currentVx, lockSeconds: 0, shakeSeconds: 0, breakDelay: null };
}

export function platformTopY(platform) {
  const offsets = {
    desk: 10, cabinet: 15, printer: 17,
    'conference-table': 12, copier: 18, 'projector-cart': 16,
    'executive-desk': 12, credenza: 16, lounge: 14,
  };
  return platform.y - (offsets[platform.appearance] ?? 10);
}

export function standingPlayerY(platform, playerHeight) {
  return platformTopY(platform) - playerHeight / 2;
}

export function playerSpriteY(playerY, playerHeight = 18) {
  const spriteBottom = 14;
  return playerY - (spriteBottom - playerHeight / 2);
}

export function createNpcAnimation(platform, playerX) {
  if (!platform.actor || platform.eventKind === 'none') return null;
  return {
    actor: platform.actor,
    eventKind: platform.eventKind,
    gesture: actorProfile(platform.actor).gesture,
    x: platform.x,
    y: platformTopY(platform),
    targetX: playerX,
    direction: Math.sign(playerX - platform.x) || 1,
    elapsed: 0,
    duration: 1.35,
    phase: 'enter',
  };
}

export function createLossAnimation(sanity) {
  if (sanity > 0) return null;
  return { kind: 'overwork', elapsed: 0, duration: 1.1 };
}

export function overworkMarkerY(playerScreenY, crossProgress) {
  return Math.max(22, playerScreenY - 29 - crossProgress * 7);
}

export function lossPresentation(sanity, lastReason) {
  if (sanity === 0) {
    return {
      title: '被慣老闆榨乾了。',
      reason: `「${lastReason}」耗盡了你的理智。`,
    };
  }
  return { title: '過勞死了', reason: lastReason };
}

export function hudValues(state) {
  const sanity = clampSanity(state.sanity);
  return {
    score: String(state.score),
    sanity: String(sanity),
    fill: `${sanity}%`,
    tone: sanity > 60 ? 'healthy' : sanity > 30 ? 'warning' : 'danger',
  };
}

export const GAME_EVENTS = Object.freeze({
  damage: DAMAGE_EVENTS,
  recovery: RECOVERY_EVENTS,
});
