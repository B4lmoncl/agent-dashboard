"use client";
import { useEffect, useState } from "react";
import { useModalBehavior } from "./ModalPortal";

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
  onComplete: (data: { name: string; apiKey: string; accessToken?: string; userId: string }) => void;
  onClose: () => void;
}

const VIRTUAL_COMPANIONS = [
  { type: "dragon", emoji: "🐉", iconSrc: "/images/icons/companion-dragon.png", name: "Ember",  desc: "A fiery dragon that pushes you forward",           personality: "fierce",    trait: "Fierce",    questHint: "Complete 3 quests every day!" },
  { type: "owl", emoji: "🦉", iconSrc: "/images/icons/companion-owl.png", name: "Sage",   desc: "A wise owl that guides your learning journey",     personality: "wise",      trait: "Wise",      questHint: "Learn something new every day" },
  { type: "phoenix", emoji: "🔥", iconSrc: "/images/icons/companion-phoenix.png", name: "Blaze",  desc: "A phoenix that rises from every setback",          personality: "resilient", trait: "Resilient", questHint: "Stronger after every setback" },
  { type: "wolf",    emoji: "🐺", iconSrc: "/images/portraits/companion-wolf.png",    name: "Shadow", desc: "A loyal wolf that stands by your side",            personality: "loyal",     trait: "Loyal",     questHint: "Maintain your daily routine" },
  { type: "fox",     emoji: "🦊", iconSrc: "/images/portraits/companion-fox.png",     name: "Trick",  desc: "A clever fox that finds creative solutions",       personality: "clever",    trait: "Clever",    questHint: "Find a more creative approach" },
  { type: "bear",    emoji: "🐻", iconSrc: "/images/portraits/companion-bear.png",    name: "Bjorn",  desc: "A strong bear that carries you through tough times",personality: "strong",    trait: "Strong",    questHint: "Fitness and strength quests" },
];

const PET_SPECIES = [
  { value: "cat",     label: "Cat",      carePreview: ["Feed", "Play", "Cuddle", "Vet Check"] },
  { value: "dog",     label: "Dog",      carePreview: ["Walk", "Feed", "Train", "Groom", "Vet Check"] },
  { value: "hamster", label: "Hamster",  carePreview: ["Feed", "Clean Cage", "Play"] },
  { value: "bird",    label: "Bird",     carePreview: ["Feed", "Sing", "Clean Cage"] },
  { value: "fish",    label: "Fish",     carePreview: ["Feed", "Clean Aquarium"] },
  { value: "rabbit",  label: "Rabbit",   carePreview: ["Feed", "Play", "Groom"] },
  { value: "other",   label: "Other",    carePreview: ["Feed", "Care"] },
];

const PET_EMOJI: Record<string, string> = {
  cat: "🐱", dog: "🐕", hamster: "🐹", bird: "🦜", fish: "🐠", rabbit: "🐰", other: "🐾",
};

