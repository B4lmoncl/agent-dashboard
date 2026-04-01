/**
 * Quest Catalog — catalog management and quest seeding.
 *
 * Templates live in public/data/questCatalog.json (seeded to data/ on boot).
 * This module handles metadata rebuilding and first-boot quest seeding.
 */
const { state, saveQuestCatalog, saveQuests } = require('./state');

// ─── Catalog metadata ────────────────────────────────────────────────────────

function rebuildCatalogMeta() {
  const t = state.questCatalog.templates;
  if (!state.questCatalog.meta) state.questCatalog.meta = {};
  state.questCatalog.meta.totalTemplates = t.length;
  state.questCatalog.meta.byCategory = { generic: 0, classQuest: 0, chainQuest: 0, companionQuest: 0 };
  state.questCatalog.meta.byClass = {};
  for (const tpl of t) {
    const cat = tpl.category || 'generic';
    state.questCatalog.meta.byCategory[cat] = (state.questCatalog.meta.byCategory[cat] || 0) + 1;
    if (tpl.classId) state.questCatalog.meta.byClass[tpl.classId] = (state.questCatalog.meta.byClass[tpl.classId] || 0) + 1;
  }
  state.questCatalog.meta.lastUpdated = new Date().toISOString();
}

// ─── Quest seeding (first boot only) ─────────────────────────────────────────
// Creates quest instances from catalog templates so players have quests on day 1.
// Only runs if no seed quests exist yet. Templates are loaded from JSON by loadQuestCatalog().

function seedQuestCatalog() {
  const templates = state.questCatalog.templates;
  if (!templates || templates.length === 0) {
    console.warn('[catalog] No quest templates found — questCatalog.json may be missing or empty');
    return;
  }

  // Check if seed quests already exist (idempotent)
  const existingIds = new Set(state.quests.map(q => q.id));
  const hasSeedQuests = existingIds.has('quest-seed-001');
  if (hasSeedQuests) return;

  const BASE = '2026-03-10T12:00:00Z';
  const at = (offset) => new Date(new Date(BASE).getTime() + offset * 1000).toISOString();
  const priorityMap = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };
  const rarityMap = { starter: 'common', intermediate: 'uncommon', advanced: 'rare', expert: 'epic' };

  const seedQuests = templates.map((t, i) => ({
    id: `quest-seed-${String(i + 1).padStart(3, '0')}`,
    title: t.title,
    description: t.description || '',
    priority: priorityMap[t.difficulty] || 'medium',
    rarity: rarityMap[t.difficulty] || 'common',
    type: t.type,
    categories: [],
    product: null,
    humanInputRequired: false,
    createdBy: 'system',
    status: 'open',
    createdAt: at(i),
    claimedBy: null,
    completedBy: null,
    completedAt: null,
    parentQuestId: null,
    recurrence: t.recurrence || null,
    streak: 0,
    lastCompletedAt: null,
    proof: null,
    checklist: null,
    nextQuestTemplate: null,
    coopPartners: null,
    coopClaimed: [],
    coopCompletions: [],
    skills: t.tags || [],
    lore: t.lore || null,
    chapter: t.chainId || null,
    minLevel: t.minLevel || 1,
    classRequired: t.classId || null,
    requiresRelationship: t.requiresRelationship || false,
  }));

  const newSeeds = seedQuests.filter(s => !existingIds.has(s.id));
  if (newSeeds.length > 0) {
    state.quests.push(...newSeeds);
    for (const q of newSeeds) state.questsById.set(q.id, q);
    saveQuests();
  }

  rebuildCatalogMeta();
  saveQuestCatalog();

  const classCount = templates.filter(t => t.classId).length;
  const genericCount = templates.filter(t => !t.classId).length;
  console.log(`[catalog] Seeded ${newSeeds.length} quests from ${templates.length} templates (${classCount} class, ${genericCount} generic)`);
}

module.exports = {
  rebuildCatalogMeta,
  seedQuestCatalog,
};
