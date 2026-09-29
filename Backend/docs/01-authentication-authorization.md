# Module 01 — Authentication & Authorization

## Objective
Provide secure registration, login, logout, session management, password recovery, email verification, and role-based access control.

## Roles
- Client
- Architect
- Material Vendor
- Administrator

## Functional Requirements
- Register and validate user accounts.
- Authenticate users securely.
- Support logout and session expiration.
- Support password reset/change.
- Verify email addresses.
- Enforce role-based permissions.
- Redirect users to role-specific dashboards.
- Prevent unauthorized access to protected resources.

## Core Flow
Registration → Email Verification → Login → Session → Role Detection → Authorized Dashboard

## Dependencies
- Database
- User/Profile Management
- Security/Audit
- Notifications

## Acceptance Criteria
- Users can register and authenticate successfully.
- Protected routes reject unauthorized users.
- Each role sees only permitted functionality.
- Passwords are never stored in plaintext.
