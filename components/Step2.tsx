"use client";
import { useMemo, useState } from 'react';
import HolidaysBlock from './HolidaysBlock';

type PlatformKey = 'airbnb' | 'booking' | 'vrbo' | 'website' | 'dtravel';
type DayType = 'weekday' | 'weekend' | 'holiday';

const defaultState = {
  currency: 'EUR',
  platforms: {
    airbnb: { guestFeePct: 14, hostCommissionPct: 3,    vatPct: 6, incomeTaxPct: 15, discountPaddingPct: 20 },
    booking: { guestFeePct: 0,  hostCommissionPct: 16.4, vatPct: 6, incomeTaxPct: 15, discountPaddingPct: 20 },
    vrbo:    { guestFeePct: 12, hostCommissionPct: 8,    vatPct: 6, incomeTaxPct: 15, discountPaddingPct: 20 },
    website: { guestFeePct: 10, hostCommissionPct: 3,    vatPct: 6, incomeTaxPct: 15, discountPaddingPct: 20 },
    dtravel: { guestFeePct: 0,  hostCommissionPct: 5.9,  vatPct: 6, incomeTaxPct: 15, discountPaddingPct: 20 }
  },
  seasonality: {
    types: ['Deep Low', 'Low', 'Early or Late', 'Season', 'Peak'],
    months: {
      'Deep Low': ['Jan','Feb'],
      'Low': ['Mar','Apr','Dec'],
      'Early or Late': ['May','Jun','Nov'],
      'Season': ['Jul','Sep','Oct'],
      'Peak': ['Aug']
    },
    multipliers: { weekday: 1.0, weekend: 1.2, holiday: 1.4 }
  },
  occupancy: {
    mode: 'perSeason',
    perYearPct: 60,
    perSeasonPct: { 'Deep Low': 40, 'Low': 55, 'Early or Late': 60, 'Season': 70, 'Peak': 85 },
    perMonthPct: {}
  },
  holidays: undefined as any
};

/**
 * Step2 allows the user to enter and amend variables for platform fees, seasonality
 * mappings, multipliers and occupancy rates. It also contains a holiday block
 * that fetches and merges holiday dates from multiple countries. A live preview
 * on the right shows how the fee stack affects a base day price of 100.
 */
