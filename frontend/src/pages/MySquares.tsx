import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

interface OwnedSquare {
  square_id: string;
  position: number;
  number: number | null;
  board: {
    id: string;
    status: string;
    quarter: string;
    price_tier: number;
    game: {
      id: string;
      home_team: string;
      away_team: string;
    };
  };
  purchased_at: string;
}

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

export default function MySquares() {
  const { user, loading: authLoading } = useAuth();
  const [squares, setSquares] = useState<OwnedSquare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch(`${API}/squares/my-boards`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setSquares(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return <div className="p-8 text-zinc-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-400 mb-4">Sign in to see your squares</p>
        <Link to="/auth" className="text-blue-400 hover:text-blue-300">Sign In</Link>
      </div>
    );
  }

  if (squares.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Squares</h1>
        <p className="text-zinc-400">No squares purchased yet.{" "}
          <Link to="/" className="text-blue-400 hover:text-blue-300">Browse the marketplace</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Squares</h1>
      <div className="grid gap-4">
        {squares.map((sq) => (
          <div key={sq.square_id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {sq.board.game.home_team} vs {sq.board.game.away_team}
              </p>
              <p className="text-sm text-zinc-400">
                {sq.board.quarter} · Board #{sq.board.id.slice(0, 8)} · Position {sq.position}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg">
                {sq.number !== null ? `#${sq.number}` : "Numbers pending"}
              </p>
              <p className="text-sm text-zinc-400">{formatCents(sq.board.price_tier * 100)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
