'use client';

import React, { useState } from 'react';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { Expense } from '@/types/expense-data-types';
import { StockMovement } from '@/types/stock-data-types';
import { calculateProfitAndLoss } from '@/lib/calculations/profit-loss-calculation';
import { buildCropStockSummary } from '@/lib/calculations/current-stock-calculation';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { PrimaryButton } from '@/components/ui/primary-button';
import { DropdownSelectField } from '@/components/ui/dropdown-select-field';
import { TextInputField } from '@/components/ui/text-input-field';
import { Printer, Download, Filter, BarChart3, ShoppingCart, TrendingUp, Boxes, Receipt } from 'lucide-react';

interface ReportsViewProps {
  crops: Crop[];
  parties: Party[];
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  movements: StockMovement[];
  isLoading?: boolean;
}

export function ReportsView({
  crops,
  parties,
  purchases,
  sales,
  expenses,
  movements,
  isLoading = false,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<'pnl' | 'purchases' | 'sales' | 'stock' | 'expenses'>('pnl');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');

  // Date Filtering Helper
  const filterByDate = <T extends { created_at?: string; expense_date?: string }>(items: T[]) => {
    return items.filter((item) => {
      const dateStr = item.created_at || item.expense_date;
      if (!dateStr) return true;
      const itemDate = new Date(dateStr).getTime();

      if (startDate && itemDate < new Date(startDate).getTime()) return false;
      if (endDate && itemDate > new Date(endDate).setHours(23, 59, 59, 999)) return false;
      return true;
    });
  };

  // Filtered Datasets
  let filteredPurchases = filterByDate(purchases);
  let filteredSales = filterByDate(sales);
  let filteredExpenses = filterByDate(expenses);

  if (selectedCropId) {
    const cid = Number(selectedCropId);
    filteredPurchases = filteredPurchases.filter((p) => p.crop_id === cid);
    filteredSales = filteredSales.filter((s) => s.crop_id === cid);
  }

  if (selectedPartyId) {
    const pid = Number(selectedPartyId);
    filteredPurchases = filteredPurchases.filter((p) => p.supplier_id === pid);
    filteredSales = filteredSales.filter((s) => s.buyer_id === pid);
  }

  // Calculated Summaries
  const pnl = calculateProfitAndLoss(filteredSales, filteredPurchases, filteredExpenses);

  const cropSummaries = crops.map((c) =>
    buildCropStockSummary(c.id, c.name, filteredPurchases, filteredSales, movements)
  );

  const handlePrint = () => {
    window.print();
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `report-${activeTab}.csv`;

    if (activeTab === 'purchases') {
      headers = ['Invoice No', 'Crop', 'Supplier', 'Bags', 'Gross Weight (kg)', 'Net Weight (kg)', 'Rate/40kg', 'Crop Amount (PKR)', 'Date'];
      rows = filteredPurchases.map((p) => [
        p.invoice_no || '',
        p.crops?.name || '',
        p.parties?.name || '',
        String(p.bags || 0),
        String(p.gross_weight_kg || 0),
        String(p.net_weight_kg || 0),
        String(p.rate_per_40kg || 0),
        String(p.crop_amount || 0),
        new Date(p.created_at).toLocaleDateString('en-PK'),
      ]);
    } else if (activeTab === 'sales') {
      headers = ['Invoice No', 'Crop', 'Buyer', 'Physical Weight Delivered (kg)', 'Billable Weight (kg)', 'Rate/40kg', 'Sale Amount (PKR)', 'Date'];
      rows = filteredSales.map((s) => [
        s.invoice_no || '',
        s.crops?.name || '',
        s.parties?.name || '',
        String(s.physical_weight_kg || 0),
        String(s.billable_weight_kg || 0),
        String(s.rate_per_40kg || 0),
        String(s.sale_amount || 0),
        new Date(s.created_at).toLocaleDateString('en-PK'),
      ]);
    } else if (activeTab === 'expenses') {
      headers = ['ID', 'Category', 'Amount (PKR)', 'Notes', 'Date'];
      rows = filteredExpenses.map((e) => [
        String(e.id),
        e.category,
        String(e.amount),
        e.notes || '',
        new Date(e.expense_date).toLocaleDateString('en-PK'),
      ]);
    } else {
      headers = ['Crop Name', 'Total Purchased (kg)', 'Total Sold (kg)', 'Available Stock (kg)', 'Avg Cost/40kg', 'Avg Cost/kg'];
      rows = cropSummaries.map((cs) => [
        cs.name,
        String(cs.totalPurchasedWeightKg),
        String(cs.totalSoldPhysicalWeightKg),
        String(cs.currentAvailableStockKg),
        String(cs.averageCostPer40KgPkr),
        String(cs.averageCostPerKgPkr),
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar (Filters & Export) - Hidden during print */}
      <div className="no-print bg-white p-4 border border-slate-200 rounded-md shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pnl')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'pnl' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5 inline mr-1" /> Profit & Loss
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'purchases' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 inline mr-1" /> Purchases
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'sales' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> Sales
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'stock' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Boxes className="w-3.5 h-3.5 inline mr-1" /> Stock Inventory
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'expenses' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Receipt className="w-3.5 h-3.5 inline mr-1" /> Expenses
            </button>
          </div>

          <div className="flex items-center gap-2">
            <PrimaryButton variant="outline" onClick={handleExportCSV} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> CSV Export
            </PrimaryButton>
            <PrimaryButton variant="secondary" onClick={handlePrint} className="text-xs">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
            </PrimaryButton>
          </div>
        </div>

        {/* Date & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <TextInputField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextInputField
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <DropdownSelectField
            label="Filter Crop"
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            options={crops.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All Crops"
          />
          <DropdownSelectField
            label="Filter Party"
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            options={parties.map((p) => ({ value: p.id, label: `${p.name} (${p.party_type})` }))}
            placeholder="All Parties"
          />
        </div>
      </div>

      {/* Printable Report Document View */}
      <div className="bg-white border border-slate-200 rounded-md p-6 shadow-2xs print-shadow-none">
        {/* Printable Letterhead Header */}
        <div className="border-b border-slate-200 pb-4 mb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 uppercase">M-Shafiq Commission Shop</h1>
            <p className="text-xs text-slate-500">Pakistani Crop Trading & Financial Statement</p>
          </div>
          <div className="mt-3 sm:mt-0 text-right text-xs text-slate-500">
            <p className="font-bold text-slate-800">
              Report: {activeTab.toUpperCase()}
            </p>
            <p>Generated: {new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
            {(startDate || endDate) && (
              <p className="text-emerald-700 font-semibold">
                Period: {startDate || 'Beginning'} to {endDate || 'Present'}
              </p>
            )}
          </div>
        </div>

        {/* Tab 1: Profit & Loss Statement */}
        {activeTab === 'pnl' && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 uppercase">
              Crop Profit & Loss Statement (Weighted-Average Costing)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm shadow-2xs hover:border-slate-300 transition-all">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Total Sales Revenue</span>
                <span className="text-lg font-bold tracking-tight text-slate-900 mt-2 block">Rs. {pnl.totalSaleRevenuePkr.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm shadow-2xs hover:border-slate-300 transition-all">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Cost of Physical Goods Sold</span>
                <span className="text-lg font-bold tracking-tight text-slate-800 mt-2 block">Rs. {pnl.totalCostOfGoodsSoldPkr.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm shadow-2xs hover:border-emerald-300 transition-all">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">Gross Profit</span>
                <span className="text-lg font-bold tracking-tight text-emerald-800 mt-2 block">Rs. {pnl.grossProfitPkr.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-sm shadow-2xs hover:border-rose-300 transition-all">
                <span className="text-[10px] font-bold text-rose-800 uppercase block tracking-wider">Total Operating Expenses</span>
                <span className="text-lg font-bold tracking-tight text-rose-700 mt-2 block">Rs. {pnl.totalOperatingExpensesPkr.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-800 text-white rounded-sm flex items-center justify-between shadow-2xs">
              <div>
                <h3 className="text-base font-bold">Net Profit / Loss for Selected Period</h3>
                <p className="text-[10px] text-emerald-200 mt-0.5">Net Profit = Gross Profit − Operating Expenses</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold tracking-tight">Rs. {pnl.netProfitPkr.toLocaleString()}</span>
                <p className="text-[10px] font-medium text-emerald-200 mt-1">Margin: {pnl.profitMarginPercent}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Purchases Report */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 uppercase">
              Purchases Report Summary
            </h2>
            <ReusableDataTable
              columns={[
                { header: 'Invoice #', accessorKey: 'invoice_no' },
                { header: 'Crop', cell: (r: Purchase) => r.crops?.name },
                { header: 'Supplier', cell: (r: Purchase) => r.parties?.name },
                { header: 'Bags', accessorKey: 'bags', align: 'center' },
                { header: 'Gross (kg)', cell: (r: Purchase) => `${r.gross_weight_kg} kg`, align: 'right' },
                { header: 'Net (kg)', cell: (r: Purchase) => `${r.net_weight_kg} kg`, align: 'right' },
                { header: 'Rate/40kg', cell: (r: Purchase) => `Rs. ${r.rate_per_40kg}`, align: 'right' },
                { header: 'Crop Amount', cell: (r: Purchase) => `Rs. ${Number(r.crop_amount).toLocaleString()}`, align: 'right' },
              ]}
              data={filteredPurchases}
            />
          </div>
        )}

        {/* Tab 3: Sales Report */}
        {activeTab === 'sales' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 uppercase">
              Sales Report Summary
            </h2>
            <ReusableDataTable
              columns={[
                { header: 'Invoice #', accessorKey: 'invoice_no' },
                { header: 'Crop', cell: (r: Sale) => r.crops?.name },
                { header: 'Buyer', cell: (r: Sale) => r.parties?.name },
                { header: 'Delivered (kg)', cell: (r: Sale) => `${r.physical_weight_kg} kg`, align: 'right' },
                { header: 'Billable (kg)', cell: (r: Sale) => `${r.billable_weight_kg} kg`, align: 'right' },
                { header: 'Rate/40kg', cell: (r: Sale) => `Rs. ${r.rate_per_40kg}`, align: 'right' },
                { header: 'Sale Amount', cell: (r: Sale) => `Rs. ${Number(r.sale_amount).toLocaleString()}`, align: 'right' },
              ]}
              data={filteredSales}
            />
          </div>
        )}

        {/* Tab 4: Current Stock Report */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 uppercase">
              Current Physical Stock Valuation Report
            </h2>
            <ReusableDataTable
              columns={[
                { header: 'Crop Category', accessorKey: 'name' },
                { header: 'Total Purchased (kg)', cell: (r) => `${r.totalPurchasedWeightKg} kg`, align: 'right' },
                { header: 'Total Sold (kg)', cell: (r) => `${r.totalSoldPhysicalWeightKg} kg`, align: 'right' },
                { header: 'Available Stock (kg)', cell: (r) => `${r.currentAvailableStockKg} kg`, align: 'right' },
                { header: 'Avg Cost / Maund', cell: (r) => `Rs. ${r.averageCostPer40KgPkr.toLocaleString()}`, align: 'right' },
                { header: 'Inventory Value', cell: (r) => `Rs. ${r.totalPurchaseValuePkr.toLocaleString()}`, align: 'right' },
              ]}
              data={cropSummaries}
            />
          </div>
        )}

        {/* Tab 5: Expenses Report */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 uppercase">
              Operational Expense Report Summary
            </h2>
            <ReusableDataTable
              columns={[
                { header: 'ID', accessorKey: 'id' },
                { header: 'Category', accessorKey: 'category' },
                { header: 'Amount (PKR)', cell: (r: Expense) => `Rs. ${Number(r.amount).toLocaleString()}`, align: 'right' },
                { header: 'Notes', accessorKey: 'notes' },
                { header: 'Date', cell: (r: Expense) => new Date(r.expense_date).toLocaleDateString('en-PK'), align: 'right' },
              ]}
              data={filteredExpenses}
            />
          </div>
        )}
      </div>
    </div>
  );
}
