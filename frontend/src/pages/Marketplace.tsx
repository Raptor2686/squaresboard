import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";

interface Game {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  event_time: string;
  home_team_logo?: string;
  away_team_logo?: string;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
}

const SPORTS = [
  { id: "", label: "All Sports", emoji: "🏆" },
  { id: "football", label: "Football", emoji: "🏈" },
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "baseball", label: "Baseball", emoji: "⚾" },
];

const SPORT_EMOJI: Record<string, string> = {
  football: "🏈",
  basketball: "🏀",
  baseball: "⚾",
};

function TeamLogo({ src, name, size = "sm" }: { src?: string; name: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-10 h-10" : "w-8 h-8";
  const text = size === "md" ? "text-sm" : "text-xs";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover bg-surface-800 p-0.5 border border-white/[0.06]`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-surface-800 border border-white/[0.06] flex items-center justify-center ${text} font-bold text-zinc-500`}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [sport, setSport] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGames = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`${API}/games/?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setGames(Array.isArray(data) ? data : []);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        setGames([]);
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    loadGames();
    const interval = setInterval(() => loadGames(true), 6000);
    return () => clearInterval(interval);
  }, [sport, statusFilter]);

  const filteredGames = games.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.home_team.toLowerCase().includes(q) ||
      g.away_team.toLowerCase().includes(q) ||
      g.sport.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
      {/* ──────────────────────────────────────────────────
          HERO BANNER
      ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/80 via-surface-900 to-sweep-950/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,108,247,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(147,51,234,0.08),transparent_60%)]" />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

        <div className="relative z-10 p-8 md:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="max-w-xl space-y-5 animate-fadeIn">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950/80 px-3.5 py-1.5 rounded-full border border-brand-800/30">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              Live Sports Pools · 10-Square Boards
            </span>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.1]">
              Select a Matchup.
              <br />
              <span className="text-gradient-gold">
                Win Sweepstakes Coins.
              </span>
            </h1>

            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Choose any live or upcoming game below. Pick your buy-in and quarter, then claim your square for a chance to win 9× the pot in redeemable Sweepstakes Coins.
            </p>

            <p className="text-[11px] text-zinc-600">
              No Purchase Necessary.{" "}
              <a href="#/rules" className="text-brand-400/60 hover:text-brand-400 underline transition-colors">
                Official Rules
              </a>
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              {user ? (
                <Link
                  to="/create-board"
                  className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-brand-950/40 hover:shadow-brand-500/20 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Host Custom Board
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold px-7 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-brand-950/40 hover:shadow-brand-500/20 text-sm"
                >
                  Sign Up Free →
                </Link>
              )}
              <a
                href="#games-list"
                className="glass hover:bg-white/[0.06] text-zinc-300 font-semibold px-6 py-3 rounded-2xl transition-all duration-200 text-sm flex items-center gap-1.5"
              >
                Browse Games ↓
              </a>
            </div>
          </div>

          {/* How It Works card */}
          <div className="glass rounded-2xl p-6 space-y-5 w-full lg:w-80 flex-shrink-0 card-highlight animate-fadeIn" style={{ animationDelay: "0.15s" }}>
            <h3 className="font-black text-xs uppercase tracking-wider text-zinc-400">
              How it works
            </h3>
            <div className="space-y-4">
              {[
                { step: 1, title: "Choose Matchup", desc: "Select any NFL, NBA, MLB, or college game." },
                { step: 2, title: "Pick Amount & Quarter", desc: "Choose $0.50 to $1,000 buy-in & period." },
                { step: 3, title: "Claim Square & Win 9×", desc: "When scores hit your number, you win the pot!" },
              ].map((item) => (
                <div key={item.step} className="flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center font-black text-brand-400 text-xs flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">{item.title}</div>
                    <div className="text-zinc-500 text-[11px] leading-snug mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────
          GAMES DIRECTORY
      ────────────────────────────────────────────────── */}
      <div id="games-list" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Available Games</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select a game to choose your buy-in and view available boards.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sport Tabs */}
            <div className="flex rounded-xl overflow-hidden border border-white/[0.06] bg-surface-900 p-0.5">
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSport(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                    sport === s.id
                      ? "bg-brand-600 text-white shadow-md shadow-brand-950/30"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  <span>{s.emoji}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-900 border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-brand-500/50 cursor-pointer transition-all duration-200"
            >
              <option value="all">All Games</option>
              <option value="live">🔴 Live Now</option>
              <option value="upcoming">Upcoming</option>
            </select>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-900 border border-white/[0.06] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 w-36 sm:w-44 transition-all duration-200"
              />
              <svg
                className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-[9px] pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadGames(false)}
              className="p-2 rounded-xl border border-white/[0.06] bg-surface-900 hover:bg-white/[0.04] text-zinc-500 hover:text-white transition-all duration-200"
              title="Refresh matchups"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-52 skeleton" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center card-highlight">
            <span className="text-4xl block mb-3">🏟️</span>
            <p className="text-zinc-300 font-bold text-lg">No games found</p>
            <p className="text-zinc-600 text-xs mt-1 max-w-xs mx-auto">
              No matchups match your filters. Try a different sport or clear the search.
            </p>
            <button
              onClick={() => { setSport(""); setStatusFilter("all"); setSearchQuery(""); }}
              className="mt-5 glass hover:bg-white/[0.06] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((g, idx) => {
              const isLive = g.status === "live";
              const isResolved = g.status === "resolved";
              const sportEmoji = SPORT_EMOJI[g.sport] ?? "🏟️";

              return (
                <Link
                  key={g.id}
                  to={`/game/${g.id}`}
                  className="group relative glass rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover card-highlight flex flex-col justify-between animate-fadeIn"
                  style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s`, animationFillMode: "both" }}
                >
                  {/* Hover glow */}
                  <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/[0.08] via-transparent to-sweep-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <div className="relative">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{sportEmoji}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {g.sport}
                        </span>
                      </div>
                      {isLive ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-red-400">
                          <span className="live-dot" style={{ width: 6, height: 6 }} />
                          Live
                        </span>
                      ) : isResolved ? (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-surface-800 border border-white/[0.06] text-zinc-500">
                          Final
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-brand-950/60 border border-brand-800/30 text-brand-400">
                          Upcoming
                        </span>
                      )}
                    </div>

                    {/* Teams */}
                    <div className="space-y-3">
                      {/* Away */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TeamLogo src={g.away_team_logo} name={g.away_team} />
                          <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">
                            {g.away_team}
                          </span>
                        </div>
                        {g.away_score !== null && (
                          <span className="font-mono font-black text-lg text-white tabular-nums">
                            {g.away_score}
                          </span>
                        )}
                      </div>

                      {/* Home */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TeamLogo src={g.home_team_logo} name={g.home_team} />
                          <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">
                            {g.home_team}
                          </span>
                        </div>
                        {g.home_score !== null && (
                          <span className="font-mono font-black text-lg text-white tabular-nums">
                            {g.home_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="relative mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                        {new Date(g.event_time).toLocaleDateString([], { month: "short", day: "numeric" })}
                        {" · "}
                        {new Date(g.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-[11px] font-bold text-sweep-400/80 mt-0.5 flex items-center gap-1">
                        <span>🎟️</span> SC & <span>🟡</span> GC Pools Open
                      </div>
                    </div>

                    <span className="bg-gradient-to-r from-brand-600 to-brand-500 group-hover:from-brand-500 group-hover:to-brand-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-brand-950/30 flex items-center gap-1.5">
                      Play
                      <svg className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
