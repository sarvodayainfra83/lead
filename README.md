# Sarvodaya Infracon - CRM & ERP Documentation

Enterprise management system designed for Real Estate, Insurance, and Mutual Fund business operations.

---

Table of Contents

1. System Architecture
2. Current Working Modules
   - User Authentication and Role Permissions
   - Multi-Vertical Lead Management
   - Call Tracker and Follow-up System
   - Customer Master Directory
   - Caller Report and Analytics
   - Master Configuration
   - Mobile Responsive Interface
3. Upcoming Modules and Pipelines
   - Real Estate: Site Visit to Closing Pipeline
   - Insurance and Mutual Funds: Advisory and Deal Pipeline
   - Executive Dashboard and Lead Analytics
   - Operations Portal (HR, Accounts, Tally, CRM)
   - WhatsApp and Email Communication
4. Database Design and Schema Reference

---

1. System Architecture

Sarvodaya Infracon CRM connects lead acquisition, telecalling follow-ups, and vertical-specific business milestones.

Lead Acquisition -> Telecalling Follow-up -> Business Milestone -> Deal Closing -> Departmental Handoff

- Real Estate Milestone: Site Visit Planning -> Visit Organizer -> Visit Follow-up -> Closing
- Financial Products Milestone: Meeting Date -> Advisory Host -> Proposal Pitch -> Policy/Folio Close

---

2. Current Working Modules

User Authentication and Role Permissions
- Administrator: Complete access to all leads, reports, settings, and team configuration.
- Employee: Access restricted by individual user role and page-level permissions (Full, Read Only, None).
- Persistent login sessions with secure authentication via Supabase.

Multi-Vertical Lead Management
- Unified leads table with linked 1-to-1 extension tables for each industry vertical:
  * Real Estate table (real_state): site location, requirement options (1BHK, 2BHK, 3BHK, Villa, Bungalow, Flat, or custom input).
  * Insurance table (insurance): insurance category, dynamic sub-types (Life Insurance subtypes like KeyMan, Business, ULIP, Retirement; Health Insurance subtypes like Individual, Family, Senior Citizen, Critical Illness), and pre-existing medical conditions.
  * Mutual Fund table (mutual_fund): investment budget ranges and investment timelines.
- Automated lead number generation by category (L-RE-0001, L-IN-0001, L-MF-0001).
- Conditional fields: Referencer name appears only when lead source is Reference.
- Standardized investment budget brackets (10k-20k, 20k-50k, 50k-70k, 70k-1L, 1L-1.5L, 1.5L-2L, 2L-3L, 3L-5L, 5L+).
- Bulk lead import using Excel (.xlsx, .xls) files with sample template download.
- Queue workflow: Unassigned leads sit in Pending Lead queue; once a caller is assigned, they move to History and show up in Call Tracker.

Call Tracker and Follow-up System
- Pending Tracker: Active follow-up list showing leads requiring calls, their contact info, and previous call notes.
- History Tracker: Full chronological audit trail of all previous call logs and customer conversations.
- Call outcome statuses:
  * Received (converts lead directly to Customer Master)
  * Expected (lead interested, awaiting next milestone)
  * Not Interested (closes lead cycle, archives to history)
  * Need Meeting (flags for in-person or advisory meeting)
  * Call Not Received (schedules prompt retry)
- Customer conversation notes: Captured for all answered calls.
- Next date field: Optional across all statuses, and automatically hidden when status is Not Interested.
- Direct lead entry: Single-step modal to create a lead and immediately record its initial call outcome.

Customer Master Directory
- Automatic inclusion: Any lead marked as Received in Call Tracker automatically becomes an active customer.
- Complete customer profile: Contact info, requirement details, investment range, assigned representative, and history.

Caller Report and Analytics
- Performance breakdown by Lead Type, Calling Person, and Month.
- Live summary counters: Total Calls, Connected Calls, Converted, Expected, Not Interested, Meetings, and Missed.
- Detail Modal: One-click view of all calls, follow-up numbers, dates, notes, and progress for any lead.
- Excel Export: Single-click export of caller reports formatted for spreadsheet analysis.

