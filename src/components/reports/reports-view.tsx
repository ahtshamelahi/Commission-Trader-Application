'use client';

// src/components/reports/reports-view.tsx  (PDF generator included in this file)
import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, Receipt, ShoppingCart, TrendingUp, FileDown, ExternalLink } from 'lucide-react';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { Expense } from '@/types/expense-data-types';
import { StockMovement } from '@/types/stock-data-types';

/* ----------------------------- PDF generator ----------------------------- */
const SHOP_NAME = 'M Shafiq Commission Shoppp';

type TradeKind = 'sales' | 'purchases';

interface TradeReportRow {
  date: string;
  party: string;
  ref: string;
  vehicleNumber: string;
  crop: string;
  totalWeight: number;
  commissionWeight: number;
  bardana: number;
  finalWeight: number; // total - commission - bardana
  pricePerMaund: number;
  itemAmount: number;
  expenses: number; // net: expenses added, income subtracted
  grandTotal: number;
}

type ExpenseRow = { amount?: number | string | null; is_income?: boolean | null };

const nf = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

const prettyDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function buildTradeReportPdf(opts: {
  kind: TradeKind;
  rows: TradeReportRow[];
  from: string;
  to: string;
}) {
  const { kind, rows, from, to } = opts;
  const isSales = kind === 'sales';
  const partyLabel = isSales ? 'Buyer' : 'Seller';
  const title = isSales ? 'Sales Report' : 'Purchase Report';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ----- Heading (centered) -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(SHOP_NAME, pageW / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const rangeText =
    from || to
      ? `${from ? prettyDate(from) : 'Beginning'}  to  ${to ? prettyDate(to) : 'Present'}`
      : 'All dates';
  doc.text(`${title}   |   ${rangeText}`, pageW / 2, 19, { align: 'center' });

  doc.setDrawColor(200, 210, 215);
  doc.line(10, 22, pageW - 10, 22);

  // ----- Table data -----
  const sum = (k: keyof TradeReportRow) => rows.reduce((t, r) => t + (r[k] as number), 0);

  const head = [
    'Date',
    'Transaction No',
    `${partyLabel} Name`,
    'Vehicle No.',
    'Crop',
    'Total Weight (kg)',
    'Commission Wt (kg)',
    'Bardana (kg)',
    'Final Weight (kg)',
    'Rate / 40 kg',
    'Item Amount',
    'Expenses',
    'Grand Total',
  ];

  const body = rows.map((r) => [
    prettyDate(r.date),
    r.ref,
    r.party,
    r.vehicleNumber || '—',
    r.crop,
    nf(r.totalWeight),
    nf(r.commissionWeight),
    nf(r.bardana),
    nf(r.finalWeight),
    nf(r.pricePerMaund),
    nf(r.itemAmount),
    nf(r.expenses),
    nf(r.grandTotal),
  ]);

  const foot = [
    { content: `Total (${rows.length} records)`, colSpan: 5, styles: { halign: 'right' as const } },
    nf(sum('totalWeight')),
    nf(sum('commissionWeight')),
    nf(sum('bardana')),
    nf(sum('finalWeight')),
    '',
    nf(sum('itemAmount')),
    nf(sum('expenses')),
    nf(sum('grandTotal')),
  ];

  // numeric columns (index 5 onwards) are right-aligned
  const columnStyles: Record<number, { halign: 'right'; fontStyle?: 'bold' }> = {};
  for (let i = 5; i < head.length; i++) columnStyles[i] = { halign: 'right' };
  columnStyles[12] = { halign: 'right', fontStyle: 'bold' }; // Grand Total bold

  // ----- Table (small font so many rows fit on one page) -----
  autoTable(doc, {
    head: [head],
    body,
    foot: [foot],
    showFoot: 'lastPage',
    startY: 25,
    margin: { top: 12, left: 10, right: 10, bottom: 12 },
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 0.9, bottom: 0.9, left: 1.2, right: 1.2 },
      lineColor: [210, 218, 224],
      lineWidth: 0.1,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: [226, 240, 233], textColor: [15, 23, 42], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 249, 248] },
    columnStyles,
  });

  // ----- Footer on every page -----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 10, pageH - 6);
    doc.text(`Page ${i} of ${pages}`, pageW - 10, pageH - 6, { align: 'right' });
  }

  const fileName = `${kind}-report_${from || 'start'}_to_${to || 'today'}.pdf`;
  return { doc, fileName };
}

