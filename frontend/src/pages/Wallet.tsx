import { useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "../context/AuthContext";
import { API } from "../config";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  currency: string;
  reference_id: string | null;
  created_at: string;
}

interface WalletData {
  user_id: string;
  display_name: string;
  gold_coins: number;
  sweep_coins: number;
  can_claim_free_sc: boolean;
  free_sc_amount: number;
  transactions: Transaction[];
}

interface Bundle {
  id: string;
  price_cents: number;
  gold_coins: number;
  bonus_sc: number;
  label: string;
  bonus: string;
}

function formatGC(n: number) {
  return (n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)) + " GC";
}
function formatSC(n: number) {
  return (n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)) + " SC";
}
function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function calculateCustomPreview(amount: number) {
  if (!amount || isNaN(amount) || amount < 1) return null;
  const dollars = amount;
  const total_gc = Math.round(dollars * 100);
  const bonus_sc = Math.round(dollars * 100) / 100;
  return {
    total_gc,
    bonus_gc: 0,
    bonus_sc,
  };
}

const TX_ICONS: Record<string, string> = {
  purchase: "🟡",
  bonus: "🎁",
  square_buy: "🎲",
  square_win: "🏆",
  refund: "↩️",
  free_claim: "🎟️",
  redeem: "💸",
};

