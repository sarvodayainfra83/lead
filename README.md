# Sarvodaya Infracon - Enterprise System Documentation

Enterprise management system designed for multi-vertical operations across **Real Estate**, **Insurance**, and **Mutual Fund** business lines.

---

Table of Contents

1. System Architecture & Core Workflow
2. Completed Working Modules
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
   - Operations Portal (HR, Staff Tasks & Attendance)
   - WhatsApp and Email Communication

---

1. System Architecture & Core Workflow

Sarvodaya Infracon connects lead acquisition, telecalling follow-ups, vertical-specific business milestones, and post-order operations.

Lead Acquisition -> Telecalling Follow-up -> Status: "Received" -> Business Milestone -> Deal Closing -> Operations Handoff

- Transition Rule: When a telecaller marks a call outcome as "Received" in the Call Tracker, the lead is automatically converted into an active record in Customer Master and unlocked for vertical-specific closing pipelines.
- Real Estate Milestone: Site Visit Planning -> Visit Organizer Assignment -> Visit Follow-up & Feedback -> Unit Booking & Closing.
- Financial Products Milestone: Meeting Date & Agenda -> Advisory Host Assignment -> Proposal Pitch -> Policy Issuance / Folio Allotment.


2. Completed Working Modules

User Authentication and Role Permissions
- Administrator: Complete administrative access to all leads, caller reports, master configurations, and team permissions.
- Employee: Access controlled by user roles and granular page-level permissions (Full: read/write/edit; Read Only: view only; None: hidden from menu).
- Session Security: Secure persistent login sessions backed by Supabase authentication and JWT token handling.

Multi-Vertical Lead Management
- Unified Leads Architecture: Central leads table linked with 1-to-1 extension tables for each industry vertical:
  * Real Estate Table (`real_state`): Captures site location and requirement options (`1BHK`, `2BHK`, `3BHK`, `Villa`, `Bungalow`, `Flat`, or custom plot requirements).
  * Insurance Table (`insurance`): Captures insurance category, dynamic sub-types (Life Insurance subtypes: KeyMan, Business, ULIP, Retirement/Pension; Health Insurance subtypes: Individual, Family Floater, Senior Citizen, Critical Illness), and pre-existing medical conditions.
  * Mutual Fund Table (`mutual_fund`): Captures investment budget ranges and investment timelines.
- Automated Sequential Lead Numbering: Formatted prefixes generated automatically per category:
  * Real Estate: `LR-001`, `LR-002`, ...
  * Insurance: `LI-001`, `LI-002`, ...
  * Mutual Fund: `LM-001`, `LM-002`, ...
- Dynamic Conditional Fields: Referencer name input appears conditionally only when the Lead Source is set to "Reference".
- Standardized Investment Budget Brackets: Consistent budget brackets across all intake forms: `10k-20k`, `20k-50k`, `50k-70k`, `70k-1L`, `1L-1.5L`, `1.5L-2L`, `2L-3L`, `3L-5L`, and `5L+`.
- Bulk Lead Import: Seamless bulk ingestion using Excel files (`.xlsx`, `.xls`) with automated field mapping, format validation, and downloadable sample templates.
- Lead Allocation Workflow: Fresh leads initially enter the unassigned Pending Lead Queue. Once allocated to a telecaller, they move to active calling history and appear directly in the Call Tracker.

Call Tracker and Follow-up System
- Dual-Queue Tracking Interface:
  * Pending Tracker: Real-time worklist displaying leads requiring outbound calls, phone numbers, lead requirement summaries, and previous interaction logs.
  * History Tracker: Complete chronological audit trail of all previous call dispositions, notes, and agent follow-ups.
- Call Outcome Statuses & State Machine:
  * `Received`: Client confirms interest and agrees to advance. Automatically converts the lead into an active client in the Customer Master Directory and unlocks post-order closing pipelines.
  * `Expected`: Client expressed interest but requires a follow-up call at a scheduled future date.
  * `Not Interested`: Closes the current lead cycle and archives the record to history.
  * `Need Meeting`: Flags the lead for an in-person, advisory, or on-site consultation.
  * `Call Not Received`: Automatically flags the lead for prompt retry scheduling.
