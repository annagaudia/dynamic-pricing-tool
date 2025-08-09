"use client";
import { useState } from 'react';

/**
 * Step1 is the introduction and acknowledgments page. It presents an
 * overview of the tool, explains what it does and how to use it, and
 * requires the user to acknowledge that the results are estimates.
 */
export default function Step1({ onNext }: { onNext: () => void }) {
  const [consent, setConsent] = useState(false);

  return (
    <section className="max-w-4xl mx-auto p-6">
      <div className="text-sm mb-4">Step 1 of 5</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h1 className="text-3xl font-semibold">Dynamic Pricing Tool — dynamic pricing calculator</h1>
          <p className="mt-2 text-base">
            Build platform‑ready nightly prices from your net income goal, seasonality, occupancy,
            fees and tax assumptions.
          </p>
          <div className="mt-6 space-y-4 text-sm">
            <div>
              <h2 className="font-medium mb-1">What this tool calculates</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>Your net income target per period</li>
                <li>The gross rate needed to hit it after fees, VAT, income tax and discount padding</li>
                <li>The guest price that appears to guests per platform</li>
              </ul>
            </div>
            <div>
              <h2 className="font-medium mb-1">How to use it</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>Confirm fee and tax assumptions per platform.</li>
                <li>Set seasonality, weekends and holiday multipliers.</li>
                <li>Enter your net income goals.</li>
                <li>Review auto‑built rates by season and day type.</li>
                <li>Export to CSV, Sheets or PDF.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-medium mb-1">Why it helps</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>Tune seasons, holidays and platform fees without subscriptions.</li>
                <li>See the math behind every number.</li>
                <li>Export clean price tables you can paste into Airbnb, Booking, VRBO or your site.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-medium mb-1">Acknowledgments</h2>
              <p className="mt-1 text-gray-600">
                This tool gives sample calculations based on values you enter. Always sanity‑check final
                prices before publishing.
              </p>
            </div>
          </div>
        </div>
        <aside className="md:pl-6">
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">What you’ll need</h3>
            <ul className="list-disc ml-5 text-sm space-y-1">
              <li>Occupancy or a target</li>
              <li>VAT and income tax assumptions</li>
              <li>Platform fees you pay</li>
              <li>Net income target per month or year</li>
            </ul>
            <label className="flex items-start gap-2 mt-4">
              <input
                type="checkbox"
                aria-label="Consent acknowledgment"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm">
                I understand this is a planning tool and I am responsible for final prices.
              </span>
            </label>
            <div className="mt-4 space-y-2">
              <button
                className={`w-full h-11 rounded-lg ${
                  consent ? 'bg-black text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!consent}
                onClick={() => consent && onNext()}
              >
                Start setup
              </button>
              {/* Secondary action to learn how it works could open a modal; omitted for brevity */}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
