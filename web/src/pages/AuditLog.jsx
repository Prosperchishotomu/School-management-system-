import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { ShieldCheck, Filter, Search, ChevronDown, ChevronUp, Printer, Loader2 } from 'lucide-react';

const AuditLog = () => {
  const { activeSchoolId } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Row expansion state
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Printing generation states
  const [isFetchingPrint, setIsFetchingPrint] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ 
      page, 
      per_page: 10, 
      entity_type: entityFilter,
      search: searchQuery
    });
    
    const url = activeSchoolId 
      ? `/schools/${activeSchoolId}/audit-log?${params}`
      : `/admin/audit-log?${params}`;

    api.get(url)
      .then(res => {
        setLogs(res.data || []);
        if (res.meta) {
          setTotalPages(Math.ceil((res.meta.total || 1) / (res.meta.per_page || 10)));
        } else {
          setTotalPages(1);
        }
        setError('');
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [activeSchoolId, page, entityFilter, searchQuery]);

  const toggleRow = (id) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const handlePrint = async (size) => {
    if (size === 10) {
      window.print();
    } else {
      setIsFetchingPrint(true);
      try {
        const params = new URLSearchParams({ 
          page: 1, 
          per_page: size, 
          entity_type: entityFilter,
          search: searchQuery
        });
        const url = activeSchoolId 
          ? `/schools/${activeSchoolId}/audit-log?${params}`
          : `/admin/audit-log?${params}`;
          
        const res = await api.get(url);
        const originalLogs = [...logs];
        
        setLogs(res.data || []);
        
        // Wait for state rendering before opening print drawer
        setTimeout(() => {
          window.print();
          setLogs(originalLogs);
          setIsFetchingPrint(false);
        }, 500);
      } catch (err) {
        alert('Failed to generate full security audit report.');
        setIsFetchingPrint(false);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
      {/* Printable Report Header - Only visible during print */}
      <div className="hidden print:block text-center space-y-2 border-b border-line-border pb-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider text-ink">SYSTEM SECURITY &amp; AUDIT LEDGER</h1>
        <p className="text-xs text-ink/65 font-medium">
          Context Scope: <span className="font-bold text-teal-primary">{activeSchoolId ? `School Tenant ID: ${activeSchoolId}` : 'System-Wide Global Platform'}</span>
        </p>
        <div className="flex justify-between items-center text-[10px] text-ink/50 pt-3 px-4 font-mono">
          <span>Report Generated: {new Date().toLocaleString()}</span>
          <span>Entity Scope: {entityFilter ? entityFilter.toUpperCase() : 'ALL ENTITIES'}</span>
          <span>Search String: {searchQuery ? `"${searchQuery}"` : 'NONE'}</span>
          <span>Records Printed: {logs.length}</span>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-line-border/30 pb-4 gap-4 non-printable">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">System Audit Trail</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            Secure, append-only records of actions performed across the tenant workspace.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Print/Export Options Dropdown */}
          <div className="relative group">
            <button
              disabled={isFetchingPrint}
              className="flex items-center space-x-1.5 px-4 py-2 bg-teal-primary hover:bg-teal-dark disabled:opacity-50 text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isFetchingPrint ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Generate Report</span>
            </button>
            
            {/* Options Hover Panel */}
            <div className="absolute right-0 top-full mt-2 w-56 bg-paper border border-line-border/30 rounded-xl shadow-xl z-50 hidden group-hover:block hover:block divide-y divide-line-border/10 font-sans text-xs">
              <button 
                onClick={() => handlePrint(10)} 
                className="w-full text-left px-4 py-3 text-ink/75 hover:bg-sage/10 rounded-t-xl transition-colors font-medium"
              >
                Print Current Page View
              </button>
              <button 
                onClick={() => handlePrint(50)} 
                className="w-full text-left px-4 py-3 text-ink/75 hover:bg-sage/10 transition-colors font-medium"
              >
                Print Extended Report (Last 50)
              </button>
              <button 
                onClick={() => handlePrint(100)} 
                className="w-full text-left px-4 py-3 text-ink/75 hover:bg-sage/10 rounded-b-xl transition-colors font-medium"
              >
                Print Comprehensive Audit (Last 100)
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-sage/25 px-3 py-1.5 rounded-lg border border-teal-primary/20">
            <ShieldCheck className="w-4 h-4 text-teal-primary" />
            <span className="text-xs font-sans font-bold text-teal-dark">Read-Only</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans non-printable">
          {error}
        </div>
      )}

      {/* Filter Block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-paper p-4 rounded-2xl border border-line-border/30 shadow-sm non-printable">
        {/* Search */}
        <div className="relative col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-ink/40" />
          </span>
          <input
            type="text"
            placeholder="Search by action, user, details, or IP address..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-line-border rounded-xl text-xs bg-paper focus:outline-none focus:border-teal-primary text-ink"
          />
        </div>

        {/* Dropdown Entity Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-teal-primary flex-shrink-0" />
          <select
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
            className="w-full bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary"
          >
            <option value="">All Entities</option>
            <option value="students">Students</option>
            <option value="users">Users</option>
            <option value="classes">Classes</option>
            <option value="fee_payments">Fee Payments</option>
            <option value="licenses">Licenses</option>
            <option value="assets">Assets</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 print:border-none print:shadow-none bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6 w-10 non-printable"></th>
              <th className="py-4 px-6">Timestamp</th>
              <th className="py-4 px-6">Action</th>
              <th className="py-4 px-6">User</th>
              <th className="py-4 px-6">Context</th>
              <th className="py-4 px-6 text-right non-printable">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-xs text-ink/40 font-semibold">
                  Loading audit trail...
                </td>
              </tr>
            ) : logs.map((log) => {
              const isExpanded = expandedRowId === log.id;
              return (
                <React.Fragment key={log.id}>
                  {/* Primary Row */}
                  <tr 
                    onClick={() => toggleRow(log.id)}
                    className="hover:bg-sage/5 transition-colors cursor-pointer print:hover:bg-white"
                  >
                    <td className="py-4 px-6 non-printable">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-teal-primary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink/40" />
                      )}
                    </td>
                    <td className="py-4 px-6 numeric-data font-mono text-[10px] text-ink/60 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-teal-primary/10 text-teal-dark text-[10px] font-mono font-bold px-2 py-0.5 rounded print:border print:border-teal-primary print:bg-white">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold">
                      {log.username || 'System'}
                      <span className="text-[10px] text-ink/50 block font-normal capitalize">
                        {log.role?.replace('_', ' ') || 'Process'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-ink/70">
                      {log.school_name || 'System-wide'}
                    </td>
                    <td className="py-4 px-6 text-right text-xs text-ink/50 italic non-printable">
                      Expand
                    </td>
                  </tr>

                  {/* Expanded Row Panel - Always print-expanded */}
                  <tr className={`bg-sage/5 border-l-4 border-teal-primary print:border-l-2 print:border-line-border print:bg-white print:table-row ${isExpanded ? 'table-row animate-fadeIn' : 'hidden print:table-row'}`}>
                    <td className="non-printable"></td>
                    <td colSpan="5" className="p-4 font-sans text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-ink/50 uppercase font-bold text-[8px] tracking-wider print:hidden">Event details</p>
                          <p className="text-ink font-semibold">Target Entity: <span className="font-mono">{log.entity_type || '—'} {log.entity_id ? `#${log.entity_id}` : ''}</span></p>
                          <p className="text-ink font-semibold">Origin IP: <span className="font-mono text-ink/75">{log.ip_address || 'Internal (Localhost)'}</span></p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-ink/50 uppercase font-bold text-[8px] tracking-wider print:hidden">Action Description</p>
                          <div className="p-2.5 bg-paper print:bg-white rounded-xl border border-line-border/30 print:border-none print:p-0 leading-relaxed text-ink/80 font-medium">
                            {log.description || 'No additional description provided.'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan="6" className="py-12 text-center text-ink/50 text-xs font-semibold">
                  No matching audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination - hidden on print */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30 non-printable">
            <button 
              onClick={() => setPage(p => Math.max(p - 1, 1))} 
              disabled={page === 1} 
              className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
              disabled={page === totalPages} 
              className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;