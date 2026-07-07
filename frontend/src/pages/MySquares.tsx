import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
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
    winning_square_id: string | null;
    game: {
      id: string;
      home_team: string;
      away_team: string;
    };
  };
}

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open:      { label: "Open",      className: "bg-blue-950 border border-blue-800/50 text-blue-400" },
  locked:    { label: "Locked",    className: "bg-amber-950 border border-amber-800/50 text-amber-400" },
  resolved:  { label: "Resolved",  className: "bg-zinc-800 border border-zinc-700 text-zinc-400" },
  cancelled: { label: "Cancelled", className: "bg-red-950 border border-red-800/50 text-red-400" },
  filled:    { label: "Filled",    className: "bg-purple-950 border border-purple-800/50 text-purple-400" },
};

export default function MySquares() {
  const { user, loading: authLoading } = useAuth();
  const [squares, setSquares] = useState<OwnedSquare[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch(`${API}/squares/my-boards`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setSquares(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto mt-16">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
        <p className="text-zinc-400 mb-6 text-sm">Sign in to see your squares and track your winnings.</p>
        <Link to="/auth" className="block bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-all">
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

  const totalWon = squares.reduce((sum, sq) => {
    const isWinner = sq.board.status === "resolved" && sq.board.winning_square_id === sq.square_id;
    return isWinner ? sum + sq.board.price_tier * 9 * 100 : sum;
  }, 0);

  const activeCount = squares.filter(
    (sq) => sq.board.status === "open" || sq.board.status === "locked" || sq.board.status === "filled"
  ).length;

  const resolvedCount = squares.filter((sq) => sq.board.status === "resolved").length;

  if (squares.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-black mb-8 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          My Squares
        </h1>
        <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-3xl p-16 text-center">
          <div className="text-5xl mb-4">🎲</div>
          <p className="text-zinc-300 text-lg font-semibold">No squares yet</p>
          <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">
            Head to the marketplace and claim your first square!
          </p>
          <Link
            to="/"
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-950/30"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          My Squares
        </h1>
        <p className="text-zinc-500 text-sm mt-1">All your purchased squares across every board</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold text-white">{squares.length}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Total Squares</div>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold text-blue-400">{activeCount}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Active</div>
        </div>
        <div className="bg-gradient-to-br from-green-950/60 to-emerald-950/60 border border-green-800/40 rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold text-green-400 font-mono">{formatCents(totalWon)}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Total Won</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize transition-all border ${
              filter === f
                ? "bg-blue-600/20 border-blue-500 text-blue-300"
                : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {f} {f === "all" ? `(${squares.length})` : f === "active" ? `(${activeCount})` : `(${resolvedCount})`}
          </button>
        ))}
      </div>

      {/* Squares list */}
      {filteredSquares.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">No squares in this category.</div>
      ) : (
        <div className="space-y-3">
          {filteredSquares.map((sq) => {
            const isWinner =
              sq.board.status === "resolved" && sq.board.winning_square_id === sq.square_id;
            const isLoser =
              sq.board.status === "resolved" && sq.board.winning_square_id !== null && !isWinner;
            const isCancelled = sq.board.status === "cancelled";
            const statusCfg = STATUS_CONFIG[sq.board.status] ?? STATUS_CONFIG.open;
            const payoutCents = sq.board.price_tier * 9 * 100;

            return (
              <Link
                key={sq.square_id}
                to={`/board/${sq.board.id}`}
                className={`group flex items-center justify-between gap-4 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                  isWinner
                    ? "bg-gradient-to-r from-yellow-950/50 to-amber-950/30 border-yellow-700/60 hover:border-yellow-500/80 hover:shadow-yellow-950/20"
                    : isCancelled
                    ? "bg-zinc-800/20 border-zinc-800/60 opacity-60"
                    : "bg-zinc-800/50 border-zinc-700/60 hover:border-blue-500/50 hover:shadow-blue-950/10"
                }`}
              >
                {/* Left: number badge */}
                <div
                  className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl font-mono border-2 ${
                    isWinner
                      ? "bg-yellow-900/50 border-yellow-500 text-yellow-400"
                      : sq.number !== null
                      ? "bg-zinc-900 border-zinc-600 text-white"
                      : "bg-zinc-900 border-zinc-700 text-zinc-600"
                  }`}
                >
                  {sq.number !== null ? sq.number : "?"}
                </div>

                {/* Middle: game info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {sq.board.game.away_team} vs {sq.board.game.home_team}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    <span>{sq.board.quarter}</span>
                    <span>·</span>
                    <span>Pos {sq.position}</span>
                    <span>·</span>
                    <span>{new Date(sq.purchased_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Right: price / result */}
                <div className="text-right flex-shrink-0">
                  {isWinner ? (
                    <div>
                      <div className="text-yellow-400 font-extrabold text-lg flex items-center gap-1 justify-end">
                        🏆 Won!
                      </div>
                      <div className="text-green-400 font-mono font-bold text-sm">+{formatCents(payoutCents)}</div>
                    </div>
                  ) : isLoser ? (
                    <div>
                      <div className="text-zinc-500 text-sm font-semibold">No win</div>
                      <div className="text-zinc-600 font-mono text-xs">-{formatCents(sq.board.price_tier * 100)}</div>
                    </div>
                  ) : isCancelled ? (
                    <div>
                      <div className="text-red-400 text-sm font-semibold">Refunded</div>
                      <div className="text-zinc-500 font-mono text-xs">{formatCents(sq.board.price_tier * 100)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">Potential</div>
                      <div className="text-green-400 font-mono font-bold text-base">
                        {formatCents(payoutCents)}
                      </div>
                      <div className="text-zinc-600 text-xs">{formatCents(sq.board.price_tier * 100)} buy-in</div>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg
                  className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors flex-shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
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
