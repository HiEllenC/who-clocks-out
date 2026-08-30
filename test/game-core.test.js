import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clampSanity,
  applyEvent,
  eventForPlatform,
  nextRival,
  createSeededRandom,
  createPlatformPlan,
  updateHorizontalMotion,
  swipeDirection,
  landsOnPlatform,
  hudValues,
  advanceScroll,
  floorAtDepth,
  platformImpact,
  createNpcAnimation,
  eventKindForRoll,
  createLossAnimation,
  lossPresentation,
  overworkMarkerY,
  GAME_EVENTS,
  weightedEventIndex,
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
  platformAppearancesForFloor,
  createPlatformSequence,
} from '../src/game-core.js';

test('instruction tells players to escape before work crushes them', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /趕快逃離辦公室，別停太久被工作壓扁/);
  assert.doesNotMatch(html, /別停太久被工作推回頂樓/);
});

test('clampSanity keeps sanity between zero and one hundred', () => {
  assert.equal(clampSanity(128), 100);
  assert.equal(clampSanity(-9), 0);
  assert.equal(clampSanity(56), 56);
});

test('applyEvent changes sanity and reports game over at zero', () => {
  assert.deepEqual(applyEvent(100, { amount: -20 }), { sanity: 80, gameOver: false });
  assert.deepEqual(applyEvent(10, { amount: -30 }), { sanity: 0, gameOver: true });
  assert.deepEqual(applyEvent(91, { amount: 20 }), { sanity: 100, gameOver: false });
});

test('eventForPlatform reads the outcome preassigned by the daily seed', () => {
  const damage = eventForPlatform({ eventKind: 'damage', eventIndex: 0 });
  const recovery = eventForPlatform({ eventKind: 'recovery', eventIndex: 0 });
  assert.equal(damage.amount < 0, true);
  assert.equal(recovery.amount > 0, true);
  assert.match(damage.line, /在嗎/);
  assert.match(recovery.line, /來吃下午茶/);
  assert.equal(eventForPlatform({ eventKind: 'none', eventIndex: 0 }), null);
});

test('nextRival finds the nearest friend above the player score', () => {
  const rivals = [
    { name: 'Jason', score: 64 },
    { name: 'Kevin', score: 91 },
    { name: 'Amy', score: 102 },
  ];
  assert.deepEqual(nextRival(87, rivals), { name: 'Kevin', score: 91, gap: 5 });
  assert.equal(nextRival(110, rivals), null);
});

test('the same run seed reproduces the complete platform plan', () => {
  const first = createPlatformPlan(createSeededRandom(20260829), 8);
  const second = createPlatformPlan(createSeededRandom(20260829), 8);
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  assert.equal(first[0].eventKind, 'none');
  assert.equal(first.every((platform) => platform.x >= 8 && platform.x <= 72), true);
});

test('each run gets a different complete platform and event arrangement', () => {
  const firstSeed = createRunSeed(20260830, 1, 123456789);
  const secondSeed = createRunSeed(20260830, 2, 123456789);
  assert.notEqual(firstSeed, secondSeed);
  const first = createPlatformPlan(createSeededRandom(firstSeed), 20);
  const second = createPlatformPlan(createSeededRandom(secondSeed), 20);
  assert.notDeepEqual(first, second);
  assert.deepEqual(
    createPlatformPlan(createSeededRandom(firstSeed), 20),
    first,
  );
});

test('platform sequence continues past floor ninety without gaps', () => {
  const nextPlatform = createPlatformSequence(createSeededRandom(20260830));
  const firstBatch = Array.from({ length: 90 }, () => nextPlatform());
  const secondBatch = Array.from({ length: 30 }, () => nextPlatform());
  assert.equal(firstBatch.at(-1).id, 89);
  assert.equal(secondBatch[0].id, 90);
  assert.equal(secondBatch.at(-1).id, 119);
  assert.equal(secondBatch[0].y - firstBatch.at(-1).y, 92);
  assert.equal(secondBatch.every((platform) => (
    platformAppearancesForFloor(platform.id + 1).includes(platform.appearance)
  )), true);
});

