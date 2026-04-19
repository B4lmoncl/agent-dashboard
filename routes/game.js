// ─── Game API (Classes, Roadmap, Rituals) ───────────────────────────────────
const router = require('express').Router();
const {
  state, STREAK_MILESTONES, RARITY_COLORS, TIMEZONE,
  saveClasses, saveRoadmap, saveRituals, saveUsers, ensureUserCurrencies,
} = require('../lib/state');
const {
  now, todayStr, getStreakXpBonus, getLevelInfo,
  getXpMultiplier, getGoldMultiplier, getUserGear, getQuestHoardingMalus,
  hasPassiveEffect, consumePassiveEffect, awardUserGold,
  getUserDropBonus, rollLoot, addLootToInventory, resetLootPity,
  checkAndAwardAchievements, checkAndAwardTitles, getLegendaryModifiers,
} = require('../lib/helpers');
const { requireApiKey, requireMasterKey } = require('../lib/middleware');

// ─── Classes API ────────────────────────────────────────────────────────────

// ─── CLASS SYSTEM — "PFAD DER MEISTERSCHAFT" — DESIGN NOTES ─────────────────
//
// STATUS: Infrastructure exists. Gameplay impact = ZERO. This is the design plan.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ORIGIN STORY
// ═══════════════════════════════════════════════════════════════════════════════
//
// The class system was born from a personal need: the creator works as an IT
// Systemintegrator / network specialist and wanted QuestHall to help him skill
// up in Fortinet firewalls, proxies, security, etc. The idea: turn real career
// development into a gamified quest chain. "Configure a firewall rule" becomes
// a quest. "Pass Fortinet NSE4" becomes a tier milestone.
//
// This means classes are NOT fantasy archetypes (warrior/mage/rogue). They are
// REAL-WORLD CAREER PATHS wrapped in fantasy naming. "Network Sage" = IT/Netzwerk.
// "Switch Architect" = Switching/WLAN. Each class is a personalized learning path.
//
// ═══════════════════════════════════════════════════════════════════════════════
// WHAT EXISTS NOW (infrastructure, no gameplay)
// ═══════════════════════════════════════════════════════════════════════════════
//
// - Data model: public/data/classes.json (1 active class: "Network Sage")
//   Fields: id, name, icon, fantasy, description, realWorld, tiers[], skillTree[],
//   achievements[], status (pending|active), createdBy, playerCount
// - Registration: OnboardingWizard step 2 = class picker + custom class submission
// - Pending → Active: POST /api/classes creates pending, PATCH activates
// - Notification: class_activated modal when pending class goes active
// - Quest gating: quest.classRequired field makes quests invisible to non-matching players
// - Profile: user.classId, user.classPending, user.classPendingNotified
//
// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN: HOW IT SHOULD WORK
// ═══════════════════════════════════════════════════════════════════════════════
//
// ── 1. CLASS TIER SYSTEM (SEPARATE from player level!) ──────────────────────
//
// The global player level (1-50) comes from XP earned by ALL quests. The class
// tier is a SEPARATE progression that advances ONLY by completing class-specific
// quests. You can be Player Level 30 but Class Tier 2 if you mostly did
// fitness quests and ignored your specialization.
//
// Storage: user._classTierProgress = { classId, questsCompleted: N, currentTier: N }
// Tier thresholds are defined per class in tiers[] (already in data model).
// BUT: thresholds should be based on class quest count, not global XP.
//   Example: Tier 1 = 0 quests, Tier 2 = 10, Tier 3 = 25, Tier 4 = 50, etc.
//
// Tier-up rewards:
//   - Title (already in tiers[].title, e.g., "Cable Apprentice" → "Switch Acolyte")
//   - Cosmetic frame (one per tier, class-themed)
//   - Maybe 1 cosmetic class emblem displayed on player card
//   - NO stat items. The gear system is complex enough. Keep it clean.
//
// Display: "Class Tier" badge on player card, distinct from player level badge.
//
// ── 2. CLASS QUESTS (the main content — THE reason for the class system) ────
//
// Each class has ~30-50 specific quests. These are REAL learning tasks, not
// generic RPG flavor. The class makes QuestHall a personalized career tool.
//
// Network Sage examples:
//   - "Konfiguriere eine Fortinet Firewall Policy" (rarity: uncommon)
//   - "Lerne die Grundlagen von Subnetting und CIDR" (rarity: common)
//   - "Mache das Fortinet NSE4 Zertifikat" (rarity: legendary)
//   - "Richte ein VLAN auf einem managed Switch ein" (rarity: rare)
//   - "Deploy einen IPsec VPN Tunnel" (rarity: epic)
//   - "Setze ein Monitoring mit SNMP auf" (rarity: uncommon)
//   - "Konfiguriere einen Reverse Proxy" (rarity: rare)
//   - "Dokumentiere ein Netzwerk-Topologie-Diagramm" (rarity: common)
//
// Class quests appear in the normal quest pool but ONLY for players of that
// class (via classRequired field, already supported in the quest system).
//
// ── 3. CLASS PASSIVE BONUS (one per class, small, not game-breaking) ────────
//
// Each class has ONE passive multiplier applied in the XP pipeline.
//   Example: Network Sage → "+15% XP for Learning quests"
//   A designer class → "+15% XP for Creative quests"
//
// Applied in helpers.js onQuestCompletedByUser, in the XP multiplier stack.
// Small enough to not break balancing. Just a nudge toward the "right" type.
//
// ── 4. PER-QUEST FEEDBACK SYSTEM (critical — classes are personalized) ──────
//
// Because every class is individually tailored, every player MUST be able to
// give feedback on their class content. Without this, classes become stale.
//
// Per-quest feedback (on every class quest):
//   - "Relevant" (thumbs up — want more like this)
//   - "Not relevant" (thumbs down — not useful for my career path)
//   - "I need..." (freetext — specific requests)
//   Storage: user._classQuestFeedback = { [questId]: { rating, text, at } }
//
// General class feedback (on the class overview page):
//   - Freetext panel where the player can write things like:
//     "Ich soll jetzt ein Cisco Zertifikat machen"
//     "Mein Fokus hat sich von Netzwerk auf Security verschoben"
//     "Ich brauche mehr zu Proxy/Reverse Proxy Themen"
//   Storage: user._classFeedback = [{ text, at }]
//
// THIS FEEDBACK IS THE INPUT FOR CLASS UPDATES. When an admin or Claude Code
// session says "update the Network Sage class", they read this feedback first
// and adjust quests accordingly. This is what makes the system alive.
//
// ── 5. CUSTOM CLASS PIPELINE (the "class forge") ────────────────────────────
//
// How a new class is born:
//   1. Player registers and enters "I'm an IT admin focusing on switches and WLAN"
//   2. POST /api/classes creates a pending class with the raw description
//   3. UI shows "Your class is being forged by the master craftsmen of Aethermoor"
//      (Skulduggery tone, mysterious, builds anticipation)
//   4. Admin or Claude Code session reads the pending submission and builds:
//      a) Fantasy name (e.g., "Wireless Warden", "Switch Architect")
//      b) Lore description (Skulduggery/Kingkiller tone)
//      c) 6-10 tier titles (career milestones as fantasy ranks)
//      d) 30-50 class-specific quest templates (REAL learning tasks)
//      e) One passive bonus (small XP multiplier for matching quest type)
//      f) Class icon (via Pixellab API, 128×128, fantasy RPG style)
//   5. Admin PATCH /api/classes/:id → status: 'active'
//   6. Player gets the class_activated notification modal
//
// ── 6. NICHE HANDLING (two people in similar but different fields) ───────────
//
// Classes are GRANULAR, not broad. "Network Sage" and "Switch Architect" and
// "Wireless Warden" are THREE SEPARATE classes. NOT branches of one class.
//
// If a friend joins and enters "I do switches and WLAN", they get their OWN
// class built from scratch. Maybe 5-10 quests overlap with Network Sage
// (fundamentals both need), but the rest is tailored to their focus.
//
// This means the class system scales by creating MORE classes, not by adding
// branches to existing ones. Each player gets exactly the quests they need.
//
// The "fundamentals" overlap is handled by quests with classRequired: null —
// visible to all players regardless of class. Only the specialized quests are
// class-gated.
//
// ── 7. GEAR: MINIMAL ────────────────────────────────────────────────────────
//
// No new stat items. The gear/affix/gem/socket system is already complex.
// Classes add QUESTS and PROGRESSION, not gear.
// Maybe 1 cosmetic class emblem per tier (displayed on player card).
// Maybe a unique class title at max tier. That's it.
//
// ═══════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION ORDER (when we get to this)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Step 1: Backend — class tier tracking (user._classTierProgress, increment on class quest complete)
// Step 2: Backend — per-quest feedback endpoints (POST /api/classes/:id/quest-feedback, GET for admin)
// Step 3: Backend — general class feedback endpoint (POST /api/classes/:id/feedback)
// Step 4: Backend — class passive bonus in XP multiplier stack (helpers.js)
// Step 5: Frontend — "Class Path" UI view (tier progress, class quest list, feedback buttons)
// Step 6: Content — Network Sage quest catalog (~30-40 real IT/networking quests)
// Step 7: Content — Class creation guide/template for admin/AI agent
// Step 8: Integration — tier-up rewards (titles, frames) via existing reward pipeline
//
// ═══════════════════════════════════════════════════════════════════════════════
// CONCRETE EXAMPLE: NETWORK SAGE
// ═══════════════════════════════════════════════════════════════════════════════
//
// realWorld: "IT / Netzwerk / Systemintegration"
// fantasy: "Network Sage"
// passive: "+15% XP for Learning quests"
//
// Tiers (based on class quest completions):
//   T1: Cable Apprentice (0 quests) — "Du hast ein Kabel eingesteckt. Das ist ein Anfang."
//   T2: Switch Acolyte (10 quests) — "Du weißt jetzt, was ein VLAN ist. Beeindruckend."
//   T3: Firewall Warden (25 quests) — "Du hast gelernt, Dinge aufzuhalten. Meistens die richtigen."
//   T4: Network Sentinel (50 quests) — "Du siehst Pakete im Schlaf. Das ist normal. Angeblich."
//   T5: Infrastructure Archmage (80 quests) — "Du sprichst fließend OSI-Layer 3."
//   T6: Network Sage (120 quests) — "Du bist das Netzwerk. Das Netzwerk bist du."
//
// Example quest catalog:
//   FUNDAMENTALS (T1-T2):
//     - "Lerne die 7 OSI-Schichten auswendig" (common)
//     - "Konfiguriere eine statische IP auf einem Linux Server" (common)
//     - "Subnetting: Berechne /24, /16, /8 Netze" (uncommon)
//     - "Richte DHCP auf einem Router ein" (common)
//     - "Dokumentiere ein Netzwerk-Topologie-Diagramm" (common)
//   SWITCHING & ROUTING (T2-T3):
//     - "Konfiguriere ein VLAN auf einem managed Switch" (rare)
//     - "Setze Inter-VLAN Routing auf" (rare)
//     - "Lerne die Grundlagen von OSPF" (uncommon)
//   FIREWALLS & SECURITY (T3-T4):
//     - "Erstelle eine Fortinet Firewall Policy" (rare)
//     - "Konfiguriere NAT auf einer FortiGate" (uncommon)
//     - "Setze einen IPsec VPN Tunnel auf" (epic)
//     - "Lerne die Basics von IDS/IPS" (uncommon)
//   CERTIFICATION (T4-T5):
//     - "Mache das Fortinet NSE4 Zertifikat" (legendary)
//     - "Bestehe eine CCNA Prüfung" (legendary)
//   ADVANCED (T5-T6):
//     - "Setze ein Monitoring mit SNMP + Grafana auf" (epic)
//     - "Automatisiere Netzwerk-Config mit Ansible" (epic)
//     - "Konfiguriere einen HA-Cluster" (legendary)
//
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/classes — all active classes
router.get('/api/classes', (req, res) => {
  res.json(state.classesData.classes.filter(c => c.status === 'active'));
});