export default function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  useModalBehavior(true, onClose);
  const [step, setStep] = useState(0);

  // Step 0 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Step 1 fields
  const [age, setAge] = useState("");
  const [goals, setGoals] = useState("");
  const [pronouns, setPronouns] = useState<string | null>(null);

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
  const [generatedAccessToken, setGeneratedAccessToken] = useState("");

  useEffect(() => {
    fetch("/api/classes")
      .then(r => r.ok ? r.json() : [])
      .then(setClasses)
      .catch((err) => { console.error('Failed to fetch classes:', err); });
  }, []);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const canProceedStep0 = name.trim().length >= 2 && emailValid && pwValid && password === passwordConfirm;
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
    } catch (err) { console.error('Failed to submit custom class:', err); }
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
          emoji: PET_EMOJI[petSpecies] ?? "",
          isReal: true,
          species: petSpecies,
        };
      } else if (virtualCompanionType) {
        const vc = VIRTUAL_COMPANIONS.find(v => v.type === virtualCompanionType);
        companion = {
          type: virtualCompanionType,
          name: virtualCompanionName.trim() || vc?.name || virtualCompanionType,
          emoji: vc?.emoji ?? "",
          isReal: false,
        };
      }

      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          age: age ? parseInt(age, 10) : null,
          goals: goals.trim() || null,
          pronouns: pronouns || null,
          classId: selectedClassId || null,
          companion,
          relationshipStatus,
          partnerName: partnerName.trim() || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      setGeneratedKey(data.apiKey);
      if (data.accessToken) setGeneratedAccessToken(data.accessToken);
      setStep(5);
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };


  const handleDone = () => {
    onComplete({
      name: name.trim(),
      apiKey: generatedKey,
      accessToken: generatedAccessToken,
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
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(167,139,250,0.3)",
          boxShadow: "0 0 80px rgba(139,92,246,0.2)",
          maxHeight: "92vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {/* Step indicator — icon + label + progress dots */}
        <div className="pt-5 pb-2 px-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(167,139,250,0.6)" }}>
              {["Create Hero", "About You", "Choose Path", "Status", "Companion", "Summary"][step]}
            </span>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{step + 1}/6</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300 flex-1"
                style={{
                  height: i <= step ? 4 : 3,
                  background: i === step
                    ? "#a78bfa"
                    : i < step
                      ? "#a78bfa"
                      : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Step 0: Name ── */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-4xl">★</div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Welcome to the Quest Hall!</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Your adventure begins here. What should we call you?</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Your Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Luna, Marco, Aria..."
                  maxLength={50}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Email</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Required for password recovery</p>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Password</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters, 1 uppercase, 1 number"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Confirm password</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="Confirm password"
                  onKeyDown={e => { if (e.key === "Enter" && canProceedStep0) setStep(1); }}
                />
                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs mt-1" style={{ color: "#ef4444" }}>Passwords don&apos;t match</p>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button
                onClick={() => { setError(""); setStep(1); }}
                disabled={!canProceedStep0}
                style={canProceedStep0 ? btnPrimary : btnDisabled}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: About you ── */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Tell us about yourself</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>This helps us create quests tailored to you.</p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Age (optional)</label>
              <input
                style={inputStyle}
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 25"
                min={5}
                max={120}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Pronouns (optional)</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "he/him", label: "He/Him" },
                  { value: "she/her", label: "She/Her" },
                  { value: "they/them", label: "They/Them" },
                  { value: "other", label: "Other" },
                  { value: "prefer_not_to_say", label: "Prefer not to say" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPronouns(pronouns === opt.value ? null : opt.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: pronouns === opt.value ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                      color: pronouns === opt.value ? "#a78bfa" : "rgba(255,255,255,0.5)",
                      border: `1px solid ${pronouns === opt.value ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>What do you want to achieve?</label>
              <textarea
                style={textareaStyle}
                value={goals}
                onChange={e => setGoals(e.target.value)}
                placeholder="e.g. Get fit, advance career, learn new skills..."
                maxLength={500}
              />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(0)} style={btnSecondary}>← Back</button>
              <button onClick={() => setStep(2)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Class selection ── */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Choose your path</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Each path brings unique quests and skills.</p>
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
                            {cls.playerCount} players
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
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Loading classes...</p>
              )}
            </div>

            {/* Inline class tutorial */}
            {showClassTutorial && selectedClass && (
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.22)" }}
              >
                <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
                  {selectedClass.icon} You chose {selectedClass.fantasy}!
                </p>
                <ul className="text-xs space-y-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <li>• {selectedClass.description}</li>
                  {selectedClass.skillTree?.slice(0, 3).map(s => (
                    <li key={s.id}>• {s.icon} {s.name}</li>
                  ))}
                </ul>
                <button onClick={() => setShowClassTutorial(false)} className="text-xs" style={{ color: "rgba(167,139,250,0.55)" }}>
                  Got it!
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
                No matching class? →
              </button>
            )}

            {/* Custom class form */}
            {showCustomClass && !customClassSubmitted && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>Submit Custom Class</p>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>What do you do for a living?</label>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 60 }}
                    value={customProfession}
                    onChange={e => setCustomProfession(e.target.value)}
                    placeholder="e.g. Electrician, Designer, Nurse..."
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>What do you want to focus on?</label>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 60 }}
                    value={customFocus}
                    onChange={e => setCustomFocus(e.target.value)}
                    placeholder="e.g. Education, Fitness, Work-Life-Balance..."
                    maxLength={200}
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
                    Submit Class
                  </button>
                  <button onClick={() => setShowCustomClass(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Custom class submitted message */}
            {customClassSubmitted && (
              <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  Your class is being forged! You can get started right away — your class path will be available once it's ready.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                style={canProceedStep2 ? btnPrimary : btnDisabled}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Relationship Status ── */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Relationship Status</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Optional — helps us create co-op quests for couples.</p>
            </div>

            <div className="space-y-2">
              {[
                { value: "single",        label: "Single" },
                { value: "relationship",  label: "In a relationship" },
                { value: "married",       label: "Married" },
                { value: "complicated",   label: "It's complicated" },
                { value: "other",         label: "Other" },
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
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Partner's name (optional)</label>
                <input
                  style={inputStyle}
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder="e.g. Alex, Maria, Sam..."
                />
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} style={btnSecondary}>← Back</button>
              <button onClick={() => setStep(4)} style={btnPrimary}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Companion ── */}
        {step === 4 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Choose your companion</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Your companion motivates you on your journey.</p>
            </div>

            {/* Real pet toggle */}
            <div className="flex gap-2">
              {[
                { v: true,  label: "I have a real pet" },
                { v: false, label: "Virtual companion" },
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
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Pet Type</label>
                  <select style={inputStyle} value={petSpecies} onChange={e => setPetSpecies(e.target.value)}>
                    {PET_SPECIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Your pet's name</label>
                  <input
                    style={inputStyle}
                    value={petName}
                    onChange={e => setPetName(e.target.value)}
                    placeholder="e.g. Luna, Bello, Tweety..."
                    autoFocus
                  />
                </div>
                {/* Care quest preview */}
                {(() => {
                  const speciesData = PET_SPECIES.find(s => s.value === petSpecies);
                  return speciesData ? (
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.18)" }}>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "#ff6b9d" }}>
                        Care quests {petName ? `for ${petName}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {speciesData.carePreview.map(q => (
                          <span key={q} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,107,157,0.1)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,107,157,0.2)" }}>
                            {q}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>These quests will be created daily/weekly for you.</p>
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
                          {vc.iconSrc
                            ? <img src={vc.iconSrc} alt={vc.name} width={32} height={32} style={{ imageRendering: "auto", borderRadius: 4, objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                            : <span className="text-2xl">{vc.emoji}</span>
                          }
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>{vc.trait}</span>
                        </div>
                        <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{vc.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{vc.desc}</p>
                        {selected && (
                          <p className="text-xs mt-1.5 italic" style={{ color: "rgba(167,139,250,0.7)" }}>
                            &ldquo;{vc.questHint}&rdquo;
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
                      <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>Quests that will be generated</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {vc?.emoji} {virtualCompanionName || vc?.name} will create a daily motivational quest for you, based on their personality.
                      </p>
                    </div>
                  );
                })()}
                {virtualCompanionType && (
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Companion's name</label>
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
              <button onClick={() => setStep(3)} style={btnSecondary}>← Back</button>
              <button
                onClick={handleFinalSubmit}
                disabled={!canProceedStep3 || loading}
                style={canProceedStep3 && !loading ? btnPrimary : btnDisabled}
              >
                {loading ? "Forging..." : "Next →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Summary + API key ── */}
        {step === 5 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-4xl">★</div>
              <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>Your adventure begins!</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Your hero has been inscribed in the Quest Hall records.</p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Name</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>{name}</span>
              </div>
              {pronouns && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Pronouns</span>
                  <span style={{ color: "#f0f0f0", fontWeight: 600 }}>{pronouns === "prefer_not_to_say" ? "—" : pronouns}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Class</span>
                <span style={{ color: "#a78bfa", fontWeight: 600 }}>
                  {selectedClass
                    ? `${selectedClass.icon} ${selectedClass.fantasy}`
                    : customClassSubmitted
                      ? "Forging..."
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Companion</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>
                  {hasRealPet
                    ? `${PET_EMOJI[petSpecies] ?? ""} ${petName}`.trim()
                    : virtualCompanionType
                      ? `${VIRTUAL_COMPANIONS.find(v => v.type === virtualCompanionType)?.emoji ?? ""} ${virtualCompanionName}`
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Status</span>
                <span style={{ color: "#f0f0f0", fontWeight: 600 }}>
                  {relationshipStatus === "single" ? "Single" : relationshipStatus === "relationship" ? "In a relationship" : relationshipStatus === "married" ? "Married" : relationshipStatus === "complicated" ? "It's complicated" : "Other"}
                  {partnerName && ` (${partnerName})`}
                </span>
              </div>
            </div>

            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-xs" style={{ color: "#22c55e" }}>You are now logged in. Your password has been securely saved.</p>
            </div>

            <button
              onClick={handleDone}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff", boxShadow: "0 4px 20px rgba(139,92,246,0.3)" }}
            >
              Begin Your Journey!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
