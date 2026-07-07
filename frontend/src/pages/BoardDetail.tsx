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
  price_tier: number;
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

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

export default function BoardDetail() {
  const { boardId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [board, setBoard] = useState<BoardData | null>(null);
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

  useEffect(() => {
    loadBoard();
  }, [boardId]);

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
      showToast(`Square claimed! Position ${position + 1} is yours. 🎉`, "success");
      await loadBoard(); // refresh board state

      // Check if the board just filled (all 10 squares now owned)
      const refreshed = await fetch(`${API}/squares/board/${boardId}`, { credentials: "include" });
      if (refreshed.ok) {
        const refreshedData: BoardData = await refreshed.json();
        if (refreshedData.board_status === "locked") {
          showToast("Board is full! Numbers have been assigned. 🔒", "info");
        }
        // Check if just resolved and user won
        if (refreshedData.board_status === "resolved") {
          const winSquare = refreshedData.squares.find(
            (s) => s.number !== null && s.number === refreshedData.winning_number
          );
          if (winSquare?.owner_id === user.id) {
            showToast(
              `You won! 🏆 ${formatCents(refreshedData.price_tier * 900)} has been credited to your wallet!`,
              "win"
            );
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
    <div className="p-8 text-center">
      <div className="text-zinc-500 animate-pulse">Loading board...</div>
    </div>
  );
  if (error && !board) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!board) return null;

  const { board_status, squares, game, price_tier, quarter, is_private, winning_number } = board;
  const winningSquare = squares.find((s) => s.number !== null && s.number === winning_number);
  const userWon = winningSquare?.owner_id === user?.id;
  const filledCount = squares.filter((s) => s.owner_id).length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Game info header */}
      <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {game.away_team} <span className="text-zinc-500 font-medium text-lg">vs</span> {game.home_team}
          </h1>
          <p className="text-zinc-400 text-xs mt-1 uppercase font-semibold tracking-wider">
            {quarter} · {new Date(game.event_time).toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-center min-w-[100px]">
          <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            {game.status === "live" ? "🔴 Live" : "Score"}
          </span>
          <span className="text-xl font-extrabold font-mono text-white">
            {game.home_score !== null ? `${game.away_score} – ${game.home_score}` : "Upcoming"}
          </span>
        </div>
      </div>

      {/* Private board share banner */}
      {is_private && (
        <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <span className="block font-semibold text-sm text-white">Private Board Active</span>
              <span className="block text-xs text-zinc-400">Invite friends using this link.</span>
            </div>
          </div>
          <button
            onClick={handleCopyInviteLink}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            {copiedLink ? "Copied! ✓" : "Copy Invite Link"}
          </button>
        </div>
      )}

      {/* Resolved winner banner */}
      {board_status === "resolved" && winningSquare && (
        <div className={`rounded-2xl p-6 text-center space-y-3 border ${
          userWon
            ? "bg-gradient-to-r from-yellow-950/60 via-amber-900/40 to-yellow-950/60 border-yellow-700/60"
            : "bg-zinc-800/40 border-zinc-700/60"
        }`}>
          <div className="text-3xl">{userWon ? "🏆" : "🎯"}</div>
          <div>
            <h3 className={`text-lg font-bold ${userWon ? "text-yellow-400" : "text-zinc-300"}`}>
              {userWon ? "You Won!" : "Board Resolved"}
            </h3>
            <p className="text-zinc-300 text-sm mt-1">
              Winning Number:{" "}
              <span className="font-mono font-extrabold text-white bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                #{winningSquare.number}
              </span>
            </p>
            <p className="text-zinc-400 text-xs mt-2">
              Winner{" "}
              <span className="font-bold text-white">
                {userWon ? "YOU" : winningSquare.owner_name}
              </span>{" "}
              takes home{" "}
              <span className="font-extrabold text-green-400">{formatCents(price_tier * 900)}</span>!
            </p>
          </div>
          <div className="pt-2">
            <Link to="/" className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider">
              Play Next Board →
            </Link>
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {board_status === "cancelled" && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-5 text-center space-y-1">
          <div className="text-2xl">❌</div>
          <h3 className="font-bold text-red-400">Board Cancelled</h3>
          <p className="text-zinc-400 text-sm">
            The quarter started before this board filled. All payments have been refunded.
          </p>
        </div>
      )}

      {/* Square Grid Panel */}
      <div className="bg-zinc-800 border border-zinc-700/60 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="font-bold text-lg text-white">Board Squares</h2>
            <span className="text-xs text-zinc-500">
              {board_status === "open"
                ? `${filledCount}/10 claimed · Click an open square to buy`
                : board_status === "locked"
                ? "All squares claimed · Numbers assigned · Waiting for quarter to end"
                : board_status === "resolved"
                ? "Board resolved"
                : "Board cancelled"}
            </span>
          </div>
          <span className="bg-green-950 text-green-400 border border-green-800/40 text-xs font-bold px-3 py-1 rounded-xl">
            {formatCents(price_tier * 100)} / sq
          </span>
        </div>

        {/* Fill progress bar */}
        {board_status === "open" && (
          <div className="w-full bg-zinc-700 rounded-full h-1.5 mb-5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(filledCount / 10) * 100}%` }}
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-xl px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="grid grid-cols-5 gap-3">
          {squares.map((sq) => {
            const isAvailable = !sq.owner_id && board_status === "open";
            const isOwned = sq.owner_id === user?.id;
            const isPurchasing = purchasing === sq.position;
            const isWinner =
              board_status === "resolved" && sq.number !== null && sq.number === winning_number;

            return (
              <button
                key={sq.id}
                onClick={() => isAvailable && handleBuySquare(sq.position)}
                disabled={!isAvailable || isPurchasing}
                className={`
                  relative h-24 rounded-2xl border-2 flex flex-col items-center justify-center
                  transition-all text-sm font-semibold select-none
                  ${
                    isWinner
                      ? "border-yellow-400 bg-yellow-950/80 ring-4 ring-yellow-400/30 animate-pulse"
                      : isOwned
                      ? "border-green-500 bg-green-950/70 shadow-lg shadow-green-950/10"
                      : isAvailable
                      ? "border-blue-500/50 bg-blue-950/20 hover:bg-blue-900/30 cursor-pointer hover:border-blue-400 hover:scale-[1.03]"
                      : "border-zinc-700/60 bg-zinc-800/50 opacity-60 cursor-default"
                  }
                `}
              >
                <span
                  className={`text-3xl font-extrabold font-mono ${
                    isWinner
                      ? "text-yellow-400"
                      : sq.number !== null
                      ? "text-white"
                      : "text-zinc-600"
                  }`}
                >
                  {sq.number !== null ? sq.number : "?"}
                </span>

                {sq.owner_name && (
                  <span className="text-[10px] text-zinc-400 mt-1.5 truncate w-full text-center px-2 font-medium">
                    {sq.owner_name}
                  </span>
                )}

                {isOwned && !isWinner && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider font-extrabold bg-green-600 text-white px-1.5 py-0.5 rounded-md">
                    Mine
                  </span>
                )}

                {isWinner && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider font-extrabold bg-yellow-500 text-black px-1.5 py-0.5 rounded-md">
                    Win
                  </span>
                )}

                {isPurchasing && (
                  <span className="absolute inset-0 bg-zinc-950/90 rounded-2xl flex items-center justify-center text-xs text-blue-400 font-bold gap-2">
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
        <p className="text-center text-zinc-500 text-xs">
          Please{" "}
          <Link to="/auth" className="text-blue-400 hover:text-blue-300 font-semibold underline">
            sign in
          </Link>{" "}
          to buy a square.
        </p>
      )}

      {/* Potential payout info */}
      {board_status === "open" && (
        <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 text-center text-xs text-zinc-500">
          <span className="font-semibold text-zinc-300">Potential payout: </span>
          <span className="text-green-400 font-bold font-mono">{formatCents(price_tier * 900)}</span>
          <span className="ml-2">(9× the square price — platform keeps 1×)</span>
        </div>
      )}
    </div>
  );
}