- Customer Conversation Notes: Detailed timestamped notes captured for all answered conversations.
- Next Follow-up Date Logic: Optional date-picker available across all active statuses; automatically hidden when status is set to `Not Interested`.
- Direct Lead Entry Modal: Single-step modal allowing callers to register a new lead and immediately record its initial call outcome without leaving the tracker.

Customer Master Directory
- Automated Promotion: Any lead marked with outcome `Received` in the Call Tracker is automatically promoted into the Customer Master Directory.
- Central Customer Record: Stores verified contact details, vertical-specific requirements, budget brackets, assigned sales representative, and complete interaction history.

Caller Report and Analytics
- Multi-Dimensional Performance Breakdown: View analytics filtered by Lead Type, Calling Person, and Date/Month.
- Real-Time Summary Counters: Live metrics tracking `Total Calls`, `Connected Calls`, `Converted (Received)`, `Expected`, `Not Interested`, `Need Meeting`, and `Missed / Not Received`.
- Caller Detail Audit Modal: One-click drill-down showing all call attempts, dates, caller notes, and status progression for any selected lead.
- Excel Export: Single-click export of caller analytics formatted for spreadsheet reporting.

Master Configuration
- Lead Types: Manage vertical business offerings (Real Estate, Insurance, Mutual Funds).
- Lead Sources: Manage acquisition channels (Digital Ads, References, Walk-ins, Campaigns).
- Lead Receivers: Manage intake team members receiving new inquiries.
- Caller Directory: Manage telecalling staff profiles and active calling rosters.

Mobile Responsive Interface
- Responsive Layout Engine: Single-column flow on smartphones and dynamic two-column grid on tablets and desktop screens.
- Dynamic Viewport Height: Modal containers clamped to `max-h-92dvh` to prevent mobile keyboard cutoff on mobile devices.
- Overflow Clamping: Boundary-clamped dropdown menus and cards preventing horizontal page overflow.
- Touch Optimization: Smooth momentum touch-scrolling with collapsible filter toolbars on small screens.

---

3. Upcoming Modules and Pipelines

Real Estate: Site Visit to Closing Pipeline

This pipeline guides property leads from initial telephone interest to site inspection, objection handling, and final unit booking.

Stage 1: Site Visit Plan
- Trigger: Lead in Call Tracker shows strong interest in a project or site location.
- Information Captured:
  * Preferred visit date and time slot.
  * Project or site location name.
  * Client specific requirements (budget bracket, unit preference: 1BHK, 2BHK, 3BHK, Villa, Bungalow, Flat, Plot).
  * Client remarks (e.g., location preferences, pickup requests).

Stage 2: Visit Organizer Assignment
- Assign responsible team members for the site visit:
  * Site visit manager or relationship manager (coordinates timing, sends location pin, manages logistics).
  * On-site sales representative (welcomes client, presents sample flats, layouts, and amenities).
  * Synchronization: Updates and reflects all assignments in the Call Tracker.

Stage 3: Visit Follow-up and Feedback
- Record visit completion status:
  * `Completed`: Client visited the site as scheduled.
  * `Rescheduled`: Client requested a revised date.
  * `Cancelled`: Visit cancelled prior to appointment.
  * `Did Not Show`: Client missed appointment without notice.
- Client interest rating: `High` | `Medium` | `Low`
- Feedback parameters:
  * Liked aspects: location, layout, amenities, price.
  * Client objections: price negotiation, layout changes, legal verification, loan approvals.

Stage 4: Closing and Deal Values
- Final deal parameters recorded upon sale closure:
  * Selected project phase, tower, and unit/flat/plot number.
  * Closing sales executive name.
  * Status: Marked as Closed / Won.

Key Terms (Real Estate):
- Site Visit Ratio: Percentage of total telecalled leads that complete a physical property visit.
- Sample Flat: A fully furnished demo flat built on-site to showcase layout, space, and finishes.
- Objection Logging: Systematically capturing client hesitations (price, bank loan, legal title) for structured resolution.
- Unit Booking: Formal inventory locking of a specific flat or plot against booking token payment.

---

Insurance and Mutual Funds: Advisory and Deal Pipeline

This pipeline handles financial advisory appointments, portfolio presentations, and policy issuance or folio allotment.

