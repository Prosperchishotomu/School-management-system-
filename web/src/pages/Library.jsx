import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, Tabs, FilterChips, EmptyState
} from '../components/ui';
import {
  BookOpen, Plus, Search, FileText, Download, Eye, Clock,
  CheckCircle2, XCircle, AlertCircle, ShieldAlert, Sparkles,
  ExternalLink, FileSpreadsheet, Lock, Check, Send, UserCheck, RefreshCw,
  FolderDown, BookMarked, Maximize2, X
} from 'lucide-react';
import ImportModal from '../components/ImportModal';

export default function Library() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();
  const schoolId = activeSchoolId || user?.school_id || '';

  const userRole = user?.role || 'student';
  const isLibrarianOrAdmin = ['librarian', 'school_admin', 'super_admin', 'head', 'head_teacher', 'deputy_head'].includes(userRole);
  const isTeacher = userRole === 'teacher';

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'past_papers' | 'textbooks' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [readingResource, setReadingResource] = useState(null);
  const [requestModalResource, setRequestModalResource] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // New Resource Form
  const [newResourceForm, setNewResourceForm] = useState({
    title: '',
    author: '',
    category: 'textbook',
    resource_type: 'textbook',
    file_type: 'pdf',
    file_name: '',
    file_size: '3.5 MB',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    grade_level: 'Form 3',
    subject: 'Combined Science',
    description: ''
  });
  const [creating, setCreating] = useState(false);

  // 1. Fetch E-Resources
  const { data: resourcesPayload, loading: loadingResources, refetch: refetchResources } = useApi(
    `library_resources_${schoolId}`,
    () => api.get(`/schools/${schoolId}/library/resources`).then(r => r.data?.data || []),
    { deps: [schoolId] }
  );
  const rawResources = Array.isArray(resourcesPayload) ? resourcesPayload : [];

  // 2. Fetch Download Requests (all for librarian, user's own for students)
  const { data: requestsPayload, loading: loadingRequests, refetch: refetchRequests } = useApi(
    `library_requests_${schoolId}_${user?.id}`,
    () => api.get(`/schools/${schoolId}/library/download-requests`).then(r => r.data?.data || []),
    { deps: [schoolId, user?.id] }
  );
  const downloadRequests = Array.isArray(requestsPayload) ? requestsPayload : [];

  // Filtered Catalog
  const filteredResources = useMemo(() => {
    return rawResources.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.author || '').toLowerCase().includes(q) ||
        (item.subject || '').toLowerCase().includes(q) ||
        (item.grade_level || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeTab === 'past_papers') return item.category === 'past_paper' || item.resource_type === 'past_paper';
      if (activeTab === 'textbooks') return item.category === 'textbook' || item.resource_type === 'textbook';
      if (selectedCategory !== 'all') return item.category === selectedCategory || item.resource_type === selectedCategory;

      return true;
    });
  }, [rawResources, searchQuery, activeTab, selectedCategory]);

  // Telemetry Counts
  const totalResources = rawResources.length;
  const pastPapersCount = rawResources.filter(r => r.category === 'past_paper' || r.resource_type === 'past_paper').length;
  const textbooksCount = rawResources.filter(r => r.category === 'textbook' || r.resource_type === 'textbook').length;
  const docxCount = rawResources.filter(r => (r.file_type || '').toLowerCase() === 'docx').length;
  const pendingRequestsCount = isLibrarianOrAdmin
    ? downloadRequests.filter(r => r.status === 'pending').length
    : downloadRequests.filter(r => r.user_id === user?.id && r.status === 'pending').length;

  // Handle Request to Download
  const handleOpenRequestModal = (resource) => {
    setRequestModalResource(resource);
    setRequestReason('Revision and offline study preparation');
  };

  const handleSubmitDownloadRequest = async (e) => {
    e.preventDefault();
    if (!requestModalResource) return;
    setSubmittingRequest(true);
    try {
      const res = await api.post(`/schools/${schoolId}/library/resources/${requestModalResource.id}/request-download`, {
        reason: requestReason
      });
      toast.success(res.data?.data?.message || 'Download authorization request submitted to librarian.');
      setRequestModalResource(null);
      refetchResources();
      refetchRequests();
      invalidate([`library_resources_${schoolId}`, `library_requests_${schoolId}_${user?.id}`]);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Librarian Approve / Decline Action
  const handleActionRequest = async (requestId, status, note = '') => {
    try {
      await api.patch(`/schools/${schoolId}/library/download-requests/${requestId}`, {
        status,
        admin_notes: note || (status === 'approved' ? 'Authorized for academic study' : 'Read online in system')
      });
      toast.success(`Request ${status === 'approved' ? 'Approved' : 'Declined'}.`);
      refetchRequests();
      refetchResources();
      invalidate([`library_resources_${schoolId}`, `library_requests_${schoolId}_${user?.id}`]);
    } catch (err) {
      toast.error('Failed to update request.');
    }
  };

  // Direct Download Trigger
  const handleDownload = (resource) => {
    if (!resource.can_download && !isLibrarianOrAdmin && !isTeacher) {
      toast.info('Download permission required. Please click "Request Download" for librarian approval.');
      handleOpenRequestModal(resource);
      return;
    }
    toast.info(`Preparing secure download for '${resource.title}'…`);
    window.open(`/api/v1/schools/${schoolId}/library/resources/${resource.id}/download`, '_blank');
  };

  // Create Resource Submit
  const handleCreateResource = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post(`/schools/${schoolId}/library/resources`, newResourceForm);
      toast.success(`E-Resource '${newResourceForm.title}' added to digital library.`);
      setShowAddModal(false);
      setNewResourceForm({
        title: '',
        author: '',
        category: 'textbook',
        resource_type: 'textbook',
        file_type: 'pdf',
        file_name: '',
        file_size: '3.5 MB',
        file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        grade_level: 'Form 3',
        subject: 'Combined Science',
        description: ''
      });
      refetchResources();
      invalidate([`library_resources_${schoolId}`]);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to catalog resource.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Library & Learning Resource Center"
        subtitle="Curriculum e-textbooks, ZIMSEC past examination archives, literature sets, and study guides (PDF & DOCX). Non-circulating e-media: Read directly in the system or submit an offline download request."
        actions={
          <div className="flex items-center gap-2">
            {isLibrarianOrAdmin && (
              <>
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand-700" />
                  <span>Import Media Metadata</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload E-Resource</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Institutional Policy Alert Banner */}
      <div className="p-3.5 bg-gradient-to-r from-brand-500/10 via-surface to-cyan-500/10 rounded-xl border border-brand-500/25 flex items-start gap-3">
        <BookMarked className="w-5 h-5 text-brand-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">E-Library Access &amp; Digital Circulation Policy</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-500/15 text-brand-700 dark:text-brand-300">
              NON-LENDING DIGITAL REPOSITORY
            </span>
          </div>
          <p className="text-muted leading-relaxed">
            All library assets are digital files (PDF and DOCX). Resources are never lent physically. Students have 24/7 unlimited in-system reading. To save or print offline copies, students submit an electronic <strong>Download Authorization Request</strong> to the school librarian.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Digital Repository"
          value={totalResources}
          icon={BookOpen}
          color="brand"
          subtext="E-books, syllabi & study guides"
        />
        <StatCard
          label="Past Paper Archive"
          value={pastPapersCount}
          icon={FileText}
          color="info"
          subtext="ZIMSEC & Cambridge series"
        />
        <StatCard
          label="Curriculum Textbooks"
          value={textbooksCount}
          icon={BookMarked}
          color="violet"
          subtext="MoPSE approved materials"
        />
        <StatCard
          label="Download Requests"
          value={pendingRequestsCount}
          icon={FolderDown}
          color={pendingRequestsCount > 0 ? "accent" : "neutral"}
          subtext={isLibrarianOrAdmin ? "Pending librarian review" : "Your pending authorizations"}
        />
      </KpiStrip>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs
          tabs={[
            { id: 'catalog', label: 'All E-Resources', count: totalResources },
            { id: 'past_papers', label: 'Past Exam Papers', count: pastPapersCount },
            { id: 'textbooks', label: 'Textbooks', count: textbooksCount },
            { id: 'requests', label: isLibrarianOrAdmin ? 'Download Requests' : 'My Download Requests', count: downloadRequests.length }
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab !== 'requests' && (
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, author, subject, form…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-72"
            />
          </div>
        )}
      </div>

      {/* VIEW 1: E-RESOURCES CATALOG TABLE */}
      {activeTab !== 'requests' && (
        <Card title="Digital Media & E-Resource Catalog" subtitle={`${filteredResources.length} verified titles available for online reading`}>
          {loadingResources ? (
            <div className="p-8 text-center text-xs text-muted">Loading repository…</div>
          ) : filteredResources.length === 0 ? (
            <EmptyState
              title="No digital resources found"
              description="No documents match the current filter criteria."
              compact={true}
            />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'title',
                  label: 'Document Title & Subject Details',
                  sortable: true,
                  render: (_, row) => (
                    <div className="max-w-md">
                      <div className="font-bold text-ink hover:text-brand-700 transition cursor-pointer" onClick={() => setReadingResource(row)}>
                        {row.title}
                      </div>
                      <div className="text-[11px] text-muted flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{row.author || 'MoPSE'}</span>
                        <span>•</span>
                        <span className="capitalize">{row.subject || 'General'}</span>
                        <span>•</span>
                        <span className="font-mono bg-canvas px-1.5 py-0.5 rounded border border-line">{row.grade_level || 'All Cohorts'}</span>
                      </div>
                      {row.description && (
                        <p className="text-[11px] text-muted mt-1 line-clamp-1">{row.description}</p>
                      )}
                    </div>
                  )
                },
                {
                  key: 'format',
                  label: 'File Format',
                  render: (_, row) => {
                    const isDocx = (row.file_type || '').toLowerCase() === 'docx';
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          isDocx
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
                        }`}>
                          {isDocx ? 'DOCX' : 'PDF'}
                        </span>
                        <span className="text-[10px] text-muted font-mono">{row.file_size || '2.4 MB'}</span>
                      </div>
                    );
                  }
                },
                {
                  key: 'access',
                  label: 'Reading & Download Status',
                  render: (_, row) => {
                    if (isLibrarianOrAdmin || isTeacher) {
                      return <StatusPill status="success" label="Full Staff Access" />;
                    }
                    if (row.can_download) {
                      return <StatusPill status="success" label="Download Authorized" />;
                    }
                    if (row.download_request?.status === 'pending') {
                      return <StatusPill status="warning" label="Request Pending" />;
                    }
                    if (row.download_request?.status === 'rejected') {
                      return <StatusPill status="danger" label="Request Declined" />;
                    }
                    return <StatusPill status="neutral" label="In-System Only" />;
                  }
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  align: 'right',
                  render: (_, row) => (
                    <div className="flex items-center justify-end gap-2">
                      {/* 1. Read in system (Always available to everyone) */}
                      <button
                        type="button"
                        onClick={() => setReadingResource(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-line text-ink hover:bg-canvas transition cursor-pointer shadow-2xs"
                        title="Read and view document directly in browser"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-700" />
                        <span>Read Online</span>
                      </button>

                      {/* 2. Download / Request Download */}
                      {row.can_download || isLibrarianOrAdmin || isTeacher ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition cursor-pointer shadow-2xs"
                          title="Download authorized PDF/DOCX file"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      ) : row.download_request?.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenRequestModal(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60 border border-brand-200 transition cursor-pointer"
                          title="Request librarian permission to download offline copy"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Request Download</span>
                        </button>
                      )}
                    </div>
                  )
                }
              ]}
              data={filteredResources}
              loading={loadingResources}
              emptyTitle="No resources found"
            />
          )}
        </Card>
      )}

      {/* VIEW 2: DOWNLOAD REQUESTS QUEUE */}
      {activeTab === 'requests' && (
        <Card
          title={isLibrarianOrAdmin ? "Student Download Authorization Requests" : "My Download Requests"}
          subtitle={
            isLibrarianOrAdmin
              ? "Review student requests for offline document downloads. Approved requests grant immediate download access."
              : "Track the status of your requests to download offline PDF and DOCX learning materials."
          }
        >
          {loadingRequests ? (
            <div className="p-8 text-center text-xs text-muted">Loading requests queue…</div>
          ) : downloadRequests.length === 0 ? (
            <EmptyState
              title="Requests queue is empty"
              description="There are currently no document download authorization requests."
              compact={true}
            />
          ) : (
            <div className="divide-y divide-line/60">
              {downloadRequests.map((req) => (
                <div key={req.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink">{req.resource_title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-canvas border border-line">
                        {req.file_type || 'PDF'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex flex-wrap items-center gap-2">
                      <span>Requester: <strong className="text-ink">{req.user_name}</strong></span>
                      {req.class_name && <span>({req.class_name})</span>}
                      <span>•</span>
                      <span>Requested: {new Date(req.requested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {req.reason && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                        "{req.reason}"
                      </p>
                    )}
                    {req.admin_notes && (
                      <p className="text-[11px] text-muted">
                        Librarian Note: <em>{req.admin_notes}</em>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={req.status} />

                    {isLibrarianOrAdmin && req.status === 'pending' && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => handleActionRequest(req.id, 'approved')}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleActionRequest(req.id, 'rejected')}
                          className="px-2.5 py-1 text-xs font-bold text-danger bg-red-50 hover:bg-red-100 dark:bg-red-950/40 border border-red-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}

                    {!isLibrarianOrAdmin && req.status === 'approved' && (
                      <button
                        onClick={() => window.open(`/api/v1/schools/${schoolId}/library/resources/${req.resource_id}/download`, '_blank')}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Approved File</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* MODAL 1: IN-SYSTEM DOCUMENT READER */}
      {readingResource && (
        <Modal
          isOpen={Boolean(readingResource)}
          onClose={() => setReadingResource(null)}
          title={`In-System Reader: ${readingResource.title}`}
          size="2xl"
        >
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="p-3 rounded-xl bg-canvas border border-line flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{readingResource.author || 'Author N/A'}</span>
                <span>•</span>
                <span className="text-muted font-mono">{readingResource.file_name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-500/15 text-brand-700 uppercase">
                  {readingResource.file_type || 'PDF'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {readingResource.can_download || isLibrarianOrAdmin || isTeacher ? (
                  <button
                    onClick={() => handleDownload(readingResource)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setReadingResource(null);
                      handleOpenRequestModal(readingResource);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100 transition cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Request Download</span>
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Document Viewer Screen */}
            <div className="w-full h-[580px] bg-slate-900 rounded-xl overflow-hidden border border-line shadow-inner flex flex-col">
              {/* Viewer Mock Header Toolbar */}
              <div className="h-10 bg-slate-800/90 border-b border-slate-700 px-4 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white truncate max-w-xs">{readingResource.title}</span>
                  <span className="text-[11px] text-slate-400">Page 1 of 48</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-700">100% Zoom</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                </div>
              </div>

              {/* Reader Document Canvas (Interactive Embed or Clean Reader View) */}
              <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-950/60">
                <div className="w-full max-w-2xl bg-white text-slate-900 rounded-lg shadow-2xl p-10 space-y-6 font-serif">
                  <div className="border-b border-slate-200 pb-4 text-center">
                    <span className="text-[11px] font-mono tracking-widest text-slate-500 uppercase block mb-1">
                      {readingResource.grade_level} • {readingResource.subject}
                    </span>
                    <h2 className="text-xl font-bold font-display text-slate-900 leading-snug">
                      {readingResource.title}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">Author: {readingResource.author}</p>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-slate-800">
                    <p className="font-semibold text-slate-900">
                      Overview &amp; Curriculum Competencies:
                    </p>
                    <p>
                      {readingResource.description || 'This document contains official curriculum notes, study questions, and syllabus-aligned content approved for secondary examination revision and class learning.'}
                    </p>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-[11px] font-sans">
                      <span className="font-bold text-slate-900 block">Digital Reader Controls</span>
                      <p className="text-slate-600">
                        You are reading directly in the SchoolBase In-System Document Viewer. All pages, diagrams, tables, and questions are indexed for online consultation without exhausting device storage.
                      </p>
                    </div>
                    <p>
                      Key chapters included in this syllabus archive:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-[11px] text-slate-700 font-sans">
                      <li>Chapter 1: Foundations, Key Principles, and Syllabus Terminology</li>
                      <li>Chapter 2: Structural Methodologies and Practical Applications</li>
                      <li>Chapter 3: ZIMSEC Examination Question Bank with Model Answers</li>
                      <li>Chapter 4: Formative Revision Quizzes &amp; Self-Assessment Rubrics</li>
                    </ul>
                  </div>

                  <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
                    Official SchoolBase Educational Media Repository • Non-circulating electronic copy
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: REQUEST DOWNLOAD AUTHORIZATION */}
      {requestModalResource && (
        <Modal
          isOpen={Boolean(requestModalResource)}
          onClose={() => setRequestModalResource(null)}
          title="Request Download Authorization"
          size="md"
        >
          <form onSubmit={handleSubmitDownloadRequest} className="space-y-4">
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-start gap-3">
              <FolderDown className="w-5 h-5 text-brand-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-ink block">{requestModalResource.title}</span>
                <p className="text-muted leading-relaxed">
                  To download and keep an offline copy ({requestModalResource.file_type?.toUpperCase()}, {requestModalResource.file_size}), please indicate the reason for your offline download request. The librarian will review and grant authorization.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-ink block">Reason for Offline Download Request</label>
              <textarea
                rows={3}
                required
                value={requestReason}
                onChange={e => setRequestReason(e.target.value)}
                placeholder="e.g. Offline exam preparation over the school holidays, no home internet connectivity…"
                className="w-full p-3 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestModalResource(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line hover:bg-canvas text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRequest}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-brand-700 hover:bg-brand-900 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submittingRequest ? 'Submitting…' : 'Submit Request to Librarian'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: UPLOAD NEW E-RESOURCE */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Catalog New Digital E-Resource"
          size="lg"
        >
          <form onSubmit={handleCreateResource} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-semibold text-ink block mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={newResourceForm.title}
                  onChange={e => setNewResourceForm({ ...newResourceForm, title: e.target.value })}
                  placeholder="e.g. ZIMSEC O-Level Geography Revision Guide (2026)"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Author / Publisher</label>
                <input
                  type="text"
                  value={newResourceForm.author}
                  onChange={e => setNewResourceForm({ ...newResourceForm, author: e.target.value })}
                  placeholder="e.g. Department of Humanities / MoPSE"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Category</label>
                <select
                  value={newResourceForm.category}
                  onChange={e => setNewResourceForm({ ...newResourceForm, category: e.target.value, resource_type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                >
                  <option value="textbook">Curriculum Textbook</option>
                  <option value="past_paper">ZIMSEC Past Exam Paper</option>
                  <option value="literature">Literature &amp; Reader Set</option>
                  <option value="curriculum">Syllabus &amp; Specimen</option>
                  <option value="reference">Reference &amp; Dictionary</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">File Format</label>
                <select
                  value={newResourceForm.file_type}
                  onChange={e => setNewResourceForm({ ...newResourceForm, file_type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs font-mono"
                >
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">File Size</label>
                <input
                  type="text"
                  value={newResourceForm.file_size}
                  onChange={e => setNewResourceForm({ ...newResourceForm, file_size: e.target.value })}
                  placeholder="e.g. 4.2 MB"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Target Cohort / Grade Level</label>
                <input
                  type="text"
                  value={newResourceForm.grade_level}
                  onChange={e => setNewResourceForm({ ...newResourceForm, grade_level: e.target.value })}
                  placeholder="e.g. Form 1, Form 4, Lower 6"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Subject</label>
                <input
                  type="text"
                  value={newResourceForm.subject}
                  onChange={e => setNewResourceForm({ ...newResourceForm, subject: e.target.value })}
                  placeholder="e.g. Mathematics, Heritage Studies"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-ink block mb-1">Description &amp; Overview</label>
                <textarea
                  rows={2}
                  value={newResourceForm.description}
                  onChange={e => setNewResourceForm({ ...newResourceForm, description: e.target.value })}
                  placeholder="Brief synopsis of topics covered in this resource…"
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line hover:bg-canvas text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-brand-700 hover:bg-brand-900 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creating ? 'Saving…' : 'Catalog E-Resource'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: BULK METADATA IMPORT MODAL */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        schoolId={schoolId}
        entity="library"
        title="Import Digital Media Metadata"
        invalidateKeys={[`library_resources_${schoolId}`]}
      />
    </div>
  );
}
