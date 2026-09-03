export default function OfficialRules() {
  const effectiveDate = "August 24, 2026";
  const sponsor = "SquaresBoard";
  const sponsorAddress = "Texas, United States";

  return (
    <div className="max-w-3xl mx-auto p-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 rounded-2xl p-8 mb-8 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h1 className="text-3xl font-black text-white mb-2">Official Sweepstakes Rules</h1>
        <p className="text-zinc-400 text-sm">SquaresBoard — Sports Squares Promotion</p>
        <p className="text-zinc-500 text-xs mt-1">Effective Date: {effectiveDate}</p>
      </div>

      {/* NO PURCHASE NECESSARY banner */}
      <div className="bg-green-950/60 border border-green-700/60 rounded-xl px-6 py-4 mb-8 text-center">
        <p className="text-green-300 font-bold text-lg">NO PURCHASE NECESSARY TO ENTER OR WIN.</p>
        <p className="text-green-400/80 text-sm mt-1">
          A purchase does not improve your chances of winning. Void where prohibited.
        </p>
      </div>

      <div className="space-y-8 text-zinc-300 text-sm leading-relaxed">

        <Section title="1. Sponsor">
          <p>
            The Sponsor of this promotion is <strong className="text-white">{sponsor}</strong>, located in {sponsorAddress} ("Sponsor").
          </p>
        </Section>

        <Section title="2. Promotion Overview">
          <p>
            SquaresBoard is a free-to-play sports prediction sweepstakes. Participants predict sports score
            outcomes by claiming squares on a 10-position grid tied to a professional sports game. When the
            applicable quarter ends, the participant whose square matches the last digit of the combined score wins
            Sweepstakes Coins ("SC"), which may be redeemed for prizes as described herein.
          </p>
          <p className="mt-3">
            There are two in-app currencies:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1.5 ml-2">
            <li>
              <strong className="text-yellow-400">Gold Coins (GC)</strong> — A virtual game credit with no monetary value.
              Gold Coins may be purchased in bundles or obtained free. Gold Coins cannot be redeemed for cash or prizes.
            </li>
            <li>
              <strong className="text-purple-300">Sweepstakes Coins (SC)</strong> — Earned by winning boards or claimed
              free once per day. SC can be redeemed for prizes as described in Section 9.
            </li>
          </ul>
        </Section>

        <Section title="3. Eligibility">
          <p>
            This promotion is open to legal residents of the United States who are 18 years of age or older at the time
            of entry. Employees, officers, and directors of Sponsor and their immediate family members are not eligible.
            Void where prohibited by law.
          </p>
          <p className="mt-3">
            This promotion is intended for entertainment and skill-based prediction only. It is the participant's
            responsibility to ensure that participation is permitted under the laws of their jurisdiction.
          </p>
        </Section>

        <Section title="4. How to Enter (Free — No Purchase Required)">
          <p className="font-semibold text-white mb-2">Method 1: Daily Free Sweepstakes Coin Claim</p>
          <p>
            Once per 24-hour period, any registered user may visit the Wallet page at{" "}
            <span className="text-blue-400">squaresboard.app/wallet</span> and click "Claim Free SC" to receive
            50 Sweepstakes Coins at no cost. These SC may be used to redeem prizes per Section 9.
          </p>

          <p className="font-semibold text-white mt-4 mb-2">Method 2: Mail-In Entry</p>
          <p>
            To receive 50 Sweepstakes Coins without any purchase or online registration, hand-print your full name,
            valid email address, and date of birth on a 3" × 5" card and mail it to:
          </p>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mt-3 font-mono text-xs text-zinc-300">
            SquaresBoard Sweepstakes Entry<br />
            Attn: Free Entry Request<br />
            {sponsorAddress}
          </div>
          <p className="mt-3 text-zinc-400 text-xs">
            Limit one (1) mail-in entry per person per day. Mail-in entries must be postmarked during the applicable
            promotion period. SC from mail-in entries will be credited within 10 business days of receipt.
          </p>

          <p className="font-semibold text-white mt-4 mb-2">Method 3: Purchase Gold Coins (Optional)</p>
          <p>
            Users may optionally purchase Gold Coins ("GC") to enter additional boards. GC can be spent on boards
            to earn SC upon winning. Purchasing GC does not increase the odds of winning relative to a free entry.
          </p>
        </Section>

        <Section title="5. How Boards Work">
          <p>
            Each board is a 10-position grid tied to a specific professional sports game and quarter. Each position
            costs a defined number of GC (e.g., 100 GC per square). When all 10 positions are claimed, the digits
            0–9 are randomly and equally assigned. At the conclusion of the associated quarter, the winning position
            is determined by the formula:
          </p>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mt-3 text-center font-mono text-blue-300 text-sm">
            (Home Score + Away Score) mod 10 = Winning Digit
          </div>
          <p className="mt-3">
            The owner of the winning position receives Sweepstakes Coins equal to 90% of the total GC pot. The
            remaining 10% is retained by Sponsor.
          </p>
        </Section>

        <Section title="6. Odds of Winning">
          <p>
            Each board has 10 positions with numbers assigned randomly and equally. Each participant who claims one
            position has a 1-in-10 (10%) chance of holding the winning position. Purchasing multiple squares on
            multiple boards increases the number of entries but does not change the per-board odds.
          </p>
          <p className="mt-3">
            Free daily entries (Method 1 and 2) may be accumulated as SC and used toward prize redemption
            (Section 9) independent of board outcomes.
          </p>
        </Section>

        <Section title="7. Randomness and Fairness">
          <p>
            Number assignment to board positions is performed using a cryptographically seeded random number
            generator upon the board filling completely. No participant or Sponsor employee has knowledge of or
            influence over the assigned numbers prior to the board filling.
          </p>
        </Section>

        <Section title="8. Prizes and Sweepstakes Coins">
          <p>
            Sweepstakes Coins (SC) have no monetary value. SC may only be redeemed for prizes as listed in the
            current Prize Catalog available at <span className="text-blue-400">squaresboard.app/prizes</span>.
          </p>
          <p className="mt-3">
            Example prize categories include (subject to change):
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
            <li>Digital gift cards (e.g., Amazon, Visa prepaid)</li>
            <li>SquaresBoard branded merchandise</li>
            <li>Charitable donation credits</li>
          </ul>
          <p className="mt-3">
            Minimum redemption is 25 SC ($25 equivalent). Prize fulfillment occurs within 3–5 business days of a valid
            redemption request. Prizes are non-transferable and have no cash equivalent.
          </p>
        </Section>

        <Section title="9. Prize Redemption">
          <p>
            To redeem SC for a prize, log in and visit the Wallet page. Enter the number of SC you wish to
            redeem (minimum 25 SC) and submit a redemption request. Sponsor will contact you at the email
            address on file to fulfill your prize selection.
          </p>
        </Section>

        <Section title="10. General Conditions">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Sponsor reserves the right to cancel, suspend, or modify the promotion at any time.</li>
            <li>
              Any attempt to fraudulently obtain SC through automation, multiple accounts, or other means will
              result in disqualification and account termination.
            </li>
            <li>
              Participants agree to the SquaresBoard Terms of Service and Privacy Policy.
            </li>
            <li>
              Disputes shall be governed by the laws of the State of Texas, without regard to conflict of law principles.
            </li>
            <li>
              This promotion is in no way sponsored, endorsed, administered by, or associated with the NFL, NBA,
              MLB, or any other sports league or team.
            </li>
          </ul>
        </Section>

        <Section title="11. Winner List">
          <p>
            To obtain a list of winners or a copy of these Official Rules, send a self-addressed stamped envelope to
            Sponsor at the address in Section 1, or email{" "}
            <span className="text-blue-400">support@squaresboard.app</span>.
          </p>
        </Section>

        <div className="border-t border-zinc-700/50 pt-6 text-zinc-500 text-xs text-center">
          <p>© {new Date().getFullYear()} {sponsor}. All rights reserved.</p>
          <p className="mt-1">These rules were last updated on {effectiveDate}.</p>
          <p className="mt-3 italic">
            This document is provided for informational purposes. SquaresBoard strongly recommends consulting a
            licensed attorney familiar with sweepstakes law before commercial launch.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-bold text-white mb-3 pb-2 border-b border-zinc-700/60">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
