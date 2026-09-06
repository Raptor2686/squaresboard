import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { API } from "../config";

const GC_TIERS = [50, 100, 500, 1000, 2000, 5000, 10000, 100000];
const SC_TIERS = [0.5, 1, 5, 10, 20, 50, 100, 1000];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const SPORT_EMOJI: Record<string, string> = {
  football: "🏈",
  basketball: "🏀",
  baseball: "⚾",
};

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
    home_team_logo?: string;
    away_team_logo?: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    event_time: string;
  };
  squares: Square[];
}

interface GameInfo {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  event_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

function formatPrice(n: number, currency: string) {
  const formatted = n % 1 === 0 ? n.toLocaleString() : n.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${currency === "SC" ? "🎟️ SC" : "🟡 GC"}`;
}

function TeamLogo({ src, name, size = "lg" }: { src?: string; name: string; size?: "lg" | "md" }) {
  const dim = size === "lg" ? "w-16 h-16" : "w-12 h-12";
  const text = size === "lg" ? "text-xl" : "text-base";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover bg-surface-800 p-1 border border-white/[0.06] shadow-lg`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-surface-800 border border-white/[0.06] flex items-center justify-center ${text} font-black text-zinc-500 shadow-lg`}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [currency, setCurrency] = useState<"SC" | "GC">("SC");
  const [selectedPrice, setSelectedPrice] = useState<number>(5);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q1");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadingBoard, setLoadingBoard] = useState<boolean>(true);
  const [walletBalance, setWalletBalance] = useState<{ gold_coins: number; sweep_coins: number } | null>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  const pollRef = useRef<number | null>(null);

  // Load Game Metadata
  useEffect(() => {
    if (!gameId) return;
    fetch(`${API}/games/${gameId}`)
      .then((r) => { if (!r.ok) throw new Error("Game not found"); return r.json(); })
      .then((data) => setGame(data))
      .catch(() => setError("Failed to load game information."));
  }, [gameId]);

  // Load User Wallet
  function loadWallet() {
    if (!user) return;
    fetch(`${API}/wallet/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setWalletBalance({ gold_coins: d.gold_coins ?? 0, sweep_coins: d.sweep_coins ?? 0 }))
      .catch(() => {});
  }

  useEffect(() => { loadWallet(); }, [user]);

  const handleCurrencyChange = (newCurrency: "SC" | "GC") => {
    setCurrency(newCurrency);
    if (newCurrency === "SC") {
      if (!SC_TIERS.includes(selectedPrice)) setSelectedPrice(5);
    } else {
      if (!GC_TIERS.includes(selectedPrice)) setSelectedPrice(500);
    }
  };

  const fetchBoard = async (silent = false) => {
    if (!gameId) return;
    if (!silent) setLoadingBoard(true);
    setError("");
    try {
      const params = new URLSearchParams({
        game_id: gameId,
        quarter: selectedQuarter,
        price_tier: String(selectedPrice),
        entry_currency: currency,
      });
      const res = await fetch(`${API}/boards/next-available?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Unable to fetch next available board");
      const data: BoardData = await res.json();
      setBoard(data);
    } catch (err: any) {
      if (!silent) setError("Could not load board. Please try again.");
    } finally {
      if (!silent) setLoadingBoard(false);
    }
  };

  useEffect(() => { fetchBoard(); }, [gameId, currency, selectedPrice, selectedQuarter]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      fetchBoard(true);
      if (gameId) {
        fetch(`${API}/games/${gameId}`)
          .then((r) => r.ok && r.json())
          .then((d) => d && setGame(d))
          .catch(() => {});
      }
    }, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [gameId, currency, selectedPrice, selectedQuarter]);

  async function handleBuySquare(position: number) {
    if (!user) { navigate("/auth"); return; }
    if (!board || board.board_status !== "open") return;
    setPurchasing(position);
    setError("");
    try {
      const res = await fetch(`${API}/squares/board/${board.board_id}/purchase`, {
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
      await fetchBoard(true);
      if (data.board_status === "locked") {
        showToast("Board is full! Numbers 0-9 have been assigned. 🔒", "info");
      }
    } catch (e) {
      const msg = "Network error. Please try again.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setPurchasing(null);
    }
  }

  function handleCopyInviteLink() {
    if (!board) return;
    const base = window.location.origin + window.location.pathname + `#/board/${board.board_id}`;
    navigator.clipboard.writeText(base);
    setCopiedLink(true);
    showToast("Board link copied to clipboard!", "info");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (!game && !error) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-20">
        <div className="text-zinc-600 text-lg flex items-center justify-center gap-2">
          <svg className="w-5 h-5 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading matchup...
        </div>
      </div>
    );
  }

  const isSc = currency === "SC";
  const userBalance = isSc ? walletBalance?.sweep_coins : walletBalance?.gold_coins;
  const canAfford = userBalance === undefined || userBalance >= selectedPrice;
  const filledCount = board ? board.squares.filter((s) => s.owner_id).length : 0;
  const rawPayout = selectedPrice * 10 * 0.9;
  const potentialPayout = rawPayout % 1 === 0 ? rawPayout : Number(rawPayout.toFixed(2));
  const sportEmoji = game ? (SPORT_EMOJI[game.sport] ?? "🏟️") : "🏟️";

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5 animate-fadeIn">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-medium transition-colors duration-200 glass rounded-xl px-3.5 py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          All Matchups
        </Link>

        {user && walletBalance !== null && (
          <Link
            to="/wallet"
            className={`flex items-center gap-2 font-mono text-xs font-bold px-3.5 py-2 rounded-xl border transition-all duration-200 ${
              isSc
                ? "bg-sweep-950/40 border-sweep-800/30 text-sweep-400 hover:border-sweep-600/40"
                : "bg-coin-950/40 border-coin-800/30 text-coin-400 hover:border-coin-600/40"
            }`}
          >
            <span>Balance:</span>
            <span className="tabular-nums">
              {isSc
                ? `${walletBalance.sweep_coins % 1 === 0 ? walletBalance.sweep_coins.toLocaleString() : walletBalance.sweep_coins.toFixed(2)} 🎟️ SC`
                : `${walletBalance.gold_coins % 1 === 0 ? walletBalance.gold_coins.toLocaleString() : walletBalance.gold_coins.toFixed(2)} 🟡 GC`}
            </span>
            <span className="text-zinc-600 font-sans text-xs ml-0.5">+ Top Up</span>
          </Link>
        )}
      </div>

      {/* Matchup Header */}
      {game && (
        <div className="relative overflow-hidden glass rounded-3xl p-7 card-highlight">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/30 via-transparent to-sweep-950/20 pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Away Team */}
            <div className="flex items-center gap-4 flex-1 justify-center md:justify-start">
              <TeamLogo src={game.away_team_logo} name={game.away_team} />
              <div className="text-center md:text-left">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600 block">Away</span>
                <span className="text-xl font-black text-white">{game.away_team}</span>
              </div>
            </div>

            {/* Score / VS center */}
            <div className="bg-surface-950/80 border border-white/[0.06] rounded-2xl px-7 py-4 text-center min-w-[150px] shadow-inner">
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 font-bold mb-1.5">
                <span>{sportEmoji}</span>
                <span className="uppercase tracking-wider">
                  {game.status === "live" ? (
                    <span className="flex items-center gap-1.5 text-red-400">
                      <span className="live-dot" style={{ width: 6, height: 6 }} />
                      Live
                    </span>
                  ) : game.status === "resolved" ? "Final" : "Upcoming"}
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-white tracking-wider tabular-nums">
                {game.away_score !== null && game.home_score !== null
                  ? `${game.away_score} – ${game.home_score}`
                  : "VS"}
              </div>
              <div className="text-[11px] text-zinc-600 font-medium mt-1.5">
                {new Date(game.event_time).toLocaleDateString([], { month: "short", day: "numeric" })}
                {" · "}
                {new Date(game.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {/* Home Team */}
            <div className="flex items-center gap-4 flex-1 justify-center md:justify-end flex-row-reverse md:flex-row">
              <div className="text-center md:text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600 block">Home</span>
                <span className="text-xl font-black text-white">{game.home_team}</span>
              </div>
              <TeamLogo src={game.home_team_logo} name={game.home_team} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: CURRENCY & BUY-IN */}
      <div className="glass rounded-3xl p-6 card-highlight space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-brand-950/40">1</span>
            <div>
              <h2 className="text-base font-extrabold text-white">Choose Buy-In Amount</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Select your currency and entry tier per square.</p>
            </div>
          </div>

          {/* Currency Switcher */}
          <div className="flex rounded-xl overflow-hidden border border-white/[0.06] p-0.5 bg-surface-950 self-start sm:self-auto">
            <button
              onClick={() => handleCurrencyChange("SC")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                currency === "SC"
                  ? "bg-sweep-600 text-white shadow-md shadow-sweep-950/30"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              🎟️ Sweepstakes
            </button>
            <button
              onClick={() => handleCurrencyChange("GC")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                currency === "GC"
                  ? "bg-coin-500 text-black shadow-md shadow-coin-950/30"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              🟡 Gold Coins
            </button>
          </div>
        </div>

        {/* Tier Chips */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
          {(isSc ? SC_TIERS : GC_TIERS).map((tier) => {
            const isSelected = selectedPrice === tier;
            const displayLabel = tier % 1 === 0 ? tier.toLocaleString() : tier.toString();
            return (
              <button
                key={tier}
                onClick={() => setSelectedPrice(tier)}
                className={`py-2.5 px-2 rounded-xl text-xs font-mono font-bold border transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? isSc
                      ? "bg-sweep-600 text-white border-sweep-400 shadow-lg shadow-sweep-950/30 scale-105"
                      : "bg-coin-500 text-black border-coin-300 shadow-lg shadow-coin-950/30 scale-105"
                    : "bg-surface-900/80 text-zinc-400 border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] hover:text-zinc-200"
                }`}
              >
                <span>{isSc ? `$${displayLabel}` : displayLabel}</span>
                <span className="text-[9px] font-sans font-semibold opacity-60">
                  {isSc ? "SC" : "GC"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Payout Preview */}
        <div className="bg-surface-950/80 border border-white/[0.04] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Entry:</span>
            <span className="font-mono font-bold text-white tabular-nums">{formatPrice(selectedPrice, currency)} / sq</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Pot:</span>
            <span className="font-mono font-bold text-zinc-300 tabular-nums">{formatPrice(selectedPrice * 10, currency)}</span>
          </div>
          <div className="flex items-center gap-2 font-bold">
            <span className="text-zinc-500">Winner (9×):</span>
            <span className={`font-mono text-sm tabular-nums ${isSc ? "text-sweep-400" : "text-coin-400"}`}>
              {formatPrice(potentialPayout, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 2: QUARTER */}
      <div className="glass rounded-3xl p-6 card-highlight space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-brand-950/40">2</span>
          <div>
            <h2 className="text-base font-extrabold text-white">Choose Quarter / Period</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Select which quarter score you want to play for.</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {QUARTERS.map((q) => {
            const isSelected = selectedQuarter === q;
            return (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`py-3.5 px-4 rounded-2xl text-sm font-extrabold border transition-all duration-200 text-center flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? "bg-brand-600 text-white border-brand-400 shadow-lg shadow-brand-950/30"
                    : "bg-surface-900/80 text-zinc-500 border-white/[0.04] hover:text-white hover:border-white/[0.08] hover:bg-white/[0.02]"
                }`}
              >
                <span>{q}</span>
                <span className="text-[10px] font-normal opacity-70">
                  {q === "Q4" ? "Final" : "Quarter"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 3: BOARD & SQUARES */}
      <div className="glass rounded-3xl p-6 space-y-5 card-highlight shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-brand-950/40">3</span>
              <h2 className="text-lg font-black text-white">
                Board · {selectedQuarter}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mt-1 ml-10">
              {board?.board_status === "open"
                ? `${filledCount}/10 squares claimed · Click an open square to buy`
                : board?.board_status === "locked"
                ? "All squares claimed · Numbers randomly assigned (0–9)"
                : board?.board_status === "resolved"
                ? "Quarter ended · Winner determined!"
                : "Loading board..."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {board && (
              <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border ${
                board.board_status === "open"
                  ? "bg-emerald-950/50 border-emerald-500/20 text-emerald-400"
                  : board.board_status === "locked"
                  ? "bg-amber-950/50 border-amber-500/20 text-amber-400"
                  : "bg-brand-950/50 border-brand-500/20 text-brand-400"
              }`}>
                {board.board_status === "open" ? "Open for Picks" : board.board_status === "locked" ? "Locked 🔒" : "Resolved 🏆"}
              </span>
            )}
            <button
              onClick={handleCopyInviteLink}
              title="Share board link"
              className="glass hover:bg-white/[0.06] text-zinc-500 hover:text-white p-2 rounded-lg transition-all duration-200"
            >
              {copiedLink ? "✓" : "🔗"}
            </button>
          </div>
        </div>

        {/* Balance warning */}
        {user && !canAfford && board?.board_status === "open" && (
          <div className={`rounded-xl px-4 py-3 text-xs font-medium border flex items-center justify-between gap-3 animate-fadeIn ${
            isSc
              ? "bg-sweep-950/30 border-sweep-500/15 text-sweep-300"
              : "bg-coin-950/30 border-coin-500/15 text-coin-300"
          }`}>
            <span>
              ⚠️ Insufficient {isSc ? "Sweepstakes Coins" : "Gold Coins"}. You need{" "}
              {formatPrice(selectedPrice, currency)} to claim a square.
            </span>
            <Link to="/wallet" className="underline font-bold whitespace-nowrap hover:opacity-80">
              Get Coins →
            </Link>
          </div>
        )}

        {/* Progress bar */}
        {board?.board_status === "open" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-500 font-semibold">
              <span>{filledCount} of 10 Claimed</span>
              <span>{10 - filledCount} Remaining</span>
            </div>
            <div className="w-full bg-surface-950 rounded-full h-2 overflow-hidden border border-white/[0.04]">
              <div
                className="bg-gradient-to-r from-brand-500 to-sweep-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(filledCount / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3 animate-fadeIn">
            {error}
          </p>
        )}

        {/* SQUARES GRID */}
        {loadingBoard ? (
          <div className="grid grid-cols-5 gap-3 py-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-28 skeleton" />
            ))}
          </div>
        ) : board ? (
          <div className="grid grid-cols-5 gap-3">
            {board.squares.map((sq, idx) => {
              const isAvailable = !sq.owner_id && board.board_status === "open";
              const isOwned = sq.owner_id === user?.id;
              const isPurchasing = purchasing === sq.position;
              const isWinner = board.board_status === "resolved" && sq.number !== null && sq.number === board.winning_number;

              return (
                <button
                  key={sq.id}
                  onClick={() => isAvailable && handleBuySquare(sq.position)}
                  disabled={!isAvailable || isPurchasing}
                  className={`
                    relative h-28 rounded-2xl border-2 flex flex-col items-center justify-center
                    transition-all duration-200 select-none animate-fadeIn
                    ${
                      isWinner
                        ? "border-yellow-400 bg-gradient-to-br from-yellow-950/80 to-amber-950/60 ring-4 ring-yellow-400/20 shadow-glow-gold"
                        : isOwned
                        ? "border-emerald-500/60 bg-emerald-950/40 shadow-glow-green"
                        : isAvailable
                        ? isSc
                          ? "border-sweep-500/30 bg-sweep-950/10 hover:bg-sweep-950/30 cursor-pointer hover:border-sweep-400/50 hover:scale-[1.04] hover:shadow-glow-purple"
                          : "border-coin-500/30 bg-coin-950/10 hover:bg-coin-950/30 cursor-pointer hover:border-coin-400/50 hover:scale-[1.04] hover:shadow-glow-gold"
                        : "border-white/[0.04] bg-surface-900/40 opacity-50 cursor-default"
                    }
                  `}
                  style={{ animationDelay: `${idx * 0.03}s`, animationFillMode: "both" }}
                >
                  <span className={`text-2xl md:text-3xl font-black font-mono tabular-nums ${
                    isWinner ? "text-yellow-400" : sq.number !== null ? "text-white" : "text-zinc-700"
                  }`}>
                    {sq.number !== null ? sq.number : "?"}
                  </span>

                  <span className="text-[10px] text-zinc-500 mt-1 truncate w-full text-center px-1 font-medium">
                    {sq.owner_name ? (isOwned ? "You" : sq.owner_name) : "Open"}
                  </span>

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
                    <span className="absolute inset-0 bg-surface-950/90 rounded-2xl flex items-center justify-center text-xs text-brand-400 font-bold gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Claiming
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Logged-out callout */}
        {!user && (
          <div className="pt-2 text-center border-t border-white/[0.04]">
            <Link
              to="/auth"
              className="inline-block text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors"
            >
              Sign in to claim your square and enter this board →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
