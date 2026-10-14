// src/lib/reports/trade-report-pdf.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const SHOP_NAME = 'M Shafiq Commission Shop';

export type TradeKind = 'sales' | 'purchases';

export interface TradeReportRow {
    date: string; // YYYY-MM-DD
    party: string; // buyer (sales) or seller (purchases)
    ref: string; // id / bill number
    totalWeight: number;
    commissionWeight: number;
    pricePerMaund: number;
    totalPrice: number;
    expenses: number;
}

const nf = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

export const prettyDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

async function loadBase64Image(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export async function buildTradeReportPdf(opts: {
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

    // Load logo
    const logoData = await loadBase64Image('/images/shafiq shop logo.jpeg');

    // ----- Heading (centered with logo) -----
    if (logoData) {
        try {
            doc.addImage(logoData, 'JPEG', pageW / 2 - 45, 7, 9, 9);
        } catch {
            // ignore
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(SHOP_NAME, pageW / 2, 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const rangeText =
        from || to
            ? `${from ? prettyDate(from) : 'Beginning'}  to  ${to ? prettyDate(to) : 'Present'}`
            : 'All dates';
    doc.text(`${title}   |   ${rangeText}`, pageW / 2, 19, { align: 'center' });

    doc.setDrawColor(200, 210, 215);
    doc.line(10, 22, pageW - 10, 22);

    // ----- Totals -----
    const sum = (k: keyof TradeReportRow) => rows.reduce((s, r) => s + (r[k] as number), 0);

    // ----- Table (small font so many rows fit on one page) -----
    autoTable(doc, {
        head: [
            [
                'Date',
                `${partyLabel} Name`,
                'ID',
                'Total Weight',
                'Commission Weight',
                'Price / Maund',
                'Total Price',
                'Expenses',
            ],
        ],
        body: rows.map((r) => [
            prettyDate(r.date),
            r.party,
            r.ref,
            nf(r.totalWeight),
            nf(r.commissionWeight),
            nf(r.pricePerMaund),
            nf(r.totalPrice),
            nf(r.expenses),
        ]),
        foot: [
            [
                { content: `Total (${rows.length} records)`, colSpan: 3, styles: { halign: 'right' } },
                nf(sum('totalWeight')),
                nf(sum('commissionWeight')),
                '',
                nf(sum('totalPrice')),
                nf(sum('expenses')),
            ],
        ],
        showFoot: 'lastPage',
        startY: 25,
        margin: { top: 12, left: 10, right: 10, bottom: 12 },
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
            lineColor: [210, 218, 224],
            lineWidth: 0.1,
            textColor: [15, 23, 42],
        },
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        footStyles: { fillColor: [226, 240, 233], textColor: [15, 23, 42], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 249, 248] },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
        },
    });

    // ----- Watermark & Footer on every page -----
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);

        // Background watermark on each page
        if (logoData) {
            try {
                const gStateClass = (doc as any).GState;
                if (gStateClass) {
                    doc.saveGraphicsState();
                    doc.setGState(new gStateClass({ opacity: 0.08 }));
                    const wmSize = 90;
                    doc.addImage(logoData, 'JPEG', (pageW - wmSize) / 2, (pageH - wmSize) / 2, wmSize, wmSize);
                    doc.restoreGraphicsState();
                }
            } catch {
                // ignore
            }
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(110);
        doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 10, pageH - 6);
        doc.text(`Page ${i} of ${pages}`, pageW - 10, pageH - 6, { align: 'right' });
    }

    const fileName = `${kind}-report_${from || 'start'}_to_${to || 'today'}.pdf`;
    return { doc, fileName };
}