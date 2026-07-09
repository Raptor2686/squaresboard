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

      await refresh();
      window.location.hash = "#/";
    } catch {
      setError("Network error — is the backend running?");
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
    <div className="flex items-center justify-center min-h-[88vh] px-4">
      <div className="w-full max-w-sm">

        {/* Branded header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 mb-4 shadow-xl shadow-blue-950/30">
            <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SquaresBoard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {mode === "login" ? "Welcome back. Let's get you in." : "Join the action. Win real money."}
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-800/70 border border-zinc-700/80 rounded-2xl p-8 shadow-2xl shadow-zinc-950/50 backdrop-blur-sm">

          {/* Glow accent */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/5 pointer-events-none" />

          {/* Mode tabs */}
          <div className="flex gap-1 bg-zinc-900/70 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="raptor2686"
                  autoComplete="username"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
              <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2.5 rounded-xl text-sm flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-950/30 flex items-center justify-center gap-2 mt-2"
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
              ) : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <p className="text-center text-xs text-zinc-500 mt-4">
              By signing in you agree to our terms. Gambling features require you to be 18+.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