Master Configuration
- Lead Types: Manage vertical product offerings.
- Lead Sources: Manage marketing and acquisition channels.
- Lead Receivers: Manage incoming intake team members.
- Caller Names: Manage telecalling staff directory.

Mobile Responsive Interface
- Single-column layout on phones and two-column layout on tablets and desktops.
- Dynamic modal viewport height (max-h-92dvh) to prevent keyboard cutoffs on smartphones.
- Boundary-clamped dropdown menus preventing horizontal page overflow.
- Mobile card views with touch momentum scrolling and collapsible filter toolbars.

---

3. Upcoming Modules and Pipelines

Real Estate: Site Visit to Closing Pipeline

This pipeline guides property leads from initial telephone interest to site inspection, negotiation, and final unit booking.

Stage 1: Site Visit Plan
- Trigger: Lead in Call Tracker shows strong interest in a project or site location.
- Information captured:
  * Preferred visit date and time slot
  * Project or site location name
  * Client specific requirements (budget, unit preference)

Stage 2: Visit Organizer Assignment
- Assign responsible team members for the site visit:
  * Site visit manager or relationship manager
  * Vehicle and driver assignment (if company transport is requested)
  * On-site sales representative to present sample flats and layouts


Stage 3: Visit Follow-up and Feedback
- Record visit completion status: Completed, Rescheduled, Cancelled, Did Not Show.
- Client feedback and interest rating (High, Medium, Low):
  * Liked aspects: location, layout, amenities, price
  * Client objections: price negotiation, layout changes, vastu, legal verification


Stage 4: Closing and Deal Values
- Final deal parameters recorded upon sale closure:
  * Selected project phase, tower, and unit/flat number
  * Total agreed deal value (INR)
  * Closing sales executive 

---

Insurance and Mutual Funds: Advisory and Deal Pipeline

This pipeline handles financial advisory appointments, portfolio presentations, and policy issuance.

Stage 1: Meeting Date and Agenda
- Trigger: Lead indicates interest in life insurance, health insurance, or mutual fund investments.
- Information captured:
  * Meeting date and time
  * Meeting mode: In-Person Office, Home Visit, Video Call (Google Meet), Phone Consultation
  * Advisory topic: Term Life, Health Coverage, Child Education, Retirement, SIP, Lump Sum

Stage 2: Meeting Host and Responsible Person
- Assign certified financial advisor or relationship manager.
- Calendar invite with client profile, previous phone notes, and health or financial history.

Stage 3: Proposal Pitch and Negotiation
- Presentation of fund performance charts, premium calculations, and policy brochures.
- Meeting progress status:
  * Proposal Presented
  * KYC Documents Collected
  * Medical Checkup Pending (Insurance)
  * Client Decision Pending

Stage 4: Deal Finalization
- Outcome status:
  * Status Yes (Deal Closed): Product name, policy or folio number, total premium or investment value, tenure.
  * Status No (Lost): Reason for drop-off (premium high, competitor chosen, postponed).
  * Status Pending: Specified next follow-up date and required action item.
- Comprehensive remarks and document upload attachments.

---

Executive Dashboard and Lead Analytics

Dedicated executive cockpit for directors, partners, and senior managers to monitor company-wide lead flow, conversion rates, and revenue projections.

Key Features:
- End-to-end Funnel Visualization:
  Lead Generated -> Call Connected -> Site Visit / Advisory Meeting -> Proposal Sent -> Deal Closed
- Multi-Vertical Revenue Tracker:
  * Real Estate total pipeline booking value vs realized token collection
  * Insurance annual recurring premium pipeline
  * Mutual Fund Asset Under Management (AUM) addition
- Comparative Performance Analytics:
  * Team conversion rates (Telecallers vs Field Organizers vs Closing Executives)
  * Acquisition channel ROI (which lead source generates the highest ticket deals)
  * Average lead velocity: Time taken from lead generation to deal closure
- Automated Executive Reporting:
  * Daily Summary: Total calls made, visits conducted, deals closed today
  * Weekly Operations Digest: Pipeline health and pending visit follow-ups
  * Monthly Board Report: Complete performance and revenue charts exported to PDF and Excel

---

Operations Portal (HR, Accounts, Tally, CRM)

Central operations hub for inter-departmental workflows.

