import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { 
  Package, Search, Filter, Plus, Edit2, Trash2, ArrowRightLeft, 
  RotateCcw, CheckCircle, AlertTriangle, AlertCircle, X, Loader2, 
  Coins, Info, UserCheck, ShieldAlert, Truck, Tag, Calendar, Layers, Eye
} from 'lucide-react';

const CATEGORY_COLORS = {
  equipment: 'text-purple-500 bg-purple-50',
  sport: 'text-amber-500 bg-amber-50',
  book: 'text-teal-500 bg-teal-50',
  other: 'text-blue-500 bg-blue-50',
  vehicle: 'text-rose-500 bg-rose-50'
};

const STATUS_COLORS = {
  available: 'bg-sage/35 text-teal-dark',
  issued: 'bg-purple-100 text-purple-700 border border-purple-200',
  damaged: 'bg-amber-warning/15 text-amber-warning border border-amber-warning/20',
  lost: 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
};

const Assets = () => {
  const { activeSchoolId, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'school_admin' || isSuperAdmin;

  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metrics, setMetrics] = useState({
    total_value: 0.00,
    total_count: 0,
    available_count: 0,
    issued_count: 0,
    damaged_count: 0,
    lost_count: 0
  });

  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Modal forms
  const [form, setForm] = useState({ 
    name: '', 
    category: 'equipment', 
    code: '', 
    serial_number: '', 
    value: '', 
    description: '',
    // vehicle subfields
    reg_number: '',
    make_model: '',
    mileage: '',
    insurance_expiry: '',
    next_service: ''
  });
  const [editForm, setEditForm] = useState({});
  const [issueForm, setIssueForm] = useState({ holder_type: 'student', holder_id: '' });
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', code: '', color_class: 'text-rose-500 bg-rose-50' });

  // Options lists for issuing assets
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);

  // States
  const [formSaving, setFormSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);

  const fetchCategories = useCallback(() => {
    if (!activeSchoolId) return;
    setCategoriesLoading(true);
    api.get(`/schools/${activeSchoolId}/asset-categories`)
      .then(res => {
        setCategories(res.data || []);
      })
      .catch(err => {
        console.error('Error loading asset categories:', err);
      })
      .finally(() => setCategoriesLoading(false));
  }, [activeSchoolId]);

  const fetchAssets = useCallback(() => {
    if (!activeSchoolId) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: '15',
      search: search,
      category: categoryFilter,
      status: statusFilter
    });

    api.get(`/schools/${activeSchoolId}/assets?${params}`)
      .then(res => {
        // Parse metadata JSON strings if any
        const loadedAssets = (res.data || []).map(item => {
          if (item.metadata && typeof item.metadata === 'string') {
            try {
              item.metadata = JSON.parse(item.metadata);
            } catch (e) {
              item.metadata = {};
            }
          }
          return item;
        });
        setAssets(loadedAssets);
        if (res.meta) {
          setTotalPages(Math.ceil((res.meta.total || 1) / 15));
          if (res.meta.metrics) {
            setMetrics(res.meta.metrics);
          }
        }
        setError('');
      })
      .catch(err => {
        console.error(err);
        setError('Could not load assets inventory.');
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId, page, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Load students & staff on mount/need for holder dropdowns
  useEffect(() => {
    if (!activeSchoolId || !isAdmin) return;
    api.get(`/schools/${activeSchoolId}/students?per_page=1000`)
      .then(res => setStudents(res.data || []))
      .catch(() => {});

    api.get(`/schools/${activeSchoolId}/staff`)
      .then(res => setStaff(res.data || []))
      .catch(() => {});
  }, [activeSchoolId, isAdmin]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError('');
    try {
      const isVehicle = form.category.toLowerCase().includes('vehicle') || form.category.toLowerCase().includes('transport');
      const payload = {
        name: form.name,
        category: form.category,
        code: form.code,
        serial_number: form.serial_number,
        value: form.value,
        description: form.description,
        metadata: isVehicle ? {
          reg_number: form.reg_number,
          make_model: form.make_model,
          mileage: form.mileage,
          insurance_expiry: form.insurance_expiry,
          next_service: form.next_service
        } : null
      };

      await api.post(`/schools/${activeSchoolId}/assets`, payload);
      setShowAddModal(false);
      setForm({ 
        name: '', category: categories[0]?.code || 'equipment', code: '', serial_number: '', value: '', description: '',
        reg_number: '', make_model: '', mileage: '', insurance_expiry: '', next_service: ''
      });
      fetchAssets();
    } catch (err) {
      setFormError(err.message || 'Failed to record asset.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError('');
    try {
      const isVehicle = editForm.category.toLowerCase().includes('vehicle') || editForm.category.toLowerCase().includes('transport');
      const payload = {
        id: editForm.id,
        name: editForm.name,
        category: editForm.category,
        code: editForm.code,
        serial_number: editForm.serial_number,
        value: editForm.value,
        description: editForm.description,
        status: editForm.status,
        metadata: isVehicle ? {
          reg_number: editForm.metadata?.reg_number || '',
          make_model: editForm.metadata?.make_model || '',
          mileage: editForm.metadata?.mileage || '',
          insurance_expiry: editForm.metadata?.insurance_expiry || '',
          next_service: editForm.metadata?.next_service || ''
        } : null
      };

      await api.patch(`/schools/${activeSchoolId}/assets/${editForm.id}`, payload);
      setShowEditModal(false);
      fetchAssets();
    } catch (err) {
      setFormError(err.message || 'Failed to update asset details.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setCategorySaving(true);
    setCategoryError('');
    try {
      await api.post(`/schools/${activeSchoolId}/asset-categories`, newCategoryForm);
      setNewCategoryForm({ name: '', code: '', color_class: 'text-rose-500 bg-rose-50' });
      fetchCategories();
      alert('Custom category added successfully.');
    } catch (err) {
      setCategoryError(err.message || 'Failed to add category.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${asset.name}"? This action is logged in audit trail.`)) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/assets/${asset.id}`);
      fetchAssets();
    } catch (err) {
      alert(err.message || 'Failed to delete asset.');
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueForm.holder_id) {
      setFormError('Please select a recipient.');
      return;
    }
    setFormSaving(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${selectedAsset.id}/issue`, issueForm);
      setShowIssueModal(false);
      setIssueForm({ holder_type: 'student', holder_id: '' });
      fetchAssets();
    } catch (err) {
      setFormError(err.message || 'Failed to issue asset.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleReturn = async (asset) => {
    if (!window.confirm(`Mark "${asset.name}" as returned to available stock?`)) return;
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${asset.id}/return`, {});
      fetchAssets();
    } catch (err) {
      alert(err.message || 'Failed to return asset.');
    }
  };

  // Helper to resolve category label & colors dynamically
  const getCategoryDetails = (catCode) => {
    const found = categories.find(c => c.code === catCode);
    return {
      label: found ? found.name : catCode,
      color: found ? found.color_class : (CATEGORY_COLORS[catCode] || 'text-blue-500 bg-blue-50')
    };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-line-border/30 pb-5 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">School Inventory &amp; Assets</h2>
          <p className="text-sm text-ink/55 mt-1">Record physical assets, track financial value, and manage lending to staff and students.</p>
        </div>
        <div className="flex items-center space-x-3 self-start">
          {isSuperAdmin && (
            <button
              onClick={() => { setShowCategoryModal(true); setCategoryError(''); }}
              className="flex items-center space-x-2 px-4 py-3 bg-paper border border-line-border hover:bg-sage/10 text-ink font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-teal-primary" /><span>Manage Categories</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setShowAddModal(true); setFormError(''); }}
              className="flex items-center space-x-2 px-5 py-3 bg-teal-primary hover:bg-teal-dark text-paper font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /><span>Record New Asset</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-teal-primary/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <Coins className="w-5 h-5 text-teal-primary/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Total Valuation</span>
          <h3 className="text-xl font-display font-bold text-teal-dark mt-2">${parseFloat(metrics.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-purple-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <Package className="w-5 h-5 text-purple-500/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Total Items</span>
          <h3 className="text-xl font-display font-bold text-ink mt-2">{metrics.total_count || 0}</h3>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-teal-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <CheckCircle className="w-5 h-5 text-teal-500/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Available</span>
          <h3 className="text-xl font-display font-bold text-teal-primary mt-2">{metrics.available_count || 0}</h3>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-purple-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <UserCheck className="w-5 h-5 text-purple-500/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Lent Out</span>
          <h3 className="text-xl font-display font-bold text-purple-600 mt-2">{metrics.issued_count || 0}</h3>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <AlertTriangle className="w-5 h-5 text-amber-500/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Damaged</span>
          <h3 className="text-xl font-display font-bold text-amber-600 mt-2">{metrics.damaged_count || 0}</h3>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-red-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
            <ShieldAlert className="w-5 h-5 text-red-500/50" />
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Lost / Missing</span>
          <h3 className="text-xl font-display font-bold text-brick-critical mt-2">{metrics.lost_count || 0}</h3>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-center justify-between border border-line-border/30">
        <div className="w-full lg:max-w-md relative">
          <input
            type="text"
            placeholder="Search by code, serial or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-ink font-sans text-xs focus:outline-none focus:border-teal-primary"
          />
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-ink/40" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-teal-primary hidden sm:block" />
          
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-initial bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-primary"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.code}>{c.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-initial bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-primary"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="issued">Lent Out</option>
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border text-[10px] font-sans font-bold text-ink/60 uppercase tracking-wider">
                <th className="py-4 px-6">Code / Serial</th>
                <th className="py-4 px-6">Asset Name</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6 text-right">Value</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Lent To</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50 text-xs font-sans text-ink">
              {loading || categoriesLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-primary mx-auto mb-2" />
                    <span className="text-ink/40">Fetching inventory items...</span>
                  </td>
                </tr>
              ) : assets.map(a => {
                const catInfo = getCategoryDetails(a.category);
                const isVehicle = a.category?.toLowerCase().includes('vehicle') || a.category?.toLowerCase().includes('transport');
                return (
                  <tr key={a.id} className="hover:bg-sage/5 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex flex-col font-mono text-[10px]">
                        <span className="font-bold text-teal-dark">{a.code || 'NO-CODE'}</span>
                        <span className="text-ink/40">{a.serial_number ? `S/N: ${a.serial_number}` : 'No Serial'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-ink">{a.name}</span>
                          {isVehicle && <Truck className="w-3.5 h-3.5 text-rose-500" />}
                        </div>
                        {isVehicle && a.metadata?.reg_number && (
                          <span className="inline-block mt-1 font-mono text-[9px] bg-sage/20 text-teal-dark px-1.5 py-0.5 rounded max-w-fit">
                            Plate: {a.metadata.reg_number}
                          </span>
                        )}
                        <span className="text-[10px] text-ink/45 mt-0.5 truncate max-w-xs">{a.description || 'No description recorded.'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-teal-dark">
                      ${parseFloat(a.value || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[a.status] || 'bg-sage/35 text-teal-dark'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1.5">
                        {a.status === 'issued' ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="font-bold text-ink/80">{a.holder_name || 'Borrower info'}</span>
                            <span className="text-[9px] font-mono text-ink/40">({a.holder_type})</span>
                          </>
                        ) : (
                          <span className="text-ink/30 italic">Not lent</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        {isVehicle && (
                          <button
                            onClick={() => { setSelectedAsset(a); setShowDetailsModal(true); }}
                            className="w-8 h-8 rounded-lg bg-paper hover:bg-sage/10 text-teal-primary border border-line-border/30 flex items-center justify-center transition-all cursor-pointer"
                            title="View Extended Data"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            {a.status === 'available' ? (
                              <button
                                onClick={() => { setSelectedAsset(a); setIssueForm({ holder_type: 'student', holder_id: '' }); setFormError(''); setShowIssueModal(true); }}
                                className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-600 hover:text-paper font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                                title="Lend this asset"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Lend</span>
                              </button>
                            ) : a.status === 'issued' ? (
                              <button
                                onClick={() => handleReturn(a)}
                                className="px-2.5 py-1.5 bg-teal-primary/10 hover:bg-teal-primary text-teal-primary hover:text-paper font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                                title="Return asset to stock"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Return</span>
                              </button>
                            ) : (
                              <div className="w-[68px]" />
                            )}
                            <button
                              onClick={() => { setEditForm(a); setFormError(''); setShowEditModal(true); }}
                              className="w-8 h-8 rounded-lg bg-paper hover:bg-sage/10 text-ink border border-line-border/30 flex items-center justify-center transition-all cursor-pointer"
                              title="Edit properties"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-ink/60" />
                            </button>
                            <button
                              onClick={() => handleDelete(a)}
                              className="w-8 h-8 rounded-lg bg-brick-critical/5 hover:bg-brick-critical text-brick-critical hover:text-paper border border-brick-critical/20 flex items-center justify-center transition-all cursor-pointer"
                              title="Delete asset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && !loading && !categoriesLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-ink/40">
                    No school assets registered match these filter choices.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30">
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3.5 py-1.5 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 disabled:opacity-40 cursor-pointer">Previous</button>
            <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="px-3.5 py-1.5 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        )}
      </div>

      {/* Record New Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowAddModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5 text-teal-primary" />
              <span>Record New School Asset</span>
            </h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Asset Name / Title *</label>
                <input required type="text" placeholder="e.g. Toyota Hiace School Bus" className="w-full glass-input rounded-xl text-xs" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Category *</label>
                  <select required className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {categories.map(c => (
                      <option key={c.id} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Financial Value ($) *</label>
                  <input required type="number" step="0.01" min="0" placeholder="0.00" className="w-full glass-input rounded-xl text-xs numeric-data font-bold text-teal-dark" value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">System Asset Code *</label>
                  <input required type="text" placeholder="e.g. COMP-042" className="w-full glass-input rounded-xl text-xs uppercase" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Serial Number (S/N)</label>
                  <input type="text" placeholder="e.g. CN-0X82Y4" className="w-full glass-input rounded-xl text-xs" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} />
                </div>
              </div>

              {/* Dynamic Subfields for Vehicles/Transport Category */}
              {(form.category?.toLowerCase().includes('vehicle') || form.category?.toLowerCase().includes('transport')) && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3 animate-fadeIn">
                  <div className="flex items-center space-x-1.5 pb-1 border-b border-rose-500/10 mb-2">
                    <Truck className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-rose-700">Vehicle / Transport Parameters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Registration Number *</label>
                      <input required type="text" placeholder="e.g. AE-9402" className="w-full glass-input rounded-lg text-xs" value={form.reg_number} onChange={e => setForm({...form, reg_number: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Make &amp; Model *</label>
                      <input required type="text" placeholder="e.g. Toyota Coaster" className="w-full glass-input rounded-lg text-xs" value={form.make_model} onChange={e => setForm({...form, make_model: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Mileage (km)</label>
                      <input type="text" placeholder="e.g. 150000" className="w-full glass-input rounded-lg text-xs" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Insurance Expiry Date</label>
                      <input type="date" className="w-full glass-input rounded-lg text-xs" value={form.insurance_expiry} onChange={e => setForm({...form, insurance_expiry: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Next Maintenance / Service Date</label>
                    <input type="date" className="w-full glass-input rounded-lg text-xs" value={form.next_service} onChange={e => setForm({...form, next_service: e.target.value})} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Description / Location Notes</label>
                <textarea rows="2" placeholder="Item details, storage room, condition at purchase..." className="w-full glass-input rounded-xl text-xs resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-line-border/30">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={formSaving} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-2">
                  {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowEditModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <Edit2 className="w-4 h-4 text-teal-primary" />
              <span>Edit Asset Properties</span>
            </h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Asset Name / Title *</label>
                <input required type="text" className="w-full glass-input rounded-xl text-xs" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Category *</label>
                  <select required className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={editForm.category || 'equipment'} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                    {categories.map(c => (
                      <option key={c.id} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Financial Value ($) *</label>
                  <input required type="number" step="0.01" min="0" className="w-full glass-input rounded-xl text-xs numeric-data" value={editForm.value || ''} onChange={e => setEditForm({...editForm, value: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">System Asset Code *</label>
                  <input required type="text" className="w-full glass-input rounded-xl text-xs uppercase" value={editForm.code || ''} onChange={e => setEditForm({...editForm, code: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Serial Number (S/N)</label>
                  <input type="text" className="w-full glass-input rounded-xl text-xs" value={editForm.serial_number || ''} onChange={e => setEditForm({...editForm, serial_number: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Physical Status</label>
                  <select required className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={editForm.status || 'available'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="available">Available</option>
                    <option value="issued">Lent Out</option>
                    <option value="damaged">Damaged</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div className="bg-sage/5 border border-line-border/20 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-ink/50 font-bold uppercase">Current Holder</span>
                  <span className="text-[10px] font-bold text-ink/80 truncate max-w-[120px]">{editForm.holder_name || 'Not Lent'}</span>
                </div>
              </div>

              {/* Dynamic Edit Subfields for Vehicles/Transport Category */}
              {(editForm.category?.toLowerCase().includes('vehicle') || editForm.category?.toLowerCase().includes('transport')) && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                  <div className="flex items-center space-x-1.5 pb-1 border-b border-rose-500/10 mb-2">
                    <Truck className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-rose-700">Vehicle / Transport Parameters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Registration Number *</label>
                      <input required type="text" className="w-full glass-input rounded-lg text-xs" value={editForm.metadata?.reg_number || ''} onChange={e => setEditForm({...editForm, metadata: {...(editForm.metadata || {}), reg_number: e.target.value}})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Make &amp; Model *</label>
                      <input required type="text" className="w-full glass-input rounded-lg text-xs" value={editForm.metadata?.make_model || ''} onChange={e => setEditForm({...editForm, metadata: {...(editForm.metadata || {}), make_model: e.target.value}})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Mileage (km)</label>
                      <input type="text" className="w-full glass-input rounded-lg text-xs" value={editForm.metadata?.mileage || ''} onChange={e => setEditForm({...editForm, metadata: {...(editForm.metadata || {}), mileage: e.target.value}})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Insurance Expiry Date</label>
                      <input type="date" className="w-full glass-input rounded-lg text-xs" value={editForm.metadata?.insurance_expiry || ''} onChange={e => setEditForm({...editForm, metadata: {...(editForm.metadata || {}), insurance_expiry: e.target.value}})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">Next Maintenance Date</label>
                    <input type="date" className="w-full glass-input rounded-lg text-xs" value={editForm.metadata?.next_service || ''} onChange={e => setEditForm({...editForm, metadata: {...(editForm.metadata || {}), next_service: e.target.value}})} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Description / Location Notes</label>
                <textarea rows="2" className="w-full glass-input rounded-xl text-xs resize-none" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-line-border/30">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={formSaving} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-2">
                  {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Vehicle Details View Modal */}
      {showDetailsModal && selectedAsset && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative text-xs text-ink font-sans">
            <button onClick={() => setShowDetailsModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <Truck className="w-5 h-5 text-rose-500" />
              <span>Vehicle Details Registry</span>
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Asset Name</span>
                <span className="font-bold">{selectedAsset.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Registration Plate</span>
                <span className="font-bold px-2 py-0.5 bg-sage/20 text-teal-dark rounded font-mono">{selectedAsset.metadata?.reg_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Make / Model</span>
                <span className="font-bold">{selectedAsset.metadata?.make_model || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Current Mileage</span>
                <span className="font-bold numeric-data">{selectedAsset.metadata?.mileage ? `${selectedAsset.metadata.mileage} km` : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Insurance Expiry</span>
                <span className="font-bold flex items-center space-x-1 text-rose-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedAsset.metadata?.insurance_expiry || 'Not Configured'}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line-border/20">
                <span className="font-bold text-ink/50">Next Maintenance Due</span>
                <span className="font-bold flex items-center space-x-1 text-teal-dark">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedAsset.metadata?.next_service || 'Not Configured'}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="mt-6 w-full py-2 bg-teal-primary text-paper text-xs font-semibold rounded-xl text-center cursor-pointer shadow hover:bg-teal-dark transition-all"
            >
              Dismiss View
            </button>
          </div>
        </div>
      )}

      {/* Manage Custom Categories Modal (Super Admin only) */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowCategoryModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-teal-primary" />
              <span>Register Custom Asset Category</span>
            </h3>
            
            {categoryError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{categoryError}</div>}

            <form onSubmit={handleCategorySubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Category Display Name *</label>
                <input required type="text" placeholder="e.g. Vehicles / Transport" className="w-full glass-input rounded-xl text-xs" value={newCategoryForm.name} onChange={e => setNewCategoryForm({...newCategoryForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">System Code * (Unique)</label>
                  <input required type="text" placeholder="e.g. vehicle" className="w-full glass-input rounded-xl text-xs lowercase" value={newCategoryForm.code} onChange={e => setNewCategoryForm({...newCategoryForm, code: e.target.value.toLowerCase().replace(/\s+/g, '-')})} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink/75 mb-1">Aesthetic Theme</label>
                  <select className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={newCategoryForm.color_class} onChange={e => setNewCategoryForm({...newCategoryForm, color_class: e.target.value})}>
                    <option value="text-rose-500 bg-rose-50">Rose / Red Theme</option>
                    <option value="text-teal-500 bg-teal-50">Teal / Green Theme</option>
                    <option value="text-purple-500 bg-purple-50">Purple Theme</option>
                    <option value="text-amber-500 bg-amber-50">Amber / Gold Theme</option>
                    <option value="text-blue-500 bg-blue-50">Blue / Slate Theme</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-line-border/30 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Close</button>
                <button type="submit" disabled={categorySaving} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {categorySaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Category</span>
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-line-border/30 pt-4">
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block mb-3">Registered Categories list</span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-2.5 bg-sage/5 border border-line-border/20 rounded-xl">
                    <span className="font-bold text-ink/80">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${c.color_class}`}>{c.code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue / Lend Asset Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowIssueModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-500" />
              <span>Lend Asset to User</span>
            </h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            
            <div className="mb-4 p-3 bg-sage/5 border border-line-border/20 rounded-xl space-y-1">
              <span className="text-[10px] text-ink/40 font-bold uppercase tracking-wider block">Lending Out Item</span>
              <span className="text-xs font-bold text-ink block">{selectedAsset?.name}</span>
              <span className="text-[9px] font-mono text-teal-primary font-bold block">{selectedAsset?.code}</span>
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Recipient Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueForm({ holder_type: 'student', holder_id: '' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      issueForm.holder_type === 'student' ? 'bg-teal-primary text-paper border-teal-primary' : 'bg-paper text-ink border-line-border'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueForm({ holder_type: 'staff', holder_id: '' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      issueForm.holder_type === 'staff' ? 'bg-teal-primary text-paper border-teal-primary' : 'bg-paper text-ink border-line-border'
                    }`}
                  >
                    Teacher / Staff
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink/75 mb-1">Select Recipient Profile *</label>
                {issueForm.holder_type === 'student' ? (
                  <select
                    required
                    value={issueForm.holder_id}
                    onChange={e => setIssueForm({...issueForm, holder_id: e.target.value})}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    value={issueForm.holder_id}
                    onChange={e => setIssueForm({...issueForm, holder_id: e.target.value})}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="">-- Choose Teacher/Staff --</option>
                    {staff.map(st => (
                      <option key={st.id} value={st.id}>{st.name} ({st.role_title})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-line-border/30">
                <button type="button" onClick={() => setShowIssueModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={formSaving} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lend Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
