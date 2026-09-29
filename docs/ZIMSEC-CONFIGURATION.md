# ZIMSEC Configuration Guide

## Centre and board setup

Configure the school's ZIMSEC centre number in the school settings and create
an active `ZIMSEC` exam board. Keep syllabus and subject board codes editable;
they must be captured from the current board documentation rather than
hard-coded by the application.

## Entry cycle

Create an entry cycle with session, level (`grade_7`, `o_level`, or `a_level`),
sitting, opening/closing dates, and centre number. Add the eligible cohort,
validate subjects, and assign candidate numbers before requesting submission.
Submission is locked behind the approvals queue.

## Results import

Use the results-import endpoint with a JSON batch during development or the UI
import flow. The request performs a dry-run first and returns row-level errors
for unknown candidates, unknown subjects, duplicate records, or invalid grades.
Only a clean batch enters maker-checker approval. Approval commits the batch in
one transaction and records the importing user.

## Export controls

Entry and SBA exports contain confidential examination data. Restrict them to
authorized school users, record the access in audit logs, and obtain the
required approval before distributing bulk exports.
