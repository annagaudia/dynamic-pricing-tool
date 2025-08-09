"use client";
import { useMemo, useState } from 'react';

type DayType = 'weekday' | 'weekend' | 'holiday';
type PlatformKey = 'airbnb' | 'booking' | 'vrbo' | 'website' | 'dtravel';

interface PriceRow {
  season: string;
  dayType: DayType;
  platform: PlatformKey;
  dp: number;
  gross: number;
  guestPrice: number;
  net: number;
}

export default function Step4({
  currency,
  platforms,
  seasonality,
  nightsBySeasonDay,
  priceTable,
  onBack,
  onNext,
}: {
  currency: string;
  platforms: any;
  seasonality: any;
  nightsBySeasonDay: Record<string, Record<DayType, number>>;
  priceTable: PriceRow[];
  onBack: () => void;
  onNext: () => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, { gross: number; locked: boolean }>>({});
  const keyFor = (r: PriceRow) => `${r.platform}|${r.season}|${r.dayType}`;
  const rows = useMemo(() => {
    return priceTable.map((r) => {
      const k = keyFor(r);
      const ov = overrides[k];
      if (!ov || !ov.locked) return r;
      const p = platforms[r.platform];
      const guest = p.guestFeePct / 100;
      const host = p.hostCommissionPct / 100;
      const vat = p.vatPct / 100;
      const tax = p.incomeTaxPct / 100;
      const gross = toEven(ov.gross);
      const guestPrice = up(gross * (1 + guest));
      const net = up(gross * (1 - host) * (1 - tax) * (1 - vat));
      return { ...r, gross, guestPrice, net };
    });
  }, [priceTable, overrides, platforms]);
  const [scopePlatform, setScopePlatform] = useState<PlatformKey>('airbnb');
  const scopedRows = rows.filter((r) => r.platform === scopePlatform);
  const scopedTotals = useMemo(() => {
    const bySeason: Record<string, { nights: number; gross: number; guest: number; net: number }> = {};
    for (const s of seasonality.types) {
      bySeason[s] = { nights: 0, gross: 0, guest: 0, net: 0 };
    }
    let grand = { nights: 0, gross: 0, guest: 0, net: 0 };
    scopedRows.forEach((r) => {
      const nights = nightsBySeasonDay[r.season]?.[r.dayType] ?? 0;
      const grossTotal = r.gross * nights;
      const guestTotal = r.guestPrice * nights;
      const netTotal = r.net * nights;
      bySeason[r.season].nights += nights;
      bySeason[r.season].gross += grossTotal;
      bySeason[r.season].guest += guestTotal;
      bySeason[r.season].net += netTotal;
      grand.nights += nights;
      grand.gross += grossTotal;
      grand.guest += guestTotal;
      grand.net += netTotal;
    });
    return { bySeason, grand };
  }, [scopedRows, nightsBySeasonDay, seasonality.types]);
  function setOverride(row: PriceRow, grossStr: string) {
    const k = keyFor(row);
    const g = Number(grossStr);
    if (Number.isNaN(g) || g <= 0) return;
    setOverrides((m) => ({ ...m, [k]: { gross: g, locked: m[k]?.locked ?? true } }));
  }
  function toggleLock(row: PriceRow, on?: boolean) {
    const k = keyFor(row);
    setOverrides((m) => ({ ...m, [k]: { gross: m[k]?.gross ?? row.gross, locked: on ?? !m[k]?.locked } }));
  }
  function clearOverride(row: PriceRow) {
    const k = keyFor(row);
    setOverrides((m) => {
      const { [k]: _, ...rest } = m;
      return rest;
    });
  }
  function exportCSV() {
    const header = [
      'Platform','Season','DayType','DP','Gross','GuestPrice','Net','Nights','GrossTotal','GuestTotal','NetTotal',
    ];
    const lines = [header.join(',')];
    scopedRows.forEach((r) => {
      const nights = nightsBySeasonDay[r.season]?.[r.dayType] ?? 0;
      const row = [
        labelFor(r.platform), r.season, r.dayType,
        r.dp, r.gross, r.guestPrice, r.net,
        nights,
        r.gross * nights,
        r.guestPrice * nights,
        r.net * nights,
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    download(url, `dynamic-pricing-${scopePlatform}.csv`);
  }
  return (
    <section className="max-w-7xl mx-auto p-6">
      <header className="flex items-center justify-between mb-4">
        <button className="underline" onClick={onBack}>Back</button>
        <div className="text-sm">Step 4 of 5</div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Legend and totals */}
        <aside className="lg:col-span-1 rounded-xl border p-4 sticky top-4 h-fit">
          <div className="text-sm font-medium mb-2">Legend</div>
          <ul className="text-sm space-y-2">
            <li><b>DP</b> – base before padding and multipliers.</li>
            <li><b>Gross</b> – platform nightly rate before guest fee, rounded to even.</li>
            <li><b>Guest</b> – what the guest sees (gross + guest fee).</li>
            <li><b>Net</b> – your payout after commission, VAT and tax.</li>
            <li><b>Nights</b> – estimated booked nights from occupancy splits.</li>
          </ul>
          <div className="mt-6">
            <label className="block text-sm mb-1">Totals for platform</label>
            <select
              className="h-10 w-full border rounded-lg px-3"
              value={scopePlatform}
              onChange={(e) => setScopePlatform(e.target.value as PlatformKey)}
            >
              {(['airbnb','booking','vrbo','website','dtravel'] as PlatformKey[]).map((pk) => (
                <option key={pk} value={pk}>{labelFor(pk)}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 border rounded-lg p-3">
            <div className="text-sm font-medium mb-2">Year totals</div>
            <Stat label="Nights" value={String(scopedTotals.grand.nights)} />
            <Stat label="Gross" value={fmt(currency, scopedTotals.grand.gross)} />
            <Stat label="Guest" value={fmt(currency, scopedTotals.grand.guest)} />
            <Stat label="Net" value={fmt(currency, scopedTotals.grand.net)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="h-10 rounded-lg bg-black text-white" onClick={exportCSV}>Export CSV</button>
            <button className="h-10 rounded-lg border" onClick={() => alert('Copy for Sheets not implemented')}>Copy for Sheets</button>
            <button className="h-10 rounded-lg border col-span-2" onClick={() => window.print()}>Print to PDF</button>
          </div>
        </aside>
        {/* Table */}
        <div className="lg:col-span-3 rounded-xl border">
          <div className="p-3 text-sm border-b flex items-center justify-between flex-wrap gap-2">
            <div>Price table — {labelFor(scopePlatform)}</div>
            <div className="text-xs text-gray-600">Edit Gross to override. Lock keeps your value across recalcs.</div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">Season</th>
                  <th className="py-2 px-2">Day</th>
                  <th className="py-2 px-2">DP</th>
                  <th className="py-2 px-2">Gross</th>
                  <th className="py-2 px-2">Guest</th>
                  <th className="py-2 px-2">Net</th>
                  <th className="py-2 px-2">Nights</th>
                  <th className="py-2 px-2">Gross total</th>
                  <th className="py-2 px-2">Net total</th>
                  <th className="py-2 px-2">Lock</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {seasonality.types.map((s: string) => (
                  (['weekday','weekend','holiday'] as DayType[]).map((d) => {
                    const r = scopedRows.find((x) => x.season === s && x.dayType === d);
                    if (!r) return null;
                    const k = keyFor(r);
                    const o = overrides[k];
                    const nights = nightsBySeasonDay[s]?.[d] ?? 0;
                    return (
                      <tr key={k} className="border-b last:border-b-0">
                        <td className="py-2 px-2">{s}</td>
                        <td className="py-2 px-2 capitalize">{d}</td>
                        <td className="py-2 px-2">{fmt(currency, r.dp)}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            className="h-9 w-24 border rounded-lg px-2"
                            value={o?.gross ?? r.gross}
                            onChange={(e) => setOverride(r, e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-2">{fmt(currency, r.guestPrice)}</td>
                        <td className="py-2 px-2">{fmt(currency, r.net)}</td>
                        <td className="py-2 px-2">{nights}</td>
                        <td className="py-2 px-2">{fmt(currency, r.gross * nights)}</td>
                        <td className="py-2 px-2">{fmt(currency, r.net * nights)}</td>
                        <td className="py-2 px-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={o?.locked ?? false}
                              onChange={(e) => toggleLock(r, e.target.checked)}
                            />
                            <span className="text-xs">lock</span>
                          </label>
                        </td>
                        <td className="py-2 px-2">
                          {o && (
                            <button className="text-xs underline" onClick={() => clearOverride(r)}>reset</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {seasonality.types.map((s: string) => {
              const t = scopedTotals.bySeason[s];
              return (
                <div key={s} className="border rounded-lg p-3">
                  <div className="text-sm font-medium mb-1">{s} totals</div>
                  <div className="text-xs text-gray-600 mb-2">Platform: {labelFor(scopePlatform)}</div>
                  <Stat label="Nights" value={String(t.nights)} />
                  <Stat label="Gross" value={fmt(currency, t.gross)} />
                  <Stat label="Guest" value={fmt(currency, t.guest)} />
                  <Stat label="Net" value={fmt(currency, t.net)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="underline mr-3" onClick={onBack}>Back</button>
        <button className="h-11 px-4 bg-black text-white rounded-lg" onClick={onNext}>Continue</button>
      </div>
    </section>
  );
}

function toEven(n: number) {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}
function up(n: number) {
  return Math.ceil(n);
}
function fmt(c: string, v: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(v);
}
function labelFor(pk: PlatformKey) {
  return pk === 'airbnb'
    ? 'Airbnb'
    : pk === 'booking'
    ? 'Booking.com'
    : pk === 'vrbo'
    ? 'VRBO'
    : pk === 'website'
    ? 'My Website'
    : 'DTravel';
}
function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}