export default function Step2({
  onNext,
  onBack,
  onUpdate,
}: {
  onNext: () => void;
  onBack: () => void;
  onUpdate: (s: any) => void;
}) {
  const [state, setState] = useState<typeof defaultState>(defaultState);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('airbnb');
  const [dayType, setDayType] = useState<DayType>('weekday');
  const dpPreview = 100;

  const preview = useMemo(() => {
    const p = state.platforms[activePlatform];
    const mult = dayType === 'weekday'
      ? state.seasonality.multipliers.weekday
      : dayType === 'weekend'
      ? state.seasonality.multipliers.weekend
      : state.seasonality.multipliers.holiday;
    const pad = 1 + p.discountPaddingPct / 100;
    const base = dpPreview * pad * mult;
    const grossRoundedEven = roundToEven(base);
    const guestPrice = roundUp(grossRoundedEven * (1 + p.guestFeePct / 100));
    const net = roundUp(grossRoundedEven * (1 - p.hostCommissionPct / 100) * (1 - p.vatPct / 100) * (1 - p.incomeTaxPct / 100));
    return { gross: grossRoundedEven, guestPrice, net };
  }, [state, activePlatform, dayType]);

  function pctInput(val: number) {
    if (val < 0) return 0;
    if (val > 100) return 100;
    return Math.round(val * 10) / 10;
  }

  function updatePlatform(pk: PlatformKey, field: string, value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setState((s) => ({
      ...s,
      platforms: { ...s.platforms, [pk]: { ...s.platforms[pk], [field]: num } },
    }));
  }

  return (
    <section className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-4">
        <button className="underline" onClick={onBack}>Back</button>
        <div className="text-sm">Step 2 of 5</div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border">
            <div className="flex flex-wrap gap-2 p-3 border-b">
              {(['airbnb','booking','vrbo','website','dtravel'] as PlatformKey[]).map((pk) => (
                <button
                  key={pk}
                  className={`px-3 py-2 rounded-lg text-sm ${activePlatform === pk ? 'bg-black text-white' : 'bg-gray-100'}`}
                  onClick={() => setActivePlatform(pk)}
                >
                  {labelFor(pk)}
                </button>
              ))}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {['guestFeePct','hostCommissionPct','vatPct','incomeTaxPct','discountPaddingPct'].map((f) => (
                <div key={f}>
                  <label className="block text-sm mb-1">{labelForField(f)}</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    className="w-full h-10 border rounded-lg px-3"
                    value={(state.platforms as any)[activePlatform][f]}
                    onChange={(e) => updatePlatform(activePlatform, f, String(pctInput(Number(e.target.value))))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Percent 0–100</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Currency</label>
                <select
                  className="w-full h-10 border rounded-lg px-3"
                  value={state.currency}
                  onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))}
                >
                  {['USD','GBP','EUR'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {(['weekday','weekend','holiday'] as DayType[]).map((dt) => (
                <div key={dt}>
                  <label className="block text-sm mb-1">{titleCase(dt)} multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.5}
                    max={3}
                    className="w-full h-10 border rounded-lg px-3"
                    value={(state.seasonality.multipliers as any)[dt]}
                    onChange={(e) => setState((s) => ({
                      ...s,
                      seasonality: {
                        ...s.seasonality,
                        multipliers: {
                          ...s.seasonality.multipliers,
                          [dt]: Number(e.target.value),
                        },
                      },
                    }))}
                  />
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <label className="block text-sm mb-2">Season month mapping</label>
              <p className="text-xs text-gray-600 mb-3">Edit later if needed. Defaults are loaded.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {state.seasonality.types.map((t) => (
                  <div key={t} className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">{t}</div>
                    <input
                      className="w-full h-10 border rounded-lg px-3"
                      value={state.seasonality.months[t].join(', ')}
                      onChange={(e) => {
                        const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        setState((s) => ({
                          ...s,
                          seasonality: {
                            ...s.seasonality,
                            months: { ...s.seasonality.months, [t]: parts },
                          },
                        }));
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Comma separated month short names</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t">
              <label className="block text-sm mb-1">Occupancy input mode</label>
              <div className="flex gap-3 mt-1">
                {['perYear','perSeason','perMonth'].map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={state.occupancy.mode === m}
                      onChange={() => setState((s) => ({ ...s, occupancy: { ...s.occupancy, mode: m } }))}
                    />
                    {m}
                  </label>
                ))}
              </div>
              {state.occupancy.mode === 'perYear' && (
                <div className="mt-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-40 h-10 border rounded-lg px-3"
                    value={state.occupancy.perYearPct}
                    onChange={(e) => setState((s) => ({ ...s, occupancy: { ...s.occupancy, perYearPct: pctInput(Number(e.target.value)) } }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">If unsure, 60 is a safe starting point.</p>
                </div>
              )}
              {state.occupancy.mode === 'perSeason' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {state.seasonality.types.map((t) => (
                    <div key={t}>
                      <label className="block text-xs mb-1">{t}</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full h-10 border rounded-lg px-3"
                        value={(state.occupancy.perSeasonPct as any)[t]}
                        onChange={(e) => setState((s) => ({
                          ...s,
                          occupancy: {
                            ...s.occupancy,
                            perSeasonPct: { ...(s.occupancy.perSeasonPct as any), [t]: pctInput(Number(e.target.value)) },
                          },
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {state.occupancy.mode === 'perMonth' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
                    <div key={m}>
                      <label className="block text-xs mb-1">{m}</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full h-10 border rounded-lg px-3"
                        value={(state.occupancy.perMonthPct as any)[m] ?? 60}
                        onChange={(e) => setState((s) => ({
                          ...s,
                          occupancy: {
                            ...s.occupancy,
                            perMonthPct: { ...(s.occupancy.perMonthPct as any), [m]: pctInput(Number(e.target.value)) },
                          },
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <HolidaysBlock
            onChange={(payload) => setState((s) => ({ ...s, holidays: payload }))}
          />
        </div>
        <aside className="lg:col-span-1">
          <div className="border rounded-xl p-4 sticky top-4">
            <div className="flex gap-2 mb-3">
              {(['weekday','weekend','holiday'] as DayType[]).map((dt) => (
                <button
                  key={dt}
                  className={`px-3 py-2 rounded-lg text-sm ${dayType === dt ? 'bg-black text-white' : 'bg-gray-100'}`}
                  onClick={() => setDayType(dt)}
                >
                  {titleCase(dt)}
                </button>
              ))}
            </div>
            <h3 className="font-medium mb-2">Preview – {labelFor(activePlatform)}</h3>
            <p className="text-xs text-gray-500 mb-3">Assumes DP = 100 for math preview. Real DP comes in Step 3.</p>
            <Stat label="Gross Rate" value={format(state.currency, preview.gross)} />
            <Stat label="Guest Price" value={format(state.currency, preview.guestPrice)} />
            <Stat label="Net Income" value={format(state.currency, preview.net)} />
            <button
              className="w-full h-11 mt-4 bg-black text-white rounded-lg"
              onClick={() => {
                onUpdate(state);
                onNext();
              }}
            >
              Continue
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function roundUp(n: number) {
  return Math.ceil(n);
}
function roundToEven(n: number) {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}
function format(c: string, v: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(v);
}
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function labelFor(pk: PlatformKey) {
  switch (pk) {
    case 'airbnb': return 'Airbnb';
    case 'booking': return 'Booking.com';
    case 'vrbo': return 'VRBO';
    case 'website': return 'My Website';
    case 'dtravel': return 'DTravel';
    default: return pk;
  }
}
function labelForField(f: string) {
  switch (f) {
    case 'guestFeePct': return 'Guest Service Fee %';
    case 'hostCommissionPct': return 'Host Commission %';
    case 'vatPct': return 'VAT %';
    case 'incomeTaxPct': return 'Income Tax %';
    case 'discountPaddingPct': return 'Padding for Discounts %';
    default: return f;
  }
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}