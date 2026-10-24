import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, UserCheck, FileText, BookOpen, ArrowRight, Loader2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * CommandPalette — Ctrl/Cmd+K global search modal across students, staff, invoices, classes.
 */
export default function CommandPalette({ isOpen, onClose }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], staff: [], invoices: [], classes: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const userRole = (user?.role || '').toLowerCase().trim();
  const isAdmin = ['super_admin', 'school_admin', 'admin', 'principal', 'head', 'deputy_head', 'headmaster'].includes(userRole);
  const isTeacher = userRole === 'teacher' || userRole === 'hod';
  const isBursar = userRole === 'bursar';

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ students: [], staff: [], invoices: [], classes: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent if state controlled
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ students: [], staff: [], invoices: [], classes: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        if (res.data) {
          setResults(res.data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened list of result items strictly filtered by role privileges
  const flatItems = [
    ...((isAdmin || isTeacher) ? (results.students || []).map(s => ({ type: 'Student', label: `${s.first_name} ${s.last_name}`, sub: s.admission_number || s.class_name, href: `/students/${s.id}`, icon: User })) : []),
    ...((isAdmin || isTeacher) ? (results.staff || []).map(s => ({ type: 'Staff', label: s.name, sub: s.role || s.department, href: `/staff`, icon: UserCheck })) : []),
    ...((isAdmin || isBursar) ? (results.invoices || []).map(i => ({ type: 'Invoice', label: `Invoice #${i.invoice_number || i.id}`, sub: i.student_name, href: `/fees?search=${i.invoice_number || i.id}`, icon: FileText })) : []),
    ...((isAdmin || isTeacher) ? (results.classes || []).map(c => ({ type: 'Class', label: c.name, sub: `${c.grade_level || ''} (${c.level || ''})`, href: `/classes?class_id=${c.id}`, icon: BookOpen })) : []),
  ];

  const handleSelect = (item) => {
    onClose();
    if (item.href) navigate(item.href);
  };

  const handleKeyDownList = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(idx => (idx + 1) % Math.max(1, flatItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(idx => (idx - 1 + flatItems.length) % Math.max(1, flatItems.length));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
      >
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b border-line flex items-center gap-3">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownList}
            placeholder="Search students, staff, invoices, classes… (ESC to close)"
            className="w-full bg-transparent text-ink placeholder:text-muted focus:outline-none text-sm font-sans"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-500 shrink-0" />}
          <button
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <div className="py-10 text-center text-muted text-xs">
              {query.length >= 2 ? (
                loading ? 'Searching...' : 'No matching results found.'
              ) : (
                'Type at least 2 characters to search across SchoolBase.'
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {flatItems.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50 text-brand-900 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'hover:bg-canvas text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-line/50 flex items-center justify-center shrink-0 text-muted">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold truncate">
                          {item.label}
                        </div>
                        {item.sub && (
                          <div className="text-[11px] text-muted truncate">
                            {item.sub}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-line text-muted">
                        {item.type}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted opacity-60" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Palette Footer */}
        <div className="px-4 py-2 border-t border-line bg-canvas/40 flex items-center justify-between text-[11px] text-muted">
          <span>Navigate with <kbd className="font-mono bg-line px-1 rounded">↑</kbd> <kbd className="font-mono bg-line px-1 rounded">↓</kbd></span>
          <span>Select with <kbd className="font-mono bg-line px-1 rounded">↵ Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}
