import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";

interface Game {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  event_time: string;
  status: string;
}

const PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export default function CreateBoard() {
  const { user, loading: authLoading } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const [selectedGameId, setSelectedGameId] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedPrice, setSelectedPrice] = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);

  const [error, setError] = useState("");
  const [createdBoard, setCreatedBoard] = useState<{ id: string; share_link: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/games`)
      .then((r) => r.json())
      .then((data) => {
        // filter only upcoming or live games
        const activeGames = data.filter((g: Game) => g.status !== "completed");
        setGames(activeGames);
        if (activeGames.length > 0) {
          setSelectedGameId(activeGames[0].id);
        }
        setLoadingGames(false);
      })
      .catch(() => {
        setLoadingGames(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGameId) {
      setError("Please select a game first.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const params = new URLSearchParams({
        game_id: selectedGameId,
        quarter: selectedQuarter,
        price_tier: String(selectedPrice),
        is_private: String(isPrivate),
      });

      const res = await fetch(`${API}/boards/?${params}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create board");
      }

      setCreatedBoard(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the board.");
    } finally {
      setSubmitting(false);
    }
  }

  function getInviteUrl() {
    if (!createdBoard) return "";
    const base = window.location.origin + window.location.pathname + "#/board/" + createdBoard.id;
    if (createdBoard.share_link) {
      return `${base}?invite=${createdBoard.share_link}`;
    }
    return base;
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(getInviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (authLoading) return <div className="p-8 text-center text-zinc-400">Loading...</div>;

  if (!user) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3">Sign In Required</h2>
          <p className="text-zinc-400 mb-6">You must be logged in to host or create a board.</p>
          <a
            href="#/auth"
            className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-all"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
        Create a New Board
      </h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {createdBoard ? (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/40 text-green-400 mb-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Board Created Successfully!</h2>
            <p className="text-zinc-400 text-sm mt-2">
              Your {isPrivate ? "private" : "public"} board for {selectedQuarter} is ready.
            </p>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-4 border border-zinc-800">
            <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider text-left mb-2">
              Board Link
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={getInviteUrl()}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono flex-1 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-all"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <a
              href={`#/board/${createdBoard.id}`}
              className="flex-1 text-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 rounded-xl transition-all"
            >
              Go to Board Details
            </a>
            <button
              onClick={() => setCreatedBoard(null)}
              className="flex-1 text-center border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-medium py-2.5 rounded-xl transition-all"
            >
              Create Another Board
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Game selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Select Game</label>
              {loadingGames ? (
                <div className="text-zinc-500 text-sm">Loading upcoming games...</div>
              ) : games.length === 0 ? (
                <div className="text-zinc-500 text-sm">No active or upcoming games found.</div>
              ) : (
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      [{g.sport.toUpperCase()}] {g.away_team} vs {g.home_team} ({new Date(g.event_time).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Quarter selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Quarter / Period</label>
              <div className="grid grid-cols-4 gap-2">
                {QUARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSelectedQuarter(q)}
                    className={`py-2 rounded-lg font-medium text-sm transition-all border ${
                      selectedQuarter === q
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold"
                        : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Price tier selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Price Tier per Square</label>
              <div className="grid grid-cols-5 gap-2">
                {PRICE_TIERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPrice(p)}
                    className={`py-2 rounded-lg font-mono text-xs transition-all border ${
                      selectedPrice === p
                        ? "bg-green-600/20 border-green-500 text-green-300 font-bold"
                        : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>

            {/* Private toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/60 rounded-xl border border-zinc-700/50">
              <div>
                <span className="block font-medium text-sm text-zinc-200">Private Board</span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  Only accessible via a direct link. Won't appear in public marketplace.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 text-sm uppercase tracking-wider"
            >
              {submitting ? "Creating Board..." : "Create Board"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