/* ------------------------- map DB rows -> report rows ------------------------- */
const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toISODate = (v: unknown) => {
  if (!v) return '';
  const s = String(v);
  if (s.length === 10) return s; // already YYYY-MM-DD
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : localISO(d);
};

const partyName = (p: unknown) => (p as { name?: string } | undefined)?.name ?? '-';
const cropName = (c: unknown) => (c as { name?: string } | undefined)?.name ?? '-';
const byDate = (a: TradeReportRow, b: TradeReportRow) => a.date.localeCompare(b.date);

// expense (is_income = false) is ADDED, income (is_income = true) is SUBTRACTED
// If your app works the other way round, flip the sign here.
const netExpenses = (list?: ExpenseRow[] | null) =>
  (list ?? []).reduce((s, e) => s + (e.is_income ? -1 : 1) * toNum(e.amount), 0);

function normalizeSales(rows: Sale[]): TradeReportRow[] {
  return rows
    .map((r) => {
      const x = r as unknown as {
        crops?: unknown;
        bardana_total_kg?: unknown;
        sale_expenses?: ExpenseRow[];
      };
      const itemAmount = toNum(r.sale_amount);
      const expenses = netExpenses(x.sale_expenses);
      return {
        date: toISODate(r.created_at),
        party: partyName(r.parties),
        ref: r.invoice_no ?? String(r.id),
        vehicleNumber: r.vehicle_number || '',
        crop: cropName(x.crops),
        totalWeight: toNum(r.physical_weight_kg),
        commissionWeight: toNum(r.commission_weight_kg),
        bardana: toNum(x.bardana_total_kg),
        finalWeight: 0, // set below
        pricePerMaund: toNum(r.rate_per_40kg),
        itemAmount,
        expenses,
        grandTotal: itemAmount + expenses,
      };
    })
    .map((r) => ({ ...r, finalWeight: r.totalWeight - r.commissionWeight - r.bardana }))
    .sort(byDate);
}

function normalizePurchases(rows: Purchase[]): TradeReportRow[] {
  return rows
    .map((r) => {
      const x = r as unknown as {
        crops?: unknown;
        bardana_total_kg?: unknown;
        purchase_expenses?: ExpenseRow[];
      };
      const itemAmount = toNum(r.crop_amount);
      const expenses = netExpenses(x.purchase_expenses);
      return {
        date: toISODate(r.created_at),
        party: partyName(r.parties),
        ref: r.invoice_no ?? String(r.id),
        vehicleNumber: r.vehicle_number || '',
        crop: cropName(x.crops),
        totalWeight: toNum(r.gross_weight_kg),
        commissionWeight: toNum(r.commission_weight_kg),
        bardana: toNum(x.bardana_total_kg),
        finalWeight: 0, // set below
        pricePerMaund: toNum(r.rate_per_40kg),
        itemAmount,
        expenses,
        grandTotal: itemAmount + expenses,
      };
    })
    .map((r) => ({ ...r, finalWeight: r.totalWeight - r.commissionWeight - r.bardana }))
    .sort(byDate);
}

/* ----------------------------- date presets ----------------------------- */
type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

function presetRange(p: Preset): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'today':
      return { from: localISO(now), to: localISO(now) };
    case 'week': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: localISO(s), to: localISO(now) };
    }
    case 'month':
      return { from: localISO(new Date(y, m, 1)), to: localISO(now) };
    case 'lastMonth':
      return { from: localISO(new Date(y, m - 1, 1)), to: localISO(new Date(y, m, 0)) };
    case 'all':
      return { from: '', to: '' };
    default:
      return null;
  }
}

