import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";

const PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const SPORTS = ["football", "basketball", "baseball"];

const SPORT_EMOJI: Record<string, string> = {
  football: "🏈",
  basketball: "🏀",
  baseball: "⚾",
};

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

interface Board {
  id: string;
  game_id: string;
  quarter: string;
  price_tier: number;
  status: string;
}

function HowItWorksStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center font-black text-blue-400 text-sm">
        {number}
      </div>
      <div>
        <div className="font-bold text-zinc-100 text-sm">{title}</div>
        <div className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{description}</div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [sport, setSport] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [games, setGames] = useState<Game[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/games`)
      .then((r) => r.json())
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (quarter) params.set("quarter", quarter);
    if (price) params.set("price_tier", String(price));
    fetch(`${API}/boards/?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setBoards(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sport, quarter, price]);

  const openBoards = boards.filter((b) => b.status === "open" || b.status === "locked");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">

      {/* ──────────────────────────────────────────────────
          HERO — shown to everyone (logged in gets CTA buttons,
          logged out gets full landing splash)
      ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-950/70 via-zinc-900 to-indigo-950/60 border border-blue-800/30 rounded-3xl p-8 md:p-12 shadow-2xl">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.1),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-400 bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/40">
              Live Sports Pools
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Pick Your Square.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Win Real Money.
              </span>
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Buy a square on any sports board. When the quarter ends, the correct score
              intersection wins <span className="text-green-400 font-semibold">9× the buy-in</span>.
              NFL · NBA · MLB · NCAA
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {user ? (
                <>
                  <Link
                    to="/create-board"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-950/40 flex items-center gap-2 hover:scale-[1.02]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Host a Board
                  </Link>
                  <a
                    href="#active-pools"
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                  >
                    Browse Boards
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </a>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-950/40 hover:scale-[1.02]"
                  >
                    Sign Up Free →
                  </Link>
                  <a
                    href="#active-pools"
                    className="bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    Browse Boards
                  </a>
                </>
              )}
            </div>
          </div>

          {/* How it works — only for logged-out or visible on desktop */}
          {!user && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-5 w-full lg:w-72 flex-shrink-0">
              <h3 className="font-black text-white text-sm uppercase tracking-wider">How it works</h3>
              <HowItWorksStep
                number={1}
                title="Pick a board"
                description="Browse open boards for any upcoming game. Choose your sport, quarter, and buy-in price."
              />
              <HowItWorksStep
                number={2}
                title="Claim a square"
                description="Buy one or more of the 10 squares. Once all 10 are filled, numbers 0–9 are randomly assigned."
              />
              <HowItWorksStep
                number={3}
                title="Win when your number hits"
                description="When the quarter ends, (home + away score) % 10 = winning number. Owner takes home 9× the price!"
              />
            </div>
          )}
        </div>

        {/* Stats strip — visible when logged in */}
        {user && (
          <div className="relative z-10 mt-8 grid grid-cols-3 gap-4 border-t border-zinc-800/80 pt-6">
            {[
              { label: "Sports covered", value: "NFL · NBA · MLB" },
              { label: "Payout multiplier", value: "9×" },
              { label: "Rake", value: "10% (1 square)" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="font-bold text-white text-sm md:text-base">{value}</div>
                <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────
          HOW IT WORKS STRIP — logged-out only (below hero)
      ────────────────────────────────────────────────── */}
      {!user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "🎯",
              title: "Choose Your Square",
              description:
                "Pick from 10 available squares on any live game board. Multiple price tiers from $0.50 to $10,000.",
            },
            {
              icon: "🔢",
              title: "Numbers Assigned Randomly",
              description:
                "When all 10 squares fill, numbers 0–9 are randomly assigned. Completely fair — no one knows their number in advance.",
            },
            {
              icon: "🏆",
              title: "Win the Quarter",
              description:
                "After each quarter, (home score + away score) % 10 = winning number. That square owner wins 9× the buy-in!",
            },
          ].map(({ icon, title, description }) => (
            <div
              key={title}
              className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-6 space-y-3 text-center"
            >
              <div className="text-4xl">{icon}</div>
              <h3 className="font-bold text-white">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────
          ACTIVE POOLS SECTION
      ────────────────────────────────────────────────── */}
      <div id="active-pools">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Pools</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              className="bg-zinc-800/90 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              <option value="">All Sports</option>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {SPORT_EMOJI[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select
              className="bg-zinc-800/90 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
            >
              <option value="">All Quarters</option>
              {QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <select
              className="bg-zinc-800/90 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              value={price || ""}
              onChange={(e) => setPrice(Number(e.target.value))}
            >
              <option value="">All Prices</option>
              {PRICE_TIERS.map((p) => (
                <option key={p} value={p}>${p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Boards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-zinc-800/40 rounded-2xl animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : openBoards.length === 0 ? (
          <div className="bg-zinc-800/30 border border-zinc-800/80 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-zinc-400 text-lg font-semibold">No active boards found</p>
            <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">
              No open boards match your filters right now.{" "}
              {user ? "Host a new board to get started!" : "Sign up to host your own board!"}
            </p>
            {!user && (
              <Link
                to="/auth"
                className="inline-block mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-xl transition-all text-sm"
              >
                Sign Up Free
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {openBoards.map((board) => {
              const game = games.find((g) => g.id === board.game_id);
              const isLocked = board.status === "locked";
              const sportEmoji = game ? SPORT_EMOJI[game.sport] ?? "🏟️" : "🏟️";

              return (
                <Link
                  key={board.id}
                  to={user ? `/board/${board.id}` : "/auth"}
                  className="group block bg-zinc-800/60 border border-zinc-700/80 hover:border-blue-500 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/20"
                >
                  <div className="flex justify-between items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{sportEmoji}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-lg border border-blue-900/60">
                        {board.quarter}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        isLocked
                          ? "bg-amber-950 border border-amber-800/50 text-amber-400"
                          : "bg-green-950 border border-green-800/50 text-green-400"
                      }`}
                    >
                      {isLocked ? "Locked 🔒" : "Open"}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {game?.away_team_logo ? (
                          <img src={game.away_team_logo} className="w-6 h-6 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-zinc-700 text-center text-[10px] leading-6 text-zinc-500">A</div>
                        )}
                        <span className="font-semibold text-zinc-100 group-hover:text-white transition-colors text-sm">
                          {game?.away_team ?? "Loading..."}
                        </span>
                      </div>
                      <span className="text-zinc-500 font-mono text-sm">
                        {game && game.away_score !== null && game.away_score !== undefined ? game.away_score : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {game?.home_team_logo ? (
                          <img src={game.home_team_logo} className="w-6 h-6 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-zinc-700 text-center text-[10px] leading-6 text-zinc-500">H</div>
                        )}
                        <span className="font-semibold text-zinc-100 group-hover:text-white transition-colors text-sm">
                          {game?.home_team ?? "..."}
                        </span>
                      </div>
                      <span className="text-zinc-500 font-mono text-sm">
                        {game && game.home_score !== null && game.home_score !== undefined ? game.home_score : ""}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-700/60 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">
                      {game?.event_time ? new Date(game.event_time).toLocaleDateString() : "TBD"}
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        {user ? "Price / Square" : "From"}
                      </span>
                      <span className="text-green-400 font-mono font-extrabold text-lg">
                        ${board.price_tier}
                      </span>
                    </div>
                  </div>

                  {!user && (
                    <div className="mt-3 pt-3 border-t border-zinc-700/40 text-center">
                      <span className="text-xs text-blue-400 font-semibold">Sign in to join →</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer CTA for logged-out users */}
      {!user && openBoards.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-800/30 rounded-2xl p-8 text-center space-y-4">
          <h3 className="text-xl font-black text-white">Ready to play?</h3>
          <p className="text-zinc-400 text-sm">Create a free account and claim your first square in seconds.</p>
          <Link
            to="/auth"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-950/30 hover:scale-[1.02]"
          >
            Sign Up Free →
          </Link>
        </div>
      )}
    </div>
  );
}
