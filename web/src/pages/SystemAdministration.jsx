import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldAlert, Settings, Mail, MessageSquare, CreditCard, 
  Trash2, Edit, Save, AlertTriangle, CheckCircle, Loader2,
  Database, RefreshCw
} from 'lucide-react';
import SkeletonLoader from '../components/ui/SkeletonLoader';

const SystemAdministration = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  
  // Tabs
  const [activeTab, setActiveTab] = useState('gateways'); // 'gateways', 'override'
  
  // Settings forms
  const [gatewaysForm, setGatewaysForm] = useState({
    sms_gateway_url: '',
    sms_api_key: '',
    sms_sender_id: '',
    email_smtp_host: '',
    email_smtp_port: 587,
    email_smtp_user: '',
    email_smtp_pass: '',
    email_from_address: '',
    email_from_name: '',
    payment_gateway_type: 'mock',
    payment_merchant_id: '',
    payment_merchant_key: '',
    payment_api_url: '',
    notify_attendance_absent: 1,
    notify_results_published: 1,
    notify_fees_overdue: 1,
    notify_discipline_incident: 1
  });
  
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  
  // Override Console state
  const [overrideEntity, setOverrideEntity] = useState('users');
  const [overrideAction, setOverrideAction] = useState('update'); // 'update', 'delete'
  const [overrideRecordId, setOverrideRecordId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideFieldsJson, setOverrideFieldsJson] = useState('{\n  "status": "active"\n}');
  
  // Lists for selector
  const [recordsList, setRecordsList] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Fetch schools
  useEffect(() => {
    api.get('/schools')
      .then(res => {
        if (res.data && res.data.length > 0) {
          setSchools(res.data);
          setSelectedSchoolId(res.data[0].id);
        }
      })
      .catch(err => console.error('Error fetching schools:', err));
  }, []);

  // Fetch settings when school selection changes
  useEffect(() => {
    if (!selectedSchoolId) return;
    setLoadingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    
    api.get(`/admin/system-settings/${selectedSchoolId}`)
      .then(res => {
        if (res.data) {
          setGatewaysForm({
            sms_gateway_url: res.data.sms_gateway_url || '',
            sms_api_key: res.data.sms_api_key || '',
            sms_sender_id: res.data.sms_sender_id || '',
            email_smtp_host: res.data.email_smtp_host || '',
            email_smtp_port: res.data.email_smtp_port || 587,
            email_smtp_user: res.data.email_smtp_user || '',
            email_smtp_pass: res.data.email_smtp_pass || '',
            email_from_address: res.data.email_from_address || '',
            email_from_name: res.data.email_from_name || '',
            payment_gateway_type: res.data.payment_gateway_type || 'mock',
            payment_merchant_id: res.data.payment_merchant_id || '',
            payment_merchant_key: res.data.payment_merchant_key || '',
            payment_api_url: res.data.payment_api_url || '',
            notify_attendance_absent: res.data.notify_attendance_absent ?? 1,
            notify_results_published: res.data.notify_results_published ?? 1,
            notify_fees_overdue: res.data.notify_fees_overdue ?? 1,
            notify_discipline_incident: res.data.notify_discipline_incident ?? 1
          });
        }
      })
      .catch(err => setSettingsError('Failed to fetch settings for this school.'))
      .finally(() => setLoadingSettings(false));
  }, [selectedSchoolId]);

  // Fetch records list for override dropdown
  const loadOverrideRecords = () => {
    if (!selectedSchoolId) return;
    setLoadingRecords(true);
    setRecordsList([]);
    setOverrideRecordId('');
    
    // Select path based on entity type
    let path = '';
    if (overrideEntity === 'users') path = `/schools/${selectedSchoolId}/users`;
    else if (overrideEntity === 'classes') path = `/schools/${selectedSchoolId}/classes`;
    else if (overrideEntity === 'students') path = `/schools/${selectedSchoolId}/students?per_page=100`;
    else if (overrideEntity === 'staff') path = `/schools/${selectedSchoolId}/staff`;
    else if (overrideEntity === 'fees') path = `/schools/${selectedSchoolId}/fees`;
    else if (overrideEntity === 'subjects') path = `/admin/subjects`;
    else if (overrideEntity === 'timetable') path = `/schools/${selectedSchoolId}/classes`;
    else if (overrideEntity === 'results') path = `/schools/${selectedSchoolId}/students?per_page=100`;
    else if (overrideEntity === 'grades') path = `/schools/${selectedSchoolId}/students?per_page=100`;

    if (!path) {
      setLoadingRecords(false);
      return;
    }

    api.get(path)
      .then(res => {
        const rawData = res.data?.data || res.data || [];
        setRecordsList(rawData);
      })
      .catch(err => console.error('Failed to load override records:', err))
      .finally(() => setLoadingRecords(false));
  };

  useEffect(() => {
    if (activeTab === 'override') {
      loadOverrideRecords();
    }
  }, [selectedSchoolId, overrideEntity, activeTab]);

  // Handle settings update
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    
    api.put(`/admin/system-settings/${selectedSchoolId}`, gatewaysForm)
      .then(res => {
        setSettingsSuccess('School integrations and settings updated successfully.');
      })
      .catch(err => {
        setSettingsError(err.message || 'Failed to update system integration configurations.');
      })
      .finally(() => setSavingSettings(false));
  };

  // Handle global override submission
  const handleOverrideSubmit = (e) => {
    e.preventDefault();
    if (!overrideRecordId) {
      setOverrideError('Please select or specify a record ID.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('A justification/reason is required to perform a global override.');
      return;
    }

    let fields = {};
    if (overrideAction === 'update') {
      try {
        fields = JSON.parse(overrideFieldsJson);
      } catch (err) {
        setOverrideError('Invalid JSON format in target override fields.');
        return;
      }
    }

    setSubmittingOverride(true);
    setOverrideSuccess('');
    setOverrideError('');

    api.put(`/admin/override/${overrideEntity}/${overrideRecordId}`, {
      action: overrideAction,
      reason: overrideReason,
      school_id: selectedSchoolId,
      fields: fields
    })
      .then(res => {
        setOverrideSuccess(`Successfully performed override ${overrideAction} action on ${overrideEntity} record #${overrideRecordId}.`);
        setOverrideReason('');
        loadOverrideRecords();
      })
      .catch(err => {
        setOverrideError(err.message || `Failed to execute override operation.`);
      })
      .finally(() => setSubmittingOverride(false));
  };

  // Helper to format record labels in selection
  const getRecordLabel = (rec) => {
    if (!rec) return '';
    if (overrideEntity === 'users') return `[${rec.id}] ${rec.username} (${rec.role})`;
    if (overrideEntity === 'classes') return `[${rec.id}] ${rec.name} (${rec.grade_level})`;
    if (overrideEntity === 'students' || overrideEntity === 'results' || overrideEntity === 'grades') {
      return `[${rec.id}] ${rec.first_name || ''} ${rec.last_name || ''} - Adm: ${rec.admission_number || rec.id}`;
    }
    if (overrideEntity === 'staff') return `[${rec.id}] ${rec.name} (${rec.role_title})`;
    if (overrideEntity === 'subjects') return `[${rec.id}] ${rec.name} (${rec.code})`;
    if (overrideEntity === 'fees') return `[${rec.id}] Student: ${rec.student_first_name || ''} ${rec.student_last_name || ''} - Due: $${rec.amount_due} (Paid: $${rec.amount_paid})`;
    return `[${rec.id}] ${rec.name || rec.title || rec.id}`;
  };

  // Set default JSON when record is selected
  useEffect(() => {
    if (overrideRecordId && overrideAction === 'update' && recordsList.length > 0) {
      const selected = recordsList.find(r => r.id === overrideRecordId);
      if (selected) {
        // Create edit envelope with existing parameters
        const copy = { ...selected };
        delete copy.id;
        delete copy.school_id;
        delete copy.created_at;
        delete copy.updated_at;
        setOverrideFieldsJson(JSON.stringify(copy, null, 2));
      }
    }
  }, [overrideRecordId]);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line-border/30 pb-5">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">System Administration</h1>
          <p className="text-sm font-sans text-ink/55 mt-1">Configure global gateway credentials and perform system-wide administrative overrides.</p>
        </div>
        
        {/* School Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-ink/60">Active School Tenant:</label>
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="bg-white border border-line-border/50 text-ink text-xs font-sans rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-teal-primary"
          >
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-ink/5 rounded-2xl w-max">
        <button
          onClick={() => setActiveTab('gateways')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'gateways'
              ? 'bg-white shadow-sm text-teal-primary border border-line-border/30'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Gateway &amp; Integrations</span>
        </button>
        <button
          onClick={() => setActiveTab('override')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'override'
              ? 'bg-white shadow-sm text-teal-primary border border-line-border/30'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Global Override Console</span>
        </button>
      </div>

      {/* Loading states */}
      {loadingSettings && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        </div>
      )}

      {/* Settings Integrations Form */}
      {!loadingSettings && activeTab === 'gateways' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsSuccess && (
            <div className="p-4 rounded-xl bg-sage/10 border border-teal-primary/20 text-teal-primary text-sm flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>{settingsSuccess}</span>
            </div>
          )}
          {settingsError && (
            <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">
              {settingsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Integrations */}
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3 mb-2">
                <Mail className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">SMTP Email Gateways</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">SMTP Host</label>
                  <input
                    type="text"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="smtp.mailtrap.io"
                    value={gatewaysForm.email_smtp_host}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Port</label>
                  <input
                    type="number"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="587"
                    value={gatewaysForm.email_smtp_port}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_smtp_port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Username</label>
                  <input
                    type="text"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="smtp-user-123"
                    value={gatewaysForm.email_smtp_user}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_smtp_user: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Password</label>
                  <input
                    type="password"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="••••••••"
                    value={gatewaysForm.email_smtp_pass}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_smtp_pass: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Sender Address</label>
                  <input
                    type="email"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="noreply@schoolbase.co.zw"
                    value={gatewaysForm.email_from_address}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_from_address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Sender Display Name</label>
                  <input
                    type="text"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="SchoolBase Platform"
                    value={gatewaysForm.email_from_name}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, email_from_name: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* SMS Integrations */}
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3 mb-2">
                <MessageSquare className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">SMS Aggregator Gateways</h3>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">SMS API Endpoint URL</label>
                <input
                  type="url"
                  className="w-full glass-input rounded-xl text-xs"
                  placeholder="https://api.bulksms.co.zw/v1/send"
                  value={gatewaysForm.sms_gateway_url}
                  onChange={e => setGatewaysForm({ ...gatewaysForm, sms_gateway_url: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">SMS Token / API Key</label>
                  <input
                    type="password"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="sms-secret-key"
                    value={gatewaysForm.sms_api_key}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, sms_api_key: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Sender Mask ID</label>
                  <input
                    type="text"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="SCHBASE"
                    value={gatewaysForm.sms_sender_id}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, sms_sender_id: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Payment Integrations */}
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4 md:col-span-2">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3 mb-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">Tuition Fees Payment Integration</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Gateway Type</label>
                  <select
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                    value={gatewaysForm.payment_gateway_type}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, payment_gateway_type: e.target.value })}
                  >
                    <option value="mock">Sandbox Mock Integration</option>
                    <option value="ecocash">EcoCash Express API</option>
                    <option value="paynow">Paynow Gateway</option>
                    <option value="innbucks">Innbucks API</option>
                    <option value="mukuru">Mukuru Agent Desk</option>
                    <option value="bank_transfer">Direct Bank Wire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Merchant Integration ID</label>
                  <input
                    type="text"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="e.g. 193021"
                    value={gatewaysForm.payment_merchant_id}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, payment_merchant_id: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Integration Secret Key</label>
                  <input
                    type="password"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="merchant-secret-key-12345"
                    value={gatewaysForm.payment_merchant_key}
                    onChange={e => setGatewaysForm({ ...gatewaysForm, payment_merchant_key: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Callback / API Query Endpoint URL</label>
                <input
                  type="url"
                  className="w-full glass-input rounded-xl text-xs"
                  placeholder="https://api.paynow.co.zw/interface/initiate"
                  value={gatewaysForm.payment_api_url}
                  onChange={e => setGatewaysForm({ ...gatewaysForm, payment_api_url: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 bg-teal-primary hover:bg-teal-dark text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md flex items-center space-x-2 disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving integration settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Integration Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Override Console Tab */}
      {!loadingSettings && activeTab === 'override' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form controls */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-line-border/30 space-y-6">
            <div className="flex items-center space-x-2 text-brick-critical border-b border-line-border/20 pb-3 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-sans font-bold text-ink">Super Admin Global Overrides</h3>
            </div>

            {overrideSuccess && (
              <div className="p-4 rounded-xl bg-sage/15 border border-teal-primary/20 text-teal-primary text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{overrideSuccess}</span>
              </div>
            )}
            {overrideError && (
              <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">
                {overrideError}
              </div>
            )}

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Entity Model</label>
                  <select
                    value={overrideEntity}
                    onChange={(e) => setOverrideEntity(e.target.value)}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="users">Users / Logins</option>
                    <option value="classes">Classes Roster</option>
                    <option value="timetable">Timetable Slots</option>
                    <option value="students">Students Records</option>
                    <option value="staff">Staff Directory</option>
                    <option value="fees">Fees Balances</option>
                    <option value="results">Academic Results</option>
                    <option value="grades">Raw Assessment Grades</option>
                    <option value="subjects">Curriculum Subjects</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Target Action</label>
                  <select
                    value={overrideAction}
                    onChange={(e) => setOverrideAction(e.target.value)}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold text-brick-critical"
                  >
                    <option value="update" className="text-ink">Update Fields</option>
                    <option value="delete" className="text-brick-critical">Force Hard Delete</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Select Record</label>
                  {loadingRecords ? (
                    <div className="flex items-center space-x-1.5 h-10 px-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-primary" />
                      <span className="text-[10px] text-ink/40">Loading records...</span>
                    </div>
                  ) : (
                    <select
                      value={overrideRecordId}
                      onChange={(e) => setOverrideRecordId(e.target.value)}
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                    >
                      <option value="">-- Choose Target --</option>
                      {recordsList.map(rec => (
                        <option key={rec.id} value={rec.id}>{getRecordLabel(rec)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Target Record ID (Manual override)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. USR00003"
                  className="w-full glass-input rounded-xl text-xs font-mono font-bold"
                  value={overrideRecordId}
                  onChange={e => setOverrideRecordId(e.target.value)}
                />
              </div>

              {overrideAction === 'update' && (
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">JSON Fields to Override</label>
                  <textarea
                    rows={6}
                    required
                    className="w-full glass-input rounded-xl text-xs font-mono p-3 bg-ink/5 text-ink"
                    value={overrideFieldsJson}
                    onChange={e => setOverrideFieldsJson(e.target.value)}
                  />
                  <span className="text-[9px] text-ink/40 block mt-1">Specify updated key-value fields in standard JSON encoding. Primary IDs and keys cannot be altered.</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Audit Trail Justification / Reason</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Mandatory explanation for audit logs (e.g. 'Reset teacher email locks due to domain migration mismatch')"
                  className="w-full glass-input rounded-xl text-xs"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                />
              </div>

              <div className="p-3 bg-brick-critical/5 border border-brick-critical/10 rounded-xl flex items-start space-x-2 text-[10px] text-brick-critical leading-relaxed font-semibold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>WARNING: Executing this override bypasses all role scopes, validation filters, and class checkpoints. This operation cannot be undone and will be flagged in system audit reports.</span>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingOverride || !overrideRecordId}
                  className={`px-5 py-3 rounded-xl text-xs font-semibold cursor-pointer shadow-md flex items-center space-x-2 disabled:opacity-40 ${
                    overrideAction === 'delete' 
                      ? 'bg-brick-critical hover:bg-brick-critical/90 text-white' 
                      : 'bg-teal-primary hover:bg-teal-dark text-white'
                  }`}
                >
                  {submittingOverride ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying override...</span>
                    </>
                  ) : (
                    <>
                      {overrideAction === 'delete' ? <Trash2 className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
                      <span>Execute Override {overrideAction === 'delete' ? 'Delete' : 'Update'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Stats / Logs sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                <Database className="w-4.5 h-4.5" />
                <h3 className="text-xs font-sans font-bold text-ink">Override Guide &amp; Targets</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-ink/75 font-sans leading-relaxed list-disc pl-4">
                <li>Select a school context using the top selector to populate local student, class, and staff lists.</li>
                <li><strong>Subjects</strong> are global and can be modified or deleted directly across schools.</li>
                <li>When updating, target properties must match database column names exactly. Invalid attributes will throw an error or be dropped by SQL layers.</li>
                <li>System Overrides require a brief reason which is injected directly to database `audit_logs` for compliance checks.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAdministration;