/* -------------------------------- component ------------------------------- */
interface ReportsViewProps {
  crops: Crop[];
  parties: Party[];
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  movements: StockMovement[];
  isLoading: boolean;
}

type Active = 'sales' | 'purchases' | 'profit-loss' | null;

export function ReportsView({ purchases, sales, isLoading }: ReportsViewProps) {
  const [active, setActive] = useState<Active>(null);
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(() => presetRange('month')!.from);
  const [to, setTo] = useState(() => presetRange('month')!.to);

  const kind: TradeKind | null = active === 'sales' || active === 'purchases' ? active : null;

  const allRows = useMemo(
    () => ({
      sales: normalizeSales(sales),
      purchases: normalizePurchases(purchases),
    }),
    [sales, purchases]
  );

  const rows = useMemo(() => {
    if (!kind) return [];
    return allRows[kind].filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  }, [allRows, kind, from, to]);

  const totalPrice = rows.reduce((s, r) => s + r.itemAmount, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalGrand = rows.reduce((s, r) => s + r.grandTotal, 0);
  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

  const choosePreset = (p: Preset) => {
    setPreset(p);
    const r = presetRange(p);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const makePdf = (mode: 'open' | 'download') => {
    if (!kind || rows.length === 0) return;
    const { doc, fileName } = buildTradeReportPdf({ kind, rows, from, to });
    if (mode === 'download') doc.save(fileName);
    else window.open(doc.output('bloburl') as unknown as string, '_blank');
  };

  const cards = [
    {
      id: 'sales' as const,
      title: 'Sales Report',
      note: 'Buyers, weights, rates and totals',
      Icon: Receipt,
      enabled: true,
    },
    {
      id: 'purchases' as const,
      title: 'Purchase Report',
      note: 'Sellers, weights, rates and totals',
      Icon: ShoppingCart,
      enabled: true,
    },
    {
      id: 'profit-loss' as const,
      title: 'Profit / Loss Report',
      note: 'Coming next',
      Icon: TrendingUp,
      enabled: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* THREE REPORT BUTTONS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ id, title, note, Icon, enabled }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled || isLoading}
              onClick={() => setActive(id)}
              className={`text-left rounded-2xl border p-5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed ${selected
                ? 'bg-emerald-700 border-emerald-700 text-white shadow-lg shadow-emerald-900/20'
                : 'bg-white border-slate-200 text-slate-900 hover:border-emerald-400 hover:shadow-md disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:shadow-none'
                }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${selected ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'
                  }`}
              >
                {isLoading && enabled ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div className="text-lg font-extrabold tracking-tight">{title}</div>
              <div className={`mt-1 text-sm ${selected ? 'text-emerald-100' : 'text-slate-500'}`}>{note}</div>
            </button>
          );
        })}
      </div>

      {/* FILTERS + GENERATE */}
      {kind && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              {kind === 'sales' ? 'Sales Report' : 'Purchase Report'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">Choose the period, then generate the PDF.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePreset(p.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${preset === p.id
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-500'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">From</label>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset('custom');
                }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">To</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('custom');
                }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* summary of what will be in the PDF */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
            {rows.length === 0 ? (
              <span className="font-semibold">
                No {kind === 'sales' ? 'sales' : 'purchases'} found
                {from || to ? ` between ${from ? prettyDate(from) : 'the beginning'} and ${to ? prettyDate(to) : 'today'}` : ''}.
              </span>
            ) : (
              <span>
                <span className="font-bold">{rows.length}</span> {kind === 'sales' ? 'sales' : 'purchases'} · Item amount{' '}
                <span className="font-bold">{fmt(totalPrice)}</span> · Expenses{' '}
                <span className="font-bold">{fmt(totalExpenses)}</span> · Grand total{' '}
                <span className="font-bold">{fmt(totalGrand)}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => makePdf('open')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Generate PDF
            </button>
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => makePdf('download')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}