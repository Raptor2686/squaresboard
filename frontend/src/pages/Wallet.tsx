import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface Transaction {
  id: string;
  amount_cents: number;
  type: string;
  reference_id: string | null;
  created_at: string;
}

interface WalletData {
  user_id: string;
  display_name: string;
  balance_cents: number;
  transactions: Transaction[];
}

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

export default function Wallet() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("50");
  const [withdrawAmount, setWithdrawAmount] = useState("20");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] = useState<any>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const redirectStatus = queryParams.get("redirect_status");
    if (redirectStatus === "succeeded") {
      setSuccess("Stripe deposit successful! Your balance has been updated.");
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  async function handleStripeDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const dollars = parseFloat(depositAmount);
    if (isNaN(dollars) || dollars <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }

    setProcessing(true);
    try {
      const cents = Math.round(dollars * 100);
      const res = await fetch(`${API}/wallet/deposit?amount_cents=${cents}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to initiate Stripe deposit");
      }
      setClientSecret(data.client_secret);
      setStripePromise(loadStripe(data.publishable_key));
    } catch (err: any) {
      setError(err.message || "An error occurred initiating Stripe deposit.");
    } finally {
      setProcessing(false);
    }
  }

  async function loadWallet() {
    try {
      const res = await fetch(`${API}/wallet/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load wallet data");
      const data = await res.json();
      setWallet(data);
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

  async function handleMockDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const dollars = parseFloat(depositAmount);
    if (isNaN(dollars) || dollars <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }

    setProcessing(true);
    try {
      const cents = Math.round(dollars * 100);
      const res = await fetch(`${API}/wallet/deposit/mock?amount_cents=${cents}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Mock deposit failed");
      }
      setSuccess(`Successfully added ${formatCents(cents)} to your wallet balance!`);
      await loadWallet();
    } catch (err: any) {
      setError(err.message || "An error occurred during deposit.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const dollars = parseFloat(withdrawAmount);
    if (isNaN(dollars) || dollars <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    setProcessing(true);
    try {
      const cents = Math.round(dollars * 100);
      const res = await fetch(`${API}/wallet/withdraw?amount_cents=${cents}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Withdrawal failed");
      }
      setSuccess(`Withdrawal of ${formatCents(cents)} requested successfully.`);
      await loadWallet();
    } catch (err: any) {
      setError(err.message || "An error occurred during withdrawal.");
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
          <p className="text-zinc-400 mb-6">You must be logged in to view your wallet and manage funds.</p>
          <a
            href="#/auth"
            className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-all"
          >
            Sign In / Sign Up
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
        My Wallet
      </h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Balance Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Current Balance</span>
            <h2 className="text-4xl font-extrabold font-mono text-green-400 mt-2">
              {wallet ? formatCents(wallet.balance_cents) : "$0.00"}
            </h2>
          </div>
          <div className="text-xs text-zinc-500 mt-6">
            Balances are processed securely. Stripe test environment keys are active.
          </div>
        </div>

        {/* Deposit Card */}
        <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 text-zinc-200">Deposit Funds</h3>
          {clientSecret && stripePromise ? (
            <div className="space-y-4">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm onCancel={() => setClientSecret("")} />
              </Elements>
            </div>
          ) : (
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-zinc-400 font-medium">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleStripeDeposit}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 font-semibold"
                >
                  {processing ? "Processing..." : "Deposit via Stripe"}
                </button>
                <button
                  type="button"
                  onClick={handleMockDeposit}
                  disabled={processing}
                  className="w-full bg-zinc-700 hover:bg-zinc-650 text-zinc-300 font-medium py-2 rounded-xl transition-all disabled:opacity-50 text-xs border border-zinc-600/40"
                >
                  {processing ? "Processing..." : "Instant Mock Deposit (Dev)"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Withdraw Card */}
        <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 text-zinc-200">Withdraw Funds</h3>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-zinc-400 font-medium">$</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={processing}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2 rounded-xl transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50"
            >
              {processing ? "Processing..." : "Request Withdrawal"}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
        <h3 className="font-bold text-lg mb-4 text-zinc-200">Transaction History</h3>
        {!wallet || wallet.transactions.length === 0 ? (
          <p className="text-zinc-500 text-sm">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-700/60 text-zinc-400">
                  <th className="py-3 font-semibold">Date</th>
                  <th className="py-3 font-semibold">Type</th>
                  <th className="py-3 font-semibold">Reference ID</th>
                  <th className="py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/40">
                {wallet.transactions.map((tx) => {
                  const isPositive = tx.amount_cents > 0;
                  return (
                    <tr key={tx.id} className="text-zinc-300">
                      <td className="py-3.5 text-xs text-zinc-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 font-medium capitalize">
                        {tx.type.replace("_", " ")}
                      </td>
                      <td className="py-3.5 font-mono text-xs text-zinc-500">
                        {tx.reference_id ? tx.reference_id.slice(0, 8) : "N/A"}
                      </td>
                      <td className={`py-3.5 text-right font-bold font-mono ${isPositive ? "text-green-400" : "text-zinc-400"}`}>
                        {isPositive ? "+" : ""}{formatCents(tx.amount_cents)}
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

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const returnUrl = window.location.origin + window.location.pathname + "?redirect_status=succeeded#/wallet";

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
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
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-zinc-700 hover:bg-zinc-650 text-white font-medium py-2 rounded-xl transition-all text-sm"
        >
          Cancel
        </button>
        <button
          disabled={!stripe || loading}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2 rounded-xl transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 text-sm"
        >
          {loading ? "Processing..." : "Pay Now"}
        </button>
      </div>
    </form>
  );
}