// GET /api/classes/pending — pending classes [admin]
router.get('/api/classes/pending', requireMasterKey, (req, res) => {
  res.json(state.classesData.classes.filter(c => c.status === 'pending'));
});

// GET /api/classes/:id — single class with skill tree + quests
router.get('/api/classes/:id', (req, res) => {
  const cls = state.classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const classQuests = state.quests.filter(q => q.skills && q.skills.includes(cls.id));
  res.json({ ...cls, quests: classQuests });
});

// POST /api/classes — submit new class (status: pending) [auth]
router.post('/api/classes', requireApiKey, (req, res) => {
  const { name, icon, fantasy, description, realWorld, tiers, skillTree, achievements, createdBy } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const cls = {
    id: `class-${Date.now()}`,
    name,
    icon: icon || null,
    fantasy: fantasy || name,
    description: description || '',
    realWorld: realWorld || '',
    tiers: Array.isArray(tiers) ? tiers : [],
    skillTree: Array.isArray(skillTree) ? skillTree : [],
    achievements: Array.isArray(achievements) ? achievements : [],
    status: 'pending',
    createdBy: createdBy || 'unknown',
    createdAt: now(),
    playerCount: 0,
  };
  state.classesData.classes.push(cls);
  saveClasses();
  res.json({ ok: true, class: cls });
});

