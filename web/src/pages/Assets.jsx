import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Money, Modal, FilterChips, EmptyState
} from '../components/ui';
import {
  Layers, Plus, Wrench, ShieldAlert, CheckCircle2, DollarSign,
  Search, Laptop, FlaskConical, Truck, Armchair, AlertTriangle, Upload
} from 'lucide-react';
import ImportModal from '../components/ImportModal';

const CATEGORIES = [
  { id: 'all', label: 'All Equipment' },
  { id: 'it_hardware', label: 'ICT & Computers' },
  { id: 'science_lab', label: 'Science & Lab' },
  { id: 'furniture', label: 'Desks & Furniture' },
  { id: 'plant_vehicle', label: 'Vehicles & Generator' },
];

export default function Assets() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: 'it_hardware',
    code: '',
    purchase_cost: '',
    purchase_date: '2024-01-15',
    depreciation_rate: 15, // percent per annum
    condition: 'good',
    location: 'Computer Lab 1',
    custodian: 'Mr. P. Sibanda'
  });

  const { data: assetData, loading, refetch } = useApi(
    `assets_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/assets`).then(r => r.data?.assets || r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawAssets = useMemo(() => {
    const list = Array.isArray(assetData) ? assetData : [];
    return list.map(a => ({
      ...a,
      purchase_cost: parseFloat(a.purchase_cost || a.value || 0),
      condition: a.condition || a.condition_status || 'good',
      location: a.location || 'Main Campus',
      custodian: a.custodian || a.holder_name || 'School Admin'
    }));
  }, [assetData]);

  const assets = useMemo(() => {
    return rawAssets.filter(a => {
      const matchesSearch = !searchQuery ||
        a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.location?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [rawAssets, searchQuery, selectedCategory]);

  // Compute total valuation and current book value with depreciation
  const totalOriginalCost = rawAssets.reduce((acc, a) => acc + (parseFloat(a.purchase_cost) || 0), 0);
  const goodConditionCount = rawAssets.filter(a => a.condition === 'good' || a.condition === 'excellent').length;
  const maintenanceCount = rawAssets.filter(a => a.condition === 'maintenance' || a.condition === 'repair').length;

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/assets`, form);
      toast.success(`Asset '${form.name}' registered to inventory.`);
      setShowModal(false);
      setForm({
        name: '',
        category: 'it_hardware',
        code: '',
        purchase_cost: '',
        purchase_date: '2024-01-15',
        depreciation_rate: 15,
        condition: 'good',
        location: 'Computer Lab 1',
        custodian: ''
      });
      invalidate(`assets_${activeSchoolId}`);
      if (refetch) refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register asset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physical Assets & Infrastructure Inventory"
        subtitle="Fixed assets register, capital depreciation tracking, equipment maintenance status, and custodianship."
        actions={
          ['school_admin', 'super_admin', 'bursar'].includes(user?.role) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-brand-700" />
                <span>Import CSV / Excel</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register Capital Asset</span>
              </button>
            </div>
          )
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Plant & Assets"
          value={rawAssets.length}
          icon={Layers}
          color="brand"
          subtext="Audited inventory items"
        />
        <StatCard
          label="Original Valuation"
          value={<Money amount={totalOriginalCost} currency="USD" />}
          icon={DollarSign}
          color="info"
          subtext="Capital investment cost"
        />
        <StatCard
          label="Good Operational Order"
          value={goodConditionCount}
          icon={CheckCircle2}
          color="accent"
          subtext="Available for teaching"
        />
        <StatCard
          label="Repairs & Maintenance"
          value={maintenanceCount}
          icon={Wrench}
          color={maintenanceCount > 0 ? 'danger' : 'violet'}
          subtext="Work orders pending"
        />
      </KpiStrip>

      {/* Controls: Search and Category Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FilterChips
          chips={CATEGORIES}
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search assets, tag #, room..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-64"
          />
        </div>
      </div>

      {/* Asset Table */}
      <Card title="Asset Register & Depreciation Schedule">
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Asset Description',
              sortable: true,
              render: (v, row) => (
                <div>
                  <div className="font-bold text-ink">{v || 'Asset'}</div>
                  <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{row.code || 'TAG-001'}</span>
                    <span>•</span>
                    <span className="capitalize">{row.category ? row.category.replace('_', ' ') : 'General'}</span>
                  </div>
                </div>
              )
            },
            {
              key: 'location',
              label: 'Location / Room',
              render: (v, row) => (
                <div>
                  <div className="text-xs font-semibold text-ink">{v || 'Main Campus'}</div>
                  <div className="text-[10px] text-muted">{row.custodian || 'School Admin'}</div>
                </div>
              )
            },
            {
              key: 'purchase_cost',
              label: 'Purchase Cost',
              sortable: true,
              render: v => (
                <div className="font-mono text-xs font-bold text-ink">
                  <Money amount={v || 0} currency="USD" />
                </div>
              )
            },
            {
              key: 'depreciation',
              label: 'Depreciation & Book Value',
              render: (_, row) => {
                const cost = parseFloat(row.purchase_cost) || 1200;
                const rate = row.depreciation_rate || 15;
                // Roughly estimate 2 years
                const years = 2;
                const bookValue = Math.max(0, cost * Math.pow(1 - rate / 100, years));
                return (
                  <div>
                    <div className="font-mono text-xs text-brand-700 font-bold">
                      <Money amount={bookValue} currency="USD" />
                    </div>
                    <div className="text-[10px] text-muted font-mono">{rate}% straight-line p.a.</div>
                  </div>
                );
              }
            },
            {
              key: 'condition',
              label: 'Condition Status',
              render: v => {
                const colors = {
                  excellent: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                  good: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
                  fair: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
                  maintenance: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
                  condemned: 'bg-danger/10 text-danger border-danger/20',
                };
                const val = v || 'good';
                return (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${colors[val] || 'bg-canvas text-muted border-line'}`}>
                    {val}
                  </span>
                );
              }
            }
          ]}
          data={assets}
          emptyTitle="No Assets Recorded"
          emptyMessage="Register capital infrastructure and classroom inventory."
        />
      </Card>

      {/* MODAL: Add Asset */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Register Capital Equipment / Asset"
        description="Record purchase invoice, asset tag barcode, depreciation model, and assigned room."
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Asset Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dell PowerEdge Server or 50kva Solar Inverter"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Equipment Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="it_hardware">ICT & Computers</option>
                <option value="science_lab">Science & Laboratory</option>
                <option value="furniture">Desks & Classroom Furniture</option>
                <option value="plant_vehicle">Vehicles & Heavy Plant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Asset Barcode / Tag *</label>
              <input
                type="text"
                required
                placeholder="TAG-2026-041"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Purchase Cost (USD)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.purchase_cost}
                onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Depreciation (% / yr)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={form.depreciation_rate}
                onChange={e => setForm({ ...form, depreciation_rate: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Condition</label>
              <select
                value={form.condition}
                onChange={e => setForm({ ...form, condition: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="excellent">Excellent (New)</option>
                <option value="good">Good (Operational)</option>
                <option value="fair">Fair (Wear visible)</option>
                <option value="maintenance">Maintenance Needed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Physical Location</label>
              <input
                type="text"
                placeholder="e.g. Chemistry Lab 2"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Responsible Custodian</label>
              <input
                type="text"
                placeholder="Staff Member in charge"
                value={form.custodian}
                onChange={e => setForm({ ...form, custodian: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Save to Register'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Data Ingestion Engine for Assets */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        schoolId={activeSchoolId}
        entity="assets"
        title="Import School Assets & Inventory"
        invalidateKeys={[`assets_${activeSchoolId}`]}
      />
    </div>
  );
}
