import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";

export default function Auth() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "signup" ? "auth/signup" : "auth/login";
    const body =
      mode === "signup"
        ? { email, password, display_name: displayName }
        : { email, password };

    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Something went wrong");
        return;
      }

      if (data.token) {
        localStorage.setItem("sb_token", data.token);
      }

      await refresh();
      window.location.hash = "#/";
    } catch (err: any) {
      console.error("Auth submit failed:", err);
      setError(`Connection failed: ${err?.message || "Network error"} (${endpoint})`);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode: "login" | "signup") {
    setMode(newMode);
    setError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
  }

  return (
    <div className="flex min-h-[88vh]">
      {/* Left panel — brand (desktop only) */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-16 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/60 via-surface-950 to-sweep-950/30 pointer-events-none" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-60 h-60 bg-sweep-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-950/40">
              <span className="text-white text-lg font-black">SB</span>
            </div>
            <span className="text-2xl font-black text-white">
              <span className="text-brand-400">Squares</span>Board
            </span>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
            Pick your square.
            <br />
            <span className="text-gradient-brand">Win big.</span>
          </h2>

          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            The premium sports squares marketplace. Join live boards for NFL, NBA, and MLB games. Claim your square and compete for 9× the pot.
          </p>

          {/* Trust signals */}
          <div className="flex items-center gap-6 pt-4">
            <div className="text-center">
              <div className="text-2xl font-black text-white font-mono">10</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Squares per board</div>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div className="text-center">
              <div className="text-2xl font-black text-coin-400 font-mono">9×</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Winner payout</div>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div className="text-center">
              <div className="text-2xl font-black text-sweep-400 font-mono">3</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Sports leagues</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex items-center justify-center flex-1 px-4 py-12">
        <div className="w-full max-w-[400px] animate-fadeIn">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-4 shadow-xl shadow-brand-950/40">
              <span className="text-white text-lg font-black">SB</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">SquaresBoard</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {mode === "login" ? "Welcome back" : "Join the action"}
            </p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {mode === "login"
                ? "Sign in to continue playing"
                : "Start winning in under 60 seconds"}
            </p>
          </div>

          {/* Card */}
          <div className="relative glass rounded-2xl p-7 card-highlight">
            {/* Glow accent */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/[0.08] via-transparent to-sweep-500/[0.04] pointer-events-none" />

            <div className="relative">
              {/* Mode tabs */}
              <div className="flex gap-1 bg-surface-950/70 rounded-xl p-1 mb-6">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    mode === "login"
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-950/40"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    mode === "signup"
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-950/40"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-surface-950 border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                      placeholder="raptor2686"
                      autoComplete="username"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-950 border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-surface-950 border border-white/[0.06] rounded-xl px-4 py-3 pr-11 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                      placeholder="••••••••"
                      minLength={8}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-950/60 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 animate-fadeIn">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-950/30 hover:shadow-brand-500/20 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Please wait...
                    </>
                  ) : mode === "login" ? (
                    "Sign In →"
                  ) : (
                    "Create Account →"
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-zinc-600 mt-5 leading-relaxed">
                By continuing you agree to our terms.{" "}
                {mode === "signup" && "Must be 18+ to participate. "}
                <a href="#/rules" className="text-brand-400/60 hover:text-brand-400 transition-colors">
                  Official Rules
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
