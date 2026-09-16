# Sarvodaya Infracon — Business Flow Guide

## 1. What Is This System?

This is a **Lead-to-Order Management System** for Sarvodaya Infracon. It manages the complete journey of a customer — starting from the moment their contact is captured as a "lead," all the way through follow-up calls, business discussions, and finally the closing of a deal (booking, policy, or investment).

The company works across **three business lines (verticals)**:

1. **Real Estate** — selling flats, villas, bungalows, and plots.
2. **Insurance** — selling life insurance and health insurance policies.
3. **Mutual Fund** — helping customers invest through SIP (monthly) or lump sum (one-time) plans.

The system is built to handle all three businesses **in one place**, while still keeping each one's specific details separate and organized.

---

## 2. The Big Picture — End-to-End Flow

Think of the entire customer journey as one straight line:

```
New Lead Comes In
        ↓
Telecaller Calls the Customer (Follow-up)
        ↓
Call Outcome Marked as "Received" (Customer Agrees to Move Forward)
        ↓
Customer Becomes an Active Client
        ↓
Business-Specific Process Begins
   (Site Visit for Real Estate  /  Advisory Meeting for Insurance & Mutual Fund)
        ↓
Deal Gets Closed
   (Flat Booked  /  Policy Issued  /  Investment Folio Opened)
        ↓
Handed Over to Operations Team
```

**The most important rule in the whole system:**
👉 The moment a telecaller marks a call as **"Received"**, that lead is automatically upgraded into a real customer record, and it becomes eligible to move into the next stage (site visit or advisory meeting). Nothing needs to be done manually to move it forward — the system does this shift on its own.

---

## 4. PART B — What Happens Next (Upcoming Build)

Now that a lead can be captured, called, and marked "Received," the next phase of development handles **what happens after that** — turning an interested customer into a **closed deal**, differently for each business type.

---

### 4.1 Real Estate — From Site Visit to Final Booking

Once a real estate customer says "yes, I'm interested" (Received), this journey begins:

**Step 1 — Plan the Site Visit**
When a customer shows strong interest in a project or location, the team schedules a visit and records:
- Preferred date and time for the visit
- Which project or site the customer wants to see
- The customer's requirement again for reference (budget, 1BHK/2BHK/3BHK/Villa/Bungalow/Flat/Plot)
- Any special remarks from the customer (e.g., preferred locations, whether they need a pickup facility)

**Step 2 — Assign the People Who Will Handle the Visit**
Two roles are assigned to make the visit happen smoothly:
- A **Site Visit / Relationship Manager**, who coordinates timing, shares the location, and manages the overall logistics.
- An **On-Site Sales Representative**, who personally welcomes the customer at the site and shows them the sample flat, layout, and amenities.
- These assignments automatically reflect back in the Call Tracker, so everyone stays updated.

**Step 3 — Record What Happened During the Visit**
After the visit, the outcome is logged:
- **Completed** — customer visited as planned.
- **Rescheduled** — customer asked for a new date.
- **Cancelled** — the visit was called off.
- **Did Not Show** — customer did not turn up without informing.

The team also records:
- How interested the customer seemed: **High / Medium / Low**
- What the customer liked (location, layout, amenities, price)
- What objections or concerns they raised (price negotiation, changes to layout, legal verification needed, loan approval issues)

**Step 4 — Closing the Deal**
When the customer decides to buy, the final booking details are recorded:
- Which project phase, tower, and unit/flat/plot number they chose
- Which sales executive closed the deal
- The deal is marked as **Closed / Won**

**Key Terms — Real Estate**
- **Site Visit Ratio** — out of all the customers called, what percentage actually came for a physical site visit. This shows how effective the telecalling is at generating real interest.
- **Sample Flat** — a fully finished demo flat built on-site so customers can see exactly what their home will look and feel like.
- **Objection Logging** — noting down the specific hesitations a customer has (price, loan, legal papers), so the team can address them properly instead of losing the customer.

---

### 4.2 Insurance & Mutual Fund — From Advisory Meeting to Policy/Investment

Once an insurance or mutual fund customer says "yes, I'm interested" (Received), this journey begins:

**Step 1 — Fix the Meeting Date and Topic**
When a customer shows interest in life insurance, health insurance, or a mutual fund investment, a meeting is scheduled, capturing:
- Date and time of the meeting
- How the meeting will happen:
  - **In-Person Office** — customer comes to the branch.
  - **Home Visit** — advisor visits the customer's home or office.
  - **Video Call** — a remote meeting with screen sharing (e.g., Google Meet).
  - **Phone Consultation** — a detailed discussion over the phone.
- What the meeting is about: Term Life, Health Coverage, Critical Illness, Child Education, Retirement Planning, SIP (Monthly investment), or Lump Sum (One-time investment).

**Step 2 — Assign the Advisor**
A certified financial advisor or relationship manager is assigned to the customer. This advisor is automatically given the customer's full background — their profile, past call notes, budget, and any medical history they've shared — so they walk into the meeting fully prepared.

**Step 3 — Present the Proposal**
During the meeting, the advisor presents the offer using supporting materials such as:
- Investment return comparisons, SIP calculators, and portfolio breakdowns (for Mutual Funds)
- Policy benefits, premium details, and coverage comparisons (for Insurance)

