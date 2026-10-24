import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, FilterChips, ConfirmDialog, EmptyState
} from '../components/ui';
import {
  Users, Plus, Shield, KeyRound, Ban, CheckCircle2, Copy,
  Eye, EyeOff, Search, Lock, UserCheck
} from 'lucide-react';

const ROLES = [
  { id: '', label: 'All Roles' },
  { id: 'teacher', label: 'Teachers' },
  { id: 'parent', label: 'Parents' },
  { id: 'school_admin', label: 'Administrators' },
  { id: 'bursar', label: 'Bursars' },
  { id: 'student', label: 'Students' },
];

export default function UserManagement() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Password reset modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // New user credentials display
  const [createdCreds, setCreatedCreds] = useState(null);

  // Form state
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'teacher',
    name: '',
    phone: '',
    student_id: ''
  });

  const { data: usersData, loading: loadingUsers } = useApi(
    `users_${activeSchoolId}_${roleFilter}`,
    () => api.get(`/schools/${activeSchoolId}/users?role=${roleFilter}`).then(r => r.data || []),
    { deps: [activeSchoolId, roleFilter] }
  );

  const { data: studentsData } = useApi(
    `students_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: schoolsData } = useApi(
    'all_schools_for_user_mgmt',
    () => api.get('/schools').then(r => r.data || [])
  );
  const schools = Array.isArray(schoolsData) ? schoolsData : [];

  const rawUsers = Array.isArray(usersData) ? usersData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  const users = useMemo(() => {
    return rawUsers.filter(u => {
      return !searchQuery ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [rawUsers, searchQuery]);

  // KPIs
  const totalUsers = rawUsers.length;
  const teacherCount = rawUsers.filter(u => u.role === 'teacher').length;
  const parentCount = rawUsers.filter(u => u.role === 'parent').length;
  const adminCount = rawUsers.filter(u => u.role === 'school_admin' || u.role === 'super_admin').length;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetSchool = form.school_id || activeSchoolId;
      const res = await api.post(`/schools/${targetSchool}/users`, form);
      toast.success(`User account created for ${form.name || form.username}.`);
      setCreatedCreds({ username: form.username, password: form.password });
      setShowModal(false);
      setForm({ username: '', email: '', password: '', role: 'school_admin', name: '', phone: '', student_id: '', school_id: activeSchoolId });
      invalidate(`users_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetUser || !newPassword) return;
    setResetting(true);
    try {
      await api.patch(`/schools/${activeSchoolId}/users/${resetUser.id}/password`, { password: newPassword });
      toast.success(`Password reset for ${resetUser.username}.`);
      setShowResetModal(false);
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const copyCreds = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`Username: ${createdCreds.username}\nPassword: ${createdCreds.password}`);
    toast.success('Credentials copied to clipboard.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Accounts & Identity Access Management"
        subtitle="SchoolBase user authentication accounts, role permissions, password resets, and guardian linkages."
        actions={
          ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head'].includes(user?.role) && (
            <button
              onClick={() => {
                const randomPw = 'Sb' + Math.floor(100000 + Math.random() * 900000) + '!';
                setForm(prev => ({ ...prev, password: randomPw }));
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Create User Account
            </button>
          )
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Active Accounts"
          value={totalUsers}
          icon={Users}
          color="brand"
        />
        <StatCard
          label="Teacher Accounts"
          value={teacherCount}
          icon={UserCheck}
          color="info"
        />
        <StatCard
          label="Parent & Guardian Accounts"
          value={parentCount}
          icon={Users}
          color="violet"
        />
        <StatCard
          label="School Administrators"
          value={adminCount}
          icon={Shield}
          color="accent"
        />
      </KpiStrip>

      {/* Created Creds Alert Banner */}
      {createdCreds && (
        <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-between text-xs text-brand-700">
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-500" />
              New User Account Provisioned Successfully
            </div>
            <div className="font-mono mt-1 text-ink">
              Username: <strong>{createdCreds.username}</strong> • Temporary Password: <strong>{createdCreds.password}</strong>
            </div>
          </div>
          <button
            onClick={copyCreds}
            className="px-3 py-1.5 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-900 flex items-center gap-1 shadow-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Credentials
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FilterChips
          chips={ROLES}
          selected={roleFilter}
          onChange={setRoleFilter}
        />

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-56"
          />
        </div>
      </div>

      {/* Users DataTable */}
      <Card title="User Directory & Access Controls">
        <DataTable
          columns={[
            {
              key: 'username',
              label: 'User Account',
              sortable: true,
              render: (_, row) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.name || row.username} size="sm" />
                  <div>
                    <div className="font-bold text-ink">{row.name || row.username}</div>
                    <div className="font-mono text-[10px] text-muted">@{row.username}</div>
                  </div>
                </div>
              )
            },
            { key: 'email', label: 'Email', render: v => <span className="font-mono text-xs text-muted">{v || 'N/A'}</span> },
            {
              key: 'role',
              label: 'System Role',
              sortable: true,
              render: v => {
                const colors = {
                  school_admin: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
                  super_admin: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
                  teacher: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                  parent: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
                  student: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
                };
                return (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${colors[v] || 'bg-canvas text-muted border-line'}`}>
                    {v ? v.replace('_', ' ') : 'User'}
                  </span>
                );
              }
            },
            {
              key: 'status',
              label: 'Account Status',
              render: v => <StatusPill status={v === 'deactivated' ? 'inactive' : 'active'} />
            },
            {
              key: 'actions',
              label: '',
              render: (_, row) => (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => {
                      setResetUser(row);
                      setNewPassword('Pass' + Math.floor(1000 + Math.random() * 9000) + '!');
                      setShowResetModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                    title="Reset Password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-muted" />
                    Reset
                  </button>
                </div>
              )
            }
          ]}
          data={users}
          emptyTitle="No User Accounts Found"
          emptyMessage="No accounts match your role filter or search keywords."
        />
      </Card>

      {/* Password Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title={`Reset Password for @${resetUser?.username}`}
        description="Issue a new cryptographic password for this user account."
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">New Password *</label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink font-mono text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create User Account */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Provision New User Account"
        description="Create credentials for a teacher, parent guardian, or school administrator."
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {user?.role === 'super_admin' && (
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Target School Institution *</label>
              <select
                value={form.school_id || activeSchoolId}
                onChange={e => setForm({ ...form, school_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || s.id})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tendai Moyo"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">System Role *</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="school_admin">School Administrator</option>
                <option value="principal">Principal / Headmaster</option>
                <option value="deputy_head">Deputy Head</option>
                <option value="teacher">Teacher</option>
                <option value="bursar">Bursar / Cashier</option>
                <option value="parent">Parent / Guardian</option>
                {user?.role === 'super_admin' && (
                  <option value="super_admin">Super Administrator (Platform)</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Username *</label>
              <input
                type="text"
                required
                placeholder="tmoyo"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Temporary Password *</label>
              <input
                type="text"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Email Address</label>
              <input
                type="email"
                placeholder="user@schoolbase.ac.zw"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Mobile Phone</label>
              <input
                type="text"
                placeholder="+263 77..."
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* If parent, link to student */}
          {form.role === 'parent' && (
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Link to Student Child</label>
              <select
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Child...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.admission_number || 'No ADM'})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {submitting ? 'Creating...' : 'Provision Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
