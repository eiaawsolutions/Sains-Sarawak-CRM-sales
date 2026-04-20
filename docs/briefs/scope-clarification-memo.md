# Scope Clarification Memo — SAINS Sarawak CRM Sales

**To:** SAINS Account Management & Business Development (Wellington Wee, Ronald Ng Yuan-Chang)
**From:** Claritas / EIAAW Solutions engineering team
**Date:** 2026-04-20
**Status:** **BLOCKER — scope lock required before implementation starts**
**Referenced artefacts:**
- `FSD_SAINS_v1.3_26122025 - signed by SAINS + Claritas.pdf` (signed contract baseline)
- `Lead _ Opportunity _ Quotation _ Customer.pdf` (workflow document)
- `SAINS To-Do Lists v3.xlsx` (in-flight clarifications)
- `MASTER Sains Data Mapping.xlsx` (field-level mapping)
- `SAINS Technical Requirement Document v1.0.pdf`
- `SAINS Integration API Document v1.2.pdf`
- `FIM2.0-Developer GuideV1.6.pdf`
- `LDAP Query API Developer Guide v1.0.pdf`

---

## 1. Why this memo

The signed FSD v1.3 describes a materially **leaner** system than the workflow PDF and to-do list v3 imply. We cannot begin implementation without SAINS resolving which is authoritative. This memo enumerates the 18 resolvable conflicts and requests written confirmation.

---

## 2. The foundational conflict

| FSD v1.3 (signed 26 Dec 2025) | Workflow PDF + To-Do v3 | Impact |
|---|---|---|
| No **Opportunity** module — "Leads represent business opportunities only" | Explicit **Create Opportunity** node between Lead and Quotation; v3 to-do renames Opportunity → **Sales Module** (R40) | Whether the data model has 1 (Lead) or 2 (Lead+Opportunity) top-level sales-pipeline entities |
| No **Lead → Customer conversion** — "CRM does not support conversion of leads into Customer (accounts) or contacts" | Explicit **"Convert Lead to Customer" → "Update Status to Won"** node in workflow | Whether Won quotations write back to CMD or not |
| No **email integration** — "CRM will not integrate with Zimbra or any email server, and no automated email dispatch" | To-Do v3 R15 offers Option 1: centralised CRM mailbox with primary/secondary + reply correlation via quotation reference | Weeks of effort and a Zimbra-side provisioning dependency |
| **Single-stage vetting**, not an approval matrix — "CRM does not support approval workflow routing or final approval processes" | To-Do v3 Notes sheet documents **4 approval routing scenarios** (AM→UH, AM→UH→SH, UH→SH, UH→SH→Director) | Whether we implement a threshold router or a full rules-based workflow engine |
| **6-state** Quotation lifecycle (Draft, Under Vetting, Approved, Quotation Sent, Closed, Rejected/Expired) | To-Do v3 Notes sheet lists **13 states** including parallel "Revision" track + WOT + AOQ + Accepted | Whether we use a single enum or an enum + `is_revision` + `parent_quotation_id` model |

**Our strong recommendation (Path B in our analysis):**
Ship the signed FSD v1.3 as v1.0. Defer the richer workflow scope to v1.1+ as a documented change order under Section 4 of the FSD ("Changes outside the project scope will be captured in a separate Scope Changes document, effective as of December 2025"). This preserves the contract and gives SAINS a clean milestone to budget the v1.1 upsell.

---

## 3. The 18 resolvable questions — please confirm in writing

### 3.A Scope boundaries (5 questions)

1. **Entity model.** Is the canonical customer entity (a) a single `Account` with `contact_type ∈ {Lead, Customer}` per the PDF, or (b) two tables `leads` and `accounts` with a `converted_to_account_id` FK per our Claritas proposal recorded in the mapping sheet R7?
2. **Opportunity vs Sales module.** Is "Opportunity" a distinct table between Lead and Quotation (per workflow PDF) or is it a *confidence-level* lifecycle flag on Lead (per to-do v3 R40 + Notes sheet)?
3. **Lead → Customer conversion.** If a quotation reaches `Closed` / Won, should the CRM write back to CMD to materialise the Account, or is CMD still the sole authority for Account creation?
4. **Email integration.** Option 1 (centralised CRM mailbox with reply correlation) OR Option 2 (manual download + personal-mailbox send, email out of CRM scope per FSD)? Our recommendation: Option 2 for v1.0 + Option 1 as v1.1 upsell.
5. **Quotation lifecycle canonical.** 6-state (mapping sheet) or 13-state with parallel Revision track (v3 Notes sheet)? Our recommendation: **6-state + `is_revision` boolean + `parent_quotation_id` self-FK** — preserves full revision history without enum explosion.

