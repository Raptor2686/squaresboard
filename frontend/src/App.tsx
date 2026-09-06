import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth, getAuthHeaders } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Marketplace from "./pages/Marketplace";
import GameDetail from "./pages/GameDetail";
import BoardDetail from "./pages/BoardDetail";
import Auth from "./pages/Auth";
import MySquares from "./pages/MySquares";
import Wallet from "./pages/Wallet";
import CreateBoard from "./pages/CreateBoard";
import Sandbox from "./pages/Sandbox";
import OfficialRules from "./pages/OfficialRules";
import { API } from "./config";

function formatGC(n: number) {
  return (n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)) + " GC";
}
function formatSC(n: number) {
  return (n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)) + " SC";
}

function Nav() {
  const { user, logout } = useAuth();
  const [goldCoins, setGoldCoins] = useState<number | null>(null);
  const [sweepCoins, setSweepCoins] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  // Track scroll for nav background intensity
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    if (user) {
      fetch(`${API}/wallet/me`, {
        credentials: "include",
        headers: getAuthHeaders(),
      })
        .then((r) => r.json())
        .then((d) => {
          setGoldCoins(d.gold_coins ?? 0);
          setSweepCoins(d.sweep_coins ?? 0);
        })
        .catch(() => {
          setGoldCoins(null);
          setSweepCoins(null);
        });
    } else {
      setGoldCoins(null);
      setSweepCoins(null);
    }
  }, [user]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string) =>
    `relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
      isActive(path)
        ? "text-white bg-white/[0.06]"
        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
    }`;

  const navLinks = (
    <>
      <Link to="/" className={navLinkClass("/")}>
        Marketplace
      </Link>
      <Link to="/my-squares" className={navLinkClass("/my-squares")}>
        My Squares
      </Link>
      {user && (
        <Link to="/create-board" className={navLinkClass("/create-board")}>
          Host Board
        </Link>
      )}
      <Link
        to="/sandbox"
        className="relative px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 text-amber-400 hover:text-amber-300 hover:bg-amber-500/[0.06] flex items-center gap-1"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
        Sandbox
      </Link>
    </>
  );

  return (
    <nav
      ref={navRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-strong shadow-lg shadow-black/20"
          : "bg-surface-950/80 backdrop-blur-md"
      }`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-950/40 group-hover:shadow-brand-500/20 transition-all duration-300">
            <span className="text-white text-xs font-black tracking-tight">SB</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />
          </div>
          <span className="text-lg font-black text-white tracking-tight hidden sm:block">
            <span className="text-brand-400">Squares</span>Board
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks}
        </div>

        {/* Right: balance + user */}
        <div className="flex gap-2 items-center">
          {user ? (
            <>
              {/* Coin Balances */}
              <div className="hidden sm:flex items-center gap-1.5">
                {goldCoins !== null && (
                  <Link
                    to="/wallet"
                    className="group flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1.5 rounded-xl bg-coin-950/40 border border-coin-800/30 text-coin-400 hover:border-coin-600/50 hover:bg-coin-950/60 transition-all duration-200"
                  >
                    <span className="text-sm">🟡</span>
                    <span>{formatGC(goldCoins)}</span>
                  </Link>
                )}
                {sweepCoins !== null && (
                  <Link
                    to="/wallet"
                    className="group flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1.5 rounded-xl bg-sweep-950/40 border border-sweep-800/30 text-sweep-400 hover:border-sweep-600/50 hover:bg-sweep-950/60 transition-all duration-200"
                  >
                    <span className="text-sm">🎟️</span>
                    <span>{formatSC(sweepCoins)}</span>
                  </Link>
                )}
              </div>

              {/* User + Logout */}
              <div className="hidden md:flex items-center gap-3 ml-2 pl-3 border-l border-white/[0.06]">
                <span className="text-zinc-500 text-xs font-medium">
                  {user.display_name}
                </span>
                <button
                  onClick={logout}
                  className="text-zinc-600 hover:text-red-400 text-xs font-medium transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/auth"
              className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-brand-950/30 hover:shadow-brand-500/20"
            >
              Sign In
            </Link>
          )}

          {/* Hamburger button (mobile) */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-[5px] items-center justify-center w-9 h-9 rounded-xl hover:bg-white/[0.04] transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span
              className={`block w-[18px] h-[2px] bg-zinc-300 rounded-full transition-all duration-200 ${
                mobileOpen ? "rotate-45 translate-y-[7px]" : ""
              }`}
            />
            <span
              className={`block w-[18px] h-[2px] bg-zinc-300 rounded-full transition-all duration-200 ${
                mobileOpen ? "opacity-0 scale-0" : ""
              }`}
            />
            <span
              className={`block w-[18px] h-[2px] bg-zinc-300 rounded-full transition-all duration-200 ${
                mobileOpen ? "-rotate-45 -translate-y-[7px]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer — full overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] z-40 animate-fadeIn">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

          {/* Menu panel */}
          <div className="relative bg-surface-900 border-t border-white/[0.04] shadow-2xl">
            <div className="px-6 py-6 flex flex-col gap-2">
              {/* Nav Links */}
              <Link to="/" className={`${navLinkClass("/")} text-base py-3 px-4`}>
                🏆 Marketplace
              </Link>
              <Link to="/my-squares" className={`${navLinkClass("/my-squares")} text-base py-3 px-4`}>
                📋 My Squares
              </Link>
              {user && (
                <Link to="/create-board" className={`${navLinkClass("/create-board")} text-base py-3 px-4`}>
                  ➕ Host Board
                </Link>
              )}
              <Link to="/sandbox" className="text-base py-3 px-4 rounded-lg text-amber-400 font-bold hover:bg-amber-500/[0.06] transition-all">
                ⚡ Sandbox
              </Link>

              {/* Balance cards (mobile) */}
              {user && goldCoins !== null && sweepCoins !== null && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to="/wallet"
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-coin-950/40 border border-coin-800/30"
                  >
                    <span className="text-lg">🟡</span>
                    <span className="font-mono text-xs font-bold text-coin-400">{formatGC(goldCoins)}</span>
                  </Link>
                  <Link
                    to="/wallet"
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-sweep-950/40 border border-sweep-800/30"
                  >
                    <span className="text-lg">🎟️</span>
                    <span className="font-mono text-xs font-bold text-sweep-400">{formatSC(sweepCoins)}</span>
                  </Link>
                </div>
              )}

              {/* User section */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                {user ? (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">
                      Signed in as <span className="text-white font-semibold">{user.display_name}</span>
                    </span>
                    <button
                      onClick={logout}
                      className="text-red-400/80 hover:text-red-400 text-sm font-medium transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    className="block w-full text-center bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold px-4 py-3 rounded-xl transition-all shadow-lg"
                  >
                    Sign In / Sign Up
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <div className="min-h-screen bg-surface-950 text-zinc-200 font-sans">
            <Nav />
            <main className="animate-fadeIn">
              <Routes>
                <Route path="/" element={<Marketplace />} />
                <Route path="/game/:gameId" element={<GameDetail />} />
                <Route path="/board/:boardId" element={<BoardDetail />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/my-squares" element={<MySquares />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/create-board" element={<CreateBoard />} />
                <Route path="/sandbox" element={<Sandbox />} />
                <Route path="/rules" element={<OfficialRules />} />
              </Routes>
            </main>

            {/* Footer */}
            <footer className="relative mt-24">
              {/* Gradient separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Logo + tagline */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                      <span className="text-white text-[10px] font-black">SB</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-zinc-400">
                        <span className="text-brand-400">Squares</span>Board
                      </span>
                      <span className="text-zinc-600 text-xs ml-2">
                        Sports squares, reimagined.
                      </span>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex items-center gap-6 text-xs">
                    <Link
                      to="/rules"
                      className="text-zinc-500 hover:text-brand-400 transition-colors font-medium"
                    >
                      Official Rules
                    </Link>
                    <span className="text-zinc-800">·</span>
                    <span className="text-zinc-600">
                      No Purchase Necessary
                    </span>
                    <span className="text-zinc-800">·</span>
                    <span className="text-zinc-600">
                      © {new Date().getFullYear()}
                    </span>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
