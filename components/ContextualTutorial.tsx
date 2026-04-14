"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Lyra's Contextual Tutorial Moments ──────────────────────────────────────
// Each moment fires ONCE when a condition is met. Stored in localStorage.
// No wizard. No spotlight. Just Lyra appearing with a dry remark.

const STORAGE_KEY = "qh_tutorial_seen";

function getSeenMoments(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markSeen(momentId: string) {
  try {
    const seen = getSeenMoments();
    seen.add(momentId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch { /* private browsing */ }
}

// ─── Tutorial Moment Definitions ─────────────────────────────────────────────
// Tier 1: First Session (Level 1-4)
// Tier 2: System Unlocks (Level 5-15)
// Tier 3: Advanced (Level 15+)

export interface TutorialMoment {
  id: string;
  title: string;
  text: string;
  /** Which view this appears on */
  view: string;
  /** Optional: minimum level to show */
  minLevel?: number;
  /** Accent color */
  accent?: string;
}

export const TUTORIAL_MOMENTS: TutorialMoment[] = [
  // ── Tier 1: First Session ──────────────────────────────────────────────
  {
    id: "arrival",
    title: "Du bist neu hier.",
    text: "Siehst du das Brett da? Das ist das Quest Board. Nimm dir eine Quest — eine die du schaffst, nicht eine die beeindruckend klingt. Die kommen später. Oder auch nicht.",
    view: "questBoard",
  },
  {
    id: "first_claim",
    title: "Du hast eine Quest angenommen.",
    text: "Jetzt musst du sie auch erledigen. Wenn du fertig bist, drück auf 'Done'. XP und Gold kommen dann von allein. Das System ist nicht kompliziert. Du wirst trotzdem Fragen haben.",
    view: "questBoard",
  },
  {
    id: "first_reward",
    title: "Belohnungen.",
    text: "XP lässt dich aufsteigen. Gold kauft Dinge. Die Forge-Temperatur bestimmt wie viel du bekommst — je heißer, desto mehr. Halte sie heiß indem du regelmäßig Quests erledigst. Oder lass es. Die Schmiede erkaltet auch ohne dich.",
    view: "questBoard",
  },
  {
    id: "streak_intro",
    title: "Der Streak.",
    text: "Jeden Tag eine Quest. Das ist der Streak. Er gibt dir bis zu +45% Gold. Verpasst du einen Tag, wird er zurückgesetzt — außer du hast Schutz: Streak Shields, Vitalität, oder den Schicksalsbaum. Dein Streak ist wertvoll. Schütz ihn.",
    view: "questBoard",
  },
  {
    id: "rituals_intro",
    title: "Rituale.",
    text: "Tägliche Gewohnheiten, formalisiert. Erstelle ein Ritual, halte es ein, verdiene XP. Breche es, und die Halle bemerkt es. Die Halle bemerkt alles. Das ist ihr Job.",
    view: "rituals",
  },
  // ── Tier 2: System Unlocks ─────────────────────────────────────────────
  {
    id: "wanderer_intro",
    title: "Wanderer's Rest.",
    text: "Reisende NPCs besuchen die Halle — jeder mit eigenen Quest-Ketten und einer einzigartigen Belohnung am Ende. Sie bleiben nicht lange. Wer ihre Quests erledigt bevor sie weiterziehen, bekommt etwas das es nirgendwo sonst gibt.",
    view: "wanderer",
  },
  {
    id: "companion_intro",
    title: "Dein Companion.",
    text: "Es folgt dir. Streichle es gelegentlich. Bei Bond Level 5 hat es Fähigkeiten die tatsächlich nützlich sind. Bis dahin ist es hauptsächlich... da. Urteilend.",
    view: "companion",
    minLevel: 3,
  },
  {
    id: "talents_intro",
    title: "Der Schicksalsbaum.",
    text: "Passive Boni in drei Ringen. Innen: Grundlagen. Mitte: Spezialisierungen mit Preis — wer hier wählt, verzichtet auf etwas anderes. Außen: Spielverändernde Kräfte für die, die den Weg bis hierhin gehen. Respec kostet. Wähle weise.",
    view: "talents",
    minLevel: 5,
  },
  {
    id: "gacha_intro",
    title: "Das Schicksalsrad.",
    text: "Gib Runensplitter oder Stardust. Bekomme Items. Manchmal gute. Meistens... lehrreiche. Das System hat einen Mitleidszähler — nach 75 Pulls ohne Legendär garantiert es dir eins. Das klingt großzügig, bis du nachzählst.",
    view: "gacha",
    minLevel: 5,
  },
  {
    id: "forge_intro",
    title: "Die Berufe.",
    text: "Acht Handwerker. Zwei darfst du wählen. Lerne Rezepte, sammle Materialien, und werde langsam besser in etwas. Wie im echten Leben, nur mit besserer Beleuchtung. Koch und Verzauberer zählen nicht als Slot — Essen und Magie braucht jeder.",
    view: "forge",
    minLevel: 7,
  },
  {
    id: "rift_intro",
    title: "Der Riss.",
    text: "Zeitbegrenzte Quest-Ketten. Normal: 3 Quests in 72 Stunden. Hard: 5 in 48. Legendary: 7 in 36. Scheitern kostet Tage Cooldown. Schaffst du Legendary, wartet Mythic+ — endlos skalierend, kein Limit, kein Mitleid.",
    view: "rift",
    minLevel: 10,
  },
  {
    id: "dungeon_intro",
    title: "Das Untergewölbe.",
    text: "Lade Freunde ein. Der Dungeon läuft im Hintergrund. Eure Gear Score entscheidet ob ihr gewinnt. Eure Freundschaft entscheidet ob ihr danach noch redet.",
    view: "dungeons",
    minLevel: 10,
  },
  {
    id: "factions_intro",
    title: "Die Vier Zirkel.",
    text: "Vier Fraktionen. Jede will andere Quests von dir. Reputation steigt automatisch. Titel, Rezepte und Rabatte warten auf die Loyalen. Oder die Geduldigen. In diesem Fall ist das dasselbe.",
    view: "factions",
    minLevel: 12,
  },
  {
    id: "worldboss_intro",
    title: "World Boss.",
    text: "Ein Boss. Alle Spieler. Jede Quest die du erledigst ist ein Schlag. Deine Gear Score bestimmt wie hart. Die Top-Beiträger bekommen was alle anderen nur bewundern können. Das ist Absicht.",
    view: "worldboss",
    minLevel: 15,
  },
  {
    id: "shop_intro",
    title: "Der Basar.",
    text: "Zwei Abteilungen. Self-Care: Dinge die gut für dich sind. Boosts: Dinge die gut für deine Stats sind. Der Unterschied ist subtiler als du denkst. Manche Items geben temporäre Buffs. Die meisten kosten Gold. Alle kosten Überwindung.",
    view: "shop",
    minLevel: 3,
  },
  {
    id: "challenges_intro",
    title: "Wöchentliche Herausforderungen.",
    text: "Sternenpfad: Drei Stufen. Allein. Schnelligkeit gibt Bonus-Sterne. Expedition: Alle zusammen. Ein gemeinsames Ziel. Beide resetten montags — neue Woche, neue Chance.",
    view: "challenges",
    minLevel: 5,
  },
  {
    id: "codex_intro",
    title: "Der Codex.",
    text: "Wissen, das du unterwegs aufsammelst. Manche Einträge findest du durch Quests, andere durch Zufall. Der Codex vergisst nichts. Ob das beruhigend oder beunruhigend ist, hängt davon ab was du so treibst.",
    view: "codex",
    minLevel: 5,
  },
  {
    id: "tome_intro",
    title: "Das Abenteuerbuch.",
    text: "Fünf Stockwerke. Dutzende Aufgaben. Meilensteine mit Belohnungen. Das Buch misst deinen Fortschritt mit einer Genauigkeit die an Besessenheit grenzt. 100% pro Stockwerk zu erreichen ist möglich. Empfohlen. Und leicht obsessiv.",
    view: "tome",
    minLevel: 10,
  },
  {
    id: "battlepass_intro",
    title: "Der Season Pass.",
    text: "40 Level. Quests geben Pass-XP. Belohnungen pro Level. Am Ende der Saison verfällt alles was du nicht abgeholt hast. Die Uhr tickt. Sie tickt immer.",
    view: "season",
    minLevel: 5,
  },
  {
    id: "social_intro",
    title: "The Breakaway.",
    text: "Freunde finden. Items tauschen. Nachrichten senden. Beobachten was die anderen so treiben. Im Wesentlichen: Gesellschaft. Mit einem Handelssystem das Vertrauen belohnt und Gier bestraft.",
    view: "social",
    minLevel: 5,
  },
];

// ─── Hook: Check if a moment should show ─────────────────────────────────────
export function useTutorialMoment(
  viewId: string,
  playerLevel: number,
  /** Extra conditions per moment ID */
  conditions?: Record<string, boolean>,
): { moment: TutorialMoment | null; dismiss: () => void } {
  const [activeMoment, setActiveMoment] = useState<TutorialMoment | null>(null);

  useEffect(() => {
    const seen = getSeenMoments();
    // Find the first unseen moment for this view that the player qualifies for
    // minLevel is informational — view access is already level-gated by TowerMap
    const match = TUTORIAL_MOMENTS.find(m =>
      m.view === viewId &&
      !seen.has(m.id) &&
      (conditions ? conditions[m.id] !== false : true)
    );
    setActiveMoment(match || null);
  }, [viewId, playerLevel, conditions]);

  const dismiss = useCallback(() => {
    if (activeMoment) {
      markSeen(activeMoment.id);
      setActiveMoment(null);
    }
  }, [activeMoment]);

  return { moment: activeMoment, dismiss };
}

// ─── Component: Tutorial Moment Banner ───────────────────────────────────────
// Inline banner that appears at the top of a view. NPC portrait + text.
// Dismisses with a click. Never blocks interaction.

export function TutorialMomentBanner({ viewId, playerLevel, conditions }: {
  viewId: string;
  playerLevel: number;
  conditions?: Record<string, boolean>;
}) {
  const { moment, dismiss } = useTutorialMoment(viewId, playerLevel, conditions);
  const [reopened, setReopened] = useState(false);

  // If no active moment, show a small "?" to re-open the last tutorial for this view
  if (!moment) {
    // Find the most relevant moment for this view that WAS seen
    const seen = getSeenMoments();
    const applicable = TUTORIAL_MOMENTS.filter(m => m.view === viewId && seen.has(m.id));
    if (applicable.length === 0) return null;
    const lastMoment = applicable[applicable.length - 1];

    if (!reopened) {
      return (
        <button
          onClick={() => setReopened(true)}
          className="text-xs mb-2 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-opacity hover:opacity-100"
          style={{ background: "rgba(233,168,76,0.06)", color: "rgba(233,168,76,0.4)", border: "1px solid rgba(233,168,76,0.12)", cursor: "pointer", opacity: 0.5 }}
          title="Show tutorial hint"
        >
          <span style={{ fontSize: 11 }}>?</span>
          <span>{lastMoment.title}</span>
        </button>
      );
    }

    // Re-opened: show the full banner (non-dismissable via storage — just hide with state)
    const accent = lastMoment.accent || "#e9a84c";
    return (
      <div className="rounded-xl px-4 py-3 mb-3 flex items-start gap-3 tab-content-enter" style={{
        background: "linear-gradient(135deg, rgba(233,168,76,0.08), rgba(233,168,76,0.03))",
        border: "1px solid rgba(233,168,76,0.25)",
        boxShadow: "0 0 24px rgba(233,168,76,0.06), inset 0 1px 0 rgba(233,168,76,0.08)",
      }}>
        <img src="/images/npcs/starweaver-final.png" alt="" width={40} height={40} className="rounded-lg flex-shrink-0 mt-0.5" style={{ imageRendering: "auto", border: "1px solid rgba(233,168,76,0.3)" }} onError={e => { e.currentTarget.style.display = "none"; }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: accent }}>{lastMoment.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{lastMoment.text}</p>
        </div>
        <button onClick={() => setReopened(false)} className="text-xs px-2 py-1 rounded-lg flex-shrink-0 mt-0.5" style={{ background: "rgba(233,168,76,0.1)", color: "#e9a84c", border: "1px solid rgba(233,168,76,0.2)", cursor: "pointer" }}>
          OK
        </button>
      </div>
    );
  }

  const accent = moment.accent || "#e9a84c";

  return (
    <div
      className="rounded-xl px-4 py-3 mb-3 flex items-start gap-3 tab-content-enter"
      style={{
        background: "linear-gradient(135deg, rgba(233,168,76,0.08), rgba(233,168,76,0.03))",
        border: "1px solid rgba(233,168,76,0.25)",
        boxShadow: "0 0 24px rgba(233,168,76,0.06), inset 0 1px 0 rgba(233,168,76,0.08)",
      }}
    >
      {/* Lyra portrait */}
      <img
        src="/images/npcs/starweaver-final.png"
        alt=""
        width={40}
        height={40}
        className="rounded-lg flex-shrink-0 mt-0.5"
        style={{ imageRendering: "auto", border: "1px solid rgba(233,168,76,0.3)" }}
        onError={e => { e.currentTarget.style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#e9a84c" }}>{moment.title}</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{moment.text}</p>
      </div>
      <button
        onClick={dismiss}
        className="text-xs px-2 py-1 rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: "rgba(233,168,76,0.1)", color: "#e9a84c", border: "1px solid rgba(233,168,76,0.2)", cursor: "pointer" }}
      >
        Verstanden
      </button>
    </div>
  );
}

// ─── Dismiss all Tier 1 moments at once ──────────────────────────────────────
export function dismissAllTier1() {
  const tier1Ids = TUTORIAL_MOMENTS.filter(m => !m.minLevel || m.minLevel <= 4).map(m => m.id);
  for (const id of tier1Ids) markSeen(id);
}

// ─── Check if any moments are unseen (for "skip tutorial" button) ────────────
export function hasUnseenMoments(): boolean {
  const seen = getSeenMoments();
  return TUTORIAL_MOMENTS.some(m => !seen.has(m.id));
}
