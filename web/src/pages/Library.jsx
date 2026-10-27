import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, Tabs, FilterChips, EmptyState
} from '../components/ui';
import {
  BookOpen, Plus, Search, BookMarked, RotateCcw, Clock,
  CheckCircle2, FileText, AlertTriangle, UserCheck, Layers, Hash, Upload
} from 'lucide-react';
import ImportModal from '../components/ImportModal';

export default function Library() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'textbook' | 'past_paper' | 'fiction' | 'overdue'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLendModal, setShowLendModal] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [form, setForm] = useState({
    name: '',
    category: 'book',
    resource_type: 'textbook',
    code: '',
    shelf_location: 'Bay 3, Shelf B',
    description: ''
  });

  const [lendForm, setLendForm] = useState({
    holder_type: 'student',
    holder_id: '',
    due_date: '2026-04-10'
  });

  const { data: libraryData, loading: loadingAssets } = useApi(
    `library_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/assets?category=book`).then(r => r.data?.assets || r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: studentsData } = useApi(
    `students_brief_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawAssets = Array.isArray(libraryData) ? libraryData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return rawAssets.filter(item => {
      const matchesSearch = !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shelf_location?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'all') return true;
      if (activeTab === 'overdue') return item.is_overdue || item.status === 'overdue';
      return item.resource_type === activeTab;
    });
  }, [rawAssets, searchQuery, activeTab]);

  // Counts
  const totalCatalog = rawAssets.length;
  const availableCount = rawAssets.filter(a => a.status === 'available' || !a.current_holder_id).length;
  const issuedCount = totalCatalog - availableCount;
  const pastPapersCount = rawAssets.filter(a => a.resource_type === 'past_paper').length;
  const overdueCount = rawAssets.filter(a => a.is_overdue || a.status === 'overdue').length;

  const handleCreateResource = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/assets`, form);
      toast.success(`Resource '${form.name}' added to catalog.`);
      setShowAddModal(false);
      setForm({
        name: '',
        category: 'book',
        resource_type: 'textbook',
        code: '',
        shelf_location: 'Bay 3, Shelf B',
        description: ''
      });
      invalidate(`library_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLend = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${selectedAsset.id}/lend`, lendForm);
      toast.success(`'${selectedAsset.name}' loaned out.`);
      setShowLendModal(false);
      setSelectedAsset(null);
      invalidate(`library_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue book.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (assetId) => {
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${assetId}/return`);
      toast.success('Book returned to library inventory.');
      invalidate(`library_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to process return.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library Resource Management & Lending"
        subtitle="School media center catalog, ZIMSEC past examination papers, textbook circulation, and return tracking."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-brand-700" />
              <span>Import Books / Media</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Library Resource</span>
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Catalog"
          value={totalCatalog}
          icon={BookOpen}
          color="brand"
          subtext="Registered library titles"
        />
        <StatCard
          label="Available on Shelves"
          value={availableCount}
          icon={CheckCircle2}
          color="info"
          subtext="Ready for circulation"
        />
        <StatCard
          label="Currently Issued"
          value={issuedCount}
          icon={BookMarked}
          color="violet"
          subtext="With pupils & faculty"
        />
        <StatCard
          label="Past Paper Archive"
          value={pastPapersCount}
          icon={FileText}
          color="accent"
          subtext="ZIMSEC & Cambridge series"
        />
      </KpiStrip>

      {/* Search and Category Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Catalog', count: totalCatalog },
            { id: 'textbook', label: 'Textbooks', count: rawAssets.filter(a => a.resource_type === 'textbook').length },
            { id: 'past_paper', label: 'Past Papers', count: pastPapersCount },
            { id: 'fiction', label: 'Fiction & Readers', count: rawAssets.filter(a => a.resource_type === 'fiction').length },
            { id: 'overdue', label: 'Overdue Loans', count: overdueCount },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, ISBN, bay..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-64"
          />
        </div>
      </div>

      {/* Catalog Table */}
      <Card title="Resource Circulation Ledger">
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Title & Resource Details',
              sortable: true,
              render: (v, row) => (
                <div>
                  <div className="font-bold text-ink">{v || 'Curriculum Resource'}</div>
                  <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                    <span className="capitalize">{row.resource_type ? row.resource_type.replace('_', ' ') : 'Textbook'}</span>
                    <span>•</span>
                    <span className="font-mono">{row.code || 'ISBN-N/A'}</span>
                  </div>
                </div>
              )
            },
            {
              key: 'shelf_location',
              label: 'Shelf Location',
              render: v => <span className="text-xs text-muted font-medium">{v || 'Main Stacks'}</span>
            },
            {
              key: 'holder',
              label: 'Current Borrower',
              render: (_, row) => (
                row.current_holder_name ? (
                  <div>
                    <span className="text-xs font-semibold text-ink">{row.current_holder_name}</span>
                    <span className="text-[10px] text-muted block">Due: {row.due_date ? new Date(row.due_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )
              )
            },
            {
              key: 'status',
              label: 'Availability',
              render: (_, row) => {
                const isIssued = row.current_holder_id || row.status === 'issued';
                const isOverdue = row.is_overdue || row.status === 'overdue';
                if (isOverdue) return <StatusPill status="declined" />;
                if (isIssued) return <StatusPill status="pending" />;
                return <StatusPill status="active" />;
              }
            },
            {
              key: 'actions',
              label: '',
              render: (_, row) => {
                const isIssued = row.current_holder_id || row.status === 'issued';
                return (
                  <div className="flex items-center gap-2 justify-end">
                    {isIssued ? (
                      <button
                        onClick={() => handleReturn(row.id)}
                        className="px-2.5 py-1 rounded-lg border border-line bg-surface text-brand-700 text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Check In
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedAsset(row);
                          if (students.length > 0 && !lendForm.holder_id) {
                            setLendForm(prev => ({ ...prev, holder_id: String(students[0].id) }));
                          }
                          setShowLendModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1"
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                        Lend Out
                      </button>
                    )}
                  </div>
                );
              }
            }
          ]}
          data={filteredCatalog}
          emptyTitle="No Library Items Found"
          emptyMessage="No resources match the selected catalog filter."
        />
      </Card>

      {/* Lending Modal */}
      <Modal
        isOpen={showLendModal}
        onClose={() => setShowLendModal(false)}
        title={`Lend: ${selectedAsset?.name || 'Resource'}`}
        description="Record borrower details and assign an official library return due date."
      >
        <form onSubmit={handleLend} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Borrower Type</label>
            <select
              value={lendForm.holder_type}
              onChange={e => setLendForm({ ...lendForm, holder_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="student">Student Learner</option>
              <option value="staff">Staff Educator</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Select Borrower *</label>
            <select
              required
              value={lendForm.holder_id}
              onChange={e => setLendForm({ ...lendForm, holder_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select recipient...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.admission_number || 'ADM-N/A'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Return Due Date *</label>
            <input
              type="date"
              required
              value={lendForm.due_date}
              onChange={e => setLendForm({ ...lendForm, due_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowLendModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Issuing...' : 'Confirm Loan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Resource Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Resource to Library Stacks"
        description="Index a new curriculum textbook, past examination booklet, or reference reading."
      >
        <form onSubmit={handleCreateResource} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Resource Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Focus on Heritage Studies: Form 4"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Resource Type *</label>
              <select
                value={form.resource_type}
                onChange={e => setForm({ ...form, resource_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="textbook">Curriculum Textbook</option>
                <option value="past_paper">ZIMSEC Past Exam Paper</option>
                <option value="fiction">Fiction & Reader</option>
                <option value="stationery">Stationery Resource</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Code / ISBN</label>
              <input
                type="text"
                placeholder="ISBN 978-..."
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Shelf / Bay Location</label>
            <input
              type="text"
              placeholder="Stack B, Shelf 3 or Reserve Desk"
              value={form.shelf_location}
              onChange={e => setForm({ ...form, shelf_location: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Cataloging...' : 'Catalog Resource'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Data Ingestion Engine for Library Books */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        schoolId={activeSchoolId}
        entity="library"
        title="Import Library Books & Media"
        invalidateKeys={[`library_${activeSchoolId}`]}
      />
    </div>
  );
}
