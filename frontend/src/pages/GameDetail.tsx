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

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [currency, setCurrency] = useState<"SC" | "GC">("SC");
  const [selectedPrice, setSelectedPrice] = useState<number>(5); // default 5 SC
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q1");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadingBoard, setLoadingBoard] = useState<boolean>(true);
  const [walletBalance, setWalletBalance] = useState<{ gold_coins: number; sweep_coins: number } | null>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Polling ref
  const pollRef = useRef<number | null>(null);

  // Load Game Metadata
  useEffect(() => {
    if (!gameId) return;
    fetch(`${API}/games/${gameId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Game not found");
        return r.json();
      })
      .then((data) => setGame(data))
      .catch(() => {
        setError("Failed to load game information.");
      });
  }, [gameId]);

  // Load User Wallet
  function loadWallet() {
    if (!user) return;
    fetch(`${API}/wallet/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setWalletBalance({ gold_coins: d.gold_coins ?? 0, sweep_coins: d.sweep_coins ?? 0 }))
      .catch(() => {});
  }

  useEffect(() => {
    loadWallet();
  }, [user]);

  // Adjust default price tier when currency toggles
  const handleCurrencyChange = (newCurrency: "SC" | "GC") => {
    setCurrency(newCurrency);
    if (newCurrency === "SC") {
      if (!SC_TIERS.includes(selectedPrice)) {
        setSelectedPrice(5); // Default $5 SC
      }
    } else {
      if (!GC_TIERS.includes(selectedPrice)) {
        setSelectedPrice(500); // Default 500 GC
      }
    }
  };

  // Fetch Next Available Board
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

      const res = await fetch(`${API}/boards/next-available?${params}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Unable to fetch next available board");
      }

      const data: BoardData = await res.json();
      setBoard(data);
    } catch (err: any) {
      if (!silent) setError("Could not load board. Please try again.");
    } finally {
      if (!silent) setLoadingBoard(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [gameId, currency, selectedPrice, selectedQuarter]);

  // Background polling every 6 seconds to keep squares & scores fresh
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

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId, currency, selectedPrice, selectedQuarter]);

  // Handle Square Purchase
  async function handleBuySquare(position: number) {
    if (!user) {
      navigate("/auth");
      return;
    }
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

      // Update local wallet
      if (data.new_gold_coins !== undefined || data.new_sweep_coins !== undefined) {
        setWalletBalance({
          gold_coins: data.new_gold_coins ?? walletBalance?.gold_coins ?? 0,
          sweep_coins: data.new_sweep_coins ?? walletBalance?.sweep_coins ?? 0,
        });
      }

      showToast(`Square claimed! Position ${position + 1} is yours. 🎉`, "success");

      // Reload active board
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
        <div className="text-zinc-500 animate-pulse text-lg">Loading matchup...</div>
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl px-3.5 py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          All Matchups
        </Link>

        {user && walletBalance !== null && (
          <Link
            to="/wallet"
            className={`flex items-center gap-2 font-mono text-xs md:text-sm font-bold px-3 py-1.5 rounded-xl border transition-all ${
              isSc
                ? "bg-purple-950/40 border-purple-800/50 text-purple-300 hover:border-purple-600"
                : "bg-yellow-950/40 border-yellow-800/50 text-yellow-400 hover:border-yellow-600"
            }`}
          >
            <span>Balance:</span>
            <span>
              {isSc
                ? `${walletBalance.sweep_coins % 1 === 0 ? walletBalance.sweep_coins.toLocaleString() : walletBalance.sweep_coins.toFixed(2)} 🎟️ SC`
                : `${walletBalance.gold_coins % 1 === 0 ? walletBalance.gold_coins.toLocaleString() : walletBalance.gold_coins.toFixed(2)} 🟡 GC`}
            </span>
            <span className="text-zinc-500 font-sans text-xs ml-1">+ Top Up</span>
          </Link>
        )}
      </div>

      {/* Matchup Header Card */}
      {game && (
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-800/90 via-zinc-900 to-blue-950/40 border border-zinc-700/80 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Away Team */}
            <div className="flex items-center gap-4 flex-1 justify-center md:justify-start">
              {game.away_team_logo ? (
                <img
                  src={game.away_team_logo}
                  alt={game.away_team}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover bg-zinc-800 p-1 border border-zinc-700 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-black text-zinc-400">
                  {game.away_team.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-center md:text-left">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500 block">
                  Away
                </span>
                <span className="text-lg md:text-xl font-black text-white">{game.away_team}</span>
              </div>
            </div>

            {/* Score / Status Center Box */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl px-6 py-3 text-center min-w-[140px] shadow-inner">
              <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-bold mb-1">
                <span>{sportEmoji}</span>
                <span className="uppercase tracking-wider">
                  {game.status === "live" ? "🔴 Live" : game.status === "resolved" ? "Final" : "Upcoming"}
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black font-mono text-white tracking-wider">
                {game.away_score !== null && game.home_score !== null
                  ? `${game.away_score} – ${game.home_score}`
                  : "VS"}
              </div>
              <div className="text-[11px] text-zinc-500 font-medium mt-1">
                {new Date(game.event_time).toLocaleDateString([], { month: "short", day: "numeric" })}{" · "}
                {new Date(game.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {/* Home Team */}
            <div className="flex items-center gap-4 flex-1 justify-center md:justify-end flex-row-reverse md:flex-row">
              <div className="text-center md:text-right">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500 block">
                  Home
                </span>
                <span className="text-lg md:text-xl font-black text-white">{game.home_team}</span>
              </div>
              {game.home_team_logo ? (
                <img
                  src={game.home_team_logo}
                  alt={game.home_team}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover bg-zinc-800 p-1 border border-zinc-700 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-black text-zinc-400">
                  {game.home_team.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          STEP 1: CHOOSE CURRENCY & BUY-IN AMOUNT
      ──────────────────────────────────────────────────────── */}
      <div className="bg-zinc-800/70 border border-zinc-700/70 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-black">
                1
              </span>
              Choose Buy-In Amount
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select your currency and entry tier per square.
            </p>
          </div>

          {/* Currency Switcher */}
          <div className="flex rounded-xl overflow-hidden border border-zinc-700 p-0.5 bg-zinc-900 self-start sm:self-auto">
            <button
              onClick={() => handleCurrencyChange("SC")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                currency === "SC"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🎟️ Sweepstakes Coins
            </button>
            <button
              onClick={() => handleCurrencyChange("GC")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                currency === "GC"
                  ? "bg-yellow-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🟡 Gold Coins
            </button>
          </div>
        </div>

        {/* Tier Chip Buttons */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
          {(isSc ? SC_TIERS : GC_TIERS).map((tier) => {
            const isSelected = selectedPrice === tier;
            const displayLabel =
              tier % 1 === 0 ? tier.toLocaleString() : tier.toString();

            return (
              <button
                key={tier}
                onClick={() => setSelectedPrice(tier)}
                className={`py-2.5 px-2 rounded-xl text-xs font-mono font-extrabold border transition-all flex flex-col items-center justify-center ${
                  isSelected
                    ? isSc
                      ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-950/40 scale-105"
                      : "bg-yellow-500 text-black border-yellow-300 shadow-lg shadow-yellow-950/40 scale-105"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700/80 hover:border-zinc-500 hover:bg-zinc-800"
                }`}
              >
                <span>{isSc ? `$${displayLabel}` : displayLabel}</span>
                <span className="text-[9px] font-sans font-semibold opacity-75">
                  {isSc ? "SC" : "GC"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Payout & Pot Preview Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Entry:</span>
            <span className="font-mono font-bold text-white">
              {formatPrice(selectedPrice, currency)} / sq
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Total Pot:</span>
            <span className="font-mono font-bold text-zinc-300">
              {formatPrice(selectedPrice * 10, currency)}
            </span>
          </div>
          <div className="flex items-center gap-2 font-bold">
            <span className="text-zinc-400">Winner Payout (9×):</span>
            <span
              className={`font-mono text-sm ${
                isSc ? "text-purple-300" : "text-yellow-400"
              }`}
            >
              {formatPrice(potentialPayout, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          STEP 2: CHOOSE QUARTER
      ──────────────────────────────────────────────────────── */}
      <div className="bg-zinc-800/70 border border-zinc-700/70 rounded-3xl p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-black">
              2
            </span>
            Choose Quarter / Period
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select which quarter score you want to play for.
          </p>
        </div>

        {/* Quarter Selector Tabs */}
        <div className="grid grid-cols-4 gap-2.5">
          {QUARTERS.map((q) => {
            const isSelected = selectedQuarter === q;
            return (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`py-3 px-4 rounded-2xl text-sm font-extrabold border transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-950/40"
                    : "bg-zinc-900/80 text-zinc-400 border-zinc-700/80 hover:text-white hover:border-zinc-600 hover:bg-zinc-800"
                }`}
              >
                <span>{q}</span>
                <span className="text-[10px] font-normal opacity-80">
                  {q === "Q4" ? "Final" : "Quarter"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          STEP 3: NEXT AVAILABLE BOARD & SQUARES GRID
      ──────────────────────────────────────────────────────── */}
      <div className="bg-zinc-800/90 border border-zinc-700/80 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-700/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-black">
                3
              </span>
              <h2 className="text-lg font-black text-white">
                Next Available Board · {selectedQuarter}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
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
              <span
                className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                  board.board_status === "open"
                    ? "bg-green-950/60 border-green-700/50 text-green-400"
                    : board.board_status === "locked"
                    ? "bg-amber-950/60 border-amber-700/50 text-amber-400"
                    : "bg-blue-950/60 border-blue-700/50 text-blue-400"
                }`}
              >
                {board.board_status === "open"
                  ? "Open for Picks"
                  : board.board_status === "locked"
                  ? "Locked 🔒"
                  : "Resolved 🏆"}
              </span>
            )}
            <button
              onClick={handleCopyInviteLink}
              title="Share board link"
              className="bg-zinc-700/60 hover:bg-zinc-700 text-zinc-300 p-1.5 rounded-lg border border-zinc-600/50 transition-colors"
            >
              {copiedLink ? "✓" : "🔗"}
            </button>
          </div>
        </div>

        {/* Balance warning */}
        {user && !canAfford && board?.board_status === "open" && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-medium border flex items-center justify-between gap-3 ${
              isSc
                ? "bg-purple-950/40 border-purple-700/60 text-purple-300"
                : "bg-yellow-950/40 border-yellow-700/60 text-yellow-300"
            }`}
          >
            <span>
              ⚠️ Insufficient {isSc ? "Sweepstakes Coins" : "Gold Coins"}. You need{" "}
              {formatPrice(selectedPrice, currency)} to claim a square.
            </span>
            <Link
              to="/wallet"
              className="underline font-bold whitespace-nowrap hover:opacity-80"
            >
              Get Coins →
            </Link>
          </div>
        )}

        {/* Progress bar */}
        {board?.board_status === "open" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-400 font-semibold">
              <span>{filledCount} of 10 Claimed</span>
              <span>{10 - filledCount} Remaining</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-700/40">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(filledCount / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        {/* 10 SQUARES GRID */}
        {loadingBoard ? (
          <div className="grid grid-cols-5 gap-3 py-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-zinc-900/60 rounded-2xl animate-pulse border border-zinc-800"
              />
            ))}
          </div>
        ) : board ? (
          <div className="grid grid-cols-5 gap-3">
            {board.squares.map((sq) => {
              const isAvailable = !sq.owner_id && board.board_status === "open";
              const isOwned = sq.owner_id === user?.id;
              const isPurchasing = purchasing === sq.position;
              const isWinner =
                board.board_status === "resolved" &&
                sq.number !== null &&
                sq.number === board.winning_number;

              return (
                <button
                  key={sq.id}
                  onClick={() => isAvailable && handleBuySquare(sq.position)}
                  disabled={!isAvailable || isPurchasing}
                  className={`
                    relative h-24 rounded-2xl border-2 flex flex-col items-center justify-center
                    transition-all select-none
                    ${
                      isWinner
                        ? "border-yellow-400 bg-yellow-950/80 ring-4 ring-yellow-400/30 animate-pulse"
                        : isOwned
                        ? "border-green-500 bg-green-950/70 shadow-lg shadow-green-950/10"
                        : isAvailable
                        ? isSc
                          ? "border-purple-500/50 bg-purple-950/20 hover:bg-purple-900/40 cursor-pointer hover:border-purple-400 hover:scale-[1.03]"
                          : "border-yellow-500/50 bg-yellow-950/20 hover:bg-yellow-900/40 cursor-pointer hover:border-yellow-400 hover:scale-[1.03]"
                        : "border-zinc-700/60 bg-zinc-900/60 opacity-60 cursor-default"
                    }
                  `}
                >
                  {/* Assigned Number or Position */}
                  <span
                    className={`text-2xl md:text-3xl font-black font-mono ${
                      isWinner
                        ? "text-yellow-400"
                        : sq.number !== null
                        ? "text-white"
                        : "text-zinc-600"
                    }`}
                  >
                    {sq.number !== null ? sq.number : "?"}
                  </span>

                  {/* Owner Label */}
                  <span className="text-[10px] text-zinc-400 mt-1 truncate w-full text-center px-1 font-semibold">
                    {sq.owner_name ? (isOwned ? "You" : sq.owner_name) : "Open"}
                  </span>

                  {/* Badges */}
                  {isOwned && !isWinner && (
                    <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider font-extrabold bg-green-600 text-white px-1.5 py-0.2 rounded">
                      Mine
                    </span>
                  )}

                  {isWinner && (
                    <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider font-extrabold bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black">
                      Win
                    </span>
                  )}

                  {isPurchasing && (
                    <span className="absolute inset-0 bg-zinc-950/90 rounded-2xl flex items-center justify-center text-xs text-blue-400 font-bold gap-1.5">
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
          <div className="pt-2 text-center border-t border-zinc-700/40">
            <Link
              to="/auth"
              className="inline-block text-xs font-bold text-blue-400 hover:text-blue-300 underline"
            >
              Sign in to claim your square and enter this board →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
