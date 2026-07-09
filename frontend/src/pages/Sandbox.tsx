import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { API } from "../config";

interface Game {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  event_time: string;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
}

interface Board {
  id: string;
  game_id: string;
  quarter: string;
  price_tier: number;
  status: string;
}

export default function Sandbox() {
  const { user, refresh: refreshAuth } = useAuth();
  const { showToast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // New Game Form
  const [homeTeam, setHomeTeam] = useState("Kansas City Chiefs");
  const [awayTeam, setAwayTeam] = useState("Philadelphia Eagles");
  const [sport, setSport] = useState("football");
  const [creatingGame, setCreatingGame] = useState(false);

  // Game Score Forms (keyed by game ID)
  const [scoreHome, setScoreHome] = useState<Record<string, string>>({});
  const [scoreAway, setScoreAway] = useState<Record<string, string>>({});
  const [gameStatus, setGameStatus] = useState<Record<string, string>>({});

  // Board Resolve Forms (keyed by board ID)
  const [resHome, setResHome] = useState<Record<string, string>>({});
  const [resAway, setResAway] = useState<Record<string, string>>({});

  // Action Loading states
  const [loadingAction, setLoadingAction] = useState<Record<string, boolean>>({});

  // Sandbox Credit
  const [creditAmount, setCreditAmount] = useState("100");
  const [crediting, setCrediting] = useState(false);

  async function loadData() {
    try {
      const gRes = await fetch(`${API}/games`);
      const gData = await gRes.json();
      setGames(gData);

      const bRes = await fetch(`${API}/boards/`, { credentials: "include" });
      const bData = await bRes.json();
      setBoards(bData);

      // Initialize form values
      const initialHome: Record<string, string> = {};
      const initialAway: Record<string, string> = {};
      const initialStatus: Record<string, string> = {};
      gData.forEach((g: Game) => {
        initialHome[g.id] = String(g.home_score ?? 0);
        initialAway[g.id] = String(g.away_score ?? 0);
        initialStatus[g.id] = g.status;
      });
      setScoreHome((prev) => ({ ...initialHome, ...prev }));
      setScoreAway((prev) => ({ ...initialAway, ...prev }));
      setGameStatus((prev) => ({ ...initialStatus, ...prev }));

      const initialResHome: Record<string, string> = {};
      const initialResAway: Record<string, string> = {};
      bData.forEach((b: Board) => {
        initialResHome[b.id] = "14";
        initialResAway[b.id] = "10";
      });
      setResHome((prev) => ({ ...initialResHome, ...prev }));
      setResAway((prev) => ({ ...initialResAway, ...prev }));

    } catch {
      showToast("Failed to load sandbox data.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateMockGame(e: React.FormEvent) {
    e.preventDefault();
    setCreatingGame(true);
    try {
      const res = await fetch(`${API}/simulator/games/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam, sport }),
      });
      if (res.ok) {
        showToast("Mock game and Q1/Q2 boards created! 🏈", "success");
        await loadData();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to create mock game", "error");
      }
    } catch {
      showToast("Network error creating game", "error");
    } finally {
      setCreatingGame(false);
    }
  }

  async function handleUpdateGameScore(gameId: string) {
    const home = parseInt(scoreHome[gameId] || "0");
    const away = parseInt(scoreAway[gameId] || "0");
    const status = gameStatus[gameId] || "upcoming";

    setLoadingAction((prev) => ({ ...prev, [gameId]: true }));
    try {
      const res = await fetch(`${API}/simulator/games/${gameId}/update-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_score: home, away_score: away, status }),
      });
      if (res.ok) {
        showToast("Game score & status updated!", "success");
        await loadData();
      } else {
        const d = await res.json();
        showToast(d.detail || "Update failed", "error");
      }
    } catch {
      showToast("Network error updating score", "error");
    } finally {
      setLoadingAction((prev) => ({ ...prev, [gameId]: false }));
    }
  }

  async function handleFillMockPlayers(boardId: string) {
    setLoadingAction((prev) => ({ ...prev, [boardId]: true }));
    try {
      const res = await fetch(`${API}/simulator/boards/${boardId}/fill-mock`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("Board squares filled with test players! 🤖", "success");
        await loadData();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to fill board", "error");
      }
    } catch {
      showToast("Network error filling board", "error");
    } finally {
      setLoadingAction((prev) => ({ ...prev, [boardId]: false }));
    }
  }

  async function handleResolveBoard(boardId: string) {
    const home = parseInt(resHome[boardId] || "0");
    const away = parseInt(resAway[boardId] || "0");

    setLoadingAction((prev) => ({ ...prev, [boardId]: true }));
    try {
      const res = await fetch(`${API}/simulator/boards/${boardId}/resolve-mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_score: home, away_score: away }),
      });
      if (res.ok) {
        showToast("Board resolved and payouts credited! 🏆", "success");
        await loadData();
        await refreshAuth();
      } else {
        const d = await res.json();
        showToast(d.detail || "Resolve failed", "error");
      }
    } catch {
      showToast("Network error resolving board", "error");
    } finally {
      setLoadingAction((prev) => ({ ...prev, [boardId]: false }));
    }
  }

  async function handleAddSandboxBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in first.", "error");
      return;
    }
    const cents = Math.round(parseFloat(creditAmount) * 100);
    setCrediting(true);
    try {
      const res = await fetch(`${API}/simulator/wallet/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount_cents: cents }),
      });
      if (res.ok) {
        showToast(`Credited ${parseFloat(creditAmount).toLocaleString("en-US", { style: "currency", currency: "USD" })} to sandbox wallet! 💸`, "success");
        await refreshAuth();
      } else {
        const d = await res.json();
        showToast(d.detail || "Credit failed", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCrediting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500 animate-pulse">Loading Sandbox Panel...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
            Sandbox
          </span>
          SquaresBoard Simulator
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Simulate full board loops: create mock matches, fill boards with test bots, set custom scores, and trigger payouts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Forms */}
        <div className="space-y-8 lg:col-span-1">
          {/* Quick Credit Sandbox Balance */}
          {user && (
            <div className="bg-zinc-800 border border-zinc-700/60 rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                💵 Sandbox Wallet
              </h2>
              <form onSubmit={handleAddSandboxBalance} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-zinc-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2 pl-8 pr-4 text-white font-bold font-mono focus:border-blue-500 outline-none"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={crediting}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-green-950/20 disabled:opacity-50"
                >
                  {crediting ? "Crediting..." : "Add Sandbox Cash"}
                </button>
              </form>
            </div>
          )}

          {/* Create Match */}
          <div className="bg-zinc-800 border border-zinc-700/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ➕ Create Test Match
            </h2>
            <form onSubmit={handleCreateMockGame} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Away Team
                </label>
                <input
                  type="text"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2 px-3 text-white font-medium focus:border-blue-500 outline-none"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="e.g. Eagles"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Home Team
                </label>
                <input
                  type="text"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2 px-3 text-white font-medium focus:border-blue-500 outline-none"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="e.g. Chiefs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Sport
                </label>
                <select
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2 px-3 text-white focus:border-blue-500 outline-none"
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  <option value="football">🏈 Football</option>
                  <option value="basketball">🏀 Basketball</option>
                  <option value="baseball">⚾ Baseball</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingGame}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50"
              >
                {creatingGame ? "Creating..." : "Create Game & Boards"}
              </button>
            </form>
          </div>
        </div>

        {/* Right columns: Active Games and Resolving Boards */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-zinc-800 pb-2">
            Active Simulator Matches
          </h2>

          {games.length === 0 ? (
            <div className="bg-zinc-800/30 border border-zinc-800 rounded-3xl p-8 text-center text-zinc-500 text-sm">
              No games in system. Use the form on the left to create a test game!
            </div>
          ) : (
            games.map((game) => {
              const gameBoards = boards.filter((b) => b.game_id === game.id);
              const isUpdating = loadingAction[game.id] || false;

              return (
                <div key={game.id} className="bg-zinc-800/50 border border-zinc-700/40 rounded-3xl p-6 space-y-5">
                  {/* Game Details */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-400 capitalize">
                          {game.sport === "football" ? "🏈 Football" : game.sport === "basketball" ? "🏀 Basketball" : "⚾ Baseball"}
                        </span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-xs font-mono text-zinc-500">{game.id.split("-")[0]}</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-1">
                        {game.away_team} vs {game.home_team}
                      </h3>
                    </div>

                    {/* Game State Form */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        placeholder="Away"
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-center text-sm font-mono font-bold"
                        value={scoreAway[game.id] || "0"}
                        onChange={(e) => setScoreAway({ ...scoreAway, [game.id]: e.target.value })}
                      />
                      <span className="text-zinc-500 font-bold font-mono">–</span>
                      <input
                        type="number"
                        placeholder="Home"
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-center text-sm font-mono font-bold"
                        value={scoreHome[game.id] || "0"}
                        onChange={(e) => setScoreHome({ ...scoreHome, [game.id]: e.target.value })}
                      />
                      <select
                        className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-xs text-zinc-300 outline-none"
                        value={gameStatus[game.id] || "upcoming"}
                        onChange={(e) => setGameStatus({ ...gameStatus, [game.id]: e.target.value })}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="live">Live</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => handleUpdateGameScore(game.id)}
                        disabled={isUpdating}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        {isUpdating ? "Saving..." : "Update"}
                      </button>
                    </div>
                  </div>

                  {/* Boards for this Game */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Game Boards
                    </h4>
                    {gameBoards.length === 0 ? (
                      <div className="text-zinc-500 text-xs italic">
                        No boards exist for this game.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {gameBoards.map((board) => {
                          const isBoardAction = loadingAction[board.id] || false;
                          return (
                            <div key={board.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <Link to={`/board/${board.id}`} className="font-bold text-sm text-zinc-200 hover:text-blue-400 transition-colors">
                                    {board.quarter} Board
                                  </Link>
                                  <span className="block text-xs text-zinc-500 mt-0.5">
                                    Price: <span className="font-mono text-zinc-400">${board.price_tier.toFixed(2)}</span>
                                  </span>
                                </div>
                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                                  board.status === "open"
                                    ? "bg-blue-950/40 text-blue-400 border-blue-800/40"
                                    : board.status === "locked"
                                    ? "bg-amber-950/40 text-amber-400 border-amber-800/40"
                                    : board.status === "resolved"
                                    ? "bg-green-950/40 text-green-400 border-green-800/40"
                                    : "bg-red-950/40 text-red-400 border-red-800/40"
                                }`}>
                                  {board.status}
                                </span>
                              </div>

                              {/* Board Actions */}
                              <div className="border-t border-zinc-800/80 pt-3 flex flex-col gap-2">
                                {board.status === "open" && (
                                  <button
                                    onClick={() => handleFillMockPlayers(board.id)}
                                    disabled={isBoardAction}
                                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-bold py-2 rounded-xl transition-all disabled:opacity-50"
                                  >
                                    {isBoardAction ? "Filling..." : "🤖 Fill with Test Players"}
                                  </button>
                                )}

                                {board.status === "locked" && (
                                  <div className="space-y-2">
                                    <span className="block text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                                      Resolve Match Score
                                    </span>
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        placeholder="Away"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-center text-xs font-mono py-1.5"
                                        value={resAway[board.id] || "0"}
                                        onChange={(e) => setResAway({ ...resAway, [board.id]: e.target.value })}
                                      />
                                      <input
                                        type="number"
                                        placeholder="Home"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-center text-xs font-mono py-1.5"
                                        value={resHome[board.id] || "0"}
                                        onChange={(e) => setResHome({ ...resHome, [board.id]: e.target.value })}
                                      />
                                    </div>
                                    <button
                                      onClick={() => handleResolveBoard(board.id)}
                                      disabled={isBoardAction}
                                      className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-green-950/20"
                                    >
                                      {isBoardAction ? "Resolving..." : "🏆 Resolve & Credit Winner"}
                                    </button>
                                  </div>
                                )}

                                {board.status === "resolved" && (
                                  <span className="text-[10px] text-zinc-500 text-center font-medium italic py-1">
                                    Payout complete.
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
