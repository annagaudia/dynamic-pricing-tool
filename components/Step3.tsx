"use client";
import { useEffect, useMemo, useState } from 'react';

type DayType = 'weekday' | 'weekend' | 'holiday';
type PlatformKey = 'airbnb' | 'booking' | 'vrbo' | 'website' | 'dtravel';

function toEven(n: number) {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}
function up(n: number) {
  return Math.ceil(n);
}
function invGross(targetNet: number, host: number, vat: number, tax: number) {
  const denom = (1 - host) * (1 - vat) * (1 - tax);
  return targetNet / Math.max(denom, 0.0001);
}
function deriveDP(targetNet: number, host: number, vat: number, tax: number, pad: number, mult: number) {
  const grossRaw = invGross(targetNet, host, vat, tax);
  return grossRaw / Math.max(pad * mult, 0.0001);
}
function forwardPrices(
  dp: number,
  guest: number,
  host: number,
  vat: number,
  tax: number,
  pad: number,
  mult: number,
) {
  const gross = toEven(dp * pad * mult);
  const guestPrice = up(gross * (1 + guest));
  const net = up(gross * (1 - host) * (1 - tax) * (1 - vat));
  return { gross, guestPrice, net };
}

interface Step3Props {
  state2: any;
  onNext: () => void;
  onBack: () => void;
  onOutput: (data: any) => void;
}

