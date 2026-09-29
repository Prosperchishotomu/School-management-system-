import React, { useState } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Loader2,
  KeyRound,
  RefreshCw,
  FileText,
  HelpCircle
} from 'lucide-react';

/* ── CSV Parser helper supporting quoted strings ─────────────────────────────── */
const parseCSV = (text) => {
  const lines = [];
  let curLine = [];
  let curVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        curVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
      curLine.push(curVal.trim());
      curVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      curLine.push(curVal.trim());
      if (curLine.some(v => v !== '')) {
        lines.push(curLine);
      }
      curLine = [];
      curVal = '';
    } else {
      curVal += char;
    }
  }

  if (curVal !== '' || curLine.length > 0) {
    curLine.push(curVal.trim());
    if (curLine.some(v => v !== '')) {
      lines.push(curLine);
    }
  }

  return lines;
};

/* ── Normalize Header Aliases ────────────────────────────────────────────────── */
const normalizeHeader = (h) => {
  const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  if (['first_name', 'firstname', 'fname', 'studentfirstname'].includes(clean)) return 'first_name';
  if (['last_name', 'lastname', 'lname', 'studentlastname'].includes(clean)) return 'last_name';
  if (['middle_name', 'middlename', 'mname'].includes(clean)) return 'middle_name';
  if (['admission_number', 'admissionnumber', 'admno', 'adm_no', 'studentid'].includes(clean)) return 'admission_number';
  if (['class_name', 'classname', 'class', 'grade', 'level'].includes(clean)) return 'class_name';
  if (['gender', 'sex'].includes(clean)) return 'gender';
  if (['date_of_birth', 'dateofbirth', 'dob', 'birthdate'].includes(clean)) return 'date_of_birth';
  if (['home_address', 'homeaddress', 'address'].includes(clean)) return 'home_address';
  if (['medical_notes', 'medicalnotes', 'medical', 'allergies'].includes(clean)) return 'medical_notes';

  // Guardian headers
  if (['guardian_name', 'guardianname', 'parent_name', 'parentname', 'guardian', 'parent'].includes(clean)) return 'guardian_name';
  if (['guardian_phone', 'guardianphone', 'parent_phone', 'parentphone', 'phone', 'contact_phone'].includes(clean)) return 'guardian_phone';
  if (['guardian_email', 'guardianemail', 'parent_email', 'parentemail', 'email', 'contact_email'].includes(clean)) return 'guardian_email';
  if (['guardian_relation', 'guardianrelation', 'parent_relation', 'parentrelation', 'relation'].includes(clean)) return 'guardian_relation';
  if (['guardian_national_id', 'nationalid', 'idnumber', 'nrc'].includes(clean)) return 'guardian_national_id';

  // Fees headers
  if (['amount_due', 'amountdue', 'due', 'invoice_amount'].includes(clean)) return 'amount_due';
  if (['amount_paid', 'amountpaid', 'amount', 'paid', 'payment_amount'].includes(clean)) return 'amount_paid';
  if (['payment_method', 'paymentmethod', 'method', 'type'].includes(clean)) return 'payment_method';
  if (['reference', 'ref', 'tx_id', 'txid', 'receipt', 'receipt_no'].includes(clean)) return 'reference';
  if (['title', 'fee_type', 'fee_title', 'description'].includes(clean)) return 'title';

  // Library & Assets headers
  if (['book_title', 'booktitle', 'title'].includes(clean)) return 'title';
  if (['author', 'writer'].includes(clean)) return 'author';
  if (['isbn', 'isbn_number'].includes(clean)) return 'isbn';
  if (['shelf_location', 'shelflocation', 'shelf'].includes(clean)) return 'shelf_location';
  if (['copies', 'quantity', 'count'].includes(clean)) return 'copies';
  if (['asset_name', 'assetname', 'item_name'].includes(clean)) return 'name';
  if (['asset_tag', 'tag_id', 'code'].includes(clean)) return 'code';
  if (['serial_number', 'serialnumber', 'serial'].includes(clean)) return 'serial_number';
  if (['purchase_cost', 'cost', 'value'].includes(clean)) return 'value';

  return clean;
};

