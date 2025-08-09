"use client";
import { useEffect, useMemo, useState } from 'react';

type CountryCode = 'US' | 'UK' | 'DE' | 'NL' | 'SE';
interface Holiday {
  id: string;
  name: string;
  date: string;
  country: CountryCode;
  isObserved: boolean;
  suggestBufferDays: number;
}
interface HolidaySettings {
  multiplier: number;
  applyToObserved: boolean;
  maxBufferDays: number;
  activeCountries: CountryCode[];
  year: number;
}

interface MergedHoliday {
  date: string;
  name: string;
  countries: CountryCode[];
  enabled: boolean;
  buffer: number;
}

export default function HolidaysBlock({
  onChange,
}: {
  onChange: (payload: { settings: HolidaySettings; merged: MergedHoliday[] }) => void;
}) {
  const [settings, setSettings] = useState<HolidaySettings>({
    multiplier: 1.4,
    applyToObserved: true,
    maxBufferDays: 2,
    activeCountries: ['US','UK','DE','NL','SE'],
    year: new Date().getFullYear(),
  });
  const [raw, setRaw] = useState<Holiday[]>([]);
  const [perDateBuffer, setPerDateBuffer] = useState<Record<string, number>>({});
  const [perDateEnabled, setPerDateEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchHolidaysStub(settings.year, settings.activeCountries).then(setRaw);
  }, [settings.year, settings.activeCountries.join('|')]);

  const merged = useMemo(() => {
    const rows = mergeAndDedupe(raw, settings.applyToObserved).map((row) => ({
      ...row,
      buffer: Math.min(perDateBuffer[row.date] ?? row.suggestBufferDays, settings.maxBufferDays),
      enabled: perDateEnabled[row.date] ?? true,
    }));
    onChange({ settings, merged: rows });
    return rows;
  }, [raw, settings, perDateBuffer, perDateEnabled]);

  return (
    <div className="rounded-xl border">
      <div className="p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">Year</label>
          <input
            type="number"
            className="h-10 w-28 border rounded-lg px-3"
            value={settings.year}
            onChange={(e) => setSettings((s) => ({ ...s, year: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Countries</label>
          <select
            multiple
            className="h-24 w-56 border rounded-lg px-3"
            value={settings.activeCountries}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value as CountryCode);
              setSettings((s) => ({ ...s, activeCountries: opts }));
            }}
          >
            {(['US','UK','DE','NL','SE'] as CountryCode[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Hold Ctrl or Cmd to multi‑select</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Holiday multiplier</label>
          <input
            type="number"
            step="0.05"
            min={1}
            max={3}
            className="h-10 w-36 border rounded-lg px-3"
            value={settings.multiplier}
            onChange={(e) => setSettings((s) => ({ ...s, multiplier: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Max buffer days ±</label>
          <input
            type="number"
            min={0}
            max={3}
            className="h-10 w-24 border rounded-lg px-3"
            value={settings.maxBufferDays}
            onChange={(e) => setSettings((s) => ({ ...s, maxBufferDays: Number(e.target.value) }))}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.applyToObserved}
            onChange={(e) => setSettings((s) => ({ ...s, applyToObserved: e.target.checked }))}
          />
          <span className="text-sm">Apply to observed days</span>
        </label>
      </div>
      <div className="p-4 border-t">
        <div className="text-sm font-medium mb-2">Holiday dates – merged</div>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Countries</th>
                <th className="py-2 pr-2">Buffer ±</th>
                <th className="py-2 pr-2">Use</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((r) => (
                <tr key={r.date} className="border-b last:border-b-0">
                  <td className="py-2 pr-2">{r.date}</td>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-1">
                      {r.countries.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={settings.maxBufferDays}
                      className="h-9 w-16 border rounded-lg px-2"
                      value={r.buffer}
                      onChange={(e) => setPerDateBuffer((m) => ({ ...m, [r.date]: Number(e.target.value) }))}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) => setPerDateEnabled((m) => ({ ...m, [r.date]: e.target.checked }))}
                      />
                      <span className="text-xs">on</span>
                    </label>
                  </td>
                </tr>
              ))}
              {merged.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={5}>No holidays for current filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          We do not stack weekend and holiday multipliers. The higher multiplier wins on any given date.
        </p>
      </div>
    </div>
  );
}

async function fetchHolidaysStub(year: number, countries: CountryCode[]): Promise<Holiday[]> {
  // Replace later with real API calls; minimal seed for demonstration
  const seed: Holiday[] = [
    { id: `${year}-01-01_US`, name: "New Year's Day", date: `${year}-01-01`, country: 'US', isObserved: false, suggestBufferDays: 0 },
    { id: `${year}-01-01_UK`, name: "New Year's Day", date: `${year}-01-01`, country: 'UK', isObserved: false, suggestBufferDays: 0 },
    { id: `${year}-12-25_US`, name: 'Christmas Day', date: `${year}-12-25`, country: 'US', isObserved: false, suggestBufferDays: 1 },
    { id: `${year}-12-25_UK`, name: 'Christmas Day', date: `${year}-12-25`, country: 'UK', isObserved: false, suggestBufferDays: 1 },
    { id: `${year}-12-26_UK`, name: 'Boxing Day', date: `${year}-12-26`, country: 'UK', isObserved: false, suggestBufferDays: 0 },
  ];
  return seed.filter((h) => countries.includes(h.country));
}

function mergeAndDedupe(hols: Holiday[], applyObserved: boolean) {
  const map: Record<string, Holiday[]> = {};
  hols.forEach((h) => {
    if (!applyObserved && h.isObserved) return;
    map[h.date] = map[h.date] ? [...map[h.date], h] : [h];
  });
  return Object.entries(map).map(([date, list]) => {
    const name = pickName(list.map((x) => x.name));
    const countries = Array.from(new Set(list.map((x) => x.country as CountryCode)));
    const suggestBufferDays = Math.max(...list.map((x) => x.suggestBufferDays));
    return { date, name, countries, enabled: true, buffer: suggestBufferDays };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function pickName(names: string[]) {
  const priority = ['christmas','new year','easter','independence','labor'];
  const found = names.find((n) => priority.some((p) => n.toLowerCase().includes(p)));
  return found ?? names[0];
}