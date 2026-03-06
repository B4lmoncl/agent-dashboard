import AgentCard from "@/components/AgentCard";
import QuestRow from "@/components/QuestRow";
import CurrentQuestCard from "@/components/CurrentQuestCard";
import StatBar from "@/components/StatBar";
import agents from "@/data/agents.json";
import quests from "@/data/quests.json";
import currentQuests from "@/data/current-quests.json";

export const dynamic = "force-static";

export default function Dashboard() {
  const activeCount = agents.filter((a) => a.status === "active").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const completedCount = quests.filter((q) => q.status === "completed").length;
  const totalTokens = quests.reduce((acc, q) => acc + q.tokensUsed, 0);
  const formattedTokens = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens);

  return (
    <div className="min-h-screen bg-[#0b0d11]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[#0b0d11]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-white/90 text-sm tracking-tight">Agent Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Updated every 15min</span>
            </div>
            <a
              href="#"
              target="_blank"
              className="text-xs text-white/30 hover:text-white/60 transition-colors font-mono border border-white/[0.06] px-2 py-1 rounded-lg hover:border-white/[0.12]"
            >
              API
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-white/90">Operations Center</h1>
          <p className="text-sm text-white/35 mt-1">Real-time overview of your AI agent team</p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBar label="Agents" value={agents.length} sub={`${activeCount} active`} />
          <StatBar label="Active" value={activeCount} sub={`${idleCount} idle · ${errorCount} error`} accent="text-emerald-400" />
          <StatBar label="Quests today" value={completedCount} sub="completed" accent="text-violet-400" />
          <StatBar label="Tokens used" value={formattedTokens} sub="today total" accent="text-blue-400" />
        </div>

        {/* Agent Overview */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Agent Roster</h2>
              <p className="text-xs text-white/30 mt-0.5">{agents.length} agents registered</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Idle</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Error</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {agents.map((agent) => <AgentCard key={agent.id} agent={agent as any} />)}
          </div>
        </section>

        {/* Two-column: Current Quests + Quest Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Quests */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Current Quests</h2>
              <p className="text-xs text-white/30 mt-0.5">{currentQuests.length} tasks in progress</p>
            </div>
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {currentQuests.map((quest) => <CurrentQuestCard key={quest.id} quest={quest as any} />)}
              {currentQuests.length === 0 && (
                <div className="bg-[#111318] border border-white/[0.06] rounded-2xl p-8 text-center">
                  <p className="text-sm text-white/25">No active quests</p>
                </div>
              )}
            </div>
          </section>

          {/* Quest Log */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Quest Log</h2>
              <p className="text-xs text-white/30 mt-0.5">{quests.length} entries today</p>
            </div>
            <div className="bg-[#111318] border border-white/[0.06] rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {quests.map((quest) => <QuestRow key={quest.id} quest={quest as any} />)}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/[0.04] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/20">
          <span>Agent Orchestration Dashboard</span>
          <div className="flex items-center gap-4 font-mono">
            <a href="#" target="_blank" className="hover:text-white/40 transition-colors">GET /api/agents</a>
            
            
          </div>
        </div>
      </footer>
    </div>
  );
}
