"use client";
import { useEffect, useState } from "react";

interface ClassDef {
  id: string;
  name: string;
  icon: string;
  fantasy: string;
  description: string;
  realWorld: string;
  tiers?: { level: number; title: string; minXp: number }[];
  skillTree?: { id: string; name: string; icon: string; maxLevel?: number }[];
  playerCount?: number;
  status: string;
}

interface CompanionData {
  type: string;
  name: string;
  emoji: string;
  isReal: boolean;
  species?: string;
}

interface OnboardingWizardProps {
  onComplete: (data: { name: string; apiKey: string; userId: string }) => void;
  onClose: () => void;
}

const VIRTUAL_COMPANIONS = [
  { type: "dragon",  emoji: "🐲", name: "Ember",  desc: "Ein feuriger Drache der dich antreibt",            personality: "fierce",    trait: "Fordernd",  questHint: "Erledige 3 Quests täglich!" },
  { type: "owl",     emoji: "🦉", name: "Sage",   desc: "Eine weise Eule die dich beim Lernen begleitet",   personality: "wise",      trait: "Weise",     questHint: "Lerne jeden Tag etwas Neues" },
  { type: "phoenix", emoji: "🔥", name: "Blaze",  desc: "Ein Phoenix der aus jeder Niederlage aufsteht",    personality: "resilient", trait: "Resilient", questHint: "Nach jedem Rückschlag stärker" },
  { type: "wolf",    emoji: "🐺", name: "Shadow", desc: "Ein treuer Wolf der immer an deiner Seite steht",  personality: "loyal",     trait: "Treu",      questHint: "Tägliche Routine einhalten" },
  { type: "fox",     emoji: "🦊", name: "Trick",  desc: "Ein schlauer Fuchs der kreative Lösungen findet",  personality: "clever",    trait: "Clever",    questHint: "Finde einen kreativeren Weg" },
  { type: "bear",    emoji: "🐻", name: "Bjorn",  desc: "Ein starker Bär der dich durch harte Zeiten trägt",personality: "strong",    trait: "Stark",     questHint: "Sport und Kraft quests" },
];

const PET_SPECIES = [
  { value: "cat",     label: "Katze 🐱",   carePreview: ["Füttern", "Spielen", "Kuscheln", "Tierarzt-Check"] },
  { value: "dog",     label: "Hund 🐕",    carePreview: ["Gassi gehen", "Füttern", "Training", "Pflegen", "Tierarzt-Check"] },
  { value: "hamster", label: "Hamster 🐹", carePreview: ["Füttern", "Käfig reinigen", "Spielen"] },
  { value: "bird",    label: "Vogel 🐦",   carePreview: ["Füttern", "Singen", "Käfig reinigen"] },
  { value: "fish",    label: "Fisch 🐟",   carePreview: ["Füttern", "Aquarium reinigen"] },
  { value: "rabbit",  label: "Hase 🐰",    carePreview: ["Füttern", "Spielen", "Pflegen"] },
  { value: "other",   label: "Andere 🐾",  carePreview: ["Füttern", "Pflegen"] },
];

const PET_EMOJI: Record<string, string> = {
  cat: "🐱", dog: "🐕", hamster: "🐹", bird: "🐦", fish: "🐟", rabbit: "🐰", other: "🐾",
};

