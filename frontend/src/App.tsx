import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Marketplace from "./pages/Marketplace";
import BoardDetail from "./pages/BoardDetail";
import Auth from "./pages/Auth";
import MySquares from "./pages/MySquares";
import Wallet from "./pages/Wallet";
import CreateBoard from "./pages/CreateBoard";
import { API } from "./config";

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

function Nav() {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (user) {
      fetch(`${API}/wallet/me`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setBalance(d.balance_cents ?? 0))
        .catch(() => setBalance(null));
    } else {
      setBalance(null);
    }
  }, [user]);

  const navLinks = (
    <>
      <Link to="/" className="hover:text-blue-400 transition-colors font-medium">
        Marketplace
      </Link>
      <Link to="/my-squares" className="hover:text-blue-400 transition-colors font-medium">
        My Squares
      </Link>
      {user && (
        <Link to="/create-board" className="hover:text-blue-400 transition-colors font-medium">
          Host Board
        </Link>
      )}
    </>
  );

  return (
    <nav
      ref={navRef}
      className="border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-xl font-black text-white tracking-tight">
          <span className="bg-blue-600 text-white text-xs font-extrabold px-1.5 py-0.5 rounded-md">SB</span>
          <span className="text-blue-400">Squares</span>Board
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-6 text-sm text-zinc-300">
          {navLinks}
        </div>

        {/* Right: balance + user */}
        <div className="flex gap-3 items-center text-sm">
          {user ? (
            <>
              {balance !== null && (
                <Link
                  to="/wallet"
                  className="text-green-400 hover:text-green-300 font-mono bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 hover:border-zinc-600 transition-all text-xs font-bold"
                >
                  {formatCents(balance)}
                </Link>
              )}
              <span className="hidden sm:inline text-zinc-400 text-xs">Hi, {user.display_name}</span>
              <button
                onClick={logout}
                className="hidden sm:inline text-zinc-500 hover:text-red-400 text-xs transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg font-semibold text-sm transition-all shadow-md shadow-blue-950/30"
            >
              Sign In
            </Link>
          )}

          {/* Hamburger button (mobile) */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1.5 items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span
              className={`block w-5 h-0.5 bg-zinc-300 transition-all duration-200 ${
                mobileOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-zinc-300 transition-all duration-200 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-zinc-300 transition-all duration-200 ${
                mobileOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-900 animate-slideDown">
          <div className="px-6 py-4 flex flex-col gap-4 text-sm text-zinc-300">
            {navLinks}
            {user ? (
              <>
                <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
                  <span className="text-zinc-400">Hi, <span className="text-white font-semibold">{user.display_name}</span></span>
                  <button onClick={logout} className="text-zinc-500 hover:text-red-400 text-xs transition-colors">
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="border-t border-zinc-800 pt-4">
                <Link
                  to="/auth"
                  className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all"
                >
                  Sign In / Sign Up
                </Link>
              </div>
            )}
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
          <div className="min-h-screen bg-zinc-900 text-white">
            <Nav />
            <Routes>
              <Route path="/" element={<Marketplace />} />
              <Route path="/board/:boardId" element={<BoardDetail />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-squares" element={<MySquares />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/create-board" element={<CreateBoard />} />
            </Routes>
          </div>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