test('platform appearance does not reveal its seeded event outcome', () => {
  const plan = createPlatformPlan(createSeededRandom(20260829), 900);
  const outcomesByAppearance = new Map();
  for (const platform of plan.slice(1)) {
    const outcomes = outcomesByAppearance.get(platform.appearance) ?? new Set();
    outcomes.add(platform.eventKind);
    outcomesByAppearance.set(platform.appearance, outcomes);
  }
  assert.equal([...outcomesByAppearance.values()].every((outcomes) => (
    outcomes.has('damage') && outcomes.has('recovery') && outcomes.has('none')
  )), true);
  assert.equal(plan.every((platform) => (
    platformAppearancesForFloor(platform.id + 1).includes(platform.appearance)
  )), true);
});

test('event rolls assign thirty percent damage, twenty percent recovery, and fifty percent no event', () => {
  assert.equal(eventKindForRoll(0), 'damage');
  assert.equal(eventKindForRoll(0.2999), 'damage');
  assert.equal(eventKindForRoll(0.3), 'recovery');
  assert.equal(eventKindForRoll(0.4999), 'recovery');
  assert.equal(eventKindForRoll(0.5), 'none');
  assert.equal(eventKindForRoll(0.9999), 'none');
});

test('event pools preserve the approved copy and exact category weights', () => {
  assert.equal(Number(GAME_EVENTS.damage.reduce((sum, event) => sum + event.weight, 0).toFixed(1)), 30);
  assert.equal(Number(GAME_EVENTS.recovery.reduce((sum, event) => sum + event.weight, 0).toFixed(1)), 20);
  assert.deepEqual(
    GAME_EVENTS.damage.find((event) => event.line === '能者多勞。'),
    { actor: 'badBoss', line: '能者多勞。', amount: -20, tone: 'damage', weight: 1.4 },
  );
  assert.deepEqual(
    GAME_EVENTS.recovery.find((event) => event.line === '公司賺很多，我發獎金！'),
    { actor: 'bossDad', line: '公司賺很多，我發獎金！', amount: 100, tone: 'bonus', weight: 0.4 },
  );
});

test('weighted event selection makes common lines more likely without losing rare lines', () => {
  assert.equal(weightedEventIndex(GAME_EVENTS.damage, 0), 0);
  assert.equal(weightedEventIndex(GAME_EVENTS.damage, 0.1065), 0);
  assert.equal(weightedEventIndex(GAME_EVENTS.damage, 0.107), 1);
  assert.equal(weightedEventIndex(GAME_EVENTS.damage, 0.9999), GAME_EVENTS.damage.length - 1);
});

test('each run plan binds every revealed line to its matching actor', () => {
  const plan = createPlatformPlan(createSeededRandom(20260830), 90);
  for (const platform of plan.filter((item) => item.eventKind !== 'none')) {
    assert.equal(platform.actor, eventForPlatform(platform).actor);
  }
});

test('platforms vary on every floor while keeping each move reachable', () => {
  const plan = createPlatformPlan(createSeededRandom(7), 30);
  const shifts = plan.slice(1).map((platform, index) => (
    Math.abs(platform.x - plan[index].x)
  ));
  assert.equal(shifts.every((shift) => shift >= 10 && shift <= 28), true);
  assert.equal(new Set(plan.map((platform) => platform.x)).size >= 12, true);
  assert.equal(plan.every((platform) => platform.x >= 8 && platform.x <= 72), true);
});

test('horizontal motion accelerates, slows down, and stays inside the playfield', () => {
  assert.deepEqual(updateHorizontalMotion({ x: 40, vx: 0 }, 1, 0.1), { x: 43, vx: 30 });
  assert.deepEqual(updateHorizontalMotion({ x: 40, vx: 20 }, 0, 0.1), { x: 40.7, vx: 7 });
  assert.equal(updateHorizontalMotion({ x: 98, vx: 20 }, 1, 0.1).x, 92);
});