const BulkImportModal = ({ type = 'students', schoolId, onClose, onSuccess }) => {
  const toast = useToast();

  const getModalTitle = () => {
    switch (type) {
      case 'students': return 'Bulk Import Students & Parents';
      case 'staff':    return 'Bulk Import Teachers & Staff';
      case 'fees':     return 'Bulk Import Fee Invoices & Payment Receipts';
      case 'library':  return 'Bulk Import Library Books Catalog';
      case 'assets':   return 'Bulk Import School Asset Inventory';
      case 'classes':  return 'Bulk Import Class Streams & Levels';
      default:         return 'Bulk CSV / Excel Import';
    }
  };

  const modalTitle = getModalTitle();

  // Step state: 1 = Choose File, 2 = Validation Preview, 3 = Importing, 4 = Results Log
  const [step, setStep]                   = useState(1);
  const [fileName, setFileName]           = useState('');
  const [parsedRows, setParsedRows]       = useState([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [filterMode, setFilterMode]       = useState('all'); // 'all' | 'valid' | 'error'

  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState(null);

  /* ── Download Sample CSV Template ───────────────────────────────────────────── */
  const handleDownloadTemplate = () => {
    let headers = [];
    let sampleRows = [];

    if (isStudents) {
      headers = [
        'First Name', 'Last Name', 'Middle Name', 'Admission Number', 'Class Name',
        'Gender', 'Date of Birth', 'Home Address', 'Guardian Name', 'Guardian Phone',
        'Guardian Email', 'Guardian Relation', 'Medical Notes'
      ];
      sampleRows = [
        ['Tariro', 'Mugabe', 'Grace', '202501A', 'Grade 7A', 'female', '2012-05-14', '12 Harare Way', 'Joseph Mugabe', '+263771234567', 'joseph@gmail.com', 'Father', 'Asthma inhaler'],
        ['Farai', 'Chauke', '', '202502B', 'Grade 7A', 'male', '2012-08-20', '45 Bulawayo Rd', 'Blessing Chauke', '+263779876543', 'blessing@gmail.com', 'Mother', 'None']
      ];
    } else {
      headers = [
        'Full Name', 'Email', 'Phone', 'Role Title', 'Assigned Class Name', 'Username', 'Password'
      ];
      sampleRows = [
        ['Sarah Mutasa', 'smutasa@school.ac.zw', '+263772111222', 'Mathematics Teacher', 'Grade 7A', 'smutasa', 'Pass123!'],
        ['John Moyo', 'jmoyo@school.ac.zw', '+263773333444', 'Science Teacher', 'Grade 8B', 'jmoyo', 'Pass123!']
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...sampleRows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', isStudents ? 'Students_Parents_Import_Template.csv' : 'Teachers_Staff_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample import template downloaded!');
  };

  /* ── Parse File on Upload ───────────────────────────────────────────────────── */
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rawLines = parseCSV(text);

        if (rawLines.length < 2) {
          toast.error('CSV file must contain a header row and at least one data row.');
          return;
        }

        const rawHeaders = rawLines[0];
        const headers = rawHeaders.map(normalizeHeader);

        const dataRows = [];

        for (let i = 1; i < rawLines.length; i++) {
          const rowValues = rawLines[i];
          if (rowValues.length === 0 || rowValues.every(v => !v)) continue;

          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rowValues[idx] || '';
          });

          // Perform client-side validation
          const errors = [];
          const warnings = [];

          if (type === 'students') {
            const fName = rowObj.first_name || rowObj.firstname;
            const lName = rowObj.last_name || rowObj.lastname;
            const gName = rowObj.guardian_name || rowObj.parent_name;
            const gPhone = rowObj.guardian_phone || rowObj.parent_phone;
            const gEmail = rowObj.guardian_email || rowObj.parent_email;

            if (!fName || !fName.trim()) errors.push('Missing Student First Name');
            if (!lName || !lName.trim()) errors.push('Missing Student Last Name');
            if (!gName || !gName.trim()) errors.push('Missing Guardian/Parent Name');
            if (!gPhone && !gEmail) errors.push('Missing Guardian Contact (Phone or Email required)');
          } else if (type === 'staff') {
            const name = rowObj.name || rowObj.full_name;
            if (!name || !name.trim()) errors.push('Missing Full Name');
          } else if (type === 'fees') {
            const adm = rowObj.admission_number || rowObj.student_name;
            const due = parseFloat(rowObj.amount_due || 0);
            const paid = parseFloat(rowObj.amount_paid || 0);
            if (!adm || !adm.trim()) errors.push('Missing Admission Number or Student Name');
            if (due <= 0 && paid <= 0) errors.push('Amount Due or Amount Paid must be greater than 0');
          } else if (type === 'library') {
            const title = rowObj.title || rowObj.book_title;
            if (!title || !title.trim()) errors.push('Missing Book Title');
          } else if (type === 'assets') {
            const name = rowObj.name || rowObj.asset_name;
            if (!name || !name.trim()) errors.push('Missing Asset Name');
          } else if (type === 'classes') {
            const name = rowObj.name || rowObj.class_name;
            if (!name || !name.trim()) errors.push('Missing Class Name');
          }

          dataRows.push({
            rowNumber: i,
            data: rowObj,
            raw: rowValues,
            errors,
            warnings,
            isValid: errors.length === 0
          });
        }

        if (dataRows.length === 0) {
          toast.error('No valid data records found in file.');
          return;
        }

        setParsedRows(dataRows);
        setStep(2);
      } catch (err) {
        console.error('CSV Parse Error:', err);
        toast.error('Failed to parse file: ' + err.message);
      }
    };

    reader.readAsText(file);
  };

  /* ── Submit Bulk Import ─────────────────────────────────────────────────────── */
  const handleExecuteImport = async () => {
    const validRowsToSubmit = parsedRows.filter(r => r.isValid).map(r => r.data);
    if (validRowsToSubmit.length === 0) {
      toast.error('No valid rows available to import.');
      return;
    }

    setImporting(true);
    setStep(3);

    try {
      let endpoint = `/schools/${schoolId}/${type}/bulk-import`;
      if (type === 'students') endpoint = `/schools/${schoolId}/students/bulk-import`;
      if (type === 'staff') endpoint = `/schools/${schoolId}/staff/bulk-import`;

      const res = await api.post(endpoint, {
        rows: validRowsToSubmit,
        update_existing: updateExisting
      });

      const resData = res.data?.data || res.data;
      setImportResult(resData);
      setStep(4);
      toast.success('Bulk import processing completed!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Import execution error:', err);
      toast.error(err.message || 'Bulk import failed on server.');
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  /* ── Download Credentials Log CSV ──────────────────────────────────────────── */
  const handleDownloadCredentials = () => {
    if (!importResult?.credentials || importResult.credentials.length === 0) {
      toast.info('No new user credentials were generated during this import.');
      return;
    }

    let headers = [];
    let rows = [];

    if (isStudents) {
      headers = ['Student Name', 'Guardian Name', 'Parent Username', 'Default Password'];
      rows = importResult.credentials.map(c => [
        c.student_name, c.guardian_name, c.username, c.password
      ]);
    } else {
      headers = ['Staff Name', 'Role Title', 'Username', 'Default Password', 'Email'];
      rows = importResult.credentials.map(c => [
        c.name, c.role, c.username, c.password, c.email
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', isStudents ? 'Generated_Parent_Logins.csv' : 'Generated_Teacher_Logins.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* Stats calculation */
  const totalCount = parsedRows.length;
  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  const filteredRows = parsedRows.filter(r => {
    if (filterMode === 'valid') return r.isValid;
    if (filterMode === 'error') return !r.isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-line-border flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-line-border flex justify-between items-center bg-surface/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-muted text-teal-primary flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">{modalTitle}</h3>
              <p className="text-xs text-ink/50 font-sans">
                Upload CSV or Excel file to batch import/update details with automated validation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-ink/40 hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: FILE PICKER & TEMPLATE DOWNLOAD
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Instructions banner */}
              <div className="p-4 bg-teal-muted/30 border border-teal-primary/20 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-dark">
                  <HelpCircle className="w-4 h-4 text-teal-primary" />
                  <span>How CSV/Excel Bulk Import Works</span>
                </div>
                <ul className="list-disc list-inside text-ink/70 space-y-1 pl-1">
                  <li>Download our standard sample template to ensure headers match.</li>
                  <li>Every student must have a valid Guardian/Parent name &amp; contact number or email.</li>
                  <li>Classes will be matched automatically or created if they don't exist.</li>
                  <li>Parent &amp; Teacher login credentials will be auto-generated and available for download.</li>
                </ul>
              </div>

              {/* Download Template Card */}
              <div className="glass-card p-5 rounded-xl border border-line-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-ink">Need the format template?</h4>
                  <p className="text-xs text-ink/55 mt-0.5 font-sans">Download sample `.csv` file with column headers and example records.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="btn-ghost text-xs cursor-pointer flex items-center gap-2 flex-shrink-0"
                >
                  <Download className="w-4 h-4 text-teal-primary" />
                  <span>Download Template CSV</span>
                </button>
              </div>

              {/* Drag-and-drop Upload Box */}
              <div className="border-2 border-dashed border-line-border hover:border-teal-primary rounded-2xl p-10 text-center transition-all bg-surface/20 cursor-pointer relative group">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 rounded-2xl bg-teal-muted/60 text-teal-primary flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-sm text-ink">Click or Drag CSV/Excel file here to parse</h4>
                <p className="text-xs text-ink/50 mt-1 font-sans">Supports `.csv`, `.tsv`, `.txt` files with standard UTF-8 encoding</p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: PRE-VALIDATION DRY-RUN PREVIEW TABLE
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4">

              {/* Validation Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface rounded-xl border border-line-border">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ink">Parsed File: <span className="text-teal-primary">{fileName}</span></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterMode === 'all' ? 'bg-ink text-white' : 'bg-white text-ink/70 hover:bg-surface'}`}
                  >
                    All Rows ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterMode === 'valid' ? 'bg-green-700 text-white' : 'bg-green-50 text-green-800 hover:bg-green-100'}`}
                  >
                    Valid ({validCount})
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setFilterMode('error')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterMode === 'error' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                    >
                      Errors ({errorCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Upload Mode Selector */}
              <div className="flex items-center gap-3 px-1 py-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={e => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary"
                  />
                  <span>Update existing records if matching record already exists</span>
                </label>
              </div>

              {/* Data Preview Table */}
              <div className="border border-line-border rounded-xl overflow-hidden max-h-72 overflow-y-auto font-sans text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-line-border text-[10px] font-bold text-ink/60 uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12 text-center">Row</th>
                      <th className="py-2.5 px-4">Status</th>
                      {isStudents ? (
                        <>
                          <th className="py-2.5 px-4">Student Name</th>
                          <th className="py-2.5 px-4">Class</th>
                          <th className="py-2.5 px-4">Guardian / Parent Name</th>
                          <th className="py-2.5 px-4">Guardian Contact</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-4">Staff Name</th>
                          <th className="py-2.5 px-4">Role Title</th>
                          <th className="py-2.5 px-4">Email</th>
                          <th className="py-2.5 px-4">Class</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/60">
                    {filteredRows.map((r) => (
                      <tr key={r.rowNumber} className={`hover:bg-surface/50 ${!r.isValid ? 'bg-red-50/40' : ''}`}>
                        <td className="py-2.5 px-4 text-center font-mono text-ink/40">{r.rowNumber}</td>
                        <td className="py-2.5 px-4">
                          {r.isValid ? (
                            <span className="badge badge-success flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-700" /> Valid
                            </span>
                          ) : (
                            <span className="badge badge-danger flex items-center gap-1" title={r.errors.join(', ')}>
                              <AlertCircle className="w-3 h-3 text-red-600" /> {r.errors[0]}
                            </span>
                          )}
                        </td>

                        {isStudents ? (
                          <>
                            <td className="py-2.5 px-4 font-semibold text-ink">
                              {r.data.first_name || r.data.firstname} {r.data.last_name || r.data.lastname}
                              {r.data.admission_number && (
                                <span className="block text-[9px] font-mono text-ink/40">Adm: {r.data.admission_number}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">{r.data.class_name || r.data.classname || 'Default'}</td>
                            <td className="py-2.5 px-4">{r.data.guardian_name || r.data.parent_name || '-'}</td>
                            <td className="py-2.5 px-4 font-mono text-[11px]">
                              {r.data.guardian_phone || r.data.guardian_email || '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-4 font-semibold text-ink">{r.data.name || r.data.full_name}</td>
                            <td className="py-2.5 px-4">{r.data.role_title || 'Teacher'}</td>
                            <td className="py-2.5 px-4 font-mono">{r.data.email || '-'}</td>
                            <td className="py-2.5 px-4">{r.data.class_name || '-'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: IMPORT EXECUTION PROGRESS
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-teal-primary mx-auto" />
              <h3 className="text-lg font-bold text-ink">Processing Bulk Import...</h3>
              <p className="text-xs text-ink/60 font-sans">Writing records, resolving classes, and generating parent user accounts.</p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 4: IMPORT SUMMARY REPORT & LOGINS
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 4 && importResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <span className="text-2xl font-bold font-mono text-emerald-800">{importResult.summary?.created || 0}</span>
                  <p className="text-[10px] font-bold uppercase text-emerald-700 mt-1">Created</p>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                  <span className="text-2xl font-bold font-mono text-sky-800">{importResult.summary?.updated || 0}</span>
                  <p className="text-[10px] font-bold uppercase text-sky-700 mt-1">Updated</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <span className="text-2xl font-bold font-mono text-amber-800">{importResult.summary?.skipped || 0}</span>
                  <p className="text-[10px] font-bold uppercase text-amber-700 mt-1">Skipped</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <span className="text-2xl font-bold font-mono text-rose-800">{importResult.summary?.errors || 0}</span>
                  <p className="text-[10px] font-bold uppercase text-rose-700 mt-1">Errors</p>
                </div>
              </div>

              {/* Generated User Credentials Log section */}
              {importResult.credentials && importResult.credentials.length > 0 && (
                <div className="glass-card p-5 rounded-xl border border-line-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-border pb-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-teal-primary" />
                      <div>
                        <h4 className="font-bold text-sm text-ink">Auto-Generated User Logins</h4>
                        <p className="text-xs text-ink/50 font-sans">
                          {importResult.credentials.length} login credentials provisioned. Download to distribute.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadCredentials}
                      className="btn-primary text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Logins CSV</span>
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-line-border rounded-lg">
                    <table className="w-full text-left border-collapse text-xs font-sans">
                      <thead className="bg-surface sticky top-0">
                        <tr className="border-b border-line-border font-bold text-ink/60 uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-4">Name</th>
                          <th className="py-2 px-4">Username</th>
                          <th className="py-2 px-4">Default Password</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-border/50">
                        {importResult.credentials.map((c, i) => (
                          <tr key={i} className="hover:bg-surface/50">
                            <td className="py-2 px-4 font-semibold">{c.student_name || c.name}</td>
                            <td className="py-2 px-4 font-mono text-teal-dark font-bold">{c.username}</td>
                            <td className="py-2 px-4 font-mono font-bold text-ink">{c.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Processing log detail */}
              <div className="border border-line-border rounded-xl p-4 max-h-40 overflow-y-auto font-mono text-[11px] bg-surface/30 space-y-1">
                {importResult.log?.map((l, i) => (
                  <div key={i} className={`py-0.5 ${l.status === 'created' ? 'text-green-700' : l.status === 'updated' ? 'text-sky-700' : l.status === 'skipped' ? 'text-amber-700' : 'text-red-600'}`}>
                    {l.message}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Buttons */}
        <div className="px-6 py-4 border-t border-line-border flex justify-between items-center bg-surface/40 flex-shrink-0">
          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost text-xs cursor-pointer"
              >
                ← Change File
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={validCount === 0}
                className="btn-primary text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Import {validCount} Valid Records</span>
              </button>
            </>
          ) : step === 4 ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary text-xs cursor-pointer ml-auto"
            >
              Done &amp; Close
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs cursor-pointer ml-auto"
            >
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default BulkImportModal;
