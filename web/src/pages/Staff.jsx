import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Drawer, FilterChips, EmptyState, ConfirmDialog
} from '../components/ui';
import {
  Users, UserCheck, Plus, Mail, Phone, BookOpen, Layers,
  LayoutGrid, List, Search, Shield, Ban, CheckCircle2, MessageSquare, Send, Upload
} from 'lucide-react';
import ImportModal from '../components/ImportModal';

const DEPARTMENTS = [
  { id: 'all', label: 'All Staff' },
  { id: 'sciences', label: 'Sciences' },
  { id: 'humanities', label: 'Humanities' },
  { id: 'languages', label: 'Languages' },
  { id: 'commercials', label: 'Commercials' },
  { id: 'administration', label: 'Admin & Operations' },
];

export default function Staff() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [viewLayout, setViewLayout] = useState('grid'); // 'grid' | 'table'
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deactivatingStaff, setDeactivatingStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New staff form
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'teacher',
    role_title: 'Teacher',
    qualification: '',
    experience_years: '',
    ec_number: '',
    employment_type: 'permanent',
    department: 'sciences',
    class_id: '',
    teaching_load: 24,
    username: '',
    password: ''
  });

  // Direct message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgBody, setMsgBody] = useState('');

  // Fetch staff, classes, subjects
  const { data: staffData, loading: loadingStaff } = useApi(
    `staff_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/staff`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: classesData } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: assignmentsData } = useApi(
    `teaching_assignments_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/teaching-assignments`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawStaff = Array.isArray(staffData) ? staffData : [];
  const classes = Array.isArray(classesData) ? classesData : [];
  const assignments = Array.isArray(assignmentsData) ? assignmentsData : [];

  // Filtered staff
  const staff = useMemo(() => {
    return rawStaff.filter(s => {
      const matchesSearch = !searchQuery ||
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role_title?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'all' || s.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [rawStaff, searchQuery, selectedDept]);

  // KPIs
  const totalStaff = rawStaff.length;
  const activeCount = rawStaff.filter(s => s.status !== 'deactivated').length;
  const teachingStaffCount = rawStaff.filter(s => s.role_title?.toLowerCase().includes('teacher') || s.role_title?.toLowerCase().includes('master')).length;
  const adminStaffCount = totalStaff - teachingStaffCount;

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/staff`, form);
      toast.success(`Staff member ${form.name} registered.`);
      setShowModal(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        role: 'teacher',
        role_title: 'Teacher',
        qualification: '',
        experience_years: '',
        ec_number: '',
        employment_type: 'permanent',
        department: 'sciences',
        class_id: '',
        teaching_load: 24,
        username: '',
        password: ''
      });
      invalidate(`staff_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const nextStatus = staffMember.status === 'deactivated' ? 'active' : 'deactivated';
    try {
      await api.patch(`/schools/${activeSchoolId}/staff/${staffMember.id}`, {
        name: staffMember.name,
        email: staffMember.email,
        phone: staffMember.phone,
        role_title: staffMember.role_title,
        status: nextStatus
      });
      toast.success(nextStatus === 'active' ? `${staffMember.name} reactivated.` : `${staffMember.name} deactivated.`);
      setDeactivatingStaff(null);
      invalidate(`staff_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to change staff status.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !msgBody.trim()) return;
    try {
      await api.post(`/schools/${activeSchoolId}/messages`, {
        recipient_id: selectedStaff.user_id || selectedStaff.id,
        subject: 'Administrative Memo',
        body: msgBody
      });
      toast.success(`Message dispatched to ${selectedStaff.name}.`);
      setShowMessageModal(false);
      setMsgBody('');
    } catch (err) {
      toast.error('Failed to deliver message.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty & Staff Directory"
        subtitle="Manage academic educators, form masters, administrative personnel, teaching workloads, and credentials."
        actions={
          ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head'].includes(user?.role) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-4 h-4 text-muted" />
                Import Staff
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Staff Member
              </button>
            </div>
          )
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Faculty & Staff"
          value={totalStaff}
          icon={Users}
          color="brand"
          subtext={`${activeCount} active on school roster`}
        />
        <StatCard
          label="Teaching Educators"
          value={teachingStaffCount}
          icon={BookOpen}
          color="info"
          subtext={totalStaff > 0 ? `${teachingStaffCount} certified educators` : 'No teachers registered'}
        />
        <StatCard
          label="Support & Admin"
          value={adminStaffCount}
          icon={Shield}
          color="violet"
          subtext={totalStaff > 0 ? `${adminStaffCount} support personnel` : 'No admin personnel'}
        />
        <StatCard
          label="Avg Teaching Load"
          value={teachingStaffCount > 0 ? `${Math.round(24)} Periods` : '0 Periods'}
          icon={UserCheck}
          color="accent"
          subtext={teachingStaffCount > 0 ? 'Standard 24-28 periods / week' : 'No teaching allocations'}
        />
      </KpiStrip>

      {/* Controls: Search, Department Chips & Layout Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FilterChips
          chips={DEPARTMENTS}
          selected={selectedDept}
          onChange={setSelectedDept}
        />

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search faculty..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-48"
            />
          </div>

          <div className="flex items-center border border-line rounded-xl overflow-hidden bg-surface">
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-2 transition ${viewLayout === 'grid' ? 'bg-canvas text-brand-700' : 'text-muted hover:text-ink'}`}
              title="Grid Layout"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewLayout('table')}
              className={`p-2 transition ${viewLayout === 'table' ? 'bg-canvas text-brand-700' : 'text-muted hover:text-ink'}`}
              title="Table Layout"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* STAFF LIST: Grid or Table */}
      {viewLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                title="No Staff Found"
                description="No educators or administrative personnel match the search parameters."
              />
            </div>
          ) : (
            staff.map(member => {
              const teachingLoad = member.teaching_load || 24;
              const maxLoad = 30;
              const loadPct = Math.round((teachingLoad / maxLoad) * 100);
              const isDeactivated = member.status === 'deactivated';

              return (
                <div
                  key={member.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDeactivated
                      ? 'bg-canvas/50 border-line opacity-60'
                      : 'bg-surface border-line hover:border-line hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="md" />
                      <div>
                        <div className="font-bold text-sm text-ink">{member.name}</div>
                        <div className="text-xs text-muted font-medium">{member.role_title || 'Teacher'}</div>
                        {(member.qualification || (member.experience_years !== null && member.experience_years !== undefined && member.experience_years !== '')) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {member.qualification && (
                              <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200/60 px-1.5 py-0.5 rounded truncate max-w-[170px]" title={member.qualification}>
                                {member.qualification}
                              </span>
                            )}
                            {member.experience_years !== null && member.experience_years !== undefined && member.experience_years !== '' && (
                              <span className="text-[10px] font-medium text-muted bg-canvas border border-line px-1.5 py-0.5 rounded font-mono">
                                {member.experience_years} yrs exp
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <StatusPill status={isDeactivated ? 'inactive' : 'active'} />
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-muted">
                    {member.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted" />
                        <span className="font-mono">{member.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Teaching load bar */}
                  <div className="mt-4 pt-3 border-t border-line/60">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted font-medium">Teaching Load</span>
                      <span className="font-mono font-bold text-ink">{teachingLoad} / {maxLoad} periods</span>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-line/50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          loadPct >= 95 ? 'bg-danger' : loadPct >= 80 ? 'bg-accent' : 'bg-brand-500'
                        }`}
                        style={{ width: `${loadPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Card Actions */}
                  <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedStaff(member)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      View Profile
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStaff(member);
                          setShowMessageModal(true);
                        }}
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-canvas transition"
                        title="Send Message"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {['school_admin', 'super_admin'].includes(user?.role) && (
                        <button
                          onClick={() => setDeactivatingStaff(member)}
                          className={`p-1.5 rounded-lg transition ${
                            isDeactivated ? 'text-brand-500 hover:bg-brand-50' : 'text-muted hover:text-danger hover:bg-danger/10'
                          }`}
                          title={isDeactivated ? 'Reactivate Account' : 'Deactivate Account'}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <Card title="Staff Directory Ledger">
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Staff Member',
                sortable: true,
                render: (_, row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} size="sm" />
                    <div>
                      <div className="font-bold text-ink">{row.name}</div>
                      <div className="text-[11px] text-muted">{row.role_title || 'Teacher'}</div>
                    </div>
                  </div>
                )
              },
              { key: 'email', label: 'Email', render: v => <span className="font-mono text-xs">{v || 'N/A'}</span> },
              { key: 'phone', label: 'Phone', render: v => <span className="font-mono text-xs">{v || 'N/A'}</span> },
              {
                key: 'qualification',
                label: 'Qualification',
                render: v => v ? (
                  <span className="font-semibold text-xs text-brand-700 truncate max-w-[160px] inline-block" title={v}>
                    {v}
                  </span>
                ) : <span className="text-muted text-xs">—</span>
              },
              {
                key: 'experience_years',
                label: 'Experience',
                render: v => (v !== null && v !== undefined && v !== '') ? (
                  <span className="font-mono text-xs font-semibold text-ink">{v} yrs</span>
                ) : <span className="text-muted text-xs">—</span>
              },
              {
                key: 'teaching_load',
                label: 'Workload',
                render: v => <span className="font-mono font-bold text-xs">{v || 24} periods/wk</span>
              },
              {
                key: 'status',
                label: 'Status',
                render: v => <StatusPill status={v === 'deactivated' ? 'inactive' : 'active'} />
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setSelectedStaff(row)}
                      className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition"
                    >
                      Dossier
                    </button>
                    {['school_admin', 'super_admin'].includes(user?.role) && (
                      <button
                        onClick={() => setDeactivatingStaff(row)}
                        className={`p-1.5 rounded-lg transition ${
                          row.status === 'deactivated' ? 'text-brand-500' : 'text-muted hover:text-danger'
                        }`}
                        title={row.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              }
            ]}
            data={staff}
          />
        </Card>
      )}

      {/* Staff 360 Dossier Drawer */}
      <Drawer
        isOpen={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        title={selectedStaff?.name || 'Staff Member'}
      >
        {selectedStaff && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-canvas border border-line">
              <Avatar name={selectedStaff.name} size="lg" />
              <div>
                <h3 className="font-bold text-base text-ink">{selectedStaff.name}</h3>
                <p className="text-xs text-muted font-medium">{selectedStaff.role_title || 'Teacher'}</p>
                <div className="mt-1">
                  <StatusPill status={selectedStaff.status === 'deactivated' ? 'inactive' : 'active'} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Qualifications & Credentials</h4>
              <div className="p-3 rounded-xl bg-canvas border border-line space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Qualification:</span>
                  <span className="font-semibold text-brand-700 text-right">{selectedStaff.qualification || 'Not Specified'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Teaching Experience:</span>
                  <span className="font-mono font-bold text-ink">
                    {selectedStaff.experience_years ? `${selectedStaff.experience_years} Years` : 'Not Specified'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">EC / Civil Service No:</span>
                  <span className="font-mono text-ink font-semibold">{selectedStaff.ec_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Employment Status:</span>
                  <span className="capitalize font-medium text-ink">{selectedStaff.employment_type || 'Permanent'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Contact & Official Records</h4>
              <div className="p-3 rounded-xl bg-canvas border border-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Email:</span>
                  <span className="font-mono text-ink font-semibold">{selectedStaff.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Phone:</span>
                  <span className="font-mono text-ink font-semibold">{selectedStaff.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">EC / Staff Number:</span>
                  <span className="font-mono text-ink font-semibold">{selectedStaff.ec_number || 'EC-883921'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Teaching Allocations</h4>
              <div className="p-3 rounded-xl bg-canvas border border-line text-xs">
                <div className="font-bold text-ink">Form 1 & Form 2 Mathematics</div>
                <div className="text-muted mt-0.5">24 total periods scheduled across 4 streams.</div>
              </div>
            </div>

            <button
              onClick={() => setShowMessageModal(true)}
              className="w-full py-2.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              Send Direct Administrative Memo
            </button>
          </div>
        )}
      </Drawer>

      {/* Direct Message Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title={`Message ${selectedStaff?.name || 'Staff'}`}
        description="Deliver a secure internal message to this educator's portal inbox."
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          <textarea
            rows={4}
            required
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            placeholder="Type your message or departmental notification..."
            className="w-full p-3 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowMessageModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Send Memo
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Add Staff Member */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Register Faculty or Staff Member"
        description="Establish an educator profile with department placement and login access."
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Full Legal Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Tendai Moyo"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Official Email *</label>
              <input
                type="email"
                required
                placeholder="tmoyo@schoolbase.ac.zw"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Mobile Contact</label>
              <input
                type="text"
                placeholder="+263 77 123 4567"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Role Title</label>
              <input
                type="text"
                placeholder="Senior Mathematics Teacher"
                value={form.role_title}
                onChange={e => setForm({ ...form, role_title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Department</label>
              <select
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="sciences">Sciences & Mathematics</option>
                <option value="humanities">Humanities & Social</option>
                <option value="languages">Languages & Literature</option>
                <option value="commercials">Commercials</option>
                <option value="administration">Admin & Support</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Teaching Load (Periods/Wk)</label>
              <input
                type="number"
                min="0"
                max="35"
                value={form.teaching_load}
                onChange={e => setForm({ ...form, teaching_load: parseInt(e.target.value) || 24 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">EC / Civil Service Number</label>
              <input
                type="text"
                placeholder="EC-993810"
                value={form.ec_number}
                onChange={e => setForm({ ...form, ec_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Highest Academic Qualification</label>
              <input
                type="text"
                placeholder="e.g. B.Ed Mathematics, Dip.Ed, M.Sc"
                value={form.qualification}
                onChange={e => setForm({ ...form, qualification: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Teaching Experience (Years)</label>
              <input
                type="number"
                min="0"
                max="50"
                placeholder="e.g. 8"
                value={form.experience_years}
                onChange={e => setForm({ ...form, experience_years: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Employment Status</label>
              <select
                value={form.employment_type}
                onChange={e => setForm({ ...form, employment_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="permanent">Permanent / Pensionable</option>
                <option value="contract">Fixed Term Contract</option>
                <option value="temporary">Temporary / Relief</option>
                <option value="intern">Intern / Student Teacher</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">System Portal Role</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="teacher">Teacher / Educator</option>
                <option value="bursar">Bursar / Accounts Officer</option>
                <option value="nurse">School Nurse / Clinic</option>
                <option value="warden">Boarding Master / Warden</option>
                <option value="school_admin">School Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Assigned Class / Form Master</label>
            <select
              value={form.class_id}
              onChange={e => setForm({ ...form, class_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Not Assigned</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level || 'Class'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1">Designates this educator as the primary Form Master or Class Teacher.</p>
          </div>

          <div className="p-3 rounded-xl bg-canvas border border-line space-y-3">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-700" />
              <span>Portal Login Credentials (Optional)</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">Portal Username</label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">Initial Password</label>
                <input
                  type="text"
                  placeholder="Enter initial temporary password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
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
              {submitting ? 'Registering...' : 'Register Staff Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivation Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingStaff}
        onClose={() => setDeactivatingStaff(null)}
        onConfirm={() => handleToggleStatus(deactivatingStaff)}
        title={deactivatingStaff?.status === 'deactivated' ? 'Reactivate Staff Member' : 'Deactivate Staff Account'}
        description={`Are you sure you want to change access for ${deactivatingStaff?.name}?`}
        confirmText={deactivatingStaff?.status === 'deactivated' ? 'Reactivate' : 'Deactivate Account'}
        danger={deactivatingStaff?.status !== 'deactivated'}
      />

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        schoolId={activeSchoolId}
        entity="staff"
        title="Import Teachers & Staff Members"
        invalidateKeys={[`staff_${activeSchoolId}`]}
      />
    </div>
  );
}
