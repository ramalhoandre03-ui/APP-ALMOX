# Security Specification & Threat Model (TDD)

## 1. Data Invariants

- **Master Gate Verification**: Only authorized clients can access the collections. Direct queries without App verification or unauthorized actors (e.g. non-admins requesting config modifications) are strictly forbidden.
- **`health_check`**: Open to reads and writes purely for validated applications (`request.app != null`) to ensure diagnostic availability without leaks to global non-app traffic.
- **`hub_logs` & `logs`**: Safe append-only structure. Valid applications can create log entries, but *cannot* update or delete them. Log reading is strictly permissioned to verified administrators (`ramalhoandre03@gmail.com`).
- **`config`**: Serves configuration payloads to valid clients. Read access is open to the app (`request.app != null`), but write operations (create, update, delete) are exclusively granted to authenticated administrators.
- **Temporal Integrity**: All incoming timestamp modifications on updates/creations must match the server timestamp (`request.time`).
- **Input Type Safety**: Id verification constraints are active; values for IDs must match strict regex patterns (`^[a-zA-Z0-9_\-]+$`) and must not exceed safe string length limits (128 characters).

---

## 2. The "Dirty Dozen" Rogue Payloads

The following payloads and request variations attempt to bypass system security, verify boundaries, and compromise the platform's integrity:

1. **Identity Spoofing - Non-Admin Writing Config**: A standard authenticated user attempts to write a customized site configuration.
2. **State Shortcutting - Modifying Completed Logs**: A client writes a log entry and subsequently tries to update the interaction's timestamp or action name to falsify active user tracking.
3. **Admin Privilege Escalation - Self-Assigned Role**: A standard user attempts to write to a hypothetical `users` role file to set their own role as an administrator.
4. **Denial of Wallet - Oversized Logs**: A malicious actor attempts to send a `status` or message of 10MB to crash storage quotas.
5. **ID Poisoning - Special Characters**: An attacker sends a configuration update targeting a path variable ID filled with junk characters or SQL injections.
6. **Bypassing App Check / Domain Constraint**: A Curl request from a foreign cloud environment tries to fetch data without App Check verification tokens.
7. **Bypassing Verification via Unverified Email**: An attacker authenticates using a fake Google Account with email `ramalhoandre03@gmail.com` but with `email_verified: false` to gain administrator status.
8. **PII Harvesting - Unauthorized Logs Scraping**: A standard user attempts to read all document events inside `hub_logs` using a blanket `list` query.
9. **Log Deletion / Evidence Tampering**: A user attempts to execute a `delete` operation on a log file to destroy evidence of unauthorized access.
10. **Timestamp Manipulation - Spoofed Past Date**: A user submits a log with a client-supplied past or future datetime instead of the authorized `serverTimestamp()`.
11. **Config Destructive Action**: A user attempts to wipe or clear the `/config` map collection.
12. **Health Check Poisoning**: A user tries to write a corrupt schema representation into the `health_check` table to trigger errors on diagnostic run.

---

## 3. Test Coverage Strategy

These vulnerabilities will be mitigated by the rules designed in `firestore.rules`.
Every allow condition strictly evaluates:
1. `request.app != null` (App Check constraint validating legitimate source application registration).
2. Email verification of the administrator.
3. Immutable logic validations for write-once / append-only collections (`hub_logs`, `logs`).
4. Strict bounds on input lengths and types using validation helpers.