test('horizontal swipe ignores taps and reports a deliberate direction', () => {
  assert.equal(swipeDirection(7), 0);
  assert.equal(swipeDirection(10), 1);
  assert.equal(swipeDirection(-10), -1);
  assert.equal(swipeDirection(42), 1);
});

test('horizontal control feels consistent at 60Hz and 120Hz', () => {
  const simulate = (dt) => {
    let player = { x: 40, vx: 0 };
    const phaseSteps = Math.round(0.2 / dt);
    for (let step = 0; step < phaseSteps; step += 1) {
      player = updateHorizontalMotion(player, 1, dt);
    }
    for (let step = 0; step < phaseSteps; step += 1) {
      player = updateHorizontalMotion(player, 0, dt);
    }
    return player;
  };
  const sixty = simulate(1 / 60);
  const oneTwenty = simulate(1 / 120);
  assert.equal(Math.abs(sixty.x - oneTwenty.x) < 0.25, true);
  assert.equal(Math.abs(sixty.vx - oneTwenty.vx) < 0.25, true);
});

test('landing requires downward crossing and horizontal overlap', () => {
  const platform = { x: 30, y: 100, width: 36 };
  assert.equal(landsOnPlatform({ x: 40, previousBottom: 96, bottom: 103, vy: 70 }, platform), true);
  assert.equal(landsOnPlatform({ x: 75, previousBottom: 96, bottom: 103, vy: 70 }, platform), false);
  assert.equal(landsOnPlatform({ x: 40, previousBottom: 103, bottom: 96, vy: -70 }, platform), false);
});

test('hud values reset the visible score and sanity for a new game', () => {
  assert.deepEqual(hudValues({ score: 0, sanity: 100 }), {
    score: '0', sanity: '100', fill: '100%', tone: 'healthy',
  });
});

test('screen pressure gets faster on every floor without segmented jumps', () => {
  const speeds = Array.from({ length: 121 }, (_, floor) => (
    advanceScroll(0, floor, 1).speed
  ));
  assert.equal(speeds.slice(1).every((speed, index) => speed > speeds[index]), true);
  assert.deepEqual(advanceScroll(0, 0, 1), { cameraY: 26, speed: 26 });
  assert.deepEqual(advanceScroll(0, 20, 1), { cameraY: 40.4, speed: 40.4 });
  assert.deepEqual(advanceScroll(0, 60, 1), { cameraY: 69.2, speed: 69.2 });
  assert.deepEqual(advanceScroll(0, 90, 1), { cameraY: 90.8, speed: 90.8 });
  assert.deepEqual(advanceScroll(0, 120, 1), { cameraY: 112.4, speed: 112.4 });
  assert.deepEqual(advanceScroll(0, 10000, 1), { cameraY: 120, speed: 120 });
});

test('office theme changes at floors thirty-one and sixty-one', () => {
  assert.equal(officeThemeForFloor(1).id, 'open-office');
  assert.equal(officeThemeForFloor(30).id, 'open-office');
  assert.equal(officeThemeForFloor(31).id, 'meeting-maze');
  assert.equal(officeThemeForFloor(60).id, 'meeting-maze');
  assert.equal(officeThemeForFloor(61).id, 'executive');
  assert.equal(officeThemeForFloor(90).id, 'executive');
  assert.equal(officeThemeForFloor(91).id, 'open-office');
  assert.equal(officeThemeForFloor(121).id, 'meeting-maze');
  assert.equal(officeThemeForFloor(151).id, 'executive');
  assert.deepEqual(platformAppearancesForFloor(1), ['desk', 'cabinet', 'printer']);
  assert.deepEqual(platformAppearancesForFloor(31), ['conference-table', 'copier', 'projector-cart']);
  assert.deepEqual(platformAppearancesForFloor(61), ['executive-desk', 'credenza', 'lounge']);
});

test('score follows deepest crossed floor even when platforms were skipped', () => {
  assert.equal(floorAtDepth(17), 0);
  assert.equal(floorAtDepth(18), 1);
  assert.equal(floorAtDepth(18 + 92 * 4 + 20), 5);
});

