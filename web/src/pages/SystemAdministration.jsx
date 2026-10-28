import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldAlert, Settings, Mail, MessageSquare, CreditCard, 
  Trash2, Edit, Save, AlertTriangle, CheckCircle, Loader2,
  Database, RefreshCw, Eye, EyeOff, Building2, Clock, Plus, ArrowLeft,
  Check, Info
} from 'lucide-react';
import SkeletonLoader from '../components/ui/SkeletonLoader';

const SystemAdministration = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  
  // Tabs: 'profile', 'gateways', 'periods', 'override'
  const [activeTab, setActiveTab] = useState('profile');
  
  // Institutional Profile State
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    school_type: 'secondary',
    head_title: 'Headmaster',
    is_boarding: false,
    boarding_type: 'day',
    tuition_fee_benchmark: 150,
    currency: 'USD',
    bank_name: '',
    account_number: ''
  });

  // Periods State
  const [periodsList, setPeriodsList] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [savingPeriods, setSavingPeriods] = useState(false);
  const [periodSuccess, setPeriodSuccess] = useState('');
  const [periodError, setPeriodError] = useState('');

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

  // Password visibility states
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showPayKey, setShowPayKey] = useState(false);

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

  // Fetch settings and periods when school selection changes
  useEffect(() => {
    if (!selectedSchoolId) return;
    setLoadingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    
    api.get(`/admin/system-settings/${selectedSchoolId}`)
      .then(res => {
        const payload = res.data?.data || res.data;
        if (payload) {
          setSchoolForm({
            name: payload.name || '',
            school_type: payload.school_type || payload.type || 'secondary',
            head_title: payload.head_title || 'Headmaster',
            is_boarding: Boolean(payload.is_boarding),
            boarding_type: payload.boarding_type || 'day',
            tuition_fee_benchmark: payload.tuition_fee_benchmark ?? 150,
            currency: payload.currency || 'USD',
            bank_name: payload.bank_name || '',
            account_number: payload.account_number || ''
          });
          setGatewaysForm({
            sms_gateway_url: payload.sms_gateway_url || '',
            sms_api_key: payload.sms_api_key || '',
            sms_sender_id: payload.sms_sender_id || '',
            email_smtp_host: payload.email_smtp_host || '',
            email_smtp_port: payload.email_smtp_port || 587,
            email_smtp_user: payload.email_smtp_user || '',
            email_smtp_pass: payload.email_smtp_pass || '',
            email_from_address: payload.email_from_address || '',
            email_from_name: payload.email_from_name || '',
            payment_gateway_type: payload.payment_gateway_type || 'mock',
            payment_merchant_id: payload.payment_merchant_id || '',
            payment_merchant_key: payload.payment_merchant_key || '',
            payment_api_url: payload.payment_api_url || '',
            notify_attendance_absent: payload.notify_attendance_absent ?? 1,
            notify_results_published: payload.notify_results_published ?? 1,
            notify_fees_overdue: payload.notify_fees_overdue ?? 1,
            notify_discipline_incident: payload.notify_discipline_incident ?? 1
          });
        }
      })
      .catch(err => setSettingsError('Failed to fetch settings for this school.'))
      .finally(() => setLoadingSettings(false));

    // Load periods
    setLoadingPeriods(true);
    setPeriodSuccess('');
    setPeriodError('');
    api.get(`/schools/${selectedSchoolId}/timetable/periods`)
      .then(res => {
        const list = res.data?.data || res.data || [];
        setPeriodsList(Array.isArray(list) ? list : []);
      })
      .catch(err => console.error('Failed to load periods:', err))
      .finally(() => setLoadingPeriods(false));
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

  // Handle settings update (profile + gateways)
  const handleSaveSettings = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    
    api.put(`/admin/system-settings/${selectedSchoolId}`, {
      ...schoolForm,
      ...gatewaysForm
    })
      .then(res => {
        setSettingsSuccess('School profile and configurations saved successfully.');
      })
      .catch(err => {
        setSettingsError(err.message || 'Failed to update system configurations.');
      })
      .finally(() => setSavingSettings(false));
  };

  // Handle teaching periods update
  const handleSavePeriods = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingPeriods(true);
    setPeriodSuccess('');
    setPeriodError('');

    api.post(`/schools/${selectedSchoolId}/timetable/periods`, { periods: periodsList })
      .then(res => {
        setPeriodSuccess('Teaching periods schedule saved successfully.');
      })
      .catch(err => {
        setPeriodError(err.message || 'Failed to save teaching periods schedule.');
      })
      .finally(() => setSavingPeriods(false));
  };

  const handlePeriodChange = (index, field, value) => {
    const updated = [...periodsList];
    updated[index] = { ...updated[index], [field]: value };
    setPeriodsList(updated);
  };

  const handleAddPeriod = () => {
    const nextId = periodsList.length > 0 ? Math.max(...periodsList.map(p => Number(p.id) || 0)) + 1 : 1;
    const newPeriod = {
      id: nextId,
      name: `Period ${periodsList.filter(p => !p.is_break).length + 1}`,
      start_time: '12:00',
      end_time: '12:45',
      is_break: false
    };
    setPeriodsList([...periodsList, newPeriod]);
  };

  const handleDeletePeriod = (index) => {
    const updated = periodsList.filter((_, i) => i !== index);
    setPeriodsList(updated);
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
        try {
          const repaired = overrideFieldsJson.replace(/(:\s*)([a-zA-Z_][a-zA-Z0-9_\-]*)\s*([,\}\n\r])/g, (match, p1, p2, p3) => {
            if (['true', 'false', 'null'].includes(p2)) return match;
            return `${p1}"${p2}"${p3}`;
          });
          fields = JSON.parse(repaired);
          setOverrideFieldsJson(JSON.stringify(fields, null, 2));
        } catch (repairErr) {
          setOverrideError('Invalid JSON format in target override fields. Ensure string values are quoted e.g. "middle_name": "Testing".');
          return;
        }
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

  const handleFormatJson = () => {
    try {
      const repaired = overrideFieldsJson.replace(/(:\s*)([a-zA-Z_][a-zA-Z0-9_\-]*)\s*([,\}\n\r])/g, (match, p1, p2, p3) => {
        if (['true', 'false', 'null'].includes(p2)) return match;
        return `${p1}"${p2}"${p3}`;
      });
      const parsed = JSON.parse(repaired);
      setOverrideFieldsJson(JSON.stringify(parsed, null, 2));
      setOverrideError('');
    } catch (err) {
      setOverrideError('Could not auto-repair JSON: ' + err.message);
    }
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
    <div className="module-page system-admin-page space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line-border/30 pb-5">
        <div>
          <div className="flex items-center space-x-3 mb-1.5">
            <Link to="/dashboard" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-teal-primary hover:text-teal-dark bg-teal-primary/10 hover:bg-teal-primary/15 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Drill Up (Dashboard)</span>
            </Link>
          </div>
          <h1 className="text-3xl font-display font-bold text-ink">System Administration</h1>
          <p className="text-sm font-sans text-ink/55 mt-1">Configure institutional profile, educational levels, teaching periods, gateway credentials and administrative overrides.</p>
        </div>
        
        {/* School Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-ink/60">Active School Tenant:</label>
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="bg-white border border-line-border/50 text-ink text-xs font-sans rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-teal-primary cursor-pointer shadow-sm"
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
          onClick={() => setActiveTab('profile')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-white shadow-sm text-teal-primary border border-line-border/30'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Institutional Profile &amp; Level</span>
        </button>
        <button
          onClick={() => setActiveTab('periods')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'periods'
              ? 'bg-white shadow-sm text-teal-primary border border-line-border/30'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Teaching Periods &amp; Intervals</span>
        </button>
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

      {/* Profile & School Level Tab */}
      {!loadingSettings && activeTab === 'profile' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsSuccess && (
            <div className="p-4 rounded-xl bg-sage/10 border border-teal-primary/20 text-teal-primary text-sm flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{settingsSuccess}</span>
            </div>
          )}
          {settingsError && (
            <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">
              {settingsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* School Profile and Type */}
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3 mb-2">
                <Building2 className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">Institutional Identity &amp; Educational Level</h3>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">School Name</label>
                <input
                  type="text"
                  className="w-full glass-input rounded-xl text-xs"
                  placeholder="e.g. Greenwood Secondary School"
                  value={schoolForm.name}
                  onChange={e => setSchoolForm({ ...schoolForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Institutional Level / Type</label>
                <select
                  value={schoolForm.school_type}
                  onChange={e => setSchoolForm({ ...schoolForm, school_type: e.target.value })}
                  className="w-full glass-input rounded-xl text-xs bg-white"
                >
                  <option value="primary">Primary School (ECD A - Grade 7)</option>
                  <option value="secondary">Ordinary Level Secondary School (Form 1 - Form 4 strictly, No Form 5 &amp; 6)</option>
                  <option value="high_school">High School (Ordinary &amp; Advanced Level: Form 1 - Form 6)</option>
                  <option value="combined">Combined Institution (Primary &amp; High School)</option>
                </select>
              </div>

              {(schoolForm.school_type === 'secondary' || schoolForm.school_type === 'o_level') && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold">Ordinary Level Policy Active:</span> Ordinary level schools strictly offer Form 1 through Form 4 only. Form 5 and Form 6 (Lower 6 &amp; Upper 6) are prohibited and cannot be created or registered under Ordinary Level schools. If your institution offers Advanced Level, choose <strong>High School</strong>.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Head Title</label>
                  <select
                    value={schoolForm.head_title}
                    onChange={e => setSchoolForm({ ...schoolForm, head_title: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-white"
                  >
                    <option value="Headmaster">Headmaster</option>
                    <option value="Headmistress">Headmistress</option>
                    <option value="Principal">Principal</option>
                    <option value="School Head">School Head</option>
                    <option value="Director">Director</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Boarding Model</label>
                  <select
                    value={schoolForm.boarding_type}
                    onChange={e => setSchoolForm({ ...schoolForm, boarding_type: e.target.value, is_boarding: e.target.value !== 'day' })}
                    className="w-full glass-input rounded-xl text-xs bg-white"
                  >
                    <option value="day">Day School Only</option>
                    <option value="boarding">Full Boarding Only</option>
                    <option value="dual">Day &amp; Boarding (Dual)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial and Banking Policy */}
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3 mb-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">Financial &amp; Banking Parameters</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Tuition Fee Benchmark ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full glass-input rounded-xl text-xs"
                    placeholder="150.00"
                    value={schoolForm.tuition_fee_benchmark}
                    onChange={e => setSchoolForm({ ...schoolForm, tuition_fee_benchmark: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Default Currency</label>
                  <select
                    value={schoolForm.currency}
                    onChange={e => setSchoolForm({ ...schoolForm, currency: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ZiG">ZiG (Zimbabwe Gold)</option>
                    <option value="ZAR">ZAR (Rand)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Official Bank Name</label>
                <input
                  type="text"
                  className="w-full glass-input rounded-xl text-xs"
                  placeholder="e.g. Stanbic Bank Zimbabwe"
                  value={schoolForm.bank_name}
                  onChange={e => setSchoolForm({ ...schoolForm, bank_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Official Account Number</label>
                <input
                  type="text"
                  className="w-full glass-input rounded-xl text-xs"
                  placeholder="e.g. 9140001234567"
                  value={schoolForm.account_number}
                  onChange={e => setSchoolForm({ ...schoolForm, account_number: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn-primary btn-md shadow-sm"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile Settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Institutional Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Teaching Periods & Schedule Tab */}
      {!loadingSettings && activeTab === 'periods' && (
        <form onSubmit={handleSavePeriods} className="space-y-6">
          {periodSuccess && (
            <div className="p-4 rounded-xl bg-sage/10 border border-teal-primary/20 text-teal-primary text-sm flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{periodSuccess}</span>
            </div>
          )}
          {periodError && (
            <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">
              {periodError}
            </div>
          )}

          <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-border/20 pb-4">
              <div className="flex items-center space-x-2 text-teal-primary">
                <Clock className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-sans font-bold text-ink">Teaching Periods &amp; Interval Timetable</h3>
                  <p className="text-xs text-ink/50 mt-0.5">Configure period names, operating start/end times, and designate tea/lunch breaks.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddPeriod}
                className="px-4 py-2 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Period</span>
              </button>
            </div>

            {loadingPeriods ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-teal-primary" />
              </div>
            ) : periodsList.length === 0 ? (
              <div className="text-center py-8 text-ink/50 text-xs">
                No periods configured. Click &quot;Add Period&quot; to initialize schedule intervals.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line-border/20 text-ink/50 text-left">
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">Period Name</th>
                      <th className="py-2.5 px-3 font-semibold">Start Time</th>
                      <th className="py-2.5 px-3 font-semibold">End Time</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Is Break?</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/10">
                    {periodsList.map((p, idx) => (
                      <tr key={p.id || idx} className={`hover:bg-ink/[0.02] ${p.is_break ? 'bg-amber-500/[0.04]' : ''}`}>
                        <td className="py-2.5 px-3 font-mono text-ink/60">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={p.name || ''}
                            onChange={e => handlePeriodChange(idx, 'name', e.target.value)}
                            className="w-full glass-input rounded-lg text-xs py-1.5 px-2.5"
                            placeholder="e.g. Period 1 or Lunch Break"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="time"
                            value={p.start_time || '08:00'}
                            onChange={e => handlePeriodChange(idx, 'start_time', e.target.value)}
                            className="glass-input rounded-lg text-xs py-1.5 px-2.5"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="time"
                            value={p.end_time || '08:45'}
                            onChange={e => handlePeriodChange(idx, 'end_time', e.target.value)}
                            className="glass-input rounded-lg text-xs py-1.5 px-2.5"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(p.is_break)}
                            onChange={e => handlePeriodChange(idx, 'is_break', e.target.checked)}
                            className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeletePeriod(idx)}
                            className="p-1.5 text-brick-critical/60 hover:text-brick-critical hover:bg-brick-critical/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Period"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPeriods}
              className="btn btn-primary btn-md shadow-sm"
            >
              {savingPeriods ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Periods Schedule...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Teaching Periods Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>
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
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      className="w-full glass-input rounded-xl text-xs pr-10"
                      placeholder="••••••••"
                      value={gatewaysForm.email_smtp_pass}
                      onChange={e => setGatewaysForm({ ...gatewaysForm, email_smtp_pass: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer"
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                  <div className="relative">
                    <input
                      type={showSmsKey ? 'text' : 'password'}
                      className="w-full glass-input rounded-xl text-xs pr-10"
                      placeholder="sms-secret-key"
                      value={gatewaysForm.sms_api_key}
                      onChange={e => setGatewaysForm({ ...gatewaysForm, sms_api_key: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmsKey(!showSmsKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer"
                    >
                      {showSmsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                  <div className="relative">
                    <input
                      type={showPayKey ? 'text' : 'password'}
                      className="w-full glass-input rounded-xl text-xs pr-10"
                      placeholder="merchant-secret-key-12345"
                      value={gatewaysForm.payment_merchant_key}
                      onChange={e => setGatewaysForm({ ...gatewaysForm, payment_merchant_key: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPayKey(!showPayKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer"
                    >
                      {showPayKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
              className="btn btn-primary btn-md shadow-sm"
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">JSON Fields to Override</label>
                    <button type="button" onClick={handleFormatJson} className="text-[10px] text-teal-primary font-bold hover:underline cursor-pointer">Auto-Format / Repair JSON</button>
                  </div>
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
                  className={`btn btn-md shadow-sm ${
                    overrideAction === 'delete' ? 'btn-danger' : 'btn-primary'
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