export default function Step3({ state2, onNext, onBack, onOutput }: Step3Props) {
  const { currency, platforms, seasonality, occupancy, holidays } = state2;
  const [mode, setMode] = useState<'year' | 'month' | 'perSeason'>('year');
  const [perYearNet, setPerYearNet] = useState(40000);
  const [perMonthNet, setPerMonthNet] = useState(3500);
  const [perSeasonNet, setPerSeasonNet] = useState<Record<string, number>>({});
  const [split, setSplit] = useState<{ weekday: number; weekend: number; holiday: number }>({ weekday: 0.7, weekend: 0.25, holiday: 0.05 });

  const selectedYear = holidays?.settings?.year ?? new Date().getFullYear();
  const holidayDates: Set<string> = useMemo(() => {
    const set = new Set<string>();
    if (!holidays?.merged) return set;
    holidays.merged.forEach((r: any) => {
      if (!r.enabled) return;
      const buf = r.buffer ?? 0;
      const base = new Date(r.date + 'T00:00:00');
      for (let i = -buf; i <= buf; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        set.add(d.toISOString().slice(0, 10));
      }
    });
    return set;
  }, [holidays]);

  // compute season days based on month mapping
  const seasonDays = useMemo(() => {
    const monthsMap: Record<string, string[]> = seasonality.months;
    const daysPerMonth: Record<string, number> = {
      Jan: 31,
      Feb: isLeap(selectedYear) ? 29 : 28,
      Mar: 31,
      Apr: 30,
      May: 31,
      Jun: 30,
      Jul: 31,
      Aug: 31,
      Sep: 30,
      Oct: 31,
      Nov: 30,
      Dec: 31,
    };
    const result: Record<string, number> = {};
    seasonality.types.forEach((t: string) => {
      const total = (monthsMap[t] || []).reduce((acc: number, m: string) => acc + (daysPerMonth[m] || 0), 0);
      result[t] = total;
    });
    return result;
  }, [seasonality, selectedYear]);

  // booked nights per season
  const bookedNightsBySeason = useMemo(() => {
    const total: Record<string, number> = {};
    const modeSel = occupancy.mode;
    if (modeSel === 'perYear') {
      const yearNights = Math.round(365 * occupancy.perYearPct / 100);
      const totalSeasonDays = Object.values(seasonDays).reduce((a, b) => a + b, 0);
      for (const s of seasonality.types) {
        const weight = (seasonDays[s] || 0) / Math.max(totalSeasonDays, 1);
        total[s] = Math.max(1, Math.round(yearNights * weight));
      }
    } else if (modeSel === 'perSeason') {
      for (const s of seasonality.types) {
        const pct = occupancy.perSeasonPct[s] ?? 60;
        total[s] = Math.max(1, Math.round((seasonDays[s] || 0) * pct / 100));
      }
    } else {
      for (const s of seasonality.types) {
        const months = seasonality.months[s] || [];
        const nights = months.reduce((acc: number, m: string) => {
          const pct = occupancy.perMonthPct[m] ?? 60;
          const days = daysOfMonth(selectedYear, m);
          return acc + Math.round(days * pct / 100);
        }, 0);
        total[s] = Math.max(1, nights);
      }
    }
    return total;
  }, [occupancy, seasonDays, seasonality, selectedYear]);

  // split into day types using booking split
  const nightsBySeasonDay = useMemo(() => {
    const res: Record<string, Record<DayType, number>> = {};
    for (const s of seasonality.types) {
      const seasonTotal = bookedNightsBySeason[s] || 1;
      const wkd = Math.max(0, Math.round(seasonTotal * split.weekday));
      const wke = Math.max(0, Math.round(seasonTotal * split.weekend));
      let hol = Math.max(0, seasonTotal - wkd - wke);
      res[s] = { weekday: wkd, weekend: wke, holiday: hol };
    }
    return res;
  }, [bookedNightsBySeason, seasonality, split]);

  // allocate net targets per season
  const seasonNetTarget = useMemo(() => {
    const out: Record<string, number> = {};
    if (mode === 'perSeason' && Object.keys(perSeasonNet).length) return perSeasonNet;
    const totalBooked = Object.values(bookedNightsBySeason).reduce((a, b) => a + b, 0);
    const base = mode === 'year' ? perYearNet : mode === 'month' ? perMonthNet * 12 : 0;
    for (const s of seasonality.types) {
      const weight = (bookedNightsBySeason[s] || 0) / Math.max(totalBooked, 1);
      out[s] = Math.round(base * weight);
    }
    return out;
  }, [mode, perYearNet, perMonthNet, perSeasonNet, bookedNightsBySeason, seasonality.types]);

  // derive per-night net target per season and day
  const perNightNetTarget = useMemo(() => {
    const out: Record<string, Record<DayType, number>> = {};
    for (const s of seasonality.types) {
      const totals = nightsBySeasonDay[s];
      const seasonNet = seasonNetTarget[s] || 0;
      const totalNights = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
      out[s] = { weekday: 0, weekend: 0, holiday: 0 };
      for (const d of ['weekday','weekend','holiday'] as DayType[]) {
        const nights = totals[d] || 0;
        const share = nights / totalNights;
        const netForType = seasonNet * share;
        const perNight = nights > 0 ? Math.max(1, Math.floor(netForType / nights)) : 0;
        out[s][d] = perNight;
      }
    }
    return out;
  }, [seasonality.types, nightsBySeasonDay, seasonNetTarget]);

  // derive price table per platform and day type
  const priceTable = useMemo(() => {
    const out: any[] = [];
    for (const s of seasonality.types) {
      for (const d of ['weekday','weekend','holiday'] as DayType[]) {
        const mult = d === 'weekday'
          ? seasonality.multipliers.weekday
          : d === 'weekend'
          ? seasonality.multipliers.weekend
          : holidays?.settings?.multiplier ?? 1.4;
        for (const pk of Object.keys(platforms) as PlatformKey[]) {
          const p = platforms[pk];
          const pad = 1 + p.discountPaddingPct / 100;
          const guest = p.guestFeePct / 100;
          const host = p.hostCommissionPct / 100;
          const vat = p.vatPct / 100;
          const tax = p.incomeTaxPct / 100;
          const netTarget = perNightNetTarget[s][d] || 0;
          const dpRaw = deriveDP(netTarget, host, vat, tax, pad, mult);
          const { gross, guestPrice, net } = forwardPrices(dpRaw, guest, host, vat, tax, pad, mult);
          out.push({ season: s, dayType: d, platform: pk, dp: Math.max(1, Math.round(dpRaw)), gross, guestPrice, net });
        }
      }
    }
    return out;
  }, [seasonality, platforms, perNightNetTarget, holidays]);

  useEffect(() => {
    onOutput({ priceTable, nightsBySeasonDay, seasonNetTarget, currency });
  }, [priceTable, nightsBySeasonDay, seasonNetTarget, currency, onOutput]);

  return (
    <section className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-4">
        <button className="underline" onClick={onBack}>Back</button>
        <div className="text-sm">Step 3 of 5</div>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: inputs */}
        <div className="xl:col-span-1 rounded-xl border p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Income mode</label>
            <div className="flex gap-3">
              {(['year','month','perSeason'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>
          {mode === 'year' && (
            <div>
              <label className="block text-sm mb-1">Net per year</label>
              <input
                type="number"
                className="h-10 w-48 border rounded-lg px-3"
                value={perYearNet}
                onChange={(e) => setPerYearNet(Number(e.target.value))}
              />
            </div>
          )}
          {mode === 'month' && (
            <div>
              <label className="block text-sm mb-1">Net per month</label>
              <input
                type="number"
                className="h-10 w-48 border rounded-lg px-3"
                value={perMonthNet}
                onChange={(e) => setPerMonthNet(Number(e.target.value))}
              />
            </div>
          )}
          {mode === 'perSeason' && (
            <div>
              <div className="text-sm mb-2">Net per season</div>
              <div className="grid grid-cols-2 gap-2">
                {seasonality.types.map((t: string) => (
                  <div key={t}>
                    <label className="block text-xs mb-1">{t}</label>
                    <input
                      type="number"
                      className="h-10 w-full border rounded-lg px-3"
                      value={perSeasonNet[t] ?? 0}
                      onChange={(e) => setPerSeasonNet((s) => ({ ...s, [t]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-sm mb-1">Booking split – must total 1.00</div>
            {(['weekday','weekend','holiday'] as DayType[]).map((k) => (
              <div key={k} className="flex items-center gap-2 mb-2">
                <span className="w-20 text-xs capitalize">{k}</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  className="h-9 w-28 border rounded-lg px-2"
                  value={(split as any)[k]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(1, Number(e.target.value)));
                    setSplit((s) => ({ ...s, [k]: v }));
                  }}
                />
              </div>
            ))}
            <div className="text-xs text-gray-600">
              Total: {(split.weekday + split.weekend + split.holiday).toFixed(2)}
            </div>
          </div>
        </div>
        {/* Middle: nights and net targets */}
        <div className="xl:col-span-1 rounded-xl border p-4">
          <div className="text-sm font-medium mb-2">Per‑season nights and net targets</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Season</th>
                <th className="py-2 pr-2">Nights</th>
                <th className="py-2 pr-2">Net target</th>
              </tr>
            </thead>
            <tbody>
              {seasonality.types.map((t: string) => (
                <tr key={t} className="border-b last:border-b-0">
                  <td className="py-2 pr-2">{t}</td>
                  <td className="py-2 pr-2">
                    {Object.values(nightsBySeasonDay[t]).reduce((a: number, b: number) => a + b, 0)}
                  </td>
                  <td className="py-2 pr-2">{format(currency, seasonNetTarget[t] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Right: live preview for a selected platform and day type */}
        <PreviewCard
          currency={currency}
          platforms={platforms}
          seasonality={seasonality}
          priceTable={priceTable}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <button className="underline mr-3" onClick={onBack}>Back</button>
        <button className="h-11 px-4 bg-black text-white rounded-lg" onClick={() => { onOutput({ priceTable }); onNext(); }}>
          Continue
        </button>
      </div>
    </section>
  );
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysOfMonth(year: number, monShort: string) {
  const mIndex = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(monShort);
  const dpm = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dpm[mIndex] ?? 30;
}
function format(c: string, v: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(v);
}

function PreviewCard({ currency, platforms, seasonality, priceTable }: { currency: string; platforms: any; seasonality: any; priceTable: any[]; }) {
  const [platform, setPlatform] = useState<PlatformKey>('airbnb');
  const [season, setSeason] = useState<string>(seasonality.types[0]);
  const [dayType, setDayType] = useState<DayType>('weekday');
  const row = priceTable.find((r) => r.platform === platform && r.season === season && r.dayType === dayType);
  return (
    <aside className="xl:col-span-1 rounded-xl border p-4 sticky top-4 h-fit">
      <div className="flex gap-2 flex-wrap mb-3">
        {(['airbnb','booking','vrbo','website','dtravel'] as PlatformKey[]).map((pk) => (
          <button
            key={pk}
            className={`px-3 py-2 rounded-lg text-sm ${platform === pk ? 'bg-black text-white' : 'bg-gray-100'}`}
            onClick={() => setPlatform(pk)}
          >
            {pk === 'website' ? 'My Website' : pk.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <select className="h-10 border rounded-lg px-3" value={season} onChange={(e) => setSeason(e.target.value)}>
          {seasonality.types.map((t: string) => <option key={t}>{t}</option>)}
        </select>
        <select className="h-10 border rounded-lg px-3" value={dayType} onChange={(e) => setDayType(e.target.value as DayType)}>
          {(['weekday','weekend','holiday'] as DayType[]).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {!row ? (
        <p className="text-sm text-gray-500">No data yet</p>
      ) : (
        <div>
          <Stat label="DP"         value={format(currency, row.dp)} />
          <Stat label="Gross rate" value={format(currency, row.gross)} />
          <Stat label="Guest price" value={format(currency, row.guestPrice)} />
          <Stat label="Net income" value={format(currency, row.net)} />
        </div>
      )}
    </aside>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}