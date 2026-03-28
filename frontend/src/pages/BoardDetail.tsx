import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

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
  squares: Square[];
}

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  event_time: string;
  home_score?: number;
  away_score?: number;
  status: string;
}

export default function BoardDetail() {
  const { boardId } = useParams();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [currentUserId] = useState<string>(""); // TODO: from auth context

  useEffect(() => {
    fetch(`http://localhost:8000/api/squares/board/${boardId}`)
      .then((r) => r.json())
      .then(setBoard)
      .catch(console.error);
  }, [boardId]);

  const handleBuySquare = async (position: number) => {
    if (!board || board.board_status !== "open") return;
    try {
      const res = await fetch(`/api/squares/board/${boardId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, user_id: currentUserId }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/squares/board/${boardId}`).then((r) => r.json());
        setBoard(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!board) return <div className="p-8 text-center text-zinc-400">Loading...</div>;

  const { board_status, squares } = board;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Board</h1>
      <div className="text-sm text-zinc-400 mb-6">
        Status: <span className="capitalize text-white">{board_status}</span>
      </div>

      {/* Square Grid */}
      <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
        <div className="text-center text-xs text-zinc-500 mb-4 uppercase tracking-wider">
          10 Squares — Numbers assigned when board fills
        </div>

        <div className="grid grid-cols-5 gap-3">
          {squares.map((sq) => {
            const isAvailable = !sq.owner_id;
            const isOwned = sq.owner_id === currentUserId;
            return (
              <button
                key={sq.id}
                onClick={() => isAvailable && handleBuySquare(sq.position)}
                disabled={!isAvailable || board_status !== "open"}
                className={`
                  relative h-24 rounded-lg border-2 flex flex-col items-center justify-center
                  transition-all text-sm font-semibold
                  ${isAvailable && board_status === "open"
                    ? "border-blue-500 bg-blue-950 hover:bg-blue-900 cursor-pointer"
                    : sq.owner_id
                    ? "border-zinc-600 bg-zinc-700 cursor-default"
                    : "border-zinc-700 bg-zinc-800"
                  }
                  ${isOwned ? "ring-2 ring-green-500" : ""}
                `}
              >
                {sq.number !== null ? (
                  <span className="text-3xl font-bold text-white">{sq.number}</span>
                ) : (
                  <span className="text-zinc-600 text-xl">?</span>
                )}
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
              </button>
            );
          })}
        </div>
      </div>

      {board_status === "open" && (
        <p className="text-center text-zinc-400 text-sm mt-4">
          Click an open square to buy it
        </p>
      )}
      {board_status === "locked" && (
        <p className="text-center text-zinc-400 text-sm mt-4">
          Board is locked — waiting for quarter to end
        </p>
      )}
      {board_status === "resolved" && (
        <p className="text-center text-green-400 text-sm mt-4">
          Winner determined — payout processing
        </p>
      )}
    </div>
  );
}
