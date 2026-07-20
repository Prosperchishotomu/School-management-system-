import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Bell, Save, Play, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Mail, CreditCard } from 'lucide-react';

const Notifications = () => {
  const { activeSchoolId, user } = useAuth();
  const [settings, setSettings] = useState({
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
    notify_attendance_absent: true,
    notify_results_published: true,
    notify_fees_overdue: true,
    notify_discipline_incident: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testChannel, setTestChannel] = useState('sms');
  const [testMsg, setTestMsg] = useState('This is a test notification from SchoolBase.');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isSuperAdmin = user?.role === 'super_admin';
  const isSchoolAdmin = user?.role === 'school_admin';

  useEffect(() => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/notification-settings`)
      .then(res => {
        if (res.data) {
          setSettings({
            sms_gateway_url: res.data.sms_gateway_url || '',
            sms_api_key: res.data.sms_api_key || '',
            sms_sender_id: res.data.sms_sender_id || '',
            email_smtp_host: res.data.email_smtp_host || '',
            email_smtp_port: parseInt(res.data.email_smtp_port || 587),
            email_smtp_user: res.data.email_smtp_user || '',
            email_smtp_pass: res.data.email_smtp_pass || '',
            email_from_address: res.data.email_from_address || '',
            email_from_name: res.data.email_from_name || '',
            payment_gateway_type: res.data.payment_gateway_type || 'mock',
            payment_merchant_id: res.data.payment_merchant_id || '',
            payment_merchant_key: res.data.payment_merchant_key || '',
            payment_api_url: res.data.payment_api_url || '',
            notify_attendance_absent: res.data.notify_attendance_absent !== 0,
            notify_results_published: res.data.notify_results_published !== 0,
            notify_fees_overdue: res.data.notify_fees_overdue !== 0,
            notify_discipline_incident: res.data.notify_discipline_incident !== 0
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeSchoolId]);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    api.put(`/schools/${activeSchoolId}/notification-settings`, settings)
      .then(() => {
        setMessage({ type: 'success', text: 'Notification gateway configurations saved successfully.' });
      })
      .catch(err => {
        setMessage({ type: 'error', text: err.message || 'Failed to save settings.' });
      })
      .finally(() => setSaving(false));
  };

  const handleRunDiagnostic = () => {
    const recipient = testChannel === 'sms' ? testPhone.trim() : testEmail.trim();
    if (testChannel !== 'banking' && !recipient) {
      setMessage({ type: 'error', text: `Please enter a test ${testChannel === 'sms' ? 'phone number' : 'email address'}.` });
      return;
    }

    setTesting(true);
    setMessage({ type: '', text: '' });
    
    const timestamp = () => `[${new Date().toLocaleTimeString()}]`;
    const logs = [];
    
    logs.push(`${timestamp()} [INIT] Spawning diagnostic worker for channel: [${testChannel.toUpperCase()}]`);
    if (testChannel !== 'banking') {
      logs.push(`${timestamp()} [RESOLVING] Recipient address: ${recipient}`);
      logs.push(`${timestamp()} [PAYLOAD] Message: "${testMsg}"`);
    } else {
      logs.push(`${timestamp()} [RESOLVING] Target school configs: ${activeSchoolId}`);
    }
    logs.push(`${timestamp()} [DISPATCH] Invoking backend gateway test endpoint...`);
    setConsoleLogs([...logs]);

    api.post(`/schools/${activeSchoolId}/communication/test`, {
      type: testChannel,
      recipient: testChannel !== 'banking' ? recipient : null,
      message: testChannel !== 'banking' ? testMsg : null
    })
      .then(res => {
        const data = res.data;
        logs.push(`${timestamp()} [BACKEND] Gateway connection successful.`);
        logs.push(`${timestamp()} [STATUS] Status code returned: ${data.status.toUpperCase()}`);
        logs.push(`${timestamp()} [DETAILS] Server response: "${data.details}"`);
        
        if (data.trace) {
          Object.entries(data.trace).forEach(([key, val]) => {
            if (key === 'handshake_logs' && Array.isArray(val)) {
              val.forEach(line => {
                logs.push(`${timestamp()} [SMTP-SOCKET] ${line}`);
              });
            } else {
              logs.push(`${timestamp()} [TRACE] ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
            }
          });
        }
        
        logs.push(`${timestamp()} [SUCCESS] Diagnostic completed successfully.`);
        setConsoleLogs([...logs]);
        setMessage({ type: 'success', text: `Diagnostic run completed with status: ${data.status}` });
      })
      .catch(err => {
        const errMsg = err.response?.data?.error?.message || err.message || 'Unknown server error.';
        logs.push(`${timestamp()} [ERROR] Gateway response failure: ${errMsg}`);
        logs.push(`${timestamp()} [CRITICAL] Connection test sequence aborted.`);
        setConsoleLogs([...logs]);
        setMessage({ type: 'error', text: `Diagnostic execution failed: ${errMsg}` });
      })
      .finally(() => setTesting(false));
  };

  if (!isSuperAdmin && !isSchoolAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 pt-16">
        <AlertTriangle className="w-16 h-16 text-brick-critical mx-auto" />
        <h2 className="text-2xl font-display font-bold text-ink">Access Restricted</h2>
        <p className="text-sm font-sans text-ink/60">Notification settings are only accessible by Administrators.</p>
      </div>
    );
  }

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <AlertTriangle className="w-16 h-16 text-amber-warning mb-4" />
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 font-sans text-sm">Select a school from the sidebar switcher to view or configure its messaging settings.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Gateway &amp; Notification Configuration</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {isSuperAdmin 
              ? 'Configure SMS gateway endpoints, Email SMTP accounts, and toggles for automated notifications.' 
              : 'Toggle automated event notifications (SMS & Email alerts).'}
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-sage/30 text-teal-dark border border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <form onSubmit={handleSave} className="md:col-span-2 space-y-6">
            
            {/* Super Admin technical configuration panels */}
            {isSuperAdmin ? (
              <>
                {/* SMS Gateway Setup */}
                <div className="glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-display font-bold text-ink flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-teal-primary" />
                    <span>SMS Gateway Setup</span>
                  </h3>
                  <p className="text-xs text-ink/50 leading-relaxed">
                    Set up bulk SMS endpoints. System sends notifications on attendance, grade releases, and fee notices.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1">Gateway Endpoint URL</label>
                    <input
                      type="text"
                      placeholder="https://api.bulksms.com/v1/messages"
                      value={settings.sms_gateway_url}
                      onChange={e => setSettings({ ...settings, sms_gateway_url: e.target.value })}
                      className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">API Key / Token</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••••••"
                        value={settings.sms_api_key}
                        onChange={e => setSettings({ ...settings, sms_api_key: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">Sender ID / Mask</label>
                      <input
                        type="text"
                        placeholder="e.g. SchoolBase"
                        value={settings.sms_sender_id}
                        onChange={e => setSettings({ ...settings, sms_sender_id: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Email SMTP Setup */}
                <div className="glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-display font-bold text-ink flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-teal-primary" />
                    <span>Email Gateway Configuration (SMTP)</span>
                  </h3>
                  <p className="text-xs text-ink/50 leading-relaxed">
                    Set up SMTP parameters to send newsletters, report cards, and email statements to guardians and staff.
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-ink/75 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="e.g. smtp.mailgun.org"
                        value={settings.email_smtp_host}
                        onChange={e => setSettings({ ...settings, email_smtp_host: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={settings.email_smtp_port}
                        onChange={e => setSettings({ ...settings, email_smtp_port: parseInt(e.target.value) || 587 })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="postmaster@yourdomain.com"
                        value={settings.email_smtp_user}
                        onChange={e => setSettings({ ...settings, email_smtp_user: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">SMTP Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={settings.email_smtp_pass}
                        onChange={e => setSettings({ ...settings, email_smtp_pass: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">From Address</label>
                      <input
                        type="email"
                        placeholder="noreply@harareprep.co.zw"
                        value={settings.email_from_address}
                        onChange={e => setSettings({ ...settings, email_from_address: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">From Name</label>
                      <input
                        type="text"
                        placeholder="Harare Primary School"
                        value={settings.email_from_name}
                        onChange={e => setSettings({ ...settings, email_from_name: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Gateway Configuration */}
                <div className="glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-display font-bold text-ink flex items-center space-x-2">
                    <CreditCard className="w-5 h-5 text-teal-primary" />
                    <span>Payment Gateways Setup</span>
                  </h3>
                  <p className="text-xs text-ink/50 leading-relaxed">
                    Set up direct integrations for parents/guardians to make fee payments. Supports local integrations (EcoCash, Paynow) and Sandbox testing.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">Gateway Provider *</label>
                      <select
                        value={settings.payment_gateway_type}
                        onChange={e => setSettings({ ...settings, payment_gateway_type: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs bg-paper focus:outline-none focus:border-teal-primary"
                      >
                        <option value="mock">Sandbox / Simulator</option>
                        <option value="ecocash">EcoCash (Mobile Money)</option>
                        <option value="paynow">Paynow Gateway</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">Gateway API Endpoint URL</label>
                      <input
                        type="text"
                        placeholder="https://www.paynow.co.zw/interface/initiatetransaction"
                        value={settings.payment_api_url}
                        onChange={e => setSettings({ ...settings, payment_api_url: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">Merchant Integration ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 10452"
                        value={settings.payment_merchant_id}
                        onChange={e => setSettings({ ...settings, payment_merchant_id: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1">Merchant Secret Key</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={settings.payment_merchant_key}
                        onChange={e => setSettings({ ...settings, payment_merchant_key: e.target.value })}
                        className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Principal Notice */
              <div className="p-4 rounded-xl bg-sage/10 border border-line-border/30 text-ink/70 flex items-start space-x-2 text-xs font-sans">
                <ShieldCheck className="w-4 h-4 text-teal-primary mt-0.5 flex-shrink-0" />
                <span>
                  Notice: Gateway protocols, bulk SMS endpoints, and SMTP email server parameters are managed directly by the platform Super Administrator. Contact support to request adjustments to these values.
                </span>
              </div>
            )}

            {/* Notification Rules */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-display font-bold text-ink">Automated Notification Rules</h3>
              <p className="text-xs text-ink/50">Configure which parent/guardian alerts are active for your school.</p>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_attendance_absent}
                    onChange={e => setSettings({ ...settings, notify_attendance_absent: e.target.checked })}
                    className="rounded border-line-border text-teal-primary focus:ring-teal-primary/30"
                  />
                  <span className="text-xs text-ink/75 font-sans">Notify guardians instantly on Student Absence</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_results_published}
                    onChange={e => setSettings({ ...settings, notify_results_published: e.target.checked })}
                    className="rounded border-line-border text-teal-primary focus:ring-teal-primary/30"
                  />
                  <span className="text-xs text-ink/75 font-sans">Notify guardians on consolidation/publishing of Term Results</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_fees_overdue}
                    onChange={e => setSettings({ ...settings, notify_fees_overdue: e.target.checked })}
                    className="rounded border-line-border text-teal-primary focus:ring-teal-primary/30"
                  />
                  <span className="text-xs text-ink/75 font-sans">Notify guardians when Term balances go into Arrears</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_discipline_incident}
                    onChange={e => setSettings({ ...settings, notify_discipline_incident: e.target.checked })}
                    className="rounded border-line-border text-teal-primary focus:ring-teal-primary/30"
                  />
                  <span className="text-xs text-ink/75 font-sans">Notify guardians on logging of Discipline Incidents</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Configuration</span>
              </button>
            </div>
          </form>

          {/* Test Desk for Admins */}
          {(isSuperAdmin || isSchoolAdmin) && (
            <div className="space-y-6 md:col-span-1">
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-base font-display font-bold text-ink">Connection Diagnostics</h3>
                  <p className="text-[11px] text-ink/50 leading-normal mt-0.5">Test configured SMTP and bulk SMS gateways by running real-time trace routines.</p>
                </div>

                {/* Channel Select Segment */}
                <div className="flex bg-sage/10 p-1 rounded-xl border border-line-border/30">
                  <button
                    type="button"
                    onClick={() => setTestChannel('sms')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${testChannel === 'sms' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:bg-sage/5'}`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestChannel('email')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${testChannel === 'email' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:bg-sage/5'}`}
                  >
                    SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestChannel('banking')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${testChannel === 'banking' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:bg-sage/5'}`}
                  >
                    Banking
                  </button>
                </div>

                {/* Recipient Input */}
                {testChannel === 'sms' && (
                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1">Test Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +263777123456"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono"
                    />
                  </div>
                )}
                {testChannel === 'email' && (
                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1">Test Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. admin@school.com"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono"
                    />
                  </div>
                )}
                {testChannel === 'banking' && (
                  <div className="p-3 bg-teal-primary/5 rounded-xl border border-teal-primary/10 text-[11px] text-teal-dark font-sans leading-relaxed">
                    ℹ️ Verification tests the school bank settings (bank name, account number) and gateway connectivity triggers.
                  </div>
                )}

                {/* Custom Message */}
                {testChannel !== 'banking' && (
                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1">Diagnostic Message Payload</label>
                    <textarea
                      rows={2}
                      value={testMsg}
                      onChange={e => setTestMsg(e.target.value)}
                      placeholder="Type a test message..."
                      className="w-full px-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-sans leading-normal resize-none"
                    />
                  </div>
                )}

                {/* Diagnostic Console Logger */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-wider">Diagnostic Console Trace</label>
                  <div className="font-mono bg-[#0d1117] text-[#58a6ff] rounded-xl p-3 text-[10px] h-40 overflow-y-auto border border-[#30363d] shadow-inner space-y-1 select-all scrollbar-thin scrollbar-thumb-ink/10">
                    {consoleLogs.length > 0 ? (
                      consoleLogs.map((log, index) => (
                        <div key={index} className={
                          log.includes('[ERROR]') || log.includes('[CRITICAL]') 
                            ? 'text-brick-critical' 
                            : log.includes('[SUCCESS]') || log.includes('[STATUS] SUCCESS')
                              ? 'text-[#39d353]'
                              : log.includes('[INIT]') || log.includes('[DISPATCH]')
                                ? 'text-amber-warning'
                                : 'text-[#8b949e]'
                        }>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-ink/30 italic text-center py-12">
                        Diagnostics Idle.<br />Click Run Test to print traces.
                      </div>
                    )}
                  </div>
                </div>

                {/* Trigger Action */}
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={testing}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-teal-primary text-teal-primary hover:bg-teal-primary/5 font-sans font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Run Connection Test</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;