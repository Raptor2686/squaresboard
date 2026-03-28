import { useState, useEffect } from "react";

const PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const SPORTS = ["football", "basketball", "baseball"];

interface Game {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  event_time: string;
  home_team_logo?: string;
  away_team_logo?: string;
  status: string;
}

interface Board {
  id: string;
  game_id: string;
  quarter: string;
  price_tier: number;
  status: string;
}

export default function Marketplace() {
  const [sport, setSport] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [games, setGames] = useState<Game[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("");

  useEffect(() => {
    fetch("http://localhost:8000/api/games")
      .then((r) => r.json())
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (selectedGame) params.set("game_id", selectedGame);
    if (quarter) params.set("quarter", quarter);
    if (price) params.set("price_tier", String(price));
    fetch(`http://localhost:8000/api/boards/?${params}`)
      .then((r) => r.json())
      .then(setBoards)
      .catch(() => setBoards([]));
  }, [sport, quarter, price, selectedGame]);

  const filteredBoards = boards.filter((b) => b.status === "open" || b.status === "locked");

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Game Marketplace</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <select
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option value="">All Sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
        >
          <option value="">All Quarters</option>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
        <select
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        >
          <option value={0}>All Prices</option>
          {PRICE_TIERS.map((p) => (
            <option key={p} value={p}>${p}</option>
          ))}
        </select>
      </div>

      {/* Boards Grid */}
      {filteredBoards.length === 0 ? (
        <div className="text-zinc-400 text-center py-16 text-lg">
          No open boards match your filters. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((board) => {
            const game = games.find((g) => g.id === board.game_id);
            return (
              <a
                key={board.id}
                href={`/board/${board.id}`}
                className="block bg-zinc-800 border border-zinc-700 rounded-xl p-5 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  {game?.away_team_logo && (
                    <img src={game.away_team_logo} className="w-8 h-8 rounded-full object-cover" alt="" />
                  )}
                  <span className="font-semibold">{game?.away_team ?? "Loading..."}</span>
                  <span className="text-zinc-500 text-sm">vs</span>
                  <span className="font-semibold">{game?.home_team ?? "..."}</span>
                  {game?.home_team_logo && (
                    <img src={game.home_team_logo} className="w-8 h-8 rounded-full object-cover" alt="" />
                  )}
                </div>
                <div className="flex justify-between text-sm text-zinc-400">
                  <span className="bg-zinc-700 px-2 py-0.5 rounded">{board.quarter}</span>
                  <span className="text-green-400 font-semibold">${board.price_tier}/square</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {game?.event_time ? new Date(game.event_time).toLocaleString() : "TBD"}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
