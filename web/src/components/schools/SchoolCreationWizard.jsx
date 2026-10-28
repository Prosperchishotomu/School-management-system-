import React, { useState, useEffect, useMemo } from 'react';
import {
  Building, Check, ChevronRight, ChevronLeft, X, Plus, Trash2,
  Lock, Shield, BookOpen, GraduationCap, Grid3X3, DollarSign,
  AlertTriangle, Users, Settings, Loader2, Sparkles, Home,
  CheckCircle2, Search, Sliders
} from 'lucide-react';
import { STANDARD_SUBJECTS, STANDARD_DEPARTMENTS, STANDARD_GRADE_LEVELS } from '../../data/standardSubjects';
import { COMPULSORY_MODULES, CONFIGURABLE_MODULES, ALL_CONFIGURABLE_MODULE_IDS } from '../../utils/modules';

const STEPS = [
  { id: 1, label: 'Identity & Boarding', description: 'School type & operational model' },
  { id: 2, label: 'Classes', description: 'Class rosters & streams' },
  { id: 3, label: 'Curriculum & Subjects', description: 'Academic subject catalog' },
  { id: 4, label: 'Pages & Modules', description: 'Super Admin module access' },
  { id: 5, label: 'Admin & Review', description: 'Account credentials & review' },
];