Stage 1: Meeting Date and Agenda
- Trigger: Lead indicates interest in life insurance, health insurance, or mutual fund investments.
- Information Captured:
  * Meeting date and time slot.
  * Meeting mode:
    * `In-Person Office`: Consultation at company branch.
    * `Home Visit`: In-person visit at client's home or office.
    * `Video Call`: Remote consultation via Google Meet with screen sharing.
    * `Phone Consultation`: In-depth phone consultation.
  * Advisory topic: Term Life, Health Coverage, Critical Illness, Child Education, Retirement Planning, SIP (Monthly), or Lump Sum (One-time).

Stage 2: Meeting Host and Responsible Person
- Assign certified financial advisor or relationship manager.
- Advisor dossier: Automatically populated with client profile, previous phone notes, investment budget, and declared health history.

Stage 3: Proposal Pitch
- Presentation collateral:
  * Fund return comparison charts, SIP calculators, and portfolio asset allocation models.
  * Policy benefits, premium tables, and sum assured comparisons.
- Meeting progress status:
  * `Proposal Presented`: Quotation and plan shared with client.
  * `Client Decision Pending`: Client evaluating proposal.

Stage 4: Deal Finalization
- Outcome status:
  * `Status YES (Deal Closed)`: Product name, policy or folio number, total premium or investment value, tenure (years), and KYC/document upload status.
  * `Status NO (Lost)`: Reason for drop-off recorded (premium high, competitor chosen, postponed, underwriting rejection).
  * `Status PENDING`: Specified next follow-up date and required action item (medical test, KYC pending).

Key Terms (Financial Products):
- Folio Number: Unique investor account number issued by Mutual Fund AMCs to track holdings.
- Policy Number: Unique legal identifier assigned to an active insurance policy.
- SIP (Systematic Investment Plan): Recurring monthly investment into targeted mutual fund schemes.
- Sum Assured: Guaranteed coverage payout provided by an insurance policy upon a claim.
- Tenure: Total active duration (in years) of the policy coverage or investment horizon.

---

Executive Dashboard and Lead Analytics

Dedicated executive cockpit for directors, partners, and senior managers to monitor company-wide lead flow, conversion rates, and revenue projections.

Key Features:
- End-to-End Funnel Visualization:
  Lead Generated -> Call Connected -> Site Visit / Advisory Meeting -> Proposal Sent -> Deal Closed
- Multi-Vertical Pipeline Tracker:
  * Real Estate: Total plots/flats booked and total pipeline value.
  * Insurance: Total active proposals and total annual premium value.
  * Mutual Funds: Total active SIPs count and total investment volume.
- Comparative Performance Analytics:
  * Team conversion rates per caller and per sales executive.
  * Average lead velocity: Average number of days taken from lead generation to deal closure.
- Automated Executive Reporting:
  * Daily Summary: Total calls made, visits conducted, proposals shared, and deals closed today.
  * Weekly Operations Digest: Pipeline health and pending visit follow-ups.
  * Monthly Board Report: Complete monthly sales volume, revenue growth, and team performance.

---

Operations Portal (Staff Tasks & Attendance)

Central operations hub for inter-departmental task coordination and workforce attendance tracking.
*(Note: Strictly focused on staff task workflows and daily attendance. Does NOT include payroll, salary calculations, or payment receipts).*

Team Task Management
- Task assignment with priority tags (`High`, `Medium`, `Low`) and due dates.
- Task tracking board (Kanban): `Pending`, `In Progress`, `Review`, `Completed`.
- Daily Work Reports (DWR): Team members submit a daily end-of-day summary of completed activities, client interactions, and hours worked.

HR and Staff Attendance
- Daily employee attendance register: Check-in time, Check-out time, Status (`Present`, `Half Day`, `Absent`, `On Leave`).
- Monthly attendance report: Aggregated view of monthly staff working days and attendance consistency.
- Employee directory: Internal directory documenting name, designation, department, and contact phone number.

---

WhatsApp and Email Communication

Direct customer communication embedded into lead cards, site visit forms, and deal modals.

WhatsApp Integration
- One-click WhatsApp message button next to customer phone numbers (launches chat directly).
- Pre-filled message templates:
  * Real Estate: Project brochure link, site location Google Maps link, site visit confirmation with date, time, and assigned manager contact.
  * Insurance / MF: Policy benefits summary, premium quotation, meeting reminder with agenda and Google Meet link.

Email Integration
- SMTP-based automated transactional emails.
- Automatic email notifications dispatched when site visits or advisory meetings are scheduled.
- Deal closing confirmation emails with summary details and document checklists.