export default function Wallet() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("25");
  const [customAmount, setCustomAmount] = useState("25");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const redirectStatus = queryParams.get("redirect_status");
    if (redirectStatus === "succeeded") {
      setSuccess("🎉 Purchase successful! Gold Coins have been added to your wallet.");
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  async function loadWallet() {
    try {
      const [walletRes, bundleRes] = await Promise.all([
        fetch(`${API}/wallet/me`, { credentials: "include", headers: getAuthHeaders() }),
        fetch(`${API}/wallet/bundles`, { credentials: "include" }),
      ]);
      if (!walletRes.ok) throw new Error("Could not load wallet data");
      const walletData = await walletRes.json();
      const bundleData = await bundleRes.json();
      setWallet(walletData);
      setBundles(bundleData);
    } catch (e) {
      setError("Failed to fetch wallet info.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadWallet();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  async function handleBuyBundle(bundle: Bundle) {
    setError("");
    setSuccess("");
    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/buy-coins?bundle_id=${bundle.id}`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to initiate purchase");
      setSelectedBundle(bundle);
      setClientSecret(data.client_secret);
      setStripePromise(loadStripe(data.publishable_key));
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleBuyCustom() {
    setError("");
    setSuccess("");
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed < 1) {
      setError("Please enter a valid amount of at least $1.00.");
      return;
    }
    if (parsed > 10000) {
      setError("Maximum purchase amount is $10,000.00.");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/buy-coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ custom_amount: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to initiate purchase");
      setSelectedBundle(data.bundle);
      setClientSecret(data.client_secret);
      setStripePromise(loadStripe(data.publishable_key));
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleClaimFreeSC() {
    setError("");
    setSuccess("");
    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/claim-free-sc`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Claim failed");
      setSuccess(`🎟️ Claimed ${data.sweep_coins_granted} free Sweepstakes Coins!`);
      await loadWallet();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const amount = parseInt(redeemAmount);
    if (isNaN(amount) || amount < 25) {
      setError("Minimum redemption is 25 SC ($25).");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/redeem-sc?amount=${amount}`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Redemption failed");
      setSuccess(data.message);
      await loadWallet();
    } catch (err: any) {
      setError(err.message || "An error occurred during redemption.");
    } finally {
      setProcessing(false);
    }
  }

  const customPreview = calculateCustomPreview(parseFloat(customAmount));

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 skeleton" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center max-w-md mx-auto animate-fadeIn">
        <div className="glass rounded-2xl p-8 card-highlight">
          <div className="text-4xl mb-3">💰</div>
          <h2 className="text-xl font-bold mb-2 text-white">Sign In Required</h2>
          <p className="text-zinc-500 mb-6 text-sm">You must be logged in to view your wallet.</p>
          <a
            href="#/auth"
            className="block w-full text-center bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-brand-950/30"
          >
            Sign In / Sign Up
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gradient-gold inline-block">My Wallet</h1>
        <p className="text-xs text-zinc-600 mt-1">
          🏆 No Purchase Necessary — Claim free Sweepstakes Coins daily. See{" "}
          <a href="#/rules" className="text-brand-400/70 underline hover:text-brand-400 transition-colors">Official Rules</a>.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm animate-fadeIn flex items-center gap-2.5">
          <span>❌</span> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl text-sm animate-fadeIn flex items-center gap-2.5">
          <span>✅</span> {success}
        </div>
      )}

      {/* Dual Balance Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GC Card */}
        <div className="relative overflow-hidden rounded-2xl p-6 card-highlight" style={{ background: "linear-gradient(135deg, rgba(69,28,2,0.25), rgba(13,20,20,0.9))" }}>
          <div className="absolute top-4 right-4 text-5xl opacity-10">🟡</div>
          <div className="absolute inset-0 border border-coin-500/10 rounded-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-coin-500">Gold Coins</span>
            <p className="text-[11px] text-zinc-600 mt-0.5 mb-3">Used to enter boards. No cash value.</p>
            <h2 className="text-4xl font-black font-mono text-coin-400 tabular-nums animate-count-up">
              {wallet ? formatGC(wallet.gold_coins) : "0 GC"}
            </h2>
          </div>
        </div>

        {/* SC Card */}
        <div className="relative overflow-hidden rounded-2xl p-6 card-highlight" style={{ background: "linear-gradient(135deg, rgba(59,7,100,0.25), rgba(13,14,20,0.9))" }}>
          <div className="absolute top-4 right-4 text-5xl opacity-10">🎟️</div>
          <div className="absolute inset-0 border border-sweep-500/10 rounded-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-sweep-500">Sweepstakes Coins</span>
            <p className="text-[11px] text-zinc-600 mt-0.5 mb-3">Won on boards. Redeemable for prizes.</p>
            <h2 className="text-4xl font-black font-mono text-sweep-300 tabular-nums animate-count-up">
              {wallet ? formatSC(wallet.sweep_coins) : "0 SC"}
            </h2>
            {wallet?.can_claim_free_sc && (
              <button
                onClick={handleClaimFreeSC}
                disabled={processing}
                className="mt-4 w-full bg-gradient-to-r from-sweep-600 to-sweep-500 hover:from-sweep-500 hover:to-sweep-400 text-white text-sm font-bold py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-sweep-950/30 flex items-center justify-center gap-2"
              >
                <span className="text-base">🎁</span>
                Claim {wallet.free_sc_amount} Free SC
              </button>
            )}
            {wallet && !wallet.can_claim_free_sc && (
              <p className="mt-4 text-[11px] text-zinc-600">Free coins claimed — come back tomorrow!</p>
            )}
          </div>
        </div>
      </div>

      {/* Buy Gold Coins */}
      <div className="glass rounded-2xl p-6 card-highlight space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              🟡 Buy Gold Coins
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Choose a package or enter a custom amount. Bonus SC included!</p>
          </div>
          <span className="text-[10px] font-bold text-coin-400 bg-coin-950/40 border border-coin-800/20 px-3 py-1.5 rounded-full w-fit">
            $1 = 100 GC + Free SC
          </span>
        </div>

        {clientSecret && stripePromise ? (
          <div className="bg-surface-950 border border-white/[0.06] rounded-2xl p-6 animate-fadeIn">
            <p className="text-sm text-zinc-300 mb-4 font-medium">
              Completing purchase: <span className="text-coin-400 font-bold">{selectedBundle?.label}</span> for{" "}
              <span className="text-white font-bold">{selectedBundle ? formatUSD(selectedBundle.price_cents) : ""}</span>
              {selectedBundle && selectedBundle.bonus_sc > 0 && (
                <span className="ml-2 text-xs text-sweep-400 font-semibold">(+{selectedBundle.bonus_sc.toLocaleString()} 🎟️ SC)</span>
              )}
            </p>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm onCancel={() => { setClientSecret(""); setSelectedBundle(null); }} />
            </Elements>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Bundle Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {bundles.map((bundle, idx) => (
                <button
                  key={bundle.id}
                  onClick={() => handleBuyBundle(bundle)}
                  disabled={processing}
                  className="group relative flex flex-col items-center justify-center bg-surface-900/80 border border-white/[0.04] hover:border-coin-500/40 rounded-xl p-4 transition-all duration-200 disabled:opacity-50 gap-0.5 card-highlight hover:shadow-glow-gold hover:scale-[1.03] animate-fadeIn"
                  style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: "both" }}
                >
                  {bundle.bonus && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-coin-400 to-coin-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
                      {bundle.bonus}
                    </span>
                  )}
                  <span className="text-2xl mb-1">🟡</span>
                  <span className="font-bold text-coin-400 text-sm">{bundle.label}</span>
                  <span className="text-white font-semibold text-xs mt-0.5">{formatUSD(bundle.price_cents)}</span>
                  {bundle.bonus_sc > 0 && (
                    <span className="mt-1.5 text-[9px] font-bold text-sweep-400 bg-sweep-950/40 border border-sweep-800/20 px-2 py-0.5 rounded-full">
                      +{bundle.bonus_sc.toLocaleString()} 🎟️ SC
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Custom Purchase */}
            <div className="relative overflow-hidden rounded-xl p-5" style={{ background: "linear-gradient(135deg, rgba(13,14,20,0.95), rgba(69,28,2,0.08))" }}>
              <div className="absolute inset-0 border border-white/[0.04] rounded-xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✨</span> Custom Purchase Amount
                  </span>
                  <span className="text-[10px] text-zinc-600">Min $1 · Max $10,000</span>
                </div>

                {/* Quick Pick Chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {["15", "25", "75", "250", "500"].map((quickVal) => (
                    <button
                      key={quickVal}
                      type="button"
                      onClick={() => setCustomAmount(quickVal)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 ${
                        customAmount === quickVal
                          ? "bg-coin-500/15 border-coin-500/40 text-coin-400"
                          : "bg-surface-900 border-white/[0.04] text-zinc-500 hover:border-white/[0.08] hover:text-zinc-300"
                      }`}
                    >
                      ${quickVal}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-surface-950 border border-white/[0.06] rounded-xl pl-8 pr-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-coin-500/50 focus:ring-1 focus:ring-coin-500/20 text-base transition-all duration-200"
                    />
                  </div>

                  <div className="bg-surface-950/80 border border-white/[0.04] rounded-xl px-4 py-2.5 flex flex-col justify-center">
                    <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                      <span>You Receive:</span>
                      {customPreview && customPreview.bonus_gc > 0 && (
                        <span className="text-coin-500 font-bold text-[10px]">+{customPreview.bonus_gc.toLocaleString()} Bonus</span>
                      )}
                    </div>
                    <div className="font-bold text-coin-400 text-sm font-mono mt-0.5 tabular-nums">
                      {customPreview ? `${customPreview.total_gc.toLocaleString()} 🟡 GC` : "0 GC"}
                    </div>
                    <div className="text-[11px] text-sweep-400 font-semibold font-mono mt-0.5 tabular-nums">
                      {customPreview && customPreview.bonus_sc > 0 ? `+${customPreview.bonus_sc.toLocaleString()} 🎟️ SC Bonus` : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyCustom}
                    disabled={processing || !customPreview}
                    className="w-full bg-gradient-to-r from-coin-400 to-coin-500 hover:from-coin-300 hover:to-coin-400 text-black font-black py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-coin-950/20 disabled:opacity-50 text-sm"
                  >
                    {processing ? "Processing..." : `Buy for $${customAmount || 0}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Redeem SC */}
      <div className="glass rounded-2xl p-6 card-highlight">
        <h3 className="font-black text-lg mb-1 text-white flex items-center gap-2">
          🎟️ Redeem Sweepstakes Coins
        </h3>
        <p className="text-xs text-zinc-500 mb-5">
          Redeem for gift cards, merch, or other prizes. Minimum 25 SC ($25). Processing takes 3-5 business days.
        </p>
        <form onSubmit={handleRedeem} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Amount (SC)
            </label>
            <input
              type="number"
              min="25"
              step="5"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              className="w-full bg-surface-950 border border-white/[0.06] rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-sweep-500/50 focus:ring-1 focus:ring-sweep-500/20 transition-all duration-200"
            />
          </div>
          <button
            type="submit"
            disabled={processing}
            className="bg-gradient-to-r from-sweep-600 to-sweep-500 hover:from-sweep-500 hover:to-sweep-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-sweep-950/30"
          >
            {processing ? "Processing..." : "Redeem"}
          </button>
        </form>
      </div>

      {/* Transaction History */}
      <div className="glass rounded-2xl p-6 card-highlight">
        <h3 className="font-black text-lg mb-5 text-white">Transaction History</h3>
        {!wallet || wallet.transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-zinc-600 text-sm">No transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallet.transactions.map((tx, idx) => {
              const isPositive = tx.amount > 0;
              const isGC = tx.currency === "GC";
              const icon = TX_ICONS[tx.type] ?? (isPositive ? "➕" : "➖");

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-surface-900/50 border border-white/[0.02] hover:border-white/[0.05] transition-all duration-200 animate-fadeIn"
                  style={{ animationDelay: `${Math.min(idx * 0.03, 0.5)}s`, animationFillMode: "both" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-zinc-200 capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isGC ? "bg-coin-950/40 text-coin-400 border border-coin-800/20" : "bg-sweep-950/40 text-sweep-400 border border-sweep-800/20"
                    }`}>
                      {tx.currency}
                    </span>
                    <span className={`font-bold font-mono text-sm tabular-nums ${
                      isPositive ? (isGC ? "text-coin-400" : "text-sweep-400") : "text-zinc-500"
                    }`}>
                      {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface CheckoutFormProps {
  onCancel: () => void;
}

function CheckoutForm({ onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage("");

    const returnUrl = window.location.origin + window.location.pathname + "?redirect_status=succeeded#/wallet";

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-500/20 text-red-300 px-3 py-2 rounded-xl text-xs animate-fadeIn">
          {errorMessage}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 glass hover:bg-white/[0.04] text-white font-medium py-2.5 rounded-xl transition-all text-sm"
        >
          Cancel
        </button>
        <button
          disabled={!stripe || loading}
          className="flex-1 bg-gradient-to-r from-coin-400 to-coin-500 hover:from-coin-300 hover:to-coin-400 text-black font-black py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 text-sm shadow-lg shadow-coin-950/20"
        >
          {loading ? "Processing..." : "Complete Purchase"}
        </button>
      </div>
    </form>
  );
}
