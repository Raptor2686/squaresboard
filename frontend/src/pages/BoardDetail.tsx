import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { API } from "../config";

interface Square {
  id: string;
  position: number;
  number: number | null;
  owner_id: string | null;
  owner_name: string | null;
}

interface BoardData {
  board_id: string;
  board_status: string;
  price_tier_gc: number;
  entry_currency: string;
  payout_sc: number;
  quarter: string;
  is_private: boolean;
  share_link: string | null;
  winning_number: number | null;
  game: {
    id: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    event_time: string;
  };
  squares: Square[];
}

function formatCoins(n: number, currency: string) {
  const formatted = n % 1 === 0 ? n.toLocaleString() : n.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${currency === "SC" ? "🎟️ SC" : "🟡 GC"}`;
}

export default function BoardDetail() {
  const { boardId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [walletBalance, setWalletBalance] = useState<{ gold_coins: number; sweep_coins: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  async function loadBoard() {
    try {
      const res = await fetch(`${API}/squares/board/${boardId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Board not found");
      const data = await res.json();
      setBoard(data);
    } catch (e) {
      setError("Failed to fetch board details.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWallet() {
    if (!user) return;
    try {
      const res = await fetch(`${API}/wallet/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance({ gold_coins: data.gold_coins, sweep_coins: data.sweep_coins });
      }
    } catch {}
  }

  useEffect(() => { loadBoard(); }, [boardId]);
  useEffect(() => { loadWallet(); }, [user]);

  async function handleBuySquare(position: number) {
    if (!user) { window.location.hash = "#/auth"; return; }
    if (!board || board.board_status !== "open") return;
    setPurchasing(position);
    setError("");
    try {
      const res = await fetch(`${API}/squares/board/${boardId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ position }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail || "Purchase failed";
        setError(msg);
        showToast(msg, "error");
        return;
      }
      if (data.new_gold_coins !== undefined || data.new_sweep_coins !== undefined) {
        setWalletBalance({
          gold_coins: data.new_gold_coins ?? walletBalance?.gold_coins ?? 0,
          sweep_coins: data.new_sweep_coins ?? walletBalance?.sweep_coins ?? 0,
        });
      }
      showToast(`Square claimed! Position ${position + 1} is yours. 🎉`, "success");
      await loadBoard();
      const refreshed = await fetch(`${API}/squares/board/${boardId}`, { credentials: "include" });
      if (refreshed.ok) {
        const refreshedData: BoardData = await refreshed.json();
        if (refreshedData.board_status === "locked") showToast("Board is full! Numbers have been assigned. 🔒", "info");
        if (refreshedData.board_status === "resolved") {
          const winSquare = refreshedData.squares.find((s) => s.number !== null && s.number === refreshedData.winning_number);
          if (winSquare?.owner_id === user.id) {
            showToast(`You won! 🏆 ${refreshedData.payout_sc.toLocaleString()} SC has been credited!`, "win");
          }
        }
        setBoard(refreshedData);
      }
    } catch (e) {
      const msg = "Network error — please try again.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setPurchasing(null);
    }
  }

  function handleCopyInviteLink() {
    if (!board) return;
    const base = window.location.origin + window.location.pathname + "#/board/" + board.board_id;
    const link = board.share_link ? `${base}?invite=${board.share_link}` : base;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast("Invite link copied to clipboard!", "info");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (loading) return (
    <div className="p-8 text-center py-20">
      <div className="text-zinc-600 flex items-center justify-center gap-2">
        <svg className="w-5 h-5 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading board...
      </div>
    </div>
  );
  if (error && !board) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!board) return null;

  const { board_status, squares, game, price_tier_gc, entry_currency, payout_sc, quarter, is_private, winning_number } = board;
  const isScBoard = entry_currency === "SC";
  const winningSquare = squares.find((s) => s.number !== null && s.number === winning_number);
  const userWon = winningSquare?.owner_id === user?.id;
  const filledCount = squares.filter((s) => s.owner_id).length;
  const relevantBalance = isScBoard ? walletBalance?.sweep_coins : walletBalance?.gold_coins;
  const canAfford = relevantBalance === undefined || relevantBalance >= price_tier_gc;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-5 animate-fadeIn">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`/game/${game.id}`}
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-medium transition-colors glass rounded-xl px-3 py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          ← Matchup Hub
        </Link>
      </div>

      {/* Game Info Header */}
      <div className="glass rounded-2xl p-6 card-highlight flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {game.away_team} <span className="text-zinc-600 font-medium text-lg">vs</span> {game.home_team}
          </h1>
          <p className="text-zinc-500 text-xs mt-1 uppercase font-semibold tracking-wider">
            {quarter} · {new Date(game.event_time).toLocaleString()}
          </p>
        </div>
        <div className="bg-surface-950 border border-white/[0.04] rounded-xl px-5 py-3 text-center min-w-[100px]">
          <span className="block text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
            {game.status === "live" ? (
              <span className="flex items-center justify-center gap-1.5 text-red-400">
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                Live
              </span>
            ) : "Score"}
          </span>
          <span className="text-xl font-black font-mono text-white tabular-nums">
            {game.home_score !== null ? `${game.away_score} – ${game.home_score}` : "Upcoming"}
          </span>
        </div>
      </div>

      {/* Wallet balance */}
      {user && walletBalance !== null && (
        <div className={`flex items-center justify-between rounded-2xl px-5 py-3 border ${
          isScBoard
            ? "bg-sweep-950/20 border-sweep-800/20"
            : "bg-coin-950/20 border-coin-800/20"
        }`}>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Your {isScBoard ? "Sweepstakes Coins" : "Gold Coins"}
          </div>
          <div className={`font-mono font-extrabold text-lg tabular-nums ${isScBoard ? "text-sweep-400" : "text-coin-400"}`}>
            {isScBoard
              ? `${walletBalance.sweep_coins % 1 === 0 ? walletBalance.sweep_coins.toLocaleString() : walletBalance.sweep_coins.toFixed(2)} 🎟️`
              : `${walletBalance.gold_coins % 1 === 0 ? walletBalance.gold_coins.toLocaleString() : walletBalance.gold_coins.toFixed(2)} 🟡`}
          </div>
        </div>
      )}

      {/* Insufficient coins warning */}
      {user && !canAfford && board_status === "open" && (
        <div className={`rounded-xl px-4 py-3 text-sm border animate-fadeIn ${
          isScBoard
            ? "bg-sweep-950/30 border-sweep-500/15 text-sweep-300"
            : "bg-coin-950/30 border-coin-500/15 text-coin-300"
        }`}>
          ⚠️ You need {formatCoins(price_tier_gc, entry_currency)} to buy a square.{" "}
          {isScBoard ? (
            <Link to="/wallet" className="underline font-semibold">Claim free SC or buy GC →</Link>
          ) : (
            <Link to="/wallet" className="underline font-semibold">Buy Gold Coins →</Link>
          )}
        </div>
      )}

      {/* Private board share */}
      {is_private && (
        <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 card-highlight">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <span className="block font-semibold text-sm text-white">Private Board</span>
              <span className="block text-xs text-zinc-500">Share this link to invite friends.</span>
            </div>
          </div>
          <button
            onClick={handleCopyInviteLink}
            className="w-full sm:w-auto bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-950/30"
          >
            {copiedLink ? "Copied! ✓" : "Copy Invite Link"}
          </button>
        </div>
      )}

      {/* Winner banner */}
      {board_status === "resolved" && winningSquare && (
        <div className={`rounded-2xl p-7 text-center space-y-3 border animate-fadeIn ${
          userWon
            ? "bg-gradient-to-r from-yellow-950/50 via-amber-950/30 to-yellow-950/50 border-yellow-500/20 shadow-glow-gold"
            : "glass card-highlight"
        }`}>
          <div className="text-4xl">{userWon ? "🏆" : "🎯"}</div>
          <div>
            <h3 className={`text-xl font-black ${userWon ? "text-yellow-400" : "text-zinc-300"}`}>
              {userWon ? "You Won!" : "Board Resolved"}
            </h3>
            <p className="text-zinc-300 text-sm mt-2">
              Winning Number:{" "}
              <span className="font-mono font-black text-white bg-surface-950 border border-white/[0.06] px-2.5 py-1 rounded-lg">
                #{winningSquare.number}
              </span>
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Winner <span className="font-bold text-white">{userWon ? "YOU" : winningSquare.owner_name}</span>{" "}
              takes home{" "}
              <span className="font-bold text-sweep-400">{payout_sc % 1 === 0 ? payout_sc.toLocaleString() : payout_sc.toFixed(2)} 🎟️ SC</span>!
            </p>
          </div>
          <div className="pt-2">
            <Link to={`/game/${game.id}`} className="text-xs font-bold text-brand-400 hover:text-brand-300 uppercase tracking-wider transition-colors">
              Play Next Board →
            </Link>
          </div>
        </div>
      )}

      {/* Cancelled */}
      {board_status === "cancelled" && (
        <div className="bg-red-950/20 border border-red-500/15 rounded-2xl p-6 text-center space-y-2 animate-fadeIn">
          <div className="text-2xl">❌</div>
          <h3 className="font-bold text-red-400">Board Cancelled</h3>
          <p className="text-zinc-500 text-sm">
            The quarter started before this board filled. All payments have been refunded.
          </p>
        </div>
      )}

      {/* Square Grid */}
      <div className="glass rounded-3xl p-6 card-highlight">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="font-bold text-lg text-white">Board Squares</h2>
            <span className="text-xs text-zinc-600">
              {board_status === "open"
                ? `${filledCount}/10 claimed · Click an open square`
                : board_status === "locked"
                ? "All squares claimed · Numbers assigned · Waiting for quarter"
                : board_status === "resolved"
                ? "Board resolved"
                : "Board cancelled"}
            </span>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
            isScBoard
              ? "bg-sweep-950/40 text-sweep-400 border-sweep-800/30"
              : "bg-coin-950/40 text-coin-400 border-coin-800/30"
          }`}>
            {formatCoins(price_tier_gc, entry_currency)} / sq
          </span>
        </div>

        {/* Progress */}
        {board_status === "open" && (
          <div className="w-full bg-surface-950 rounded-full h-1.5 mb-5 border border-white/[0.02]">
            <div
              className="bg-gradient-to-r from-brand-500 to-sweep-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(filledCount / 10) * 100}%` }}
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/20 rounded-xl px-3 py-2 mb-4 animate-fadeIn">
            {error}
          </p>
        )}

        <div className="grid grid-cols-5 gap-3">
          {squares.map((sq, idx) => {
            const isAvailable = !sq.owner_id && board_status === "open";
            const isOwned = sq.owner_id === user?.id;
            const isPurchasing = purchasing === sq.position;
            const isWinner = board_status === "resolved" && sq.number !== null && sq.number === winning_number;

            return (
              <button
                key={sq.id}
                onClick={() => isAvailable && handleBuySquare(sq.position)}
                disabled={!isAvailable || isPurchasing}
                className={`
                  relative h-28 rounded-2xl border-2 flex flex-col items-center justify-center
                  transition-all duration-200 text-sm font-semibold select-none animate-fadeIn
                  ${
                    isWinner
                      ? "border-yellow-400 bg-gradient-to-br from-yellow-950/80 to-amber-950/60 ring-4 ring-yellow-400/20 shadow-glow-gold"
                      : isOwned
                      ? "border-emerald-500/60 bg-emerald-950/40 shadow-glow-green"
                      : isAvailable
                      ? isScBoard
                        ? "border-sweep-500/30 bg-sweep-950/10 hover:bg-sweep-950/30 cursor-pointer hover:border-sweep-400/50 hover:scale-[1.03] hover:shadow-glow-purple"
                        : "border-brand-500/30 bg-brand-950/10 hover:bg-brand-950/20 cursor-pointer hover:border-brand-400/50 hover:scale-[1.03] hover:shadow-glow-blue"
                      : "border-white/[0.04] bg-surface-900/40 opacity-50 cursor-default"
                  }
                `}
                style={{ animationDelay: `${idx * 0.03}s`, animationFillMode: "both" }}
              >
                <span className={`text-3xl font-black font-mono tabular-nums ${
                  isWinner ? "text-yellow-400" : sq.number !== null ? "text-white" : "text-zinc-700"
                }`}>
                  {sq.number !== null ? sq.number : "?"}
                </span>

                {sq.owner_name && (
                  <span className="text-[10px] text-zinc-500 mt-1.5 truncate w-full text-center px-2 font-medium">
                    {sq.owner_name}
                  </span>
                )}

                {isOwned && !isWinner && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">
                    Mine
                  </span>
                )}
                {isWinner && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider font-black bg-yellow-400 text-black px-1.5 py-0.5 rounded-md">
                    Win
                  </span>
                )}
                {isPurchasing && (
                  <span className="absolute inset-0 bg-surface-950/90 rounded-2xl flex items-center justify-center text-xs text-brand-400 font-bold gap-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Buying...
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {board_status === "open" && !user && (
        <p className="text-center text-zinc-600 text-xs">
          Please{" "}
          <Link to="/auth" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">sign in</Link>{" "}
          to buy a square.
        </p>
      )}

      {/* Payout info */}
      {board_status === "open" && (
        <div className="glass rounded-xl p-4 text-center text-xs text-zinc-600 card-highlight">
          <span className="font-semibold text-zinc-400">Potential payout: </span>
          <span className="text-sweep-400 font-bold font-mono tabular-nums">{payout_sc.toLocaleString()} 🎟️ SC</span>
          <span className="ml-2">(90% of the total pot — platform keeps 10%)</span>
        </div>
      )}
    </div>
  );
}
