# 🎓 SchoolBase — Enterprise School Management System
**Complete System Architecture, UI/UX Design System, Page Catalog & API Reference**

---

## 📑 Table of Contents
1. [Overview & Zimbabwe Academic Model](#1-overview--zimbabwe-academic-model)
2. [UI/UX Design System & Global CSS Architecture](#2-uiux-design-system--global-css-architecture)
   - [Design Tokens & Color Palette](#design-tokens--color-palette)
   - [Typography & Tabular Numerics](#typography--tabular-numerics)
   - [Animations & Micro-interactions](#animations--micro-interactions)
   - [Reusable Component CSS Library](#reusable-component-css-library)
3. [Page Catalog & Functional Specifications](#3-page-catalog--functional-specifications)
   - [Authentication & Public Pages](#31-authentication--public-pages)
   - [Administrative & Command Desks](#32-administrative--command-desks)
   - [People & Cohort Directories](#33-people--cohort-directories)
   - [Academics, Curriculum & Examination Boards](#34-academics-curriculum--examination-boards)
   - [Continuous Assessment, Gradebook & Results](#35-continuous-assessment-gradebook--results)
   - [Finance, Multi-Currency Billing & Cashier Desk](#36-finance-multi-currency-billing--cashier-desk)
   - [Boarding, Hostels & Exeat Lifecycle](#37-boarding-hostels--exeat-lifecycle)
   - [Communication, Unified Chats & Broadcasts](#38-communication-unified-chats--broadcasts)
   - [Student Well-being, Health & Discipline](#39-student-well-being-health--discipline)
   - [School Resources & Library Catalog](#310-school-resources--library-catalog)
4. [Backend API Reference & Route Matrix](#4-backend-api-reference--route-matrix)
5. [Database Architecture & Runtime Migrations](#5-database-architecture--runtime-migrations)
6. [Deployment & Developer Guide](#6-deployment--developer-guide)

---

## 1. Overview & Zimbabwe Academic Model

**SchoolBase** is an enterprise-grade School Management Information System (MIS) engineered for Zimbabwean and international academic institutions spanning **ECD A & B, Primary (Grades 1–7), Junior High (Forms 1–2), O-Level (Forms 3–4), and A-Level (Lower 6 & Upper 6)**.

### Zimbabwe Curriculum & Regulatory Alignments:
- **ZIMSEC & Cambridge Dual Grading Scale**: O-Level grading ($A^*, A, B, C, D, E, U$) with Best-6 aggregate points calculation; A-Level grading ($A–E, O, U$) on the 10-point and 15-point scale (Best-3 subjects computation + General Paper).
- **ZIMSEC Examination Desk**: Candidate entry batch generation, Centre Number & Syllabus code validation, SBA (School Based Assessment) component entry, Candidate CSV export, and November Results CSV import with dry-run conflict mitigation.
- **Continuous Assessment Learning Activities (CALA / Heritage-Based Curriculum)**: Weighting component models for coursework and final examinations.
- **Three-Term Academic Calendar**: Automated termly rollover, session tracking, and attendance reporting.
- **Multi-Currency Treasury**: Base USD accounting with live exchange rate conversion for Zimbabwe Gold (ZWG / ZiG) and South African Rand (ZAR); Cash at cashier desk, EcoCash, InnBucks, Paynow, and Bank Transfer reconciliation.
- **Boarding & Exeat Gate Lifecycle**: Weekend/medical exeat approvals with SMS dispatch, Warden gate check-out/check-in, and automated background reconciliation flagging attendance-exeat discrepancies.
- **Ministry of Primary and Secondary Education (MoPSE) EMIS Returns**: Statistical enumeration by grade, gender, age, and enrolment snapshots with SHA-256 integrity verification.

---

## 2. UI/UX Design System & Global CSS Architecture

The application adopts a **glassmorphism-enhanced modern dashboard aesthetic**, pairing high-readability typography with bespoke semantic tokens, responsive flex/grid layouts, micro-animations, and full dark/light theme switching.

### Design Tokens & Color Palette

The global design tokens are defined in [`web/src/index.css`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/index.css):

| CSS Variable | Light Mode Value | Dark Mode Value | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--color-ink` | `#0F172A` (Slate 900) | `#E5E7EB` (Gray 200) | Primary typography & heading text |
| `--color-paper` | `#F6F7FB` (Off-white canvas) | `#0B1020` (Midnight Navy) | Background canvas & surface backdrop |
| `--color-surface` | `#FFFFFF` (Pure white) | `#111832` (Deep Navy surface) | Panels, cards, and modal sheets |
| `--color-sage` | `#F1F5F9` (Slate 100) | `#16203C` (Subtle dark surface) | Table headers, secondary hover states |
| `--color-teal-primary` | `#6366F1` (Indigo/Teal Accent) | `#6366F1` (Vibrant Indigo) | Primary action buttons, active navigation tabs |
| `--color-teal-dark` | `#4F46E5` (Deep Indigo) | `#818CF8` (Soft Indigo) | Button hover states, active borders |
| `--color-teal-light` | `#818CF8` (Lavender Indigo) | `#A78BFA` (Light Purple) | Focus rings, light gradient highlights |
| `--color-teal-muted` | `#EEF2FF` (Pale Indigo Tint) | `#25245B` (Muted Indigo) | Badge backdrops, active icon containers |
| `--color-amber-warning` | `#F59E0B` (Amber 500) | `#FBBF24` (Amber 400) | Warning badges, pending approvals |
| `--color-brick-critical`| `#F43F5E` (Rose 500) | `#FB7185` (Rose 400) | Overdue fees, suspensions, destructive buttons |
| `--color-line-border` | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | Clean card boundaries, table dividers |
| `--color-sky-info` | `#22D3EE` (Cyan 400) | `#67E8F9` (Cyan 300) | System alerts, information banners |

### Typography & Tabular Numerics

- **Display Headings (`--font-display`)**: `Plus Jakarta Sans`, `Inter`, system-ui, sans-serif. Used on page titles, stat values, and section banners (`font-display font-bold tracking-tight`).
- **Body & Controls (`--font-sans`)**: `Inter`, system-ui, sans-serif. Used on inputs, table rows, button text, and body copy (`font-sans text-xs/text-sm`).
- **Tabular & Financial Data (`--font-mono` / `.numeric-data`)**: `JetBrains Mono`, ui-monospace, monospace with `font-variant-numeric: tabular-nums`. Applied on invoices, amounts, candidate numbers, and admission numbers.

### Animations & Micro-interactions

Defined in `@keyframes` in `index.css`:
- **`fadeIn` (`.animate-fadeIn`)**: `0.4s ease-out` — subtle vertical translation from $+6\text{px}$ to $0\text{px}$ with opacity transition.
- **`slideUp` (`.animate-slideUp`)**: `0.4s cubic-bezier(0.4, 0, 0.2, 1)` — smooth entrance from $+16\text{px}$ for modals and action drawers.
- **`shake` (`.animate-shake`)**: Form error feedback animation across keyframes.
- **`pulse` (`.animate-pulse`)**: Audio recording indicator and live synchronization beacons.
- **`spin` (`.animate-spin`)**: Asynchronous loaders and submit buttons.

### Reusable Component CSS Library

The following standardized utility classes are applied consistently across all pages:

```css
/* Card & Container Architecture */
.glass-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line-border);
  box-shadow: 0 1px 2px rgba(2, 6, 23, 0.04), 0 8px 24px rgba(2, 6, 23, 0.06);
  border-radius: 1rem; /* rounded-2xl */
}

.glass-card-hover {
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card-hover:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--color-teal-primary) 50%, transparent);
  box-shadow: 0 14px 32px rgba(24, 39, 75, 0.11);
}

.glass-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-line-border);
  box-shadow: 0 18px 48px rgba(2, 6, 23, 0.14);
  border-radius: 1.5rem; /* rounded-3xl */
}

/* Interactive Form Controls */
.glass-input {
  background: var(--color-surface);
  border: 1px solid var(--color-line-border);
  padding: 0.5rem 0.875rem;
  border-radius: 0.75rem; /* rounded-xl */
  font-size: 0.8125rem;
  color: var(--color-ink);
  transition: all 0.2s ease;
}
.glass-input:focus {
  outline: none;
  border-color: var(--color-teal-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-teal-primary) 20%, transparent);
}

/* Action Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-teal-primary);
  color: #FFFFFF;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-teal-primary) 28%, transparent);
}
.btn-primary:hover {
  background: var(--color-teal-dark);
  transform: translateY(-1px);
}

/* Status Badges */
.badge-success { background: rgba(16, 185, 129, 0.12); color: #047857; }
.badge-warning { background: rgba(245, 158, 11, 0.14); color: #B45309; }
.badge-danger  { background: rgba(244, 63, 94, 0.12);  color: #BE123C; }
.badge-neutral { background: rgba(15, 23, 42, 0.08);   color: #475569; }

/* Data Tables */
.table-premium {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.8125rem;
}
.table-premium thead th {
  background: var(--color-sage);
  color: var(--color-ink);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.75rem 1rem;
}
```

---

## 3. Page Catalog & Functional Specifications

### 3.1. Authentication & Public Pages

#### 1. Home / Landing Page ([`Home.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Home.jsx))
- **URL Route**: `/`
- **Access Control**: Public (Unauthenticated)
- **Features & Functionality**:
  - High-conversion institutional showcase with hero section, statistics counter, core feature breakdown (CALA, ZIMSEC, Multi-currency, Boarding), and interactive fee calculator preview.
  - Quick Public Enquiry submission modal directly interfacing with `POST /enquiries`.
  - Integrated Login Drawer / Modal with credential validation, role selection, and session persistence.
- **UI Elements & CSS**: Glassmorphic hero gradient (`bg-gradient-to-br from-paper via-sage/10 to-teal-primary/5`), navigation bar with backdrop blur (`backdrop-blur-md bg-paper/80`), `.btn-primary` action triggers, and responsive layout grids.

#### 2. Authentication / Login ([`Home.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Home.jsx))
- **URL Route**: `/login` (auto-redirects to `/dashboard` if authenticated)
- **Features & Functionality**:
  - Username & password authentication against `POST /api/v1/auth/login`.
  - Returns RS256/HMAC JWT access tokens and HTTP-only refresh tokens.
  - Automatic role-based routing (Super Admin $\rightarrow$ `/admin/command-center`, School Admin $\rightarrow$ `/school-admin/dashboard`, Teacher $\rightarrow$ `/teacher/dashboard`, Parent $\rightarrow$ `/parent/dashboard`).
- **UI Elements & CSS**: Clean modal sheet (`.glass-panel`), floating label inputs (`.glass-input`), shake feedback animation on failure (`.animate-shake`), and loading button state.

#### 3. Password Recovery & Reset ([`ForgotPassword.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/ForgotPassword.jsx), [`ResetPassword.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/ResetPassword.jsx))
- **URL Routes**: `/forgot-password`, `/reset-password?token=...`
- **Features & Functionality**:
  - Email/Username lookup issuing single-use hashed recovery tokens with 15-minute expiration (`POST /auth/forgot-password`).
  - Cryptographic token verification and Argon2/Bcrypt hash replacement (`POST /auth/reset-password`).
- **UI Elements & CSS**: Centered card layout (`max-w-md mx-auto mt-20 .glass-card`), password strength checklist with live visual meters.

---

### 3.2. Administrative & Command Desks

#### 4. Super Admin Command Center ([`CommandCenter.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/CommandCenter.jsx))
- **URL Routes**: `/admin/command-center`, `/admin/licenses`, `/admin/alerts`
- **Access Control**: Role: `super_admin`
- **Features & Functionality**:
  - Multi-tenant school orchestration overview: active schools counter, total student headcount, overall billing volume, and database connection telemetry.
  - License Management Tab: provision new school instances, generate activation keys, configure plan limits (Standard, Premium, Enterprise), and adjust maximum student capacity.
  - System Health Tab: Redis cache hit rates, background outbox worker status, MySQL pool connection monitoring, and system-wide security alert triggers.
- **UI Elements & CSS**: 4 KPI glass metric cards (`grid grid-cols-1 md:grid-cols-4 gap-5`), tabbed sub-navigation (`.badge`), and interactive Recharts graphs.

#### 5. School Admin & Teacher Dashboard ([`Dashboard.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Dashboard.jsx))
- **URL Routes**: `/dashboard`, `/school-admin/dashboard`, `/teacher/dashboard`, `/student/dashboard`
- **Access Control**: Roles: `school_admin`, `teacher`, `super_admin`, `student`
- **Features & Functionality**:
  - Operational KPIs: Today's Student Attendance %, Unpaid Fees Balance, Pending Exeat Requests, Active Announcements, and Library Items Issued.
  - Recharts Enrollment Distribution by Form/Grade and Gender Breakdown.
  - Quick action shortcuts: "Record Attendance", "Submit Scheme of Work", "Enter Marks", "Publish Announcement".
  - Recent activity feed displaying audit logs and real-time alerts.
- **UI Elements & CSS**: Responsive dashboard layout (`grid grid-cols-1 xl:grid-cols-3 gap-6`), stat widgets with icon backdrops (`p-3 rounded-2xl bg-teal-primary/10 text-teal-primary`), and collapsible activity timelines.

#### 6. License Status Desk ([`LicenseStatus.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/LicenseStatus.jsx))
- **URL Route**: `/school-admin/license`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Displays institutional license tier, validity window, countdown to renewal, and student limit utilization gauge.
  - Activation key submission modal to apply extended subscription certificates.
- **UI Elements & CSS**: Status banner with color indicators (`bg-teal-primary/10 border-teal-primary/30`), circular progress gauge, and `.badge-success` indicators.

---

### 3.3. People & Cohort Directories

#### 7. Student Directory ([`Students.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Students.jsx))
- **URL Route**: `/students`
- **Access Control**: Roles: `school_admin`, `teacher`, `super_admin`
- **Features & Functionality**:
  - Comprehensive student roster with multi-faceted filtering (by Class, Gender, Status: Active/Enrolled/Suspended, and Search query).
  - Teacher view restriction: automatically filters down to students in the teacher's classes or subject cohorts.
  - Multi-section Student Enrollment Wizard:
    - Section 1: Personal Data (First, Middle, Last Name, Gender, Date of Birth, Nationality, Religion).
    - Section 2: Academic Placement (Class Assignment, Previous School, Leadership Position).
    - Section 3: Medical Records & Special Needs.
    - Section 4: Primary & Secondary Guardian Contact Details (National ID, Phone, Email, Physical Address).
    - Section 5: **Parent Account Provisioning** (Admin-supplied Parent Portal username & password with duplicate validation).
  - Bulk CSV Enrollment Import and Bulk Class Reassignment tool.
  - Visual charts: Class Enrollment Distribution and Gender Ratios.
- **UI Elements & CSS**: Floating multi-step enrollment modal, `.table-premium` with sticky header, avatar badges with student initials, and responsive Recharts bars.

#### 8. Student Profile & 360° Dossier ([`StudentProfile.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/StudentProfile.jsx))
- **URL Routes**: `/students/:id`, `/parent/children/:id`
- **Access Control**: Roles: `school_admin`, `teacher`, `super_admin`, `parent` (scoped to linked children)
- **Features & Functionality**:
  - Academic Tab: Enrolled subjects, subject teachers, historical termly report cards, and ZIMSEC/Cambridge candidate numbers.
  - Attendance Tab: Cumulative attendance percentage, present/absent/late day tallies, and monthly heatmap.
  - Financial Ledger Tab: Invoices issued, payments recorded, outstanding balances, and official printable PDF receipts.
  - Health & Residence Tab: Medical history, dietary needs, hostel dormitory allocation, and past exeat pass history.
  - Discipline Tab: Merit points, infraction records, and behavioral counselling notes.
- **UI Elements & CSS**: Profile header with status badges, horizontal tab pills, printable report card view modal, and `.numeric-data` fee cards.

#### 9. Staff Directory ([`Staff.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Staff.jsx))
- **URL Route**: `/staff`
- **Access Control**: Roles: `school_admin`, `super_admin`, `teacher`
- **Features & Functionality**:
  - Employee roster categorized by Teaching Staff vs Non-Teaching/Administrative Staff.
  - Staff onboarding modal: Staff Number (EC Number), First/Last Name, National ID, Department, Designation (Headmaster, Deputy Head, HOD, Senior Teacher, Teacher, Boarding Master, Bursar, Librarian, Nurse), Qualifications, Joining Date, Phone, and Linked User Account creation.
  - Subject allocation mapping: view classes and subjects taught by each teacher.
- **UI Elements & CSS**: Employee grid cards with contact shortcuts, designation badges (`.badge-neutral`), and detailed edit drawers.

#### 10. User Management Desk ([`UserManagement.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/UserManagement.jsx))
- **URL Route**: `/user-management`
- **Access Control**: Roles: `super_admin`, `school_admin`
- **Features & Functionality**:
  - System-wide user credentials overview (Super Admin, School Admin, Teacher, Parent, Student).
  - Force password reset, account lock/unlock, session invalidation, and role assignment.
  - Audit logging of last login timestamps and IP addresses.
- **UI Elements & CSS**: Data table with status toggle switches, lock/unlock icon buttons, and confirmation dialogs.

#### 11. Parent Portal ([`ParentPortal.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/ParentPortal.jsx))
- **URL Route**: `/parent-portal`
- **Access Control**: Role: `parent`
- **Features & Functionality**:
  - Multi-child switcher tab allowing parents with more than one child enrolled to switch context seamlessly.
  - Real-time academic performance summary (Latest Report Cards, Gradebook entries, Teacher remarks).
  - Fee Payment Modal with **Cash at Cashier Desk**, EcoCash, InnBucks, Paynow, and Bank Transfer with automated FX currency calculator (USD / ZiG / ZAR).
  - **Boarding Residence Accommodation Application Form**: Parents apply for hostel residency for boarding students directly.
  - Attendance & Exeat pass submission with real-time status tracking.
- **UI Elements & CSS**: Family workspace theme, child avatar selector tabs (`flex space-x-3 overflow-x-auto`), payment currency converter pill tabs, and status cards.

---

### 3.4. Academics, Curriculum & Examination Boards

#### 12. Academic Setup & Structures ([`AcademicsSetup.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/AcademicsSetup.jsx))
- **URL Route**: `/academics/setup`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Academic Session Manager (Year, Start Date, End Date, Set as Active Session).
  - Term Manager (Term 1, Term 2, Term 3 with start, end, and vacation dates).
  - Department Setup (Sciences, Mathematics, Languages, Humanities, Commercials, Technical/Vocational, Primary, Guidance & Counselling) with Head of Department (HOD) assignment.
  - Grading Scale Configurator: ZIMSEC O-Level, ZIMSEC A-Level, Primary, Cambridge IGCSE with customizable percentage-to-grade ranges and grade points.
  - Academic Promotion Rules: required passing grades, mandatory subjects (e.g., English Language and Mathematics requirements).
- **UI Elements & CSS**: Multi-tab management cards (`.glass-card`), tabular percentage boundary editors, and active term highlight banners.

#### 13. Classes & Subjects Configuration ([`Classes.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Classes.jsx))
- **URL Route**: `/classes`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Form & Class Directory (e.g., Form 1 North, Form 1 South, ECD A, Grade 7 Blue) with capacity and assigned Form Master (Class Teacher).
  - Subject Catalog management (Subject Name, Subject Code, Level: Primary / O-Level / A-Level, Department, Is Practical/SBA Subject).
  - Class-Subject-Teacher matrix: assign subject teachers to specific classes with timetable period allocation.
- **UI Elements & CSS**: Master-detail view, form master assignment dropdowns, badge pills for subject codes, and class capacity progress bars.

#### 14. Schemes of Work & Lesson Plans ([`SchemesOfWork.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/SchemesOfWork.jsx))
- **URL Route**: `/academics/schemes`
- **Access Control**: Roles: `teacher`, `hod`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Termly Scheme of Work builder: Week Number, Topic, Sub-topic, Objectives, Competencies (Heritage-Based Curriculum), Source of Material (SOM), Methodology, and Evaluation.
  - Approval Workflow: Teachers submit $\rightarrow$ HOD reviews & approves with comments $\rightarrow$ Head of School inspection export.
  - Daily Lesson Plan Generator: Linked to approved scheme topics, detailing Introduction, Main Activities, Conclusion, Assessment Tasks, and Media Aids.
- **UI Elements & CSS**: Weekly timeline view, status pills (Draft, Submitted, Approved, Revision Requested), collapsible plan sections, and PDF export preview.

#### 15. ZIMSEC Examination Board Desk ([`ZimsecBoard.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/ZimsecBoard.jsx))
- **URL Route**: `/zimsec/portal`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Examination cycle management: Session Year, Exam Series (June / November), Level (O-Level / A-Level), and Centre Number configuration.
  - Candidate Entry Desk: assign Candidate Numbers, select registered subjects and paper options, capture SBA marks.
  - Official Candidate Entry CSV Export conforming to ZIMSEC electronic registration specifications.
  - November Results Import: CSV file upload with dry-run error parser, candidate matching, grade-point allocation, and instant aggregate pass verification (5 O-Levels including English Language).
- **UI Elements & CSS**: Official examination desk banner, CSV upload dropzone with file hash integrity check, dry-run validation error modal, and pass rate KPI cards.

---

### 3.5. Continuous Assessment, Gradebook & Results

#### 16. Gradebook Entry Matrix ([`Grades.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Grades.jsx))
- **URL Route**: `/grades`
- **Access Control**: Roles: `teacher`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Spreadsheet-style mark entry grid by Class, Subject, Term, and Assessment Type (CALA / Coursework, Mid-Term Test, Final Exam).
  - Live percentage calculation, automated letter grade assignment, and instant teacher remarks suggestions.
  - Bulk mark entry with offline local caching and versioning to prevent concurrent edit overwrites.
- **UI Elements & CSS**: Keyboard-navigable tabular spreadsheet grid (`.table-premium`), color-coded mark boundaries (Distinction: Green, Pass: Indigo, Fail: Rose), and auto-save indicators.

#### 17. Results Ledger & Report Card Issuing ([`Results.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Results.jsx))
- **URL Routes**: `/results`, `/student/results`, `/student/report-cards`
- **Access Control**: Roles: `school_admin`, `teacher`, `parent`, `student`, `super_admin`
- **Features & Functionality**:
  - Termly Results publication and embargo workflow: drafts can be entered, vetted by HOD, and released officially by the Headmaster before parents can view.
  - Printable Standard Zimbabwean Report Card:
    - ECD Pupils: Skills checklist report without numerical ranking.
    - Primary & O-Level: Subject breakdown, coursework component marks, exam marks, grade, class average, subject teacher remarks, Form Master comments, Headmaster signature, and Best-6 points aggregate.
    - A-Level: 10/15-point scale, Best-3 calculation, and General Paper pass indication.
  - Integrated Print Modal ([`PrintReportModal.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/components/PrintReportModal.jsx)) formatted for A4 printing and PDF export.
- **UI Elements & CSS**: Official institutional crest header, watermark, dual-signoff stamp containers, and clean tabular grade blocks.

#### 18. Examination Scheduler ([`Exams.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Exams.jsx))
- **URL Route**: `/exams`
- **Access Control**: Roles: `school_admin`, `teacher`, `super_admin`
- **Features & Functionality**:
  - Internal examination timetable setup (Termly Mocks, Mid-Term Assessments, Final Sessions).
  - Session scheduling: Paper Name, Date, Start Time, Duration, Room/Hall allocation, and Chief Invigilator assignment.
- **UI Elements & CSS**: Chronological exam schedule list, conflict detection alert banners, and printable exam hall timetable.

---

### 3.6. Finance, Multi-Currency Billing & Cashier Desk

#### 19. Fees Ledger & Financial Desk ([`Fees.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Fees.jsx))
- **URL Routes**: `/fees`, `/finance/dashboard`, `/finance/invoices`, `/finance/payments`, `/finance/fee-structures`, `/parent/fees/pay`
- **Access Control**: Roles: `bursar`, `school_admin`, `parent`, `student`, `super_admin`
- **Features & Functionality**:
  - Fee Structure Configurator: Tuition fee, Boarding fee, SDA Levy (School Development Association), Building Fund, Practical Subject Levy, and ZIMSEC Exam entry fee.
  - Bulk Term Invoice Generation: Generates automated invoices for all enrolled students in USD with custom line items.
  - Multi-Currency Cashier Desk:
    - Accepts Cash at Cashier Desk (tracks cashier name, physical receipt number, auto-generates `CSH-XXXXXXX` reference).
    - Remote Payments: EcoCash, InnBucks, Paynow, and Bank Transfer with proof of payment (POP) upload.
    - Currency conversion engine applying official school exchange rates (USD / ZiG / ZAR).
  - Debtors Aging Analysis: 30-day, 60-day, 90-day overdue balance aging tables.
  - Bank Statement Reconciliation: CSV bank statement upload with automated POP matching and maker-checker approval.
- **UI Elements & CSS**: Multi-currency conversion pills, payment declaration drawer, `.numeric-data` financial cards, and printable receipt preview.

#### 20. School Expenditure Ledger ([`Expenses.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Expenses.jsx))
- **URL Routes**: `/expenses`, `/finance/expenses`
- **Access Control**: Roles: `bursar`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Institutional operational expenses logging categorized by Department, Category (Salaries, Boarding Provisions, Stationery, Utilities, Maintenance), Amount, Currency, and Payment Method.
  - Expense receipt attachment storage and budget variance tracking.
- **UI Elements & CSS**: Expenditure category badges, monthly expense trend chart, and transaction entry modal.

---

### 3.7. Boarding, Hostels & Exeat Lifecycle

#### 21. Hostel & Dormitory Allocation ([`Hostels.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Hostels.jsx))
- **URL Routes**: `/hostels`, `/boarding/hostels`
- **Access Control**: Roles: `boarding_master`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Hostels management (Hostel Name, Gender: Boys/Girls, Total Capacity, Warden Phone & Email, Max Occupants per Room).
  - Bed & Room Allocation: assign boarding students to specific rooms and beds.
  - **Hostel Applications Desk**: Review and approve/reject residence accommodation applications submitted by parents in the Parent Portal.
- **UI Elements & CSS**: Dormitory occupancy progress bars (`bg-teal-primary/20 h-2 rounded-full`), room allocation cards, and application review action buttons.

#### 22. Boarding Exeat Management ([`BoardingExeat.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/BoardingExeat.jsx))
- **URL Routes**: `/boarding/exeat`, `/parent/exeats`
- **Access Control**: Roles: `boarding_master`, `head`, `school_admin`, `parent` (scoped to own children)
- **Features & Functionality**:
  - Exeat Request Submission: Student, Exeat Type (Weekend, Medical, Compassionate, Official), Destination, Departure Date/Time, Expected Return Date/Time, Reason, and Emergency Contact Phone.
  - Approval Lifecycle: Boarding Master / Head approval with automated guardian SMS dispatch notification (`delivery_outbox`).
  - Gate Check-Out & Return Check-In: Gate security/warden records actual departure and actual return timestamps.
  - Automated Reconciliation: Background reconciliation daemon detects discrepancies between checked-out exeat status and classroom morning attendance records.
  - **Parent Scoping**: Parents only see and submit exeats for their own linked children.
- **UI Elements & CSS**: Status badge lifecycle (`.badge-warning` Pending $\rightarrow$ `.badge-success` Approved $\rightarrow$ Checked Out $\rightarrow$ Returned), gate action trigger buttons, and emergency contact chips.

---

### 3.8. Communication, Unified Chats & Broadcasts

#### 23. Unified Notification & Communication Hub ([`Notifications.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Notifications.jsx))
- **URL Routes**: `/notifications`, `/messages` (auto-redirects to `/notifications?tab=chats`), `/announcements` (auto-redirects to `/notifications?tab=announcements`)
- **Access Control**: Roles: `school_admin`, `teacher`, `parent`, `super_admin`
- **Features & Functionality**:
  - **Tab 1 — Secure WhatsApp-style Communication**:
    - Scoped conversation threads: Teachers only see parents of students in their classes/subjects; parents only see their children's teachers and administration.
    - Simulated Audio Voice Notes: live microphone recorder with duration counter, audio playback scrubber, and wave animation.
    - File Attachments: Medical certificates, reports, homework photos.
    - Real-time updates: WebSocket handshake (`ws://localhost:5000/ws?token=...`) auto-refreshes message threads without reloading.
  - **Tab 2 — Broadcast Announcements**:
    - Official institutional broadcast feed filtered by Category (All, Academic, Sports, General).
    - **+ Post Broadcast Modal**: Authorized staff/admins post announcements specifying Title, Target Audience (All School, Staff Only, Parents Only, Specific Student Classes), Class selection, Expiry Date, and Message body.
  - **Tab 3 — Automated System Alerts**:
    - Unread fee payment notices, absence alerts, exeat approval updates with "Mark All as Read" action.
- **UI Elements & CSS**: 3-pill tabbed header, WhatsApp-style dual-column chat layout with message bubbles (outgoing: `bg-teal-primary text-white`, incoming: `bg-paper border border-line-border/50`), audio player bar, and broadcast card containers.

---

### 3.9. Student Well-being, Health & Discipline

#### 24. Leave & Absence Requests ([`LeaveRequests.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/LeaveRequests.jsx))
- **URL Route**: `/leave-requests`
- **Access Control**: Roles: `school_admin`, `teacher`, `parent` (scoped to own children)
- **Features & Functionality**:
  - Student absence & medical leave notice submission with date range and reason.
  - Two-way consultation thread: Teachers and parents discuss absence reasons in an authenticated conversation thread.
  - Doctor's note file attachment upload and voice note explanations.
  - Administration approval/rejection with status updates.
- **UI Elements & CSS**: Conversation consultation card with file attachment chips, voice player, and approval status chips.

#### 25. Conduct & Discipline Desk ([`Discipline.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Discipline.jsx))
- **URL Route**: `/discipline`
- **Access Control**: Roles: `school_admin`, `teacher`, `super_admin`, `parent`
- **Features & Functionality**:
  - Incident recording: Student, Incident Date, Category (Disruptive behavior, Truancy, Bullying, Vandalism, Uniform infraction), Severity Level (Low, Medium, High, Critical), Action Taken (Detention, Parent Conference, Suspension, Guidance referral).
  - Parent scoping: Parents only view disciplinary records relating to their own children.
- **UI Elements & CSS**: Severity-colored alert tags (`.badge-danger`, `.badge-warning`), incident summary cards, and resolution notes.

#### 26. Health & Medical Services ([`HealthRecords.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/HealthRecords.jsx))
- **URL Route**: `/health-records`
- **Access Control**: Roles: `nurse`, `school_admin`, `teacher`, `super_admin`
- **Features & Functionality**:
  - Clinic visit log: Student, Visit Timestamp, Chief Complaint / Symptoms, Diagnosis, Treatment Administered (Medication, Rest, Referred to Hospital), Attending Nurse/Staff.
  - Chronic conditions and allergy registers.
- **UI Elements & CSS**: Clinic log table with medical cross icons, urgent medical alerts, and confidential record indicators.

---

### 3.10. School Resources & Library Catalog

#### 27. Library Catalog & Lending ([`Library.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Library.jsx))
- **URL Route**: `/library`
- **Access Control**: Roles: `school_admin`, `teacher`, `parent`, `super_admin`
- **Features & Functionality**:
  - 4 KPI Stat Cards: Total Catalog, Available in Stock, Currently Issued, Past Exam Archives count.
  - Multi-criteria filtering:
    - Resource Categories: All, Textbooks & Syllabi, Literature & African Fiction, Exam & Past Papers, School Stationery & Equipment.
    - Class Level: Primary, Form 1–2, Form 3–4, Form 5–6.
    - Availability: All, In Library / Available, Currently Issued.
  - Live unified search across Title, Author, Barcode/Asset Tag, and Shelf Location.
  - Asset lending workflow: issue book/stationery to Student or Staff with return due dates; return asset with condition inspection.
- **UI Elements & CSS**: Category tab buttons with counts, availability badges, clean catalog table with book icon backdrops, and book lending modal.

#### 28. School Assets & Inventory ([`Assets.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Assets.jsx))
- **URL Route**: `/assets`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Fixed assets registry: Furniture, IT Hardware, Science Laboratory Equipment, Vehicles, Sports Equipment.
  - Serial number tracking, purchase date, acquisition value, depreciation, and current operational condition (Good, Fair, Needs Repair, Damaged, Disposed).
- **UI Elements & CSS**: Equipment inventory table with condition badges and asset registration drawer.

#### 29. Timetable & Schedule Matrix ([`Timetable.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Timetable.jsx))
- **URL Routes**: `/timetable`, `/calendar`
- **Access Control**: Roles: `school_admin`, `teacher`, `parent`, `student`, `super_admin`
- **Features & Functionality**:
  - Interactive weekly period grid (Periods 1 through 8 across Monday to Friday).
  - Filterable by Class or by Teacher with real-time clash and double-booking conflict warnings.
- **UI Elements & CSS**: Grid matrix layout (`grid grid-cols-6 border`), period time blocks with subject and teacher initials, and printable schedule export.

#### 30. EMIS Returns & Institutional Reporting ([`EmisReturns.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/EmisReturns.jsx), [`Reporting.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Reporting.jsx))
- **URL Routes**: `/emis/returns`, `/reporting`, `/admin/approvals`
- **Access Control**: Roles: `head`, `deputy_head`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Ministry January Enrolment Return generator breaking down enrolment by Grade, Gender, and Age.
  - Immutable Enrolment Snapshot with SHA-256 digital cryptographic verification hash.
  - Comprehensive statistical reports: Attendance rate analysis, Fee collection vs target, Academic pass rate trends, and Debtors ledger export.
- **UI Elements & CSS**: Statistical aggregation tables, snapshot verification badges with hash display, and CSV/PDF export triggers.

#### 31. Tasks, Work Planner & Calendar ([`Tasks.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/Tasks.jsx))
- **URL Route**: `/tasks`
- **Access Control**: Roles: `teacher`, `school_admin`, `super_admin`
- **Features & Functionality**:
  - Staff task list with priority tags (High, Medium, Low), due dates, and status checkboxes (Pending, In Progress, Completed).
- **UI Elements & CSS**: Kanban / list hybrid view with draggable task cards and completion strikethroughs.

#### 32. Security Settings & System Audit Log ([`SecuritySettings.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/SecuritySettings.jsx), [`AuditLog.jsx`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/web/src/pages/AuditLog.jsx))
- **URL Routes**: `/settings/security`, `/audit-log`
- **Access Control**: Roles: `school_admin`, `super_admin`
- **Features & Functionality**:
  - Password change, Two-Factor Authentication (MFA / TOTP) toggle, and active session termination.
  - Complete immutable audit trail capturing User ID, Action, Entity Type, Entity ID, Timestamp, and Old/New values on sensitive operations (mark correction, fee payment reversal, student grade edits).
- **UI Elements & CSS**: Security card toggles, code confirmation modal, and audit log event viewer with monospace timestamps.

---

## 4. Backend API Reference & Route Matrix

The backend is built with **Node.js, Express, MySQL (with connection pooling and transactions), and WebSocket (`ws`)**. All authenticated routes expect an `Authorization: Bearer <token>` header.

### 4.1. Authentication & Security Endpoints (`authRoutes.js`)
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials; returns JWT and user payload |
| `POST` | `/api/v1/auth/refresh` | Public | Exchanges valid refresh token for a new access token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current session refresh token |
| `POST` | `/api/v1/auth/logout-all` | Authenticated | Revokes all refresh tokens across all devices for the user |
| `POST` | `/api/v1/auth/forgot-password`| Public | Dispatches password reset token |
| `POST` | `/api/v1/auth/reset-password` | Public | Applies new password using verified reset token |
| `GET`  | `/api/v1/auth/me` | Authenticated | Fetches authenticated user profile, permissions, and school context |
| `PUT`  | `/api/v1/auth/change-password`| Authenticated | Updates account password with old password verification |

### 4.2. Student & Guardian Endpoints (`studentsRoutes.js`)
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/schools/:schoolId/students` | Authenticated | Roster of students; auto-scoped for parents and teachers |
| `POST`| `/api/v1/schools/:schoolId/students` | `school_admin`, `super_admin` | Enrolls student, creates guardian, links parent account |
| `GET` | `/api/v1/schools/:schoolId/students/:id` | Authenticated | Single student detailed record |
| `PATCH`| `/api/v1/schools/:schoolId/students/:id`| `school_admin`, `super_admin` | Updates student profile information |
| `GET` | `/api/v1/schools/:schoolId/students/:id/profile` | Authenticated | 360° student profile (grades, fees, attendance, health) |
| `POST`| `/api/v1/schools/:schoolId/students/bulk-import` | `school_admin`, `super_admin` | Bulk CSV enrollment processor |

### 4.3. Academics, Classes & ZIMSEC Endpoints
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/schools/:schoolId/classes` | Authenticated | List of classes with form masters and student counts |
| `POST`| `/api/v1/schools/:schoolId/classes` | `school_admin`, `super_admin` | Creates new class cohort |
| `GET` | `/api/v1/schools/:schoolId/subjects` | Authenticated | Subjects registry with syllabus codes |
| `GET` | `/api/v1/academics/grading-scales` | Authenticated | ZIMSEC and Cambridge grading boundaries |
| `GET` | `/api/v1/schools/:schoolId/grades` | Authenticated | Marks matrix for class and subject |
| `POST`| `/api/v1/schools/:schoolId/grades/bulk`| `teacher`, `school_admin` | Bulk grades batch entry with conflict detection |
| `GET` | `/api/v1/zimsec/entries` | `school_admin`, `super_admin` | ZIMSEC candidate entry cycles |
| `POST`| `/api/v1/zimsec/entries/:id/export-csv`| `school_admin`, `super_admin` | Generates official ZIMSEC entry CSV |
| `POST`| `/api/v1/zimsec/entries/:id/import-results`| `school_admin`, `super_admin` | Imports Nov exam results with dry-run conflict check |

### 4.4. Finance & Multi-Currency Endpoints (`feesRoutes.js`, `financeExtraRoutes.js`)
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/schools/:schoolId/fees/structures` | Authenticated | Fee structures by term and class level |
| `POST`| `/api/v1/schools/:schoolId/fees/structures` | `bursar`, `school_admin` | Creates fee breakdown with line items |
| `GET` | `/api/v1/schools/:schoolId/fees/invoices` | Authenticated | Invoices roster; scoped for parents to their kids |
| `POST`| `/api/v1/schools/:schoolId/fees/payments` | `bursar`, `school_admin` | Records verified payment with receipt generation |
| `POST`| `/api/v1/schools/:schoolId/remote-payments`| Authenticated | Submits cash declaration or mobile money POP |
| `GET` | `/api/v1/schools/:schoolId/fees/exchange-rates` | Authenticated | Real-time school FX rates (USD, ZiG, ZAR) |
| `POST`| `/api/v1/finance/bank-statements/reconcile` | `bursar`, `school_admin` | Imports and reconciles bank statement entries |

### 4.5. Boarding, Hostels & Exeats (`boardingRoutes.js`, `extraRoutes.js`)
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/boarding/houses` | Authenticated | Houses list with points standings |
| `POST`| `/api/v1/boarding/houses/points` | Staff roles | Awards or deducts house competition points |
| `GET` | `/api/v1/boarding/exeats` | Authenticated | Exeat passes; strictly scoped for parents |
| `POST`| `/api/v1/boarding/exeats` | Authenticated | Requests exeat pass (verifies student guardian linkage) |
| `POST`| `/api/v1/boarding/exeats/:id/approve` | Boarding master / Head | Approves/rejects exeat and queues guardian SMS |
| `POST`| `/api/v1/boarding/exeats/:id/check-out` | Boarding master | Gate security checkout timestamp recording |
| `POST`| `/api/v1/boarding/exeats/:id/check-in` | Boarding master | Gate security return check-in timestamp recording |
| `GET` | `/api/v1/hostels/applications` | Authenticated | Hostel applications; strictly scoped for parents |
| `POST`| `/api/v1/hostels/applications` | Authenticated | Submits boarding residence accommodation application |

### 4.6. Communication & Notifications (`messagesRoutes.js`, `extraRoutes.js`)
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/messages/conversations` | Authenticated | User's active secure conversation threads |
| `POST`| `/api/v1/messages/conversations` | Authenticated | Starts thread with permitted contacts |
| `GET` | `/api/v1/messages/conversations/:id` | Authenticated | Thread messages with voice note and document links |
| `POST`| `/api/v1/messages/conversations/:id/messages`| Authenticated | Sends message, voice note, or attachment |
| `GET` | `/api/v1/messages/contacts` | Authenticated | Scoped contact list (Teachers $\leftrightarrow$ Cohort Parents) |
| `GET` | `/api/v1/schools/:schoolId/announcements`| Authenticated | Broadcast announcements feed |
| `POST`| `/api/v1/schools/:schoolId/announcements`| Staff / Admins | Publishes broadcast targeted by role or class |
| `GET` | `/api/v1/notifications` | Authenticated | Unread system alerts and notices |
| `POST`| `/api/v1/notifications/read-all` | Authenticated | Marks all user notifications as read |

### 4.7. Library, Assets & Leave Requests
| Method | Endpoint | Scopes / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/schools/:schoolId/assets` | Authenticated | Library and school equipment catalog |
| `POST`| `/api/v1/schools/:schoolId/assets` | `school_admin`, `librarian` | Adds new catalog item |
| `POST`| `/api/v1/schools/:schoolId/assets/:id/lend` | `school_admin`, `librarian` | Lends book/equipment to student or staff |
| `POST`| `/api/v1/schools/:schoolId/assets/:id/return`| `school_admin`, `librarian` | Returns lent asset to library store |
| `GET` | `/api/v1/schools/:schoolId/leave-requests`| Authenticated | Absence notices; scoped for parents and teachers |
| `POST`| `/api/v1/schools/:schoolId/leave-requests`| Authenticated | Submits absence note with doctor note / audio |
| `POST`| `/api/v1/schools/:schoolId/leave-requests/:id/chat`| Authenticated | Two-way absence consultation message |

---

## 5. Database Architecture & Runtime Migrations

The database is built on **MySQL 8.0** with strict UTF-8 (`utf8mb4_unicode_ci`) collation. Schema enhancement and column expansions run automatically on startup via `ensureTables()` in [`backend-node/src/config/db.js`](file:///c:/Users/Professor/Desktop/School%20work/School%20Management%20System/backend-node/src/config/db.js).

### Core Tables & Relationships
1. **`users`**: Base credentials, username, password hash (Bcrypt), role (`super_admin`, `school_admin`, `teacher`, `parent`, `student`, `bursar`, `boarding_master`), phone, email, MFA secrets.
2. **`schools`**: Institution profile, registration/centre number, currency, bank details, boarding capability (`is_boarding`).
3. **`students`**: Student records, admission number, class assignment, date of birth, home address, medical notes, leadership status.
4. **`guardians`**: Parent/guardian contact records, national ID, phone, email, linked to `users.id`.
5. **`student_guardians`**: Many-to-many relationship linking students to their designated primary and secondary guardians.
6. **`classes` & `subjects`**: Cohort allocations and syllabus listings.
7. **`grades` & `entry_results`**: Coursework, exams, ZIMSEC results, and aggregate grade points.
8. **`invoices`, `invoice_items`, `fee_payments`, `remote_payments`**: Financial ledger tracking multi-currency fee schedules and cash transactions.
9. **`exeats`**: Boarding gate pass requests, departure/return dates, approvals, actual check-out/check-in timestamps.
10. **`hostels`, `hostel_applications`, `hostel_allocations`**: Dormitory management and boarding residency applications.
11. **`conversations`, `conversation_participants`, `messages`**: Encrypted multi-channel communication ledger supporting audio and document links.
12. **`announcements` & `notifications`**: School broadcasts and automated user alerts.
13. **`assets` & `asset_lendings`**: Library catalog, literature books, syllabi, and equipment loans.
14. **`audit_logs`**: Immutable audit logs capturing old/new values, IP addresses, and user actions.

---

## 6. Deployment & Developer Guide

### Prerequisites
- **Node.js**: `v18.x` or `v20.x` LTS
- **MySQL**: `8.0+`
- **Package Manager**: `npm` (`v9+`)

### Local Setup Instructions

#### 1. Configure the Backend API
```bash
cd backend-node

# Configure environment variables in .env
# Example .env:
# PORT=5000
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=schoolbase
# JWT_SECRET=super_secret_jwt_key_here

npm install
node src/server.js
```
The API server will automatically run startup migrations in `db.js`, instantiate WebSocket listeners on `/ws`, start the background attendance reconciliation daemon, and bind to `http://localhost:5000`.

#### 2. Configure the Frontend Web Application
```bash
cd ../web

npm install
npm run dev
```
The Vite development server will start and bind to `http://localhost:5174` (or `5173`).

#### 3. Production Compilation Validation
```bash
npm run build
```
Generates optimized and minified production bundles in `web/dist/` with zero lint or JSX errors.

---

## 7. Quality Assurance & Acceptance Checklist (§13 Signed Off)

- [x] **Scenario A (Admissions)**: Student enrollment generates linked guardian account with manual login credentials.
- [x] **Scenario B (ECD Reporting)**: Checklist report cards without numerical ranking accessible in parent portal.
- [x] **Scenario C (O-Level & ZIMSEC)**: CALA components $\rightarrow$ Mock marks $\rightarrow$ Best-6 points calculation $\rightarrow$ Candidate CSV export $\rightarrow$ Nov results dry-run import.
- [x] **Scenario D (A-Level)**: Combination registration (3 A-Levels + General Paper) $\rightarrow$ 10/15-point scale $\rightarrow$ Best-3 computation.
- [x] **Scenario E (Curriculum)**: Teacher submits Scheme of Work $\rightarrow$ HOD approves with notes $\rightarrow$ Lesson plan logged.
- [x] **Scenario F (Boarding)**: Weekend exeat requested $\rightarrow$ Head approves $\rightarrow$ Gate check-out/check-in recorded $\rightarrow$ Automated reconciliation detects absence conflicts.
- [x] **Scenario G (Treasury)**: Term invoices issued in USD $\rightarrow$ Cashier desk cash payments and mobile payments recorded at official school exchange rates.
- [x] **Scenario H (EMIS)**: January enrolment returns generated by grade and gender with SHA-256 digital snapshot hash.
- [x] **Scenario I (Security & Scoping)**: Strict parent and teacher scoping across messaging, exeat passes, and residence applications; full audit trail for corrected marks and reversed transactions.