export default function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  // Step 0 fields
  const [name, setName] = useState("");

  // Step 1 fields
  const [age, setAge] = useState("");
  const [goals, setGoals] = useState("");

  // Step 2 fields
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showCustomClass, setShowCustomClass] = useState(false);
  const [customProfession, setCustomProfession] = useState("");
  const [customFocus, setCustomFocus] = useState("");
  const [customClassSubmitted, setCustomClassSubmitted] = useState(false);
  const [showClassTutorial, setShowClassTutorial] = useState(false);

  // Step 3 relationship fields
  const [relationshipStatus, setRelationshipStatus] = useState<string>("single");
  const [partnerName, setPartnerName] = useState("");

  // Step 4 (companion) fields
  const [hasRealPet, setHasRealPet] = useState<boolean | null>(null);
  const [petSpecies, setPetSpecies] = useState("cat");
  const [petName, setPetName] = useState("");
  const [virtualCompanionType, setVirtualCompanionType] = useState<string | null>(null);
  const [virtualCompanionName, setVirtualCompanionName] = useState("");

  // Step 0 password fields
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Step 5 result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");

  useEffect(() => {
    fetch("/api/classes")
      .then(r => r.ok ? r.json() : [])
      .then(setClasses)
      .catch(() => {});
  }, []);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const canProceedStep0 = name.trim().length >= 2 && password.length >= 6 && password === passwordConfirm;
  const canProceedStep2 = selectedClassId !== null || customClassSubmitted;
  const canProceedStep3 = hasRealPet === true
    ? petName.trim().length >= 1
    : hasRealPet === false
      ? virtualCompanionType !== null
      : false;

  const inputStyle: React.CSSProperties = {
    background: "#141414",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#f0f0f0",
    outline: "none",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    minHeight: 72,
  };

  const handleSubmitCustomClass = async () => {
    if (!customProfession.trim()) return;
    try {
      await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "pending" },
        body: JSON.stringify({
          name: customProfession.trim(),
          fantasy: customProfession.trim(),
          description: customFocus.trim() || customProfession.trim(),
          realWorld: customProfession.trim(),
          createdBy: name.trim() || "unknown",
        }),
      });
    } catch { /* ignore */ }
    setCustomClassSubmitted(true);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      let companion: CompanionData | null = null;
      if (hasRealPet) {
        companion = {
          type: petSpecies,
          name: petName.trim(),
          emoji: PET_EMOJI[petSpecies] ?? "🐾",
          isReal: true,
          species: petSpecies,
        };
      } else if (virtualCompanionType) {
        const vc = VIRTUAL_COMPANIONS.find(v => v.type === virtualCompanionType);
        companion = {
          type: virtualCompanionType,
          name: virtualCompanionName.trim() || vc?.name || virtualCompanionType,
          emoji: vc?.emoji ?? "🐲",
          isReal: false,
        };
      }

      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          password,
          age: age ? parseInt(age, 10) : null,
          goals: goals.trim() || null,
          classId: selectedClassId || null,
          companion,
          relationshipStatus,
          partnerName: partnerName.trim() || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Registrierung fehlgeschlagen");
        setLoading(false);
        return;
      }
      setGeneratedKey(data.apiKey);
      setStep(5);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    }
    setLoading(false);
  };


  const handleDone = () => {
    onComplete({
      name: name.trim(),
      apiKey: generatedKey,
      userId: name.trim().toLowerCase().replace(/\s+/g, "_"),
    });
  };

  const btnPrimary: React.CSSProperties = {
    background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "9px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  const btnSecondary: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 13,
    cursor: "pointer",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnPrimary,
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.3)",
    cursor: "not-allowed",
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(167,139,250,0.3)",
          boxShadow: "0 0 80px rgba(139,92,246,0.2)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-1">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                background: i === step
                  ? "#a78bfa"
                  : i < step
                    ? "rgba(167,139,250,0.5)"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        {/* ── Step 0: Name ── */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-4xl">⚒️</div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Willkommen in der Quest Hall!</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Dein Abenteuer beginnt hier. Wie sollen wir dich nennen?</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Dein Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="z.B. Luna, Marco, Aria..."
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Passwort</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 Zeichen"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Passwort wiederholen</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="Passwort best\u00e4tigen"
                  onKeyDown={e => { if (e.key === "Enter" && canProceedStep0) setStep(1); }}
                />
                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs mt-1" style={{ color: "#ef4444" }}>Passw\u00f6rter stimmen nicht \u00fcberein</p>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={onClose} style={btnSecondary}>Abbrechen</button>
              <button
                onClick={() => { setError(""); setStep(1); }}
                disabled={!canProceedStep0}
                style={canProceedStep0 ? btnPrimary : btnDisabled}
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: About you ── */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Erzähl uns von dir</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Diese Infos helfen uns, passende Quests für dich zu erstellen.</p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Alter (optional)</label>
              <input
                style={inputStyle}
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="z.B. 25"
                min={5}
                max={120}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Was willst du erreichen?</label>
              <textarea
                style={textareaStyle}
                value={goals}
                onChange={e => setGoals(e.target.value)}
                placeholder="z.B. Fit werden, Karriere voranbringen, neue Skills lernen..."
              />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(0)} style={btnSecondary}>← Zurück</button>
              <button onClick={() => setStep(2)} style={btnPrimary}>Weiter →</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Class selection ── */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Wähle deinen Pfad</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Jeder Pfad bringt einzigartige Quests und Fähigkeiten.</p>
            </div>

            {/* Class cards */}
            <div className="space-y-2">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setShowCustomClass(false);
                    setShowClassTutorial(true);
                    setTimeout(() => setShowClassTutorial(false), 5000);
                  }}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{
                    background: selectedClassId === cls.id ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedClassId === cls.id ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{cls.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{cls.fantasy}</span>
                        {(cls.playerCount ?? 0) > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.1)", color: "rgba(167,139,250,0.7)" }}>
                            {cls.playerCount} Spieler
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{cls.realWorld}</p>
                    </div>
                    {selectedClassId === cls.id && <span className="text-base" style={{ color: "#a78bfa" }}>✓</span>}
                  </div>
                </button>
              ))}
              {classes.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Klassen werden geladen...</p>
              )}
            </div>

            {/* Inline class tutorial */}
            {showClassTutorial && selectedClass && (
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.22)" }}
              >
                <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
                  {selectedClass.icon} Du hast {selectedClass.fantasy} gewählt!
                </p>
                <ul className="text-xs space-y-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <li>• {selectedClass.description}</li>
                  {selectedClass.skillTree?.slice(0, 3).map(s => (
                    <li key={s.id}>• {s.icon} {s.name}</li>
                  ))}
                </ul>
                <button onClick={() => setShowClassTutorial(false)} className="text-xs" style={{ color: "rgba(167,139,250,0.55)" }}>
                  Verstanden!
                </button>
              </div>
            )}

            {/* Custom class link */}
            {!showCustomClass && !customClassSubmitted && (
              <button
                onClick={() => { setShowCustomClass(true); setSelectedClassId(null); setShowClassTutorial(false); }}
                className="text-xs underline"
                style={{ color: "rgba(167,139,250,0.5)" }}
              >
                Keine passende Klasse? →
              </button>
            )}

            {/* Custom class form */}
            {showCustomClass && !customClassSubmitted && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>✏️ Klasse einreichen</p>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Was machst du beruflich?</label>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 60 }}
                    value={customProfession}
                    onChange={e => setCustomProfession(e.target.value)}
                    placeholder="z.B. Elektriker, Grafikdesigner, Pflegekraft..."
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Worauf willst du den Fokus legen?</label>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 60 }}
                    value={customFocus}
                    onChange={e => setCustomFocus(e.target.value)}
                    placeholder="z.B. Weiterbildung, Fitness, Work-Life-Balance..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitCustomClass}
                    disabled={!customProfession.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{
                      background: customProfession.trim() ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)",
                      color: customProfession.trim() ? "#a78bfa" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${customProfession.trim() ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    Klasse einreichen
                  </button>
                  <button onClick={() => setShowCustomClass(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Custom class submitted message */}
            {customClassSubmitted && (
              <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  ⚒️ Deine Klasse wird geschmiedet! Du kannst schon loslegen — dein Klassenpfad wird dir zur Verfügung gestellt sobald er fertig ist.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} style={btnSecondary}>← Zurück</button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                style={canProceedStep2 ? btnPrimary : btnDisabled}
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Relationship Status ── */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Beziehungsstatus</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Optional — hilft uns, passende Quests für dich zu erstellen.</p>
            </div>

            <div className="space-y-2">
              {[
                { value: "single",        label: "💔 Single" },
                { value: "relationship",  label: "💑 In einer Beziehung" },
                { value: "married",       label: "💍 Verheiratet" },
                { value: "complicated",   label: "🤷 Es ist kompliziert" },
                { value: "other",         label: "✨ Andere" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRelationshipStatus(opt.value)}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{
                    background: relationshipStatus === opt.value ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${relationshipStatus === opt.value ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: relationshipStatus === opt.value ? "#a78bfa" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {(relationshipStatus !== "single") && (
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Name deines Partners / deiner Partnerin (optional)</label>
                <input
                  style={inputStyle}
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder="z.B. Alex, Maria, Sam..."
                />
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} style={btnSecondary}>← Zurück</button>
              <button onClick={() => setStep(4)} style={btnPrimary}>Weiter →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Companion ── */}
        {step === 4 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Wähle deinen Begleiter</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Dein Begleiter motiviert dich auf deinem Weg.</p>
            </div>

            {/* Real pet toggle */}
            <div className="flex gap-2">
              {[
                { v: true,  label: "🐾 Ich habe ein Haustier" },
                { v: false, label: "✨ Virtueller Begleiter" },
              ].map(opt => (
                <button
                  key={String(opt.v)}
                  onClick={() => setHasRealPet(opt.v)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold"
                  style={{
                    background: hasRealPet === opt.v ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                    color: hasRealPet === opt.v ? "#a78bfa" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${hasRealPet === opt.v ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Real pet form */}
            {hasRealPet === true && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Tierart</label>
                  <select style={inputStyle} value={petSpecies} onChange={e => setPetSpecies(e.target.value)}>
                    {PET_SPECIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Name deines Haustieres</label>
                  <input
                    style={inputStyle}
                    value={petName}
                    onChange={e => setPetName(e.target.value)}
                    placeholder="z.B. Luna, Bello, Tweety..."
                    autoFocus
                  />
                </div>
                {/* Care quest preview */}
                {(() => {
                  const speciesData = PET_SPECIES.find(s => s.value === petSpecies);
                  return speciesData ? (
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.18)" }}>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "#ff6b9d" }}>
                        📋 Deine Pflegequests {petName ? `für ${petName}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {speciesData.carePreview.map(q => (
                          <span key={q} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,107,157,0.1)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,107,157,0.2)" }}>
                            {q}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Diese Quests werden täglich/wöchentlich für dich erstellt.</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Virtual companion selection */}
            {hasRealPet === false && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {VIRTUAL_COMPANIONS.map(vc => {
                    const selected = virtualCompanionType === vc.type;
                    return (
                      <button
                        key={vc.type}
                        onClick={() => { setVirtualCompanionType(vc.type); setVirtualCompanionName(vc.name); }}
                        className="p-3 rounded-xl text-left transition-all"
                        style={{
                          background: selected ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-2xl">{vc.emoji}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 10 }}>{vc.trait}</span>
                        </div>
                        <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{vc.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{vc.desc}</p>
                        {selected && (
                          <p className="text-xs mt-1.5 italic" style={{ color: "rgba(167,139,250,0.7)" }}>
                            💬 &ldquo;{vc.questHint}&rdquo;
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {virtualCompanionType && (() => {
                  const vc = VIRTUAL_COMPANIONS.find(v => v.type === virtualCompanionType);
                  return (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}>
                      <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>📋 Quests die generiert werden</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {vc?.emoji} {virtualCompanionName || vc?.name} wird täglich eine motivierende Quest für dich erstellen, basierend auf seinem Charakter.
                      </p>
                    </div>
                  );
                })()}
                {virtualCompanionType && (
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Name deines Begleiters</label>
                    <input
                      style={inputStyle}
                      value={virtualCompanionName}
                      onChange={e => setVirtualCompanionName(e.target.value)}
                      placeholder="Name..."
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} style={btnSecondary}>← Zurück</button>
              <button
                onClick={handleFinalSubmit}
                disabled={!canProceedStep3 || loading}
                style={canProceedStep3 && !loading ? btnPrimary : btnDisabled}
              >
                {loading ? "⚒️ Wird geschmiedet..." : "Weiter →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Summary + API key ── */}
        {step === 5 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-4xl">🔥</div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Dein Abenteuer beginnt!</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Dein Held wurde in den Büchern der Quest Hall verewigt.</p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Name</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>{name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Klasse</span>
                <span style={{ color: "#a78bfa", fontWeight: 600 }}>
                  {selectedClass
                    ? `${selectedClass.icon} ${selectedClass.fantasy}`
                    : customClassSubmitted
                      ? "⚒️ Wird geschmiedet..."
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Begleiter</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>
                  {hasRealPet
                    ? `${PET_EMOJI[petSpecies] ?? "🐾"} ${petName}`
                    : virtualCompanionType
                      ? `${VIRTUAL_COMPANIONS.find(v => v.type === virtualCompanionType)?.emoji ?? ""} ${virtualCompanionName}`
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Status</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>
                  {relationshipStatus === "single" ? "💔 Single" : relationshipStatus === "relationship" ? "💑 In einer Beziehung" : relationshipStatus === "married" ? "💍 Verheiratet" : relationshipStatus === "complicated" ? "🤷 Kompliziert" : "✨ Andere"}
                  {partnerName && ` (${partnerName})`}
                </span>
              </div>
            </div>

            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-xs" style={{ color: "#22c55e" }}>Du bist jetzt eingeloggt. Dein Passwort ist sicher gespeichert.</p>
            </div>

            <button
              onClick={handleDone}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff", boxShadow: "0 4px 20px rgba(139,92,246,0.3)" }}
            >
              Los geht&apos;s! 🔥
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