The meeting's progress is tracked as:
- **Proposal Presented** — the plan and quotation have been shared with the customer.
- **Client Decision Pending** — the customer is still thinking it over.

**Step 4 — Final Outcome of the Deal**
Every meeting eventually reaches one of three results:
- **Status YES (Deal Closed)** — the product name, policy/folio number, total premium or investment amount, tenure (in years), and document/KYC status are all recorded.
- **Status NO (Lost)** — the reason the deal didn't happen is noted (premium too high, customer chose a competitor, postponed, or rejected during underwriting).
- **Status PENDING** — the next follow-up date is scheduled, along with what still needs to happen (e.g., a medical test or pending KYC documents).

**Key Terms — Insurance & Mutual Fund**
- **Folio Number** — a unique account number given by a Mutual Fund company to track a customer's investment holdings.
- **Policy Number** — a unique identification number given to an active insurance policy.
- **SIP (Systematic Investment Plan)** — a fixed amount the customer invests every month into a mutual fund, instead of investing a large amount all at once.
- **Sum Assured** — the guaranteed amount an insurance company will pay out if a claim is made.
- **Tenure** — how many years the policy or investment stays active.

---

### 4.3 Executive Dashboard — The Big-Picture View for Leadership

This is a special screen built for directors, partners, and senior managers — a bird's-eye view of the entire company's performance across all three businesses, without needing to dig into individual leads.

**What it shows:**

- **The Complete Funnel at a Glance:**
  ```
  Lead Generated → Call Connected → Site Visit / Advisory Meeting → Proposal Sent → Deal Closed
  ```
  This shows, at every stage, how many leads are moving forward and how many are dropping off.

- **Business-Wise Pipeline Summary:**
  - **Real Estate** — how many flats/plots have been booked so far, and the total value of the ongoing pipeline.
  - **Insurance** — how many active proposals are running, and the total annual premium value they represent.
  - **Mutual Fund** — how many SIPs are currently active, and the total amount invested through the system.

- **Performance Comparison:**
  - How each telecaller and each sales executive is performing compared to one another (conversion rates).
  - **Average Lead Velocity** — on average, how many days it takes for a lead to travel from "first contact" all the way to "deal closed." A lower number means faster conversions.

- **Automatic Reports for Leadership:**
  - **Daily Summary** — total calls made, visits done, proposals shared, and deals closed that day.
  - **Weekly Digest** — overall health of the pipeline and which visits/meetings are still pending.
  - **Monthly Board Report** — full monthly sales figures, growth compared to previous months, and team performance.

---

### 4.4 Operations Portal — Staff Tasks & Attendance

This is an internal hub purely for **coordinating daily staff work and tracking attendance** across departments.

*(Important: this portal is strictly limited to task management and attendance. It does not include payroll, salary calculation, or payment receipts.)*

**Team Task Management**
- Tasks can be assigned to staff with a priority level (**High / Medium / Low**) and a due date.
- A task tracking board shows the stage of every task: **Pending → In Progress → Review → Completed.**
- **Daily Work Report (DWR)** — every team member submits a short end-of-day summary of what they worked on, which clients they interacted with, and how many hours they worked.

**Staff Attendance**
- A daily attendance register records each employee's check-in time, check-out time, and status (**Present, Half Day, Absent, On Leave**).
- A monthly attendance report gives a combined view of how many days each employee worked and how consistent their attendance has been.
- An internal employee directory keeps each staff member's name, designation, department, and contact number on record.

---

### 4.5 WhatsApp & Email Communication

This adds direct customer communication straight from inside the lead's record, site visit form, or deal screen — no need to switch to a separate app.

**WhatsApp Integration**
- A one-click WhatsApp button next to every customer's phone number opens a chat with them directly.
- Ready-made message templates are available depending on the business:
  - **Real Estate** — sending the project brochure link, the site location on Google Maps, or a site visit confirmation with date, time, and the assigned manager's contact.
  - **Insurance / Mutual Fund** — sending a summary of policy benefits, the premium quotation.

**Email Integration**
- emails are sent to customers via the company's email system.
- An email is triggered whenever a site visit or advisory meeting is scheduled.
- When a deal is closed, a confirmation email is sent with a summary of the deal and a checklist of required documents.

---

## 5. Quick Summary — One-Page View

| Stage | What Happens | Who's Involved |
|---|---|---|
| 1. Lead Capture | New enquiry recorded under Real Estate / Insurance / Mutual Fund | Lead Receiver |
| 2. Telecalling | Follow-up calls made, outcome recorded | Telecaller |
| 3. "Received" | Customer confirms interest — auto-promoted to Customer Master | System (Automatic) |
| 4a. Real Estate Path | Site visit planned → conducted → feedback → unit booked | Visit Manager + Sales Executive |
| 4b. Insurance/MF Path | Advisory meeting planned → proposal presented → policy/folio issued | Financial Advisor |
| 5. Leadership View | Executive Dashboard shows company-wide performance | Directors / Senior Managers |
| 6. Internal Operations | Staff tasks and attendance tracked | HR / Team Leads |
| 7. Customer Touchpoints | WhatsApp & Email keep the customer informed at every step | Automated + Manual |