test('document trap knocks the player upward and briefly locks steering', () => {
  assert.deepEqual(platformImpact('documents', 18, 1), {
    vy: -76, vx: -26, lockSeconds: 0.18, shakeSeconds: 0.3, breakDelay: null,
  });
});

test('moving chair carries the player sideways', () => {
  assert.deepEqual(platformImpact('chair', 0, -1), {
    vy: 0, vx: -34, lockSeconds: 0, shakeSeconds: 0, breakDelay: null,
  });
});

test('cardboard box holds briefly before collapsing', () => {
  assert.equal(platformImpact('box', 0, 1).breakDelay, 0.32);
});

test('event creates a readable NPC animation that can leave the scene', () => {
  assert.deepEqual(
    createNpcAnimation({ actor: 'annoyingManager', eventKind: 'damage', appearance: 'cabinet', x: 64, y: 386 }, 42),
    {
      actor: 'annoyingManager', eventKind: 'damage', gesture: 'point', x: 64, y: 371,
      targetX: 42, direction: -1, elapsed: 0, duration: 1.35, phase: 'enter',
    },
  );
  assert.equal(createNpcAnimation({ actor: null, eventKind: 'none', x: 35, y: 110 }, 50), null);
});

test('NPC feet use the visible top surface of each platform', () => {
  assert.equal(platformTopY({ appearance: 'desk', y: 100 }), 90);
  assert.equal(platformTopY({ appearance: 'cabinet', y: 100 }), 85);
  assert.equal(platformTopY({ appearance: 'printer', y: 100 }), 83);
  assert.equal(platformTopY({ appearance: 'conference-table', y: 100 }), 88);
  assert.equal(platformTopY({ appearance: 'copier', y: 100 }), 82);
  assert.equal(platformTopY({ appearance: 'projector-cart', y: 100 }), 84);
  assert.equal(platformTopY({ appearance: 'executive-desk', y: 100 }), 88);
  assert.equal(platformTopY({ appearance: 'credenza', y: 100 }), 84);
  assert.equal(platformTopY({ appearance: 'lounge', y: 100 }), 86);
});

test('player sprite feet rest on the visible platform top instead of crossing its body', () => {
  const platform = { appearance: 'desk', y: 100 };
  const playerY = standingPlayerY(platform, 18);
  const spriteY = playerSpriteY(playerY);
  assert.equal(playerY, 81);
  assert.equal(spriteY + 14, platformTopY(platform));
});

test('zero sanity creates an overwork collapse before the result', () => {
  assert.deepEqual(createLossAnimation(0), {
    kind: 'overwork', elapsed: 0, duration: 1.1,
  });
  assert.equal(createLossAnimation(1), null);
  assert.deepEqual(lossPresentation(0, '能者多勞。'), {
    title: '被慣老闆榨乾了。',
    reason: '「能者多勞。」耗盡了你的理智。',
  });
  assert.deepEqual(lossPresentation(80, '下輩子，再也不工作了。'), {
    title: '過勞死了',
    reason: '下輩子，再也不工作了。',
  });
});

test('overwork marker remains visible when the player collapses near the ceiling', () => {
  assert.equal(overworkMarkerY(20, 1), 22);
  assert.equal(overworkMarkerY(100, 0.5), 67.5);
});

test('event presentation identifies the speaker and separates the sanity change', () => {
  assert.deepEqual(eventPresentation({
    actor: 'badBoss',
    line: '能者多勞。',
    amount: -20,
    tone: 'damage',
  }), {
    speaker: '慣老闆',
    line: '能者多勞。',
    impact: '理智 -20',
    tone: 'damage',
  });
  assert.equal(eventPresentation({
    actor: 'bossDad',
    line: '公司賺很多，我發獎金！',
    amount: 100,
    tone: 'bonus',
  }).impact, '理智補滿');
});