### 3.B Technology stack (5 questions)

6. **".NET Framework" literal.** Does the Tech Req doc mean (a) legacy **.NET Framework 4.8** specifically, or (b) is **.NET 8 (ASP.NET Core hosted in IIS via ANCM)** acceptable? We strongly recommend (b) — modern .NET is in active LTS, legacy Framework is in maintenance mode with no new features.
7. **UI framework.** Is **Blazor Server** acceptable, or must we use MVC + Razor / Razor Pages?
8. **Data access.** Is **Entity Framework Core** acceptable, or does SAINS mandate stored-procedure-only access to MSSQL?
9. **DEV environment.** The Tech Req doc names UAT + PROD only. Is there a DEV environment, or do we work locally and deploy to UAT?
10. **MSSQL collation.** Recommended collation (default `SQL_Latin1_General_CP1_CI_AS`)?

### 3.C Integration details (4 questions)

11. **Integration API credentials.** The client_id / secret_key / refresh_token printed in the Integration API v1.2 doc — are they **production-live** or sample values? If live, they must be rotated before CRM go-live and re-issued to the engineering team through a secure channel.
12. **Integration API idempotency.** On retry (same `organization_name`, different `id`), should the CRM (a) create a duplicate, (b) update in-place by name match, or (c) reject? Equally: on update, what is the matching key?
13. **Other `Module` / `SpKey` combinations.** The single documented endpoint `POST /SaveXml/124` with `Module=Account, SpKey=LeadData` suggests a generic dispatcher. Are other modules (Opportunity, Quotation, etc.) supported inbound, or is it Account-only?
14. **FIM 2.0 UAT domain.** The doc lists PROD `fim2.sarawak.gov.my`. What is the UAT/Staging FIM domain? We need separate `client_id`/`secret` per environment.

### 3.D Operational & compliance (4 questions)

15. **Approval thresholds (R13).** Numeric figures for the vetting threshold(s) — single global, per-section, or per-category?
16. **Running number cut-off.** The go-live seed value per agent + current volume (so the generator doesn't collide with SAINS' existing quotation numbers).
17. **A4 quotation header/footer template (R24).** PDF or DOCX of the approved template with logo, address, footer text.
18. **PDPA compliance posture.** Malaysia PDPA 2010 — who is the Data Controller (SAINS) and who is the Data Processor (Claritas)? We need the Data Processing Agreement (DPA) signed before handling any live CMD data in UAT.

---

## 4. Critical security finding (action required)

The Integration API v1.2 document prints these values verbatim:

- Client ID: `15D5A24B3CFA46096ADD0B3BA10551A938E0AE51`
- Secret Key: `115209B9F44E0F0F535C261F3736255072D851DD`
- Refresh Token: `DA2B5879BFCBA0EF4433CC2B4606BCD6F2BAE8C38764049855BB0299ECF1D943`

Regardless of whether these are live or samples, **they have been distributed in a document marked CONFIDENTIAL to at least two vendor organisations (Claritas + EIAAW)**. Our recommendation:

1. **Rotate all three before 2026-04-30.**
2. **Issue replacement credentials per-environment** (UAT ≠ PROD).
3. **Deliver replacements via secure channel** (SAINS-provisioned secret vault, not email/doc).
4. Establish a **90-day rotation policy** with tooling, not tickets.

---

## 5. What we need to proceed

- **Written confirmation** of Q1–Q18 above (one page, signed by SAINS Unit Head — Wellington Wee or Ronald Ng Yuan-Chang)
- **Credentials rotation** per §4 (separate email with new credentials via secure channel)
- **Data Processing Agreement** signed (PDPA 2010)
- **Kick-off meeting** to walk through Path A vs Path B vs Path C (see [`crm-brief.md`](crm-brief.md) §3)

Target date for all of the above: **2026-05-02**. Every day beyond this is one day of schedule risk on the 3–4 month delivery.

---

*Signed by the Claritas + EIAAW engineering team.*
