import React from 'react';
import { Printer, X, ShieldCheck, FileText, Download } from 'lucide-react';

const PrintReportModal = ({
  isOpen,
  onClose,
  title = "OFFICIAL SYSTEM REPORT",
  subtitle = "School Management & Governance Ledger",
  schoolName = "SchoolBase Academy",
  summaryCards = [],
  columns = [],
  data = [],
  userRole = "Administrator"
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-ZW', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:overflow-visible">
      {/* Container */}
      <div className="bg-white rounded-3xl shadow-2xl border border-line-border w-full max-w-5xl overflow-hidden my-8 print:my-0 print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Top Control Bar (Hidden during print) */}
        <div className="bg-sage/30 px-6 py-4 border-b border-line-border flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-ink">Print / Save PDF Report Preview</h3>
              <p className="text-[11px] text-ink/50">Official printable document output for compliance & physical record</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Export PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-ink/40 hover:text-ink hover:bg-ink/5 rounded-xl transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 print:p-6 space-y-6 text-ink bg-white font-sans">
          
          {/* Header Banner */}
          <div className="border-b-2 border-teal-primary pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-teal-primary">
                <ShieldCheck className="w-6 h-6" />
                <span className="font-display font-extrabold text-xl tracking-tight uppercase text-ink">{schoolName}</span>
              </div>
              <h1 className="text-2xl font-bold font-display text-ink uppercase tracking-wider">{title}</h1>
              <p className="text-xs font-mono text-ink/60">{subtitle}</p>
            </div>

            <div className="text-right text-xs text-ink/70 space-y-1">
              <div className="font-bold text-teal-dark">OFFICIAL DOCUMENT</div>
              <div>Generated: <span className="font-mono">{currentDate}</span></div>
              <div>Authority: <span className="font-bold">{userRole} Portal</span></div>
              <div className="text-[10px] font-mono text-ink/40">Ref ID: RPT-{Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
            </div>
          </div>

          {/* Summary KPIs Row */}
          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              {summaryCards.map((card, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-line-border bg-sage/10 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-ink/50 block">{card.label}</span>
                  <span className="text-xl font-bold font-mono text-teal-dark mt-1 block">{card.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-sage/20 border-b-2 border-line-border text-[10px] font-bold text-ink/80 uppercase tracking-wider print:bg-gray-200">
                  <th className="py-2.5 px-3">#</th>
                  {columns.map((col, idx) => (
                    <th key={idx} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/60">
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-sage/5 print:hover:bg-transparent">
                    <td className="py-2.5 px-3 font-mono text-[10px] text-ink/40">{rowIdx + 1}</td>
                    {columns.map((col, colIdx) => {
                      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
                      return (
                        <td key={colIdx} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                          {val !== undefined && val !== null ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-8 text-center text-ink/40 italic">
                      No data records available for this report query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Official Signatures & Approval Footer */}
          <div className="pt-10 border-t border-line-border/50 mt-12 grid grid-cols-2 gap-12 print:pt-6 print:mt-6">
            <div className="space-y-6">
              <span className="text-[10px] uppercase font-bold text-ink/50 tracking-wider block">Prepared By</span>
              <div className="border-b border-ink/40 w-4/5 h-8"></div>
              <div className="text-[11px] text-ink/70">
                <p className="font-bold">System Administrator</p>
                <p className="text-[10px] text-ink/50">School Administration Office</p>
              </div>
            </div>

            <div className="space-y-6 text-right flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-ink/50 tracking-wider block">Approved & Certified By</span>
              <div className="border-b border-ink/40 w-4/5 h-8"></div>
              <div className="text-[11px] text-ink/70">
                <p className="font-bold">Headmaster / School Principal</p>
                <p className="text-[10px] text-ink/50">Official Stamp & Date</p>
              </div>
            </div>
          </div>

          {/* Page Footer Disclaimer */}
          <div className="pt-4 text-center text-[9px] font-mono text-ink/40 border-t border-line-border/30">
            Confidential Document • Generated via SchoolBase Management System • Page 1 of 1
          </div>

        </div>

      </div>
    </div>
  );
};

export default PrintReportModal;