test('actor profiles assign distinct readable gestures', () => {
  assert.deepEqual(actorProfile('annoyingManager'), { label: '煩人主管', gesture: 'point' });
  assert.deepEqual(actorProfile('cuteCoworker'), { label: '可愛同事', gesture: 'coffee' });
  assert.deepEqual(actorProfile('difficultClient'), { label: '難搞客戶', gesture: 'revision' });
  assert.deepEqual(actorProfile('unknown'), { label: '同事', gesture: 'talk' });
});

test('NPC animation stays readable through enter act and exit phases', () => {
  assert.equal(npcAnimationPhase(0.1, 1.35), 'enter');
  assert.equal(npcAnimationPhase(0.5, 1.35), 'act');
  assert.equal(npcAnimationPhase(1.2, 1.35), 'exit');
});

test('bonus recovery uses money while other recovery events use sparkles', () => {
  assert.equal(recoveryParticleKind('bossDad'), 'money');
  assert.equal(recoveryParticleKind('cuteCoworker'), 'sparkle');
  assert.equal(recoveryParticleKind('kindManager'), 'sparkle');
});

test('player briefly reacts to damage and recovery events', () => {
  const recoil = createPlayerReaction(-10, -1);
  const cheer = createPlayerReaction(15, 1);
  assert.deepEqual(recoil, { kind: 'recoil', direction: -1, elapsed: 0, duration: 0.55 });
  assert.deepEqual(cheer, { kind: 'cheer', direction: 1, elapsed: 0, duration: 0.65 });
  assert.equal(advancePlayerReaction(recoil, 0.2).elapsed, 0.2);
  assert.equal(advancePlayerReaction(recoil, 0.55), null);
});

test('every downward fall uses the panic pose while low sanity makes it stronger', () => {
  assert.deepEqual(fallingPose(100, 80, 0), {
    intensity: 0.55,
    armSwing: 0,
    legSwing: 1,
  });
  assert.equal(fallingPose(15, 0, 0), null);
  assert.equal(fallingPose(15, -20, 0), null);
  assert.deepEqual(fallingPose(15, 80, 0), {
    intensity: 0.775,
    armSwing: 0,
    legSwing: 1,
  });
});

test('centered landings build a combo and every third landing restores sanity', () => {
  const platform = { x: 20, width: 30 };
  assert.deepEqual(resolveLandingCombo(0, 35, platform, 70), {
    centered: true, combo: 1, sanity: 70, sanityGain: 0, earned: false,
  });
  assert.deepEqual(resolveLandingCombo(2, 35, platform, 70), {
    centered: true, combo: 3, sanity: 75, sanityGain: 5, earned: true,
  });
  assert.deepEqual(resolveLandingCombo(5, 35, platform, 99), {
    centered: true, combo: 6, sanity: 100, sanityGain: 1, earned: true,
  });
  assert.deepEqual(resolveLandingCombo(2, 46, platform, 70), {
    centered: false, combo: 0, sanity: 70, sanityGain: 0, earned: false,
  });
});

test('landing reaction is brief and removes itself after cleanup', () => {
  const reaction = createLandingReaction(false, 0, false);
  assert.deepEqual(reaction, {
    centered: false, combo: 0, earned: false, elapsed: 0, duration: 0.28,
  });
  assert.deepEqual(advanceLandingReaction(reaction, 0.1), {
    centered: false, combo: 0, earned: false, elapsed: 0.1, duration: 0.28,
  });
  assert.equal(advanceLandingReaction(reaction, 0.28), null);
});

test('earned landing combo keeps its celebration visible long enough to read', () => {
  assert.deepEqual(createLandingReaction(true, 3, true), {
    centered: true, combo: 3, earned: true, elapsed: 0, duration: 0.85,
  });
});

test('daily rivals use the approved fifty and eighty floor targets', () => {
  assert.deepEqual(RIVALS, [
    { name: 'Jason', score: 8, reason: '五分鐘就好' },
    { name: 'Amy', score: 50, reason: '快速對一下' },
    { name: 'Kevin', score: 80, reason: '客戶改方向' },
  ]);
});
