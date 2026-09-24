# Module 25 — Professional Vendor Verification & Credential Validation

## Objective
Provide a secure, configurable, auditable verification system for vendors who want to sell construction materials through BuildSmart AI.

## Verification Workflow
```text
Vendor Registration
 → Identity Information
 → Business Information
 → Country / Business Type / Categories
 → Determine Required Evidence
 → Upload Documents
 → Automated Validation
 → Risk / Consistency Flags
 → Authorized Human Review
 → Approved / Correction Required / Rejected
 → Verified Vendor
```

## Required Evidence Categories

### Identity
- Government-issued national ID
- Passport or equivalent accepted identity document
- Authorized representative evidence where applicable

### Business
- Certificate of incorporation/registration
- Commercial registry extract
- Trade/business license
- Certificate of existence/good standing where applicable

### Tax & Regulatory
- Tax identification
- Tax registration/clearance where applicable
- VAT/GST registration where applicable

### Corporate
- Articles/Memorandum where applicable
- Authorized representative documentation

### Supplier/Product Evidence
Depending on category:
- Manufacturer authorization
- Distributor certificate
- Supplier agreement
- Product conformity/safety certificates
- Product origin documentation
- Warranty/quality certifications
- Authorized dealership evidence

### Address
Where required:
- Registration document showing address
- Utility bill
- Lease/rental agreement
- Local authority evidence

### Payment/Payout
Where applicable:
- Account-holder/business name
- Bank/payment account verification
- Mobile-money business account verification

Sensitive payment and identity information must never be public.

## International Support
Requirements must be configurable by country and business type. Support international credentials such as incorporation certificates, commercial registry extracts, good-standing certificates, VAT/GST evidence, import/export authorization, chamber-of-commerce evidence, and product conformity documents.

## Verification Levels
- `UNVERIFIED`
- `IDENTITY_VERIFIED`
- `BUSINESS_VERIFIED`
- `VERIFIED_VENDOR`
- Optional `TRUSTED_VENDOR`

## Verification Statuses
```text
DRAFT
SUBMITTED
DOCUMENTS_PENDING
UNDER_REVIEW
ADDITIONAL_INFORMATION_REQUIRED
IDENTITY_VERIFIED
BUSINESS_VERIFIED
FULLY_VERIFIED
REJECTED
EXPIRED
SUSPENDED
REVOKED
```

Backend-controlled status transitions are required.

## Automated Validation
```text
Upload
 → File Security Validation
 → Document Classification
 → OCR/Text Extraction
 → Field Extraction
 → Required Field Validation
 → Expiry Check
 → Identity/Business Consistency Check
 → Risk Flags
 → Human Review
```

AI may assist with OCR, classification, extraction, expiry detection, duplicate detection and consistency checking. High-impact decisions must support authorized human review.

## Vendor Dashboard
Display:
- Verification level/status
- Completed and missing requirements
- Document status
- Expiry dates
- Correction requests
- Resubmission
- Verification history

## Admin Dashboard
Authorized reviewers can:
- View vendor/business information
- Review documents
- Inspect extracted fields and flags
- Approve
- Reject
- Request additional evidence
- Mark documents invalid/expired
- Suspend/revoke verification
- Restore verification after review

All important actions must be audited.

## Public Badge
Show only a safe summary such as:

**Verified Vendor ✓**

Never expose:
- ID numbers
- Tax numbers
- Bank details
- Private documents
- Private residential information

## Suggested Data Model
```text
User
 └── VendorProfile
      ├── VendorBusiness
      ├── VendorVerification
      │    ├── VerificationRequirement
      │    ├── VerificationDocument
      │    ├── VerificationReview
      │    └── VerificationEvent
      ├── SupplierCredential
      ├── Product
      └── VendorPaymentAccount
```

## API Responsibilities
Implement secure operations for:
- Create verification application
- Get requirements
- Upload/list documents
- Submit application
- Get status
- Request correction
- Resubmit
- Admin review
- Approve/reject
- Suspend/revoke
- Get history

## Security
Implement:
- Private document storage
- Role-based access
- Encryption where appropriate
- Secure file uploads
- File type/size validation
- Malware scanning where available
- Access/audit logs
- Retention/deletion policies
- No public sensitive-document URLs
- No sensitive data in frontend logs/analytics

## Marketplace Integration
Example configurable rules:
```text
UNVERIFIED → Cannot publish products
IDENTITY VERIFIED → Limited functionality
BUSINESS VERIFIED → Product listing subject to platform rules
VERIFIED VENDOR → Full verified marketplace functionality
```

## Expiration & Renewal
Track expiry dates, notify vendors, request updates, recalculate verification, and restrict affected privileges where required.

## Correction & Appeal
```text
Correction Required / Rejected
 → Reason Provided
 → Vendor Corrects Evidence
 → Resubmission
 → New Review
```

Preserve previous verification history.

## Acceptance Criteria
The module is complete when vendor identity/business evidence can be securely submitted, validated, reviewed, approved/rejected, corrected, renewed, audited, and integrated with marketplace permissions and verified-vendor badges.

## AI-Agent Instructions
1. Inspect the existing codebase first.
2. Reuse existing authentication/user/file models.
3. Do not duplicate vendor/product/notification models.
4. Implement backend authorization and validation.
5. Store verification files privately.
6. Use configurable country/business-type requirements.
7. Implement vendor and admin verification interfaces.
8. Implement backend status transitions.
9. Add audit events.
10. Integrate status with marketplace permissions.
11. Add expiry notifications.
12. Support correction/resubmission.
13. Do not allow irreversible AI-only verification decisions.
14. Test approved, rejected, invalid, expired, resubmitted, suspended and revoked cases.
15. Preserve unrelated functionality.
