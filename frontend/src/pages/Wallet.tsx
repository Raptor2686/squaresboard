import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
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
  return n.toLocaleString() + " GC";
}
function formatSC(n: number) {
  return n.toLocaleString() + " SC";
}
function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function Wallet() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState("500");
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
        fetch(`${API}/wallet/me`, { credentials: "include" }),
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

  async function handleClaimFreeSC() {
    setError("");
    setSuccess("");
    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/claim-free-sc`, {
        method: "POST",
        credentials: "include",
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
    if (isNaN(amount) || amount < 500) {
      setError("Minimum redemption is 500 SC.");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${API}/wallet/redeem-sc?amount=${amount}`, {
        method: "POST",
        credentials: "include",
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

  if (authLoading || loading) {
    return <div className="p-8 text-center text-zinc-400">Loading wallet...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3">Sign In Required</h2>
          <p className="text-zinc-400 mb-6">You must be logged in to view your wallet.</p>
          <a href="#/auth" className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-all">
            Sign In / Sign Up
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
        My Wallet
      </h1>
      <p className="text-xs text-zinc-500 mb-6">
        🏆 No Purchase Necessary — Claim free Sweepstakes Coins daily. See{" "}
        <a href="#/rules" className="text-blue-400 underline">Official Rules</a>.
      </p>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-xl mb-6 text-sm">{success}</div>}

      {/* Dual Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/20 border border-yellow-700/50 rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-yellow-500">🟡 Gold Coins</span>
          <p className="text-xs text-zinc-400 mt-1 mb-2">Used to enter boards. No cash value.</p>
          <h2 className="text-4xl font-extrabold font-mono text-yellow-400">{wallet ? formatGC(wallet.gold_coins) : "0 GC"}</h2>
        </div>
        <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/20 border border-purple-700/50 rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">🎟️ Sweepstakes Coins</span>
          <p className="text-xs text-zinc-400 mt-1 mb-2">Won on boards. Redeemable for prizes.</p>
          <h2 className="text-4xl font-extrabold font-mono text-purple-300">{wallet ? formatSC(wallet.sweep_coins) : "0 SC"}</h2>
          {wallet?.can_claim_free_sc && (
            <button
              onClick={handleClaimFreeSC}
              disabled={processing}
              className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-2 rounded-xl transition-all disabled:opacity-50"
            >
              🎁 Claim {wallet.free_sc_amount} Free SC
            </button>
          )}
          {wallet && !wallet.can_claim_free_sc && (
            <p className="mt-3 text-xs text-zinc-500">Free coins claimed — come back tomorrow!</p>
          )}
        </div>
      </div>

      {/* Buy Gold Coins */}
      <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-6 mb-6">
        <h3 className="font-bold text-lg mb-1 text-zinc-200">🟡 Buy Gold Coins</h3>
        <p className="text-xs text-zinc-400 mb-5">Gold Coins are used to enter boards. They have no cash value and cannot be redeemed for money.</p>

        {clientSecret && stripePromise ? (
          <div>
            <p className="text-sm text-zinc-300 mb-4 font-medium">
              Completing purchase: <span className="text-yellow-400">{selectedBundle?.label}</span> for{" "}
              <span className="text-white">{selectedBundle ? formatUSD(selectedBundle.price_cents) : ""}</span>
            </p>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm onCancel={() => { setClientSecret(""); setSelectedBundle(null); }} />
            </Elements>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {bundles.map((bundle) => (
              <button
                key={bundle.id}
                onClick={() => handleBuyBundle(bundle)}
                disabled={processing}
                className="relative flex flex-col items-center justify-center bg-zinc-900 border border-zinc-700 hover:border-yellow-500 rounded-xl p-4 transition-all group disabled:opacity-50 gap-0.5"
              >
                {bundle.bonus && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {bundle.bonus}
                  </span>
                )}
                <span className="text-2xl mb-1">🟡</span>
                <span className="font-bold text-yellow-400 text-sm">{bundle.label}</span>
                <span className="text-zinc-400 text-xs">{formatUSD(bundle.price_cents)}</span>
                {bundle.bonus_sc > 0 && (
                  <span className="mt-1.5 text-[10px] font-semibold text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-full">
                    +{bundle.bonus_sc.toLocaleString()} 🎟️ SC
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Redeem SC */}
      <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-6 mb-6">
        <h3 className="font-bold text-lg mb-1 text-zinc-200">🎟️ Redeem Sweepstakes Coins</h3>
        <p className="text-xs text-zinc-400 mb-5">Redeem for gift cards, merch, or other prizes. Minimum 500 SC. Processing takes 3-5 business days.</p>
        <form onSubmit={handleRedeem} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Amount (SC)</label>
            <input
              type="number"
              min="500"
              step="50"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={processing}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50"
          >
            {processing ? "Processing..." : "Redeem"}
          </button>
        </form>
      </div>

      {/* Transaction History */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
        <h3 className="font-bold text-lg mb-4 text-zinc-200">Transaction History</h3>
        {!wallet || wallet.transactions.length === 0 ? (
          <p className="text-zinc-500 text-sm">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-700/60 text-zinc-400">
                  <th className="py-3 font-semibold">Date</th>
                  <th className="py-3 font-semibold">Type</th>
                  <th className="py-3 font-semibold">Currency</th>
                  <th className="py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/40">
                {wallet.transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const isGC = tx.currency === "GC";
                  return (
                    <tr key={tx.id} className="text-zinc-300">
                      <td className="py-3.5 text-xs text-zinc-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 font-medium capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </td>
                      <td className="py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isGC ? "bg-yellow-900/50 text-yellow-400" : "bg-purple-900/50 text-purple-300"}`}>
                          {tx.currency}
                        </span>
                      </td>
                      <td className={`py-3.5 text-right font-bold font-mono ${isPositive ? (isGC ? "text-yellow-400" : "text-purple-300") : "text-zinc-400"}`}>
                        {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded-xl text-xs">
          {errorMessage}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={loading}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 rounded-xl transition-all text-sm">
          Cancel
        </button>
        <button disabled={!stripe || loading}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold py-2 rounded-xl transition-all disabled:opacity-50 text-sm">
          {loading ? "Processing..." : "Complete Purchase"}
        </button>
      </div>
    </form>
  );
}
