import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

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
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadBoard() {
    try {
      const res = await fetch(`${API}/squares/board/${boardId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Board not found");
      const data = await res.json();
      setBoard(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, [boardId]);

  async function handleBuySquare(position: number) {
    if (!user) { window.location.href = "/auth"; return; }
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
        setError(data.detail || "Purchase failed");
        return;
      }
      await loadBoard(); // refresh board state
    } catch (e) {
      setError("Network error");
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading...</div>;
  if (error && !board) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!board) return null;

  const { board_status, squares, game, price_tier, quarter } = board;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Game info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {game.home_team} vs {game.away_team}
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {quarter} · {new Date(game.event_time).toLocaleString()} ·{" "}
          {game.home_score !== null ? `${game.home_score}–${game.away_score}` : "Upcoming"}
        </p>
      </div>

      {/* Status badge */}
      <div className="mb-4 flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          board_status === "open" ? "bg-blue-900 text-blue-300" :
          board_status === "locked" ? "bg-yellow-900 text-yellow-300" :
          board_status === "resolved" ? "bg-green-900 text-green-300" :
          "bg-zinc-800 text-zinc-400"
        }`}>
          {board_status.toUpperCase()}
        </span>
        <span className="text-zinc-400 text-sm">{formatCents(price_tier * 100)} per square</span>
      </div>

      {/* Square Grid */}
      <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
        <div className="text-center text-xs text-zinc-500 mb-4 uppercase tracking-wider">
          {board_status === "open" ? "Click an open square to buy" : "Numbers locked — waiting for result"}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="grid grid-cols-5 gap-3">
          {squares.map((sq) => {
            const isAvailable = !sq.owner_id && board_status === "open";
            const isOwned = sq.owner_id === user?.id;
            const isPurchasing = purchasing === sq.position;

            return (
              <button
                key={sq.id}
                onClick={() => isAvailable && handleBuySquare(sq.position)}
                disabled={!isAvailable || isPurchasing}
                className={`
                  relative h-24 rounded-lg border-2 flex flex-col items-center justify-center
                  transition-all text-sm font-semibold
                  ${isOwned ? "border-green-500 bg-green-950 ring-2 ring-green-500" :
                    isAvailable ? "border-blue-500 bg-blue-950 hover:bg-blue-900 cursor-pointer" :
                    "border-zinc-700 bg-zinc-700 cursor-default"
                  }
                `}
              >
                <span className={`text-3xl font-bold ${sq.number !== null ? "text-white" : "text-zinc-600"}`}>
                  {sq.number !== null ? sq.number : "?"}
                </span>
                {sq.owner_name && (
                  <span className="text-xs text-zinc-400 mt-1 truncate w-full text-center px-1">
                    {sq.owner_name}
                  </span>
                )}
                {isOwned && (
                  <span className="absolute top-1 right-1 text-xs bg-green-600 text-white px-1 rounded">
                    You
                  </span>
                )}
                {isPurchasing && (
                  <span className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center text-xs">
                    Buying...
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {board_status === "open" && !user && (
        <p className="text-center text-zinc-400 text-sm mt-4">
          <a href="/auth" className="text-blue-400 hover:text-blue-300">Sign in</a> to buy a square
        </p>
      )}
    </div>
  );
}
