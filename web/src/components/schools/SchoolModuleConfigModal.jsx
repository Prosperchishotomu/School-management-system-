import React, { useState, useEffect } from 'react';
import {
  X, Save, Shield, Lock, AlertTriangle, CheckCircle2,
  Grid3X3, BookOpen, Plus, Loader2, Building, Trash2
} from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import {
  COMPULSORY_MODULES,
  CONFIGURABLE_MODULES,
  ALL_CONFIGURABLE_MODULE_IDS,
  getSchoolEnabledModules,
  isSchoolBoarding
} from '../../utils/modules';
import { STANDARD_DEPARTMENTS } from '../../data/standardSubjects';

export default function SchoolModuleConfigModal({ school, isOpen, onClose, onUpdated }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'classes' | 'subjects'
  const [saving, setSaving] = useState(false);

  // Operational Model state
  const [boardingType, setBoardingType] = useState('day');
  const [enabledModules, setEnabledModules] = useState([]);

  // Classes & Subjects sub-management
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [newSubj, setNewSubj] = useState({ name: '', code: '', department: 'General', level: 'all' });
  const [loadingData, setLoadingData] = useState(false);

  // Initialize from school prop
  useEffect(() => {
    if (school) {
      const bType = school.boarding_type || (isSchoolBoarding(school) ? 'boarding' : 'day');
      setBoardingType(bType);

      const activeMods = getSchoolEnabledModules(school);
      setEnabledModules(activeMods);

      // Load existing classes & subjects
      setLoadingData(true);
      Promise.all([
        api.get(`/schools/${school.id}/classes`),
        api.get(`/schools/${school.id}/subjects`)
      ]).then(([cRes, sRes]) => {
        setClassesList(Array.isArray(cRes.data) ? cRes.data : []);
        setSubjectsList(Array.isArray(sRes.data) ? sRes.data : []);
      }).catch(err => {
        console.error('Error fetching school curriculum:', err);
      }).finally(() => setLoadingData(false));
    }
  }, [school]);

  // When boardingType changes to 'day', immediately filter out boarding module
  const handleBoardingTypeChange = (type) => {
    setBoardingType(type);
    if (type === 'day') {
      setEnabledModules(prev => prev.filter(m => m !== 'boarding'));
    } else {
      setEnabledModules(prev => prev.includes('boarding') ? prev : [...prev, 'boarding']);
    }
  };

  const toggleModule = (modId) => {
    if (modId === 'boarding' && boardingType === 'day') return;
    if (enabledModules.includes(modId)) {
      setEnabledModules(enabledModules.filter(m => m !== modId));
    } else {
      setEnabledModules([...enabledModules, modId]);
    }
  };

  const handleAddClass = async (e) => {
    e?.preventDefault();
    if (!newClassName.trim()) return;
    try {
      const isPrimary = String(school?.school_type || '').toLowerCase() === 'primary';
      const res = await api.post(`/schools/${school.id}/classes`, {
        name: newClassName.trim(),
        grade_level: newClassName.trim(),
        level: isPrimary ? 'Primary' : 'Secondary'
      });
      setClassesList(prev => [...prev, res.data]);
      setNewClassName('');
      toast.success(`Class '${newClassName}' added.`);
    } catch (err) {
      toast.error(err.message || 'Failed to add class.');
    }
  };

  const handleAddSubject = async (e) => {
    e?.preventDefault();
    if (!newSubj.name.trim()) return;
    try {
      const res = await api.post(`/schools/${school.id}/subjects`, {
        name: newSubj.name.trim(),
        code: newSubj.code ? newSubj.code.trim().toUpperCase() : newSubj.name.substring(0, 4).toUpperCase(),
        category: newSubj.department,
        level: newSubj.level
      });
      setSubjectsList(prev => [...prev, res.data]);
      setNewSubj({ name: '', code: '', department: 'General', level: 'all' });
      toast.success(`Subject '${newSubj.name}' added.`);
    } catch (err) {
      toast.error(err.message || 'Failed to add subject.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isDay = boardingType === 'day';
      const isBoardingVal = isDay ? 0 : 1;
      const finalModules = isDay ? enabledModules.filter(m => m !== 'boarding') : enabledModules;

      await api.patch(`/schools/${school.id}`, {
        is_boarding: isBoardingVal,
        boarding_type: boardingType,
        enabled_modules: finalModules
      });

      toast.success(`Configuration updated for ${school.name}`);
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save school configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !school) return null;

  const isDaySchool = boardingType === 'day';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-paper rounded-3xl shadow-2xl border border-line-border/40 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-line-border/30 bg-ink/5 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-primary/10 text-teal-primary">
                Super Admin Configuration
              </span>
              <span className="text-xs text-ink/40 font-mono">ID: {school.id}</span>
            </div>
            <h2 className="text-xl font-display font-bold text-ink mt-0.5">
              Configure Pages & Operational Architecture
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">{school.name} ({school.code || school.id})</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close configuration modal"
            className="btn-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-6 py-2.5 border-b border-line-border/20 bg-paper/60 flex items-center space-x-1 shrink-0 overflow-x-auto">
          {[
            { id: 'modules', label: 'Pages & Feature Modules' },
            { id: 'classes', label: `Classes (${classesList.length})` },
            { id: 'subjects', label: `Subjects (${subjectsList.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-primary text-paper shadow-xs font-bold'
                  : 'text-ink/60 hover:text-ink hover:bg-ink/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* TAB 1: MODULES & BOARDING ARCHITECTURE */}
          {activeTab === 'modules' && (
            <div className="space-y-6">
              
              {/* Boarding Model Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                  Boarding Operational Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => handleBoardingTypeChange('day')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      boardingType === 'day'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-xs'
                        : 'border-line-border/40 hover:bg-ink/5'
                    }`}
                  >
                    <span className="text-base block mb-1">🏫</span>
                    <span className="text-xs font-bold text-ink block">Day School Only</span>
                    <span className="text-[10px] text-ink/60 block mt-0.5">Hostels & Exeats strictly hidden</span>
                  </div>

                  <div
                    onClick={() => handleBoardingTypeChange('boarding')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      boardingType === 'boarding'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-xs'
                        : 'border-line-border/40 hover:bg-ink/5'
                    }`}
                  >
                    <span className="text-base block mb-1">🛏️</span>
                    <span className="text-xs font-bold text-ink block">Full Boarding</span>
                    <span className="text-[10px] text-ink/60 block mt-0.5">Dormitories & gate passes active</span>
                  </div>

                  <div
                    onClick={() => handleBoardingTypeChange('dual')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      boardingType === 'dual'
                        ? 'border-teal-primary bg-teal-primary/5 shadow-xs'
                        : 'border-line-border/40 hover:bg-ink/5'
                    }`}
                  >
                    <span className="text-base block mb-1">🏛️</span>
                    <span className="text-xs font-bold text-ink block">Dual Model</span>
                    <span className="text-[10px] text-ink/60 block mt-0.5">Day commuters + hostel residents</span>
                  </div>
                </div>
              </div>

              {/* Compulsory Core Pages Banner */}
              <div className="p-3.5 rounded-2xl bg-sage/20 border border-teal-primary/20 space-y-2">
                <div className="flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-teal-dark" />
                  <span className="text-[10px] font-bold text-teal-dark uppercase tracking-wider">
                    Compulsory Core Pages (Always Active for All Schools)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMPULSORY_MODULES.map(cm => (
                    <span key={cm.id} className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-paper/80 border border-teal-primary/20 text-[11px] font-medium text-ink">
                      <Lock className="w-2.5 h-2.5 text-teal-dark" />
                      <span>{cm.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Decided Feature Modules Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Decided by Super Admin (Feature Modules)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all = ALL_CONFIGURABLE_MODULE_IDS.filter(id => {
                          if (id === 'boarding' && isDaySchool) return false;
                          return true;
                        });
                        setEnabledModules(all);
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
                      Disable All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {CONFIGURABLE_MODULES.map(mod => {
                    const isBoardingMod = mod.id === 'boarding';
                    const isForcedOff = isBoardingMod && isDaySchool;
                    const isEnabled = enabledModules.includes(mod.id) && !isForcedOff;

                    return (
                      <div
                        key={mod.id}
                        onClick={() => {
                          if (!isForcedOff) toggleModule(mod.id);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all select-none ${
                          isForcedOff
                            ? 'border-line-border/30 bg-ink/5 opacity-50 cursor-not-allowed'
                            : isEnabled
                            ? 'border-teal-primary/50 bg-teal-primary/5 shadow-xs cursor-pointer'
                            : 'border-line-border/40 hover:border-line-border hover:bg-ink/5 cursor-pointer opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-ink">{mod.label}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-ink/5 text-ink/60">
                                {mod.category}
                              </span>
                            </div>
                            <p className="text-[10px] text-ink/60 leading-relaxed font-sans">
                              {mod.description}
                            </p>
                            {isForcedOff && (
                              <p className="text-[10px] font-semibold text-brick-critical flex items-center space-x-1 pt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Disabled: Day School Model Selected</span>
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

          {/* TAB 2: CLASSES & STREAMS */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Class Roster Configuration</h4>
                <p className="text-xs text-ink/60">Manage classes registered under {school.name}.</p>
              </div>

              <form onSubmit={handleAddClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Class name or stream (e.g. Form 3 East)..."
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  className="flex-1 glass-input rounded-xl text-xs"
                />
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              </form>

              {loadingData ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-primary" /></div>
              ) : classesList.length === 0 ? (
                <p className="py-8 text-center text-xs text-ink/40">No classes found for this school.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {classesList.map(c => (
                    <div key={c.id} className="p-3 rounded-xl bg-paper border border-line-border/30 flex items-center justify-between text-xs font-semibold text-ink">
                      <div className="flex items-center space-x-2">
                        <Grid3X3 className="w-3.5 h-3.5 text-teal-primary" />
                        <span>{c.name}</span>
                      </div>
                      <span className="text-[10px] text-ink/40 font-mono">{c.grade_level || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CURRICULUM SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Academic Subjects Catalog</h4>
                <p className="text-xs text-ink/60">Subjects offered to students at {school.name}.</p>
              </div>

              <form onSubmit={handleAddSubject} className="p-4 rounded-2xl bg-teal-primary/5 border border-teal-primary/20 space-y-3">
                <span className="text-xs font-bold text-teal-dark">Add New Subject</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    required
                    type="text"
                    placeholder="Subject Name"
                    value={newSubj.name}
                    onChange={e => setNewSubj({ ...newSubj, name: e.target.value })}
                    className="glass-input rounded-xl text-xs"
                  />
                  <select
                    value={newSubj.department}
                    onChange={e => setNewSubj({ ...newSubj, department: e.target.value })}
                    className="glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    {STANDARD_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button type="submit" className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-bold shadow hover:bg-teal-dark cursor-pointer">
                    Add Subject
                  </button>
                </div>
              </form>

              {loadingData ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-primary" /></div>
              ) : subjectsList.length === 0 ? (
                <p className="py-8 text-center text-xs text-ink/40">No subjects registered for this school.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subjectsList.map(s => (
                    <div key={s.id} className="p-3 rounded-xl bg-paper border border-line-border/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-ink block">{s.name}</span>
                        <span className="text-[10px] text-ink/50 block">{s.category || s.department || 'General'}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-ink/5 text-ink/60">
                        {s.code || s.name.substring(0, 4).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line-border/30 bg-ink/5 flex justify-end space-x-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="btn btn-primary btn-md shadow-md"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{saving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