export default function SchoolCreationWizard({ isOpen, onClose, onSchoolCreated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ─── Step 1: Identity & Boarding ──────────────────────────────────────────
  const [identity, setIdentity] = useState({
    name: '',
    code: '',
    school_type: 'secondary', // primary, secondary, high_school, combined
    head_title: 'Headmaster',
    boarding_type: 'day', // 'day' | 'boarding' | 'dual'
    is_boarding: 0,
    tuition_fee_benchmark: '',
    currency: 'USD',
    bank_name: '',
    account_number: ''
  });

  // Auto-generate code when school name changes
  const handleNameChange = (val) => {
    const next = { ...identity, name: val };
    if (!identity.code || identity.code === generateCode(identity.name)) {
      next.code = generateCode(val);
    }
    setIdentity(next);
  };

  const generateCode = (name) => {
    if (!name) return '';
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].substring(0, 3) + '-' + parts[1].substring(0, 3)).toUpperCase();
    }
    return clean.substring(0, 6).toUpperCase();
  };

  // ─── Step 2: Classes ──────────────────────────────────────────────────────
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');

  // Reset/populate classes when school_type changes
  useEffect(() => {
    if (identity.school_type === 'primary') {
      setSelectedClasses(['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']);
    } else if (identity.school_type === 'secondary') {
      setSelectedClasses(['Form 1', 'Form 2', 'Form 3', 'Form 4']);
    } else if (identity.school_type === 'high_school') {
      setSelectedClasses(['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6']);
    } else {
      setSelectedClasses(['ECD A', 'Grade 1', 'Grade 7', 'Form 1', 'Form 4', 'Lower 6', 'Upper 6']);
    }
  }, [identity.school_type]);

  const handleAddClass = (e) => {
    e?.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;
    if (!selectedClasses.includes(trimmed)) {
      setSelectedClasses([...selectedClasses, trimmed]);
    }
    setNewClassName('');
  };

  const handleRemoveClass = (cls) => {
    setSelectedClasses(selectedClasses.filter(c => c !== cls));
  };

  // ─── Step 3: Subjects ─────────────────────────────────────────────────────
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [customSubject, setCustomSubject] = useState({ name: '', code: '', department: 'General', level: 'all' });
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Set default subjects matching school type
  useEffect(() => {
    const isPrimary = identity.school_type === 'primary';
    const defaults = STANDARD_SUBJECTS.filter(s => {
      if (isPrimary) return s.level === 'primary' || s.level === 'all';
      return s.level === 'secondary' || s.level === 'o_level' || s.level === 'a_level' || s.level === 'all';
    }).map(s => s.name);
    setSelectedSubjects(defaults);
  }, [identity.school_type]);

  const toggleSubject = (subjName) => {
    if (selectedSubjects.includes(subjName)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subjName));
    } else {
      setSelectedSubjects([...selectedSubjects, subjName]);
    }
  };

  const selectAllFilteredSubjects = (filtered) => {
    const toAdd = filtered.map(s => s.name).filter(n => !selectedSubjects.includes(n));
    setSelectedSubjects([...selectedSubjects, ...toAdd]);
  };

  const deselectAllFilteredSubjects = (filtered) => {
    const names = new Set(filtered.map(s => s.name));
    setSelectedSubjects(selectedSubjects.filter(s => !names.has(s)));
  };

  const handleAddCustomSubject = (e) => {
    e?.preventDefault();
    if (!customSubject.name.trim()) return;
    const name = customSubject.name.trim();
    if (!selectedSubjects.includes(name)) {
      setSelectedSubjects([...selectedSubjects, name]);
    }
    setCustomSubject({ name: '', code: '', department: 'General', level: 'all' });
    setShowAddSubject(false);
  };

  const filteredSubjectsList = useMemo(() => {
    return STANDARD_SUBJECTS.filter(s => {
      const matchDept = selectedDept === 'all' || s.department === selectedDept;
      const matchSearch = !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [selectedDept, subjectSearch]);

  // ─── Step 4: Modules & Pages Selection ────────────────────────────────────
  const [enabledModules, setEnabledModules] = useState(() => {
    return ALL_CONFIGURABLE_MODULE_IDS.filter(id => id !== 'boarding');
  });

  // When boarding status changes, automatically enforce boarding module rule
  useEffect(() => {
    const isDay = identity.boarding_type === 'day';
    if (isDay) {
      // Day schools must NEVER have boarding enabled
      setEnabledModules(prev => prev.filter(m => m !== 'boarding'));
    } else {
      // Full/Dual boarding schools have boarding enabled by default
      setEnabledModules(prev => prev.includes('boarding') ? prev : [...prev, 'boarding']);
    }
  }, [identity.boarding_type]);

  const toggleModule = (modId) => {
    if (modId === 'boarding' && identity.boarding_type === 'day') {
      return; // Cannot enable boarding for day schools
    }
    if (enabledModules.includes(modId)) {
      setEnabledModules(enabledModules.filter(m => m !== modId));
    } else {
      setEnabledModules([...enabledModules, modId]);
    }
  };

  // ─── Step 5: Administrator Account ────────────────────────────────────────
  const [adminAccount, setAdminAccount] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Auto-generate admin username if empty
  useEffect(() => {
    if (!adminAccount.username && identity.code) {
      setAdminAccount(prev => ({
        ...prev,
        username: `${identity.code.toLowerCase().replace(/[^a-z0-9]/g, '')}admin`
      }));
    }
  }, [identity.code, adminAccount.username]);

  if (!isOpen) return null;

  // ─── Navigation Validation ────────────────────────────────────────────────
  const canGoNext = () => {
    if (currentStep === 1) {
      return identity.name.trim().length > 0 && identity.code.trim().length > 0;
    }
    if (currentStep === 2) {
      return selectedClasses.length > 0;
    }
    if (currentStep === 3) {
      return selectedSubjects.length > 0;
    }
    if (currentStep === 4) {
      return true;
    }
    if (currentStep === 5) {
      return adminAccount.username.trim().length > 0 && adminAccount.password.trim().length >= 6;
    }
    return true;
  };

  // ─── Submission ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      const isDay = identity.boarding_type === 'day';
      const isBoardingVal = isDay ? 0 : 1;

      // Filter out boarding if school is day
      const finalModules = isDay
        ? enabledModules.filter(m => m !== 'boarding')
        : enabledModules;

      // Map subjects into payload objects
      const subjectsPayload = selectedSubjects.map(sName => {
        const found = STANDARD_SUBJECTS.find(s => s.name === sName);
        return {
          name: sName,
          code: found ? found.name.substring(0, 4).toUpperCase() : sName.substring(0, 4).toUpperCase(),
          category: found ? found.department : 'General',
          level: found ? found.level : 'all'
        };
      });

      const payload = {
        name: identity.name.trim(),
        code: identity.code.trim().toUpperCase(),
        school_type: identity.school_type,
        head_title: identity.head_title,
        is_boarding: isBoardingVal,
        boarding_type: identity.boarding_type,
        tuition_fee_benchmark: identity.tuition_fee_benchmark ? parseFloat(identity.tuition_fee_benchmark) : null,
        currency: identity.currency,
        bank_name: identity.bank_name || null,
        account_number: identity.account_number || null,
        classes: selectedClasses,
        subjects: subjectsPayload,
        enabled_modules: finalModules,
        admin_username: adminAccount.username.trim().toLowerCase(),
        admin_email: adminAccount.email ? adminAccount.email.trim().toLowerCase() : null,
        admin_password: adminAccount.password.trim()
      };

      await onSchoolCreated(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create and configure school.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-paper rounded-3xl shadow-2xl border border-line-border/40 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Wizard Header */}
        <div className="px-6 py-5 border-b border-line-border/30 bg-ink/5 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-primary/10 text-teal-primary">
                Super Admin Provisioning
              </span>
              <span className="text-xs text-ink/40 font-mono">Step {currentStep} of {STEPS.length}</span>
            </div>
            <h2 className="text-xl font-display font-bold text-ink mt-0.5">
              Create & Configure School Tenant
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close creation wizard"
            className="btn-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progression Bar */}
        <div className="px-6 py-3 border-b border-line-border/20 bg-paper/50 shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[550px]">
            {STEPS.map((s, idx) => {
              const isPassed = currentStep > s.id;
              const isCurrent = currentStep === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div
                    onClick={() => { if (isPassed) setCurrentStep(s.id); }}
                    className={`flex items-center space-x-2 text-xs font-semibold ${
                      isCurrent
                        ? 'text-teal-primary font-bold'
                        : isPassed
                        ? 'text-teal-dark/80 cursor-pointer hover:underline'
                        : 'text-ink/35'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                        isCurrent
                          ? 'bg-teal-primary text-paper shadow-sm ring-2 ring-teal-primary/20'
                          : isPassed
                          ? 'bg-sage text-teal-dark'
                          : 'bg-ink/10 text-ink/40'
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.id}
                    </div>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 rounded ${isPassed ? 'bg-teal-primary/40' : 'bg-ink/10'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Wizard Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* ──────────────────────────────────────────────────────────────────
              STEP 1: IDENTITY & BOARDING OPERATIONAL MODEL
          ────────────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-display font-bold text-ink">School Identity & Profile</h3>
                <p className="text-xs text-ink/60">Enter the primary legal name, school code, and head of institution.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1.5">School Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Prince Edward High School"
                    value={identity.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className="w-full glass-input rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1.5">Tenant School Code *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. PE-HARARE"
                    value={identity.code}
                    onChange={e => setIdentity({ ...identity, code: e.target.value.toUpperCase() })}
                    className="w-full glass-input rounded-xl text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1.5">School Type *</label>
                  <select
                    value={identity.school_type}
                    onChange={e => setIdentity({ ...identity, school_type: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold cursor-pointer"
                  >
                    <option value="primary">Primary School (ECD A - Grade 7)</option>
                    <option value="secondary">Secondary School (Form 1 - Form 4)</option>
                    <option value="high_school">High School (Ordinary & Advanced Level)</option>
                    <option value="combined">Combined Institution (Primary & Secondary)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1.5">Head of Institution Title *</label>
                  <select
                    value={identity.head_title}
                    onChange={e => setIdentity({ ...identity, head_title: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold cursor-pointer"
                  >
                    <option value="Headmaster">Headmaster</option>
                    <option value="Principal">Principal</option>
                    <option value="Headmistress">Headmistress</option>
                    <option value="Rector">Rector</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1.5">Tuition Benchmark ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 500.00"
                    value={identity.tuition_fee_benchmark}
                    onChange={e => setIdentity({ ...identity, tuition_fee_benchmark: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Boarding Model Selection (Crucial User Requirement) */}
              <div className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-0.5">
                      Boarding & Residential Architecture *
                    </label>
                    <p className="text-[11px] text-ink/60">
                      Determine whether this institution operates boarding facilities. Day schools will have all hostel and exeat pages permanently removed.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Day School (Non-Boarding) */}
                  <div
                    onClick={() => setIdentity({ ...identity, boarding_type: 'day', is_boarding: 0 })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      identity.boarding_type === 'day'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-sm'
                        : 'border-line-border/40 hover:border-line-border hover:bg-ink/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">🏫</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        identity.boarding_type === 'day' ? 'bg-teal-primary text-paper' : 'bg-ink/10 text-ink/60'
                      }`}>
                        Day School Only
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-ink">Non-Boarding School</h4>
                    <p className="text-[11px] text-ink/65 mt-1 leading-relaxed">
                      Commuter students only. Hostels, dormitories, and exeat gate passes are completely excluded.
                    </p>
                  </div>

                  {/* Option 2: Full Boarding */}
                  <div
                    onClick={() => setIdentity({ ...identity, boarding_type: 'boarding', is_boarding: 1 })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      identity.boarding_type === 'boarding'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-sm'
                        : 'border-line-border/40 hover:border-line-border hover:bg-ink/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">🛏️</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        identity.boarding_type === 'boarding' ? 'bg-teal-primary text-paper' : 'bg-ink/10 text-ink/60'
                      }`}>
                        Full Boarding
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-ink">Full Boarding School</h4>
                    <p className="text-[11px] text-ink/65 mt-1 leading-relaxed">
                      All learners reside on campus. Dormitories, bed allocations, house points, and exeat gate permits enabled.
                    </p>
                  </div>

                  {/* Option 3: Dual Model */}
                  <div
                    onClick={() => setIdentity({ ...identity, boarding_type: 'dual', is_boarding: 1 })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      identity.boarding_type === 'dual'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-sm'
                        : 'border-line-border/40 hover:border-line-border hover:bg-ink/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">🏛️</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        identity.boarding_type === 'dual' ? 'bg-teal-primary text-paper' : 'bg-ink/10 text-ink/60'
                      }`}>
                        Dual Model
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-ink">Day & Boarding (Dual)</h4>
                    <p className="text-[11px] text-ink/65 mt-1 leading-relaxed">
                      Hybrid enrollment of commuter scholars and hostel residents. Both day and hostel features active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              STEP 2: CLASSES PROVISIONING
          ────────────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-display font-bold text-ink">Configure Classes & Streams</h3>
                  <p className="text-xs text-ink/60">Select or add the academic classes that will be created for {identity.name || 'this school'}.</p>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedClasses(['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'])}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-ink/5 hover:bg-ink/10 text-ink/70 cursor-pointer"
                  >
                    Primary Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedClasses(['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6'])}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-ink/5 hover:bg-ink/10 text-ink/70 cursor-pointer"
                  >
                    High School Set
                  </button>
                </div>
              </div>

              {/* Add custom class input */}
              <form onSubmit={handleAddClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter custom class name or stream (e.g. Form 1 North, Grade 3 Blue)..."
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  className="flex-1 glass-input rounded-xl text-xs"
                />
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/30 text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              </form>

              {/* Active Classes Chips */}
              <div className="bg-ink/5 p-5 rounded-2xl border border-line-border/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Configured Classes ({selectedClasses.length})
                  </span>
                  {selectedClasses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedClasses([])}
                      className="text-[10px] text-brick-critical hover:underline cursor-pointer font-semibold"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {selectedClasses.length === 0 ? (
                  <div className="py-8 text-center text-xs text-ink/40">
                    No classes added. Use the input above or select a preset to configure classes.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedClasses.map((cls) => (
                      <div
                        key={cls}
                        className="px-3 py-1.5 rounded-xl bg-paper border border-line-border/40 shadow-xs flex items-center space-x-2 text-xs font-semibold text-ink group"
                      >
                        <Grid3X3 className="w-3.5 h-3.5 text-teal-primary" />
                        <span>{cls}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveClass(cls)}
                          className="text-ink/30 hover:text-brick-critical transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              STEP 3: CURRICULUM & SUBJECTS
          ────────────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-display font-bold text-ink">Curriculum & Subject Catalog</h3>
                  <p className="text-xs text-ink/60">Configure the subjects taught in {identity.name || 'this school'}. Pre-selected according to curriculum level.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-primary/10 text-teal-primary font-mono">
                    {selectedSubjects.length} Subjects Active
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddSubject(!showAddSubject)}
                    className="px-3 py-1.5 border border-line-border hover:bg-ink/5 rounded-xl text-xs font-semibold text-ink cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-primary" />
                    <span>Custom Subject</span>
                  </button>
                </div>
              </div>

              {/* Custom Subject Form Drawer */}
              {showAddSubject && (
                <form onSubmit={handleAddCustomSubject} className="p-4 rounded-2xl bg-teal-primary/5 border border-teal-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-dark">Add Custom Subject</span>
                    <button type="button" onClick={() => setShowAddSubject(false)} className="text-ink/40 hover:text-ink"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      required
                      type="text"
                      placeholder="Subject Name (e.g. Robotics)"
                      value={customSubject.name}
                      onChange={e => setCustomSubject({ ...customSubject, name: e.target.value })}
                      className="glass-input rounded-xl text-xs"
                    />
                    <select
                      value={customSubject.department}
                      onChange={e => setCustomSubject({ ...customSubject, department: e.target.value })}
                      className="glass-input rounded-xl text-xs bg-paper font-semibold"
                    >
                      {STANDARD_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-bold shadow hover:bg-teal-dark cursor-pointer">
                      Add to Catalog
                    </button>
                  </div>
                </form>
              )}

              {/* Filters & Bulk Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-ink/40" />
                  <input
                    type="text"
                    placeholder="Search subjects..."
                    value={subjectSearch}
                    onChange={e => setSubjectSearch(e.target.value)}
                    className="w-full glass-input rounded-xl text-xs pl-8.5"
                  />
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="glass-input rounded-xl text-xs bg-paper font-semibold cursor-pointer"
                  >
                    <option value="all">All Departments ({STANDARD_SUBJECTS.length})</option>
                    {STANDARD_DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => selectAllFilteredSubjects(filteredSubjectsList)}
                    className="px-2.5 py-1.5 text-[10px] font-semibold bg-ink/5 hover:bg-ink/10 rounded-lg text-ink cursor-pointer whitespace-nowrap"
                  >
                    Select Shown
                  </button>
                  <button
                    type="button"
                    onClick={() => deselectAllFilteredSubjects(filteredSubjectsList)}
                    className="px-2.5 py-1.5 text-[10px] font-semibold bg-ink/5 hover:bg-ink/10 rounded-lg text-ink/60 cursor-pointer whitespace-nowrap"
                  >
                    Deselect Shown
                  </button>
                </div>
              </div>

              {/* Subjects Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredSubjectsList.map(subj => {
                  const isChecked = selectedSubjects.includes(subj.name);
                  return (
                    <label
                      key={subj.name}
                      className={`p-3 rounded-xl border flex items-start space-x-2.5 transition-all cursor-pointer ${
                        isChecked
                          ? 'border-teal-primary/40 bg-teal-primary/5 shadow-xs'
                          : 'border-line-border/30 hover:border-line-border hover:bg-ink/5 opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSubject(subj.name)}
                        className="mt-0.5 rounded text-teal-primary focus:ring-teal-primary"
                      />
                      <div className="truncate">
                        <span className={`text-xs block truncate ${isChecked ? 'font-bold text-ink' : 'font-medium text-ink/70'}`}>
                          {subj.name}
                        </span>
                        <span className="text-[10px] text-ink/45 block truncate font-sans">
                          {subj.department} • <span className="uppercase">{subj.level}</span>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              STEP 4: PAGES & MODULES SELECTION (SUPER ADMIN ACCESS CONTROL)
          ────────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-display font-bold text-ink">Pages & Module Configuration</h3>
                <p className="text-xs text-ink/60 leading-relaxed">
                  As Super Admin, configure which pages and feature modules are accessible to this school. 
                  Compulsory core pages are permanently active. Non-boarding schools have boarding pages strictly disabled.
                </p>
              </div>

              {/* Section A: Compulsory Base Modules */}
              <div className="p-4 rounded-2xl bg-sage/20 border border-teal-primary/20 space-y-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-teal-dark" />
                  <h4 className="text-xs font-bold text-teal-dark uppercase tracking-wider">
                    Compulsory Base Pages (Active For All Schools)
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMPULSORY_MODULES.map(cm => (
                    <div key={cm.id} className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-paper/80 border border-teal-primary/20 text-xs font-semibold text-ink">
                      <Lock className="w-3 h-3 text-teal-dark shrink-0" />
                      <span className="truncate">{cm.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section B: Configurable Feature Pages */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Decided by Super Admin (Feature Pages & Tools)
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = ALL_CONFIGURABLE_MODULE_IDS.filter(id => {
                          if (id === 'boarding' && identity.boarding_type === 'day') return false;
                          return true;
                        });
                        setEnabledModules(allIds);
                      }}
                      className="px-2.5 py-1 text-[10px] font-semibold rounded bg-ink/5 hover:bg-ink/10 text-ink cursor-pointer"
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnabledModules([])}
                      className="px-2.5 py-1 text-[10px] font-semibold rounded bg-ink/5 hover:bg-ink/10 text-ink/60 cursor-pointer"
                    >
                      Disable Optional
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CONFIGURABLE_MODULES.map(mod => {
                    const isBoardingMod = mod.id === 'boarding';
                    const isDaySchool = identity.boarding_type === 'day';
                    const isForcedOff = isBoardingMod && isDaySchool;
                    const isEnabled = enabledModules.includes(mod.id) && !isForcedOff;

                    return (
                      <div
                        key={mod.id}
                        onClick={() => {
                          if (!isForcedOff) toggleModule(mod.id);
                        }}
                        className={`p-4 rounded-2xl border transition-all select-none ${
                          isForcedOff
                            ? 'border-line-border/30 bg-ink/5 opacity-55 cursor-not-allowed'
                            : isEnabled
                            ? 'border-teal-primary/50 bg-teal-primary/5 shadow-xs cursor-pointer'
                            : 'border-line-border/40 hover:border-line-border hover:bg-ink/5 cursor-pointer opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-ink">{mod.label}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-ink/5 text-ink/60">
                                {mod.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink/60 leading-relaxed font-sans">
                              {mod.description}
                            </p>
                            {isForcedOff && (
                              <p className="text-[10px] font-semibold text-brick-critical flex items-center space-x-1 pt-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Excluded — School configured as Day School (Non-Boarding)</span>
                              </p>
                            )}
                          </div>

                          <div className="pt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              disabled={isForcedOff}
                              checked={isEnabled}
                              onChange={() => {}}
                              className="rounded text-teal-primary focus:ring-teal-primary w-4 h-4 cursor-pointer disabled:opacity-40"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              STEP 5: ADMINISTRATOR ACCOUNT & SUMMARY REVIEW
          ────────────────────────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-display font-bold text-ink">Administrator Login & Provisioning Review</h3>
                <p className="text-xs text-ink/60">Define the primary administrative login credentials and verify the school configuration.</p>
              </div>

              {/* Administrator Login Credentials */}
              <div className="p-5 rounded-2xl bg-teal-primary/5 border border-teal-primary/15 space-y-4">
                <div className="flex items-center space-x-2 text-teal-dark">
                  <Users className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    School Administrator Account Credentials
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ink/70 mb-1">Admin Username *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. peadmin"
                      value={adminAccount.username}
                      onChange={e => setAdminAccount({ ...adminAccount, username: e.target.value.toLowerCase() })}
                      className="w-full glass-input rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/70 mb-1">Admin Email</label>
                    <input
                      type="email"
                      placeholder="admin@school.ac.zw"
                      value={adminAccount.email}
                      onChange={e => setAdminAccount({ ...adminAccount, email: e.target.value })}
                      className="w-full glass-input rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/70 mb-1">Admin Password *</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={adminAccount.password}
                        onChange={e => setAdminAccount({ ...adminAccount, password: e.target.value })}
                        className="w-full glass-input rounded-xl text-xs pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-[10px] text-teal-primary font-bold hover:underline cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Bank Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. CBZ Bank Limited"
                    value={identity.bank_name}
                    onChange={e => setIdentity({ ...identity, bank_name: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 02123456780010"
                    value={identity.account_number}
                    onChange={e => setIdentity({ ...identity, account_number: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Configuration Summary Card */}
              <div className="border border-line-border/40 rounded-2xl p-5 space-y-4 bg-paper shadow-xs">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Configuration Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-ink/50 text-[10px] block uppercase font-mono">School</span>
                    <span className="font-bold text-ink">{identity.name || '—'}</span>
                    <span className="block text-[10px] font-mono text-teal-dark">{identity.code}</span>
                  </div>
                  <div>
                    <span className="text-ink/50 text-[10px] block uppercase font-mono">Model</span>
                    <span className="font-bold text-ink capitalize">
                      {identity.boarding_type === 'day' ? 'Day School (Non-Boarding)' : identity.boarding_type === 'boarding' ? 'Full Boarding' : 'Dual Model'}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink/50 text-[10px] block uppercase font-mono">Classes & Subjects</span>
                    <span className="font-bold text-ink">{selectedClasses.length} Classes</span>
                    <span className="block text-[10px] text-ink/60">{selectedSubjects.length} Subjects</span>
                  </div>
                  <div>
                    <span className="text-ink/50 text-[10px] block uppercase font-mono">Pages Configured</span>
                    <span className="font-bold text-teal-dark">{COMPULSORY_MODULES.length} Core</span>
                    <span className="block text-[10px] text-ink/60">
                      + {enabledModules.filter(m => identity.boarding_type !== 'day' || m !== 'boarding').length} Optional Modules
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-line-border/30 bg-ink/5 flex justify-between items-center shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/70 hover:bg-paper cursor-pointer flex items-center space-x-1.5 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                disabled={!canGoNext()}
                onClick={() => setCurrentStep(currentStep + 1)}
                className="btn btn-primary btn-md shadow-sm"
              >
                <span>Continue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !canGoNext()}
                onClick={handleSubmit}
                className="btn btn-primary btn-md shadow-md"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{saving ? 'Provisioning School Tenant...' : 'Create & Provision School'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
