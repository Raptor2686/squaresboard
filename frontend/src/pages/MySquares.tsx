import { useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { API } from "../config";

interface OwnedSquare {
  square_id: string;
  position: number;
  number: number | null;
  purchased_at: string;
  board: {
    id: string;
    status: string;
    quarter: string;
    price_tier: number;
    price_tier_gc?: number;
    entry_currency?: string;
    payout_sc?: number;
    winning_square_id: string | null;
    game: {
      id: string;
      home_team: string;
      away_team: string;
    };
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open:      { label: "Open",      className: "bg-brand-950/50 border border-brand-500/20 text-brand-400" },
  locked:    { label: "Locked",    className: "bg-amber-950/50 border border-amber-500/20 text-amber-400" },
  resolved:  { label: "Resolved",  className: "bg-surface-800 border border-white/[0.06] text-zinc-500" },
  cancelled: { label: "Cancelled", className: "bg-red-950/50 border border-red-500/20 text-red-400" },
  filled:    { label: "Filled",    className: "bg-sweep-950/50 border border-sweep-500/20 text-sweep-400" },
};

export default function MySquares() {
  const { user, loading: authLoading } = useAuth();
  const [squares, setSquares] = useState<OwnedSquare[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch(`${API}/squares/my-boards`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((d) => { setSquares(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto mt-16 animate-fadeIn">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
        <p className="text-zinc-500 mb-6 text-sm">Sign in to see your squares and track your winnings.</p>
        <Link
          to="/auth"
          className="block bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-brand-950/30"
        >
          Sign In / Sign Up
        </Link>
      </div>
    );
  }

  const filteredSquares = squares.filter((sq) => {
    if (filter === "active") return sq.board.status === "open" || sq.board.status === "locked" || sq.board.status === "filled";
    if (filter === "resolved") return sq.board.status === "resolved" || sq.board.status === "cancelled";
    return true;
  });

  const totalWonSC = squares.reduce((sum, sq) => {
    const isWinner = sq.board.status === "resolved" && sq.board.winning_square_id === sq.square_id;
    const price = sq.board.price_tier || sq.board.price_tier_gc || 0;
    const payout = sq.board.payout_sc ?? (price * 10 * 0.90);
    return isWinner ? sum + payout : sum;
  }, 0);

  const activeCount = squares.filter(
    (sq) => sq.board.status === "open" || sq.board.status === "locked" || sq.board.status === "filled"
  ).length;

  const resolvedCount = squares.filter((sq) => sq.board.status === "resolved").length;

  if (squares.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto animate-fadeIn">
        <h1 className="text-3xl font-black mb-8 text-gradient-brand inline-block">
          My Squares
        </h1>
        <div className="glass rounded-3xl p-16 text-center card-highlight">
          <div className="text-5xl mb-4">🎲</div>
          <p className="text-zinc-300 text-lg font-semibold">No squares yet</p>
          <p className="text-zinc-600 text-sm mt-2 max-w-xs mx-auto">
            Head to the marketplace and claim your first square!
          </p>
          <Link
            to="/"
            className="inline-block mt-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold px-7 py-3 rounded-xl transition-all shadow-lg shadow-brand-950/30"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gradient-brand inline-block">My Squares</h1>
        <p className="text-zinc-600 text-sm mt-1">All your purchased squares across every board</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 text-center card-highlight">
          <div className="text-2xl font-black text-white font-mono tabular-nums animate-count-up">{squares.length}</div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mt-0.5">Total Squares</div>
        </div>
        <div className="glass rounded-2xl p-4 text-center card-highlight">
          <div className="text-2xl font-black text-brand-400 font-mono tabular-nums animate-count-up">{activeCount}</div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mt-0.5">Active</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 text-center card-highlight" style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.15), rgba(29,52,171,0.1))" }}>
          <div className="absolute inset-0 border border-sweep-500/10 rounded-2xl pointer-events-none" />
          <div className="relative">
            <div className="text-xl font-black text-sweep-400 font-mono tabular-nums animate-count-up">
              {totalWonSC.toLocaleString()} <span className="text-sm">🎟️</span>
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Total SC Won</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200 border ${
              filter === f
                ? "bg-brand-600/15 border-brand-500/30 text-brand-400"
                : "glass text-zinc-500 hover:text-zinc-300 hover:border-white/[0.08]"
            }`}
          >
            {f} {f === "all" ? `(${squares.length})` : f === "active" ? `(${activeCount})` : `(${resolvedCount})`}
          </button>
        ))}
      </div>

      {/* Squares list */}
      {filteredSquares.length === 0 ? (
        <div className="text-center py-12 text-zinc-600">No squares in this category.</div>
      ) : (
        <div className="space-y-2.5">
          {filteredSquares.map((sq, idx) => {
            const isWinner = sq.board.status === "resolved" && sq.board.winning_square_id === sq.square_id;
            const isLoser = sq.board.status === "resolved" && sq.board.winning_square_id !== null && !isWinner;
            const isCancelled = sq.board.status === "cancelled";
            const statusCfg = STATUS_CONFIG[sq.board.status] ?? STATUS_CONFIG.open;
            const curr = sq.board.entry_currency || "GC";
            const price = sq.board.price_tier ?? sq.board.price_tier_gc ?? 0;
            const rawPayout = sq.board.payout_sc ?? (price * 10 * 0.90);
            const payoutSCStr = rawPayout % 1 === 0 ? rawPayout.toLocaleString() : rawPayout.toFixed(2);
            const priceStr = price % 1 === 0 ? price.toLocaleString() : price.toFixed(2);

            return (
              <Link
                key={sq.square_id}
                to={`/board/${sq.board.id}`}
                className={`group flex items-center justify-between gap-4 rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover animate-fadeIn ${
                  isWinner
                    ? "bg-gradient-to-r from-yellow-950/30 to-amber-950/15 border-yellow-500/15 hover:border-yellow-400/30 shadow-glow-gold"
                    : isCancelled
                    ? "glass opacity-50"
                    : "glass hover:border-white/[0.08] card-highlight"
                }`}
                style={{ animationDelay: `${Math.min(idx * 0.04, 0.5)}s`, animationFillMode: "both" }}
              >
                {/* Number badge */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl font-mono border-2 tabular-nums ${
                  isWinner
                    ? "bg-yellow-900/30 border-yellow-500/50 text-yellow-400"
                    : sq.number !== null
                    ? "bg-surface-900 border-white/[0.06] text-white"
                    : "bg-surface-900 border-white/[0.04] text-zinc-700"
                }`}>
                  {sq.number !== null ? sq.number : "?"}
                </div>

                {/* Game info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                    {sq.board.game.away_team} vs {sq.board.game.home_team}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      curr === "SC" ? "bg-sweep-950/30 text-sweep-400 border-sweep-800/20" : "bg-coin-950/30 text-coin-400 border-coin-800/20"
                    }`}>
                      {curr}
                    </span>
                    <span>{sq.board.quarter}</span>
                    <span className="text-zinc-700">·</span>
                    <span>Pos {sq.position}</span>
                    <span className="text-zinc-700">·</span>
                    <span>{new Date(sq.purchased_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Price / result */}
                <div className="text-right flex-shrink-0">
                  {isWinner ? (
                    <div>
                      <div className="text-yellow-400 font-extrabold text-lg flex items-center gap-1 justify-end">🏆 Won!</div>
                      <div className="text-sweep-400 font-mono font-bold text-sm tabular-nums">+{payoutSCStr} 🎟️ SC</div>
                    </div>
                  ) : isLoser ? (
                    <div>
                      <div className="text-zinc-600 text-sm font-semibold">No win</div>
                      <div className="text-zinc-700 font-mono text-xs tabular-nums">-{priceStr} {curr}</div>
                    </div>
                  ) : isCancelled ? (
                    <div>
                      <div className="text-red-400/70 text-sm font-semibold">Refunded</div>
                      <div className="text-zinc-600 font-mono text-xs tabular-nums">{priceStr} {curr}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-0.5">Potential</div>
                      <div className="text-sweep-400 font-mono font-bold text-base tabular-nums">+{payoutSCStr} SC</div>
                      <div className="text-zinc-600 text-xs">{priceStr} {curr} buy-in</div>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-zinc-700 group-hover:text-brand-400 transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