// PATCH /api/classes/:id — update class [admin]
router.patch('/api/classes/:id', requireMasterKey, (req, res) => {
  const cls = state.classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const allowed = ['name', 'icon', 'fantasy', 'description', 'realWorld', 'tiers', 'skillTree', 'achievements', 'status', 'playerCount'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) cls[key] = req.body[key];
  }
  saveClasses();
  res.json({ ok: true, class: cls });
});

// ─── Roadmap API ────────────────────────────────────────────────────────────

// GET /api/roadmap — all items
router.get('/api/roadmap', (req, res) => {
  res.json(state.roadmapData);
});

// POST /api/roadmap — add item [admin]
router.post('/api/roadmap', requireMasterKey, (req, res) => {
  const { title, desc, status, eta, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validStatuses = ['planned', 'in_progress', 'done'];
  const item = {
    id: `r${Date.now()}`,
    title,
    desc: desc || '',
    status: validStatuses.includes(status) ? status : 'planned',
    eta: eta || '',
    category: category || 'feature',
  };
  state.roadmapData.push(item);
  saveRoadmap();
  res.json({ ok: true, item });
});

// PATCH /api/roadmap/:id — update item [admin]
router.patch('/api/roadmap/:id', requireMasterKey, (req, res) => {
  const item = state.roadmapData.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Roadmap item not found' });
  const allowed = ['title', 'desc', 'status', 'eta', 'category'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  saveRoadmap();
  res.json({ ok: true, item });
});

// ─── Rituals API ────────────────────────────────────────────────────────────

// GET /api/rituals?player=X
router.get('/api/rituals', (req, res) => {
  const { player } = req.query;
  if (player) {
    return res.json(state.rituals.filter(r => r.playerId === player.toLowerCase()));
  }
  res.json(state.rituals);
});

// POST /api/rituals — create ritual [auth]
router.post('/api/rituals', requireApiKey, (req, res) => {
  const { title, description, schedule, difficulty, rewards, playerId, createdBy, isAntiRitual, category, commitment, commitmentDays, bloodPact } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  const ritual = {
    id: `ritual-${Date.now()}`,
    title,
    description: description || '',
    schedule: schedule || { type: 'daily' },
    difficulty: difficulty || 'medium',
    rewards: rewards || { xp: 15, gold: 5 },
    streak: 0,
    lastCompleted: null,
    missedDays: 0,
    createdBy: createdBy || playerId,
    playerId: playerId.toLowerCase(),
    createdAt: now(),
    status: 'active',
    ...(commitment ? { commitment } : {}),
    ...(commitmentDays ? { commitmentDays } : {}),
    ...(bloodPact ? { bloodPact: true } : {}),
    ...(isAntiRitual ? { isAntiRitual: true, category, cleanDays: 0, lastViolated: null } : {}),
  };
  state.rituals.push(ritual);
  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/recommit — rise again after broken streak [auth]
router.post('/api/rituals/:id/recommit', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  // Ownership check
  const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  if (!req.auth?.isAdmin && ritual.playerId?.toLowerCase() !== authId) {
    return res.status(403).json({ error: 'Cannot modify another player\'s ritual' });
  }
  if (ritual.status !== 'broken') return res.status(400).json({ error: 'Ritual is not broken' });

  // Reset to active with streak 0
  ritual.status = 'active';
  ritual.streak = 0;
  if (ritual.isAntiRitual) ritual.cleanDays = 0;
  ritual.lastCompleted = null;
  ritual.missedDays = 0;

  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/complete — mark done today [auth]
router.post('/api/rituals/:id/complete', requireApiKey, (req, res) => {
  const { playerId } = req.body;

  // Block ritual completion during tavern rest mode
  if (playerId) {
    const restUser = state.users[playerId.toLowerCase()];
    if (restUser?.tavernRest?.active) {
      return res.status(400).json({ error: 'Cannot complete rituals while resting in The Hearth. Leave rest mode first.' });
    }
  }

  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  // Verify playerId matches authenticated user (prevents XP injection to other players)
  const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  if (!req.auth?.isAdmin && playerId.toLowerCase() !== authId) {
    return res.status(403).json({ error: 'You can only complete your own rituals' });
  }

  // Block completions on broken rituals — must recommit first
  if (ritual.status === 'broken') return res.status(400).json({ error: 'Ritual is broken. Recommit first.' });

  const today = todayStr();
  if (ritual.lastCompleted === today) {
    return res.status(409).json({ error: 'Ritual already completed today' });
  }

  // Streak logic: was it done yesterday?
  // Trigger-type vows only count on explicit completion — missed days don't break the streak.
  const isTriggerType = ritual.schedule?.type === 'trigger';
  // Use Berlin timezone for yesterday (must match todayStr() which sets lastCompleted)
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  if (ritual.lastCompleted === yesterday) {
    ritual.streak = (ritual.streak || 0) + 1;
  } else if (!ritual.lastCompleted) {
    ritual.streak = 1;
  } else if (isTriggerType) {
    // Trigger-based: no missed-day penalty — just increment the count
    ritual.streak = (ritual.streak || 0) + 1;
  } else {
    // Missed days (daily schedule only)
    const lastDate = new Date(ritual.lastCompleted);
    const daysMissed = Math.floor((Date.now() - lastDate.getTime()) / 86400000) - 1;
    if (daysMissed === 1) {
      ritual.streak = Math.max(0, (ritual.streak || 0) - 3);
    } else if (daysMissed === 2) {
      ritual.streak = Math.max(0, (ritual.streak || 0) - 7);
    } else {
      ritual.streak = 0;
      ritual.status = 'broken';
      saveRituals();
      return res.json({ ok: false, broken: true, ritual, message: 'Streak lost — ritual is now broken. Recommit to continue.' });
    }
  }
  ritual.lastCompleted = today;
  ritual.missedDays = 0;

  // Award XP/gold to player
  const uid = playerId.toLowerCase();
  const u = state.users[uid];

  // Track for achievements
  if (u) u._ritualsCompleted = (u._ritualsCompleted || 0) + 1;

  // Track longest streak and completion history
  if (!ritual.longestStreak || ritual.streak > ritual.longestStreak) {
    ritual.longestStreak = ritual.streak;
  }
  if (!ritual.completedDates) ritual.completedDates = [];
  if (!ritual.completedDates.includes(today)) {
    ritual.completedDates.push(today);
    if (ritual.completedDates.length > 90) {
      ritual.completedDates = ritual.completedDates.slice(-90);
    }
  }
  let newAchievements = [];
  let lootDrop = null;
  let milestoneDrop = null;
  let pactCompletionXp = 0;
  let pactCompletionGold = 0;
  let xpAmount = 0;
  let goldEarnedAmount = 0;

  if (u) {
    // ─── Commitment & difficulty bonus calculation ───
    // Daily: base + bond bonus (no pact multiplier). Pact bonus pays out at commitment completion.
    const COMMITMENT_BONUSES = { none: { gold: 0, xp: 0 }, spark: { gold: 3, xp: 5 }, flame: { gold: 7, xp: 10 }, ember: { gold: 13, xp: 20 }, crucible: { gold: 20, xp: 35 }, eternity: { gold: 30, xp: 50 } };
    const DIFFICULTY_BOND_SCALE = { easy: 0.5, medium: 1.0, hard: 1.5, legendary: 2.0 };
    const BLOOD_PACT_MULTI = { none: 1, spark: 3, flame: 3, ember: 7, crucible: 16, eternity: 30 };
    const commitBonus = COMMITMENT_BONUSES[ritual.commitment] || { gold: 0, xp: 0 };
    const diffScale = DIFFICULTY_BOND_SCALE[ritual.difficulty] || 1.0;
    const commitXp = Math.round(commitBonus.xp * diffScale);
    const commitGold = Math.round(commitBonus.gold * diffScale);

    // Apply full multiplier chain (same as quest completion)
    const xpBase = (ritual.rewards.xp || 15) + commitXp;
    const streakBonus = getStreakXpBonus(ritual.streak);
    const xpMulti = getXpMultiplier(uid);
    const gear = getUserGear(uid);
    const gearBonus = 1 + (gear.xpBonus || 0) / 100;
    const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
    const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
    const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
    const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
    const hoardingMalus = getQuestHoardingMalus(uid).multiplier;
    let passiveXpBonus = 1;
    if (hasPassiveEffect(uid, 'xp_boost_10')) passiveXpBonus += 0.10;
    if (hasPassiveEffect(uid, 'xp_boost_5')) passiveXpBonus += 0.05;
    xpAmount = Math.round(xpBase * (1 + streakBonus) * xpMulti * gearBonus * companionBonus * bondBonus * hoardingMalus * passiveXpBonus);

    // Legendary effect: ritualStreakBonus — extra XP scaled by streak days
    const ritualMods = getLegendaryModifiers(uid);
    const streakBonusXp = Math.round(xpBase * (u.streakDays || 0) * (ritualMods.ritualStreakBonus || 0));
    xpAmount += streakBonusXp;

    u.xp = (u.xp || 0) + xpAmount;

    // Gold with full multiplier chain
    const goldBase = (ritual.rewards.gold || 5) + commitGold;
    const goldMulti = getGoldMultiplier(uid);
    const streakGoldMulti = Math.min(1 + (u.streakDays || 0) * 0.015, 1.45);
    goldEarnedAmount = Math.round(goldBase * goldMulti * streakGoldMulti);
    if (consumePassiveEffect(uid, 'gold_boost_next')) goldEarnedAmount *= 2;
    u.gold = (u.gold || 0) + goldEarnedAmount;
    ensureUserCurrencies(u);
    u.currencies.gold = u.gold;

    // ─── Blood Pact completion bonus (one-time at end of commitment) ───
    if (ritual.bloodPact && ritual.commitmentDays && ritual.streak >= ritual.commitmentDays && !ritual.pactCompleted) {
      const pactMulti = BLOOD_PACT_MULTI[ritual.commitment] || 3;
      pactCompletionXp = Math.round(commitBonus.xp * diffScale * pactMulti);
      pactCompletionGold = Math.round(commitBonus.gold * diffScale * pactMulti);
      u.xp = (u.xp || 0) + pactCompletionXp;
      u.gold = (u.gold || 0) + pactCompletionGold;
      u.currencies.gold = u.gold;
      ritual.pactCompleted = true;
    }

    // ─── Mega-milestone premium currency bonuses (180/365 day streaks) ───
    // (Must be OUTSIDE the pactCompleted gate — these trigger at day 180/365
    //  regardless of when the initial commitment was completed)
    const MEGA_MILESTONES = [
      { days: 180, stardust: 50, essenz: 100, title: { id: 'pact-half-year', name: 'Halbjahreseid', rarity: 'epic' } },
      { days: 365, stardust: 150, essenz: 300, title: { id: 'pact-year', name: 'Jahresschwur', rarity: 'legendary' } },
    ];
    if (ritual.bloodPact) {
      for (const mm of MEGA_MILESTONES) {
        const mmKey = `pactMega_${mm.days}`;
        if (ritual.streak >= mm.days && !ritual[mmKey]) {
          ritual[mmKey] = true;
          ensureUserCurrencies(u);
          if (mm.stardust) { u.currencies.stardust = (u.currencies.stardust || 0) + mm.stardust; }
          if (mm.essenz) { u.currencies.essenz = (u.currencies.essenz || 0) + mm.essenz; }
          if (mm.title) {
            u.earnedTitles = u.earnedTitles || [];
            if (!u.earnedTitles.find(t => t.id === mm.title.id)) {
              u.earnedTitles.push({ id: mm.title.id, name: mm.title.name, rarity: mm.title.rarity, source: 'blood-pact-mega', earnedAt: now() });
            }
          }
        }
      }
    }

    // Milestone check
    const prevStreak = ritual.streak - 1;
    for (const m of STREAK_MILESTONES) {
      if (ritual.streak === m.days && prevStreak < m.days) {
        if (m.lootTier) {
          const pool = state.lootTables[m.lootTier] || [];
          if (pool.length > 0) {
            milestoneDrop = { ...pool[Math.floor(Math.random() * pool.length)], rarity: m.lootTier, rarityColor: RARITY_COLORS[m.lootTier] };
            addLootToInventory(uid, milestoneDrop);
          }
        }
      }
    }

    // Loot drop (10% chance + GLÜ bonus)
    const dropBonus = getUserDropBonus(uid);
    const { level: ritualPlayerLevel } = getLevelInfo(u.xp || 0);
    const dropped = rollLoot(0.10 + dropBonus, ritualPlayerLevel);
    if (dropped) {
      resetLootPity(uid);
      addLootToInventory(uid, dropped);
      lootDrop = dropped;
    }

    newAchievements = checkAndAwardAchievements(uid);
    saveUsers();

    // Battle Pass XP
    try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'ritual_complete'); } catch (e) { console.warn('[bp-xp] ritual_complete:', e.message); }
    if (ritual.isAntiRitual) {
      try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'vow_clean_day'); } catch (e) { console.warn('[bp-xp] vow_clean_day:', e.message); }
    }
  }
  saveRituals();

  const xpEarned = pactCompletionXp > 0 ? xpAmount + pactCompletionXp : xpAmount;
  const goldEarned = pactCompletionGold > 0 ? goldEarnedAmount + pactCompletionGold : goldEarnedAmount;
  const streakMilestone = u?._lastStreakMilestone || null;
  if (u) delete u._lastStreakMilestone;
  res.json({ ok: true, ritual, newAchievements, lootDrop, milestoneDrop, xpEarned, goldEarned, streakMilestone, ...(pactCompletionXp > 0 ? { pactCompletion: { xp: pactCompletionXp, gold: pactCompletionGold } } : {}) });
});

// PATCH /api/rituals/:id/extend — extend ritual/vow deadline [auth]
router.patch('/api/rituals/:id/extend', requireApiKey, (req, res) => {
  const { newCommitment, newCommitmentDays } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  // Ownership check
  const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  if (!req.auth?.isAdmin && ritual.playerId?.toLowerCase() !== authId) {
    return res.status(403).json({ error: 'Cannot modify another player\'s ritual' });
  }

  // Blood Oaths cannot be extended (they are permanent)
  if (ritual.bloodPact) {
    return res.status(403).json({ error: 'Blood Oaths are permanent and cannot be extended' });
  }

  // New commitment must be longer than current
  if (!newCommitmentDays || newCommitmentDays <= (ritual.commitmentDays || 0)) {
    return res.status(400).json({ error: 'New commitment must be longer than current commitment' });
  }

  ritual.commitment = newCommitment || ritual.commitment;
  ritual.commitmentDays = newCommitmentDays;

  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/violate — mark vow as violated / slipped [auth]
router.post('/api/rituals/:id/violate', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  if (!req.auth?.isAdmin && playerId.toLowerCase() !== authId) {
    return res.status(403).json({ error: 'You can only violate your own rituals' });
  }

  // Track longest streak before resetting
  if (!ritual.longestStreak || ritual.streak > ritual.longestStreak) {
    ritual.longestStreak = ritual.streak;
  }

  // Reset streak to 0 and mark as broken
  ritual.streak = 0;
  if (ritual.isAntiRitual) {
    ritual.cleanDays = 0;
  }
  ritual.status = 'broken';
  ritual.lastViolated = todayStr();
  ritual.missedDays = (ritual.missedDays || 0) + 1;

  saveRituals();
  res.json({ ok: true, ritual });
});

// DELETE /api/rituals/:id [auth]
router.delete('/api/rituals/:id', requireApiKey, (req, res) => {
  const idx = state.rituals.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ritual not found' });
  // Ownership check
  const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  const ritual = state.rituals[idx];
  if (!req.auth?.isAdmin && ritual.playerId?.toLowerCase() !== authId) {
    return res.status(403).json({ error: 'Cannot delete another player\'s ritual' });
  }
  if (!req.body.confirmed) {
    return res.json({ ok: false, needsConfirmation: true, message: 'Ritual wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.' });
  }
  state.rituals.splice(idx, 1);
  saveRituals();
  res.json({ ok: true });
});

// ─── Titles ─────────────────────────────────────────────────────────────────
const { requireAuth, requireSelf } = require('../lib/middleware');

// GET /api/titles — all title definitions
router.get('/api/titles', (req, res) => {
  res.json(state.titleDefinitions || []);
});

// GET /api/player/:name/titles — player's earned titles + equipped title
router.get('/api/player/:name/titles', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const newTitles = checkAndAwardTitles(uid);
  if (newTitles.length > 0) saveUsers();
  const defs = state.titleDefinitions || [];
  const earned = (u.earnedTitles || []).map(t => {
    const def = defs.find(d => d.id === t.id);
    return def ? { ...def, earnedAt: t.earnedAt } : { id: t.id, name: t.id, earnedAt: t.earnedAt };
  });
  res.json({ earned, equipped: u.equippedTitle || null });
});

// POST /api/player/:name/title/equip — equip a title
router.post('/api/player/:name/title/equip', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const { titleId } = req.body;
  if (!titleId) {
    // Unequip
    u.equippedTitle = null;
    saveUsers();
    return res.json({ ok: true, equippedTitle: null });
  }
  const earned = (u.earnedTitles || []).find(t => t.id === titleId);
  if (!earned) return res.status(400).json({ error: 'Title not earned yet' });
  const def = (state.titleDefinitions || []).find(d => d.id === titleId);
  u.equippedTitle = def ? { id: def.id, name: def.name, rarity: def.rarity } : { id: titleId, name: titleId };
  saveUsers();
  res.json({ ok: true, equippedTitle: u.equippedTitle });
});

module.exports = router;