Team Task Management
- Task assignment with priority tags (High, Medium, Low) and due dates.
- Task tracking board: Pending, In Progress, Review, Completed.
- Daily Work Reports (DWR): Team members submit a daily summary of completed activities and hours.

HR and Staff Attendance
- Daily employee attendance register: Check-in time, Check-out time, Status (Present, Half Day, Absent, On Leave).
- Monthly attendance report for payroll calculation.
- Employee directory with designation, department, and contact information.

Accounts and Tally Integration
- Payment tracking: Booking token, advance receipts, customer installment schedules.
- Payment vouchers: Generate draft receipts with payment mode (Cheque, NEFT/RTGS, UPI, Cash).
- Tally ledger sync: Export formatted receipts and customer records in Tally XML format for direct accounting import.

CRM Administration
- Lead re-assignment tools during staff leave or workload balancing.
- Rule-based distribution: Assign incoming leads based on caller performance or lead vertical.

---

WhatsApp and Email Communication

Direct customer communication embedded into lead cards, site visit forms, and deal modals.

WhatsApp Integration
- One-click WhatsApp message button next to customer phone numbers.
- Pre-filled message templates:
  * Real Estate: Project brochure, site location Google Maps link, site visit confirmation.
  * Insurance / MF: Policy benefits summary, premium quotation, meeting reminder.
  * Payment Acknowledgement: Advance token receipt confirmation.
- Supports direct WhatsApp Web messaging and automated WhatsApp Business API.

Email Integration
- SMTP-based automated transactional emails.
- Attachments: Project deck PDF, floor plans, financial proposal sheets, and payment receipts.
- Automatic email notifications when site visits or meetings are scheduled.

---

4. Database Design and Schema Reference

Below are the upcoming database tables planned for Supabase to support the new pipelines:

Site Visits Table (Real Estate)
- id: UUID, primary key
- lead_id: UUID, foreign key referencing leads(id)
- site_location: TEXT
- scheduled_date: TIMESTAMP WITH TIME ZONE
- organizer_name: TEXT
- organizer_phone: TEXT
- pickup_required: BOOLEAN DEFAULT FALSE
- pickup_address: TEXT
- status: TEXT (Scheduled, Completed, Rescheduled, Cancelled, Did Not Show)
- feedback: TEXT
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Real Estate Deals Table
- id: UUID, primary key
- lead_id: UUID, foreign key referencing leads(id)
- project_name: TEXT
- unit_no: TEXT
- deal_value: NUMERIC
- booking_amount: NUMERIC
- payment_mode: TEXT
- payment_schedule: TEXT
- closed_by: TEXT
- closing_date: DATE
- remarks: TEXT
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Financial Deals Table (Insurance and Mutual Funds)
- id: UUID, primary key
- lead_id: UUID, foreign key referencing leads(id)
- vertical: TEXT (Insurance, Mutual Fund)
- meeting_date: TIMESTAMP WITH TIME ZONE
- meeting_mode: TEXT (In-Person, Office, Video Call, Phone)
- meeting_host: TEXT
- deal_status: TEXT (Yes, No, Pending)
- product_name: TEXT
- deal_amount: NUMERIC
- policy_or_folio_no: TEXT
- drop_reason: TEXT
- next_followup_date: DATE
- remarks: TEXT
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Team Tasks Table
- id: UUID, primary key
- assigned_to: TEXT
- department: TEXT (CRM, HR, Accounts, Sales, Management)
- task_title: TEXT
- description: TEXT
- priority: TEXT (High, Medium, Low)
- due_date: DATE
- status: TEXT (Pending, In Progress, Completed)
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Daily Work Reports Table
- id: UUID, primary key
- employee_name: TEXT
- department: TEXT
- report_date: DATE DEFAULT CURRENT_DATE
- work_summary: TEXT
- hours_worked: NUMERIC(4, 2)
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Staff Attendance Table
- id: UUID, primary key
- employee_name: TEXT
- attendance_date: DATE DEFAULT CURRENT_DATE
- check_in_time: TIME
- check_out_time: TIME
- status: TEXT (Present, Absent, Half Day, Leave)
- notes: TEXT
- unique constraint on (employee_name, attendance_date)

---

End of Documentation.
