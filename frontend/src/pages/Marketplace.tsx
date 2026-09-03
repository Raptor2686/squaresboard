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

export default function Marketplace() {
  const { user } = useAuth();
  const [sport, setSport] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`${API}/games?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setGames(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setGames([]);
        setLoading(false);
      });
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      {/* ──────────────────────────────────────────────────
          HERO BANNER
      ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-950/80 via-zinc-900 to-indigo-950/70 border border-blue-800/30 rounded-3xl p-6 md:p-10 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.1),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-400 bg-blue-950/90 px-3 py-1 rounded-full border border-blue-800/50">
              Live Sports Pools · 10-Square Boards
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Select a Matchup.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
                Win Sweepstakes Coins.
              </span>
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Choose any live or upcoming game below. Pick your buy-in ($0.50 to $1,000) and quarter, then claim your square for a chance to win 9× the pot in redeemable Sweepstakes Coins.
            </p>
            <p className="text-xs text-zinc-500">
              No Purchase Necessary. See{" "}
              <a href="#/rules" className="text-blue-400 underline">
                Official Rules
              </a>
              .
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {user ? (
                <Link
                  to="/create-board"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-950/40 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Host Custom Board
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-950/40 hover:scale-[1.02] text-sm"
                >
                  Sign Up Free →
                </Link>
              )}
              <a
                href="#games-list"
                className="bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm flex items-center gap-1.5"
              >
                Browse Games ↓
              </a>
            </div>
          </div>

          {/* 3 Steps Visual Guide */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4 w-full lg:w-80 flex-shrink-0 shadow-lg">
            <h3 className="font-black text-white text-xs uppercase tracking-wider text-zinc-300">
              How it works in 3 steps
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center font-black text-blue-400 text-xs flex-shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Choose Matchup</div>
                  <div className="text-zinc-400 text-[11px] leading-tight mt-0.5">
                    Select any NFL, NBA, MLB, or college game.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center font-black text-blue-400 text-xs flex-shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Pick Amount & Quarter</div>
                  <div className="text-zinc-400 text-[11px] leading-tight mt-0.5">
                    Choose $0.50 to $1,000 buy-in & period (Q1–Q4).
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center font-black text-blue-400 text-xs flex-shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Claim Square & Win 9×</div>
                  <div className="text-zinc-400 text-[11px] leading-tight mt-0.5">
                    When scores hit your number, you win the pot!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────
          GAMES DIRECTORY SECTION
      ────────────────────────────────────────────────── */}
      <div id="games-list" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Available Games</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select a game below to choose your buy-in denomination and view available boards.
            </p>
          </div>

          {/* Sport Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sport Tabs */}
            <div className="flex rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 p-0.5">
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSport(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    sport === s.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-zinc-400 hover:text-white"
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
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Games</option>
              <option value="live">🔴 Live Now</option>
              <option value="upcoming">Upcoming</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-36 sm:w-44 transition-all"
              />
              <svg
                className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-zinc-800/40 rounded-3xl animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="bg-zinc-800/30 border border-zinc-800/80 rounded-3xl p-16 text-center">
            <span className="text-4xl block mb-3">🏟️</span>
            <p className="text-zinc-300 font-bold text-lg">No games found</p>
            <p className="text-zinc-500 text-xs mt-1 max-w-xs mx-auto">
              No matchups match your selected filters. Try choosing a different sport or clearing the search.
            </p>
            <button
              onClick={() => { setSport(""); setStatusFilter("all"); setSearchQuery(""); }}
              className="mt-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGames.map((g) => {
              const isLive = g.status === "live";
              const isResolved = g.status === "resolved";
              const sportEmoji = SPORT_EMOJI[g.sport] ?? "🏟️";

              return (
                <Link
                  key={g.id}
                  to={`/game/${g.id}`}
                  className="group relative bg-zinc-800/70 border border-zinc-700/70 hover:border-blue-500/80 rounded-3xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/20 flex flex-col justify-between"
                >
                  {/* Top Bar: Sport & Status */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{sportEmoji}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          {g.sport}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          isLive
                            ? "bg-red-950/80 border-red-700/60 text-red-400 animate-pulse"
                            : isResolved
                            ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                            : "bg-blue-950/80 border-blue-800/60 text-blue-400"
                        }`}
                      >
                        {isLive ? "🔴 Live" : isResolved ? "Final" : "Upcoming"}
                      </span>
                    </div>

                    {/* Teams Matchup View */}
                    <div className="space-y-3.5 my-2">
                      {/* Away Team */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {g.away_team_logo ? (
                            <img
                              src={g.away_team_logo}
                              alt={g.away_team}
                              className="w-8 h-8 rounded-full object-cover bg-zinc-800 p-0.5 border border-zinc-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                              {g.away_team.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-extrabold text-sm text-zinc-100 group-hover:text-white transition-colors">
                            {g.away_team}
                          </span>
                        </div>
                        {g.away_score !== null && (
                          <span className="font-mono font-black text-lg text-white">
                            {g.away_score}
                          </span>
                        )}
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {g.home_team_logo ? (
                            <img
                              src={g.home_team_logo}
                              alt={g.home_team}
                              className="w-8 h-8 rounded-full object-cover bg-zinc-800 p-0.5 border border-zinc-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                              {g.home_team.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-extrabold text-sm text-zinc-100 group-hover:text-white transition-colors">
                            {g.home_team}
                          </span>
                        </div>
                        {g.home_score !== null && (
                          <span className="font-mono font-black text-lg text-white">
                            {g.home_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer: Pool details + Action Button */}
                  <div className="mt-5 pt-3.5 border-t border-zinc-700/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                        {new Date(g.event_time).toLocaleDateString([], { month: "short", day: "numeric" })}{" · "}
                        {new Date(g.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-[11px] font-bold text-purple-300 mt-0.5">
                        🎟️ SC & 🟡 GC Pools Open
                      </div>
                    </div>

                    <span className="bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1">
                      Play Now →
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
