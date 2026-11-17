# Deferred issues register — maintained across subphases

**Rule:** Every subphase lists issues intentionally not fixed, their impact, and target owner. These are baseline findings, not proof of active exploitation. Reassess priority if impact increases.

| ID | Severity | Baseline issue (file / component) | Not fixed in 1.2 because | Target subphase |
|---|---|---|---|---|
| DEF-001 | Critical | Order number generated once per module load (`controllers/orderController.js`) | Order behavior outside module scaffold | Future order implementation; mitigate before accepting v2 orders |
| DEF-002 | Critical | Order save and legacy stock deductions are nontransactional (`controllers/orderController.js`) | Changing existing order semantics is out of scope | 1.6 infrastructure, then v2 orders/inventory |
| DEF-003 | High | Order silently truncates quantity (`controllers/orderController.js`) | Business flow change | v2 orders implementation |
| DEF-004 | High | Upload endpoint lacks authorization, explicit file size/type guards (`index.js`) | Requires security tests & permissions | 1.5 |
| DEF-005 | High | Weekly report trigger route is not protected (`routes/adminAlertsRoutes.js`) | Requires security tests | 1.5 |
| DEF-006 | High | Auth logs include bearer token on user-not-found (`middleware/authmiddleware.js`) | Requires security-focused modification | 1.5, prioritize early |
| DEF-007 | High | User profile mass-assignment and privileged field mutation risk (`controllers/userController.js`) | Requires security validation | 1.5 |
| DEF-008 | High | Rate-limit exemptions include sensitive API groups (`index.js`) | Requires traffic policy and tests | 1.5 |
| DEF-009 | Medium | API listen occurs before MongoDB connectivity established (`index.js`) | Startup lifecycle work | 1.3 |
| DEF-010 | Medium | Deprecated Mongoose connection options (`index.js`, `tests/setup.js`) | Config/test environment cleanup | 1.3 / 1.8 |
| DEF-011 | Medium | Cancellation typo `returnres` (`controllers/orderController.js`) | Legacy controller intentionally unchanged | Related order hardening; fix with regression test |
| DEF-012 | High | Backend npm audit: 48 findings (4 critical, 15 high) | Dependency upgrade not part of scaffolding | 1.3 triage / 1.5 remediation; release gate |
| DEF-013 | High | Frontend npm audit: 68 findings (4 critical, 40 high) | Frontend changes outside backend phase | Frontend dependency/security work; release gate |
| DEF-014 | Medium | Frontend CI build fails on 8 ESLint warnings | No frontend modification in backend skeleton | Frontend CI/build cleanup, before Phase 1 final verification |
| DEF-015 | Medium | No frontend tests; CRA reports no tests found | Frontend testing out of scope | 1.8 / frontend work |
| DEF-016 | Medium | MongoDB transaction tests absent; existing setup uses standalone memory server | Requires Unit of Work design | 1.6 / 1.8 |
| DEF-017 | Medium | CI GitHub Actions absent, Node versions unpinned | Infra and test workflow not 1.2 | 1.3 / 1.8 |
| DEF-018 | High | Physical count versus picking ordering ambiguity when no Start Picking | Needs business operating procedure at feature implementation | Inventory/fulfillment implementation |
| DEF-019 | Medium | Official WhatsApp group eligibility unverified | Provider integration excluded | Notifications implementation |
| DEF-020 | Medium | Actual Atlas backup/restore and clean v2 DB creation not executed | Requires environment and reset approval | Database migration work |

Open items remain **open** until implementation, focused tests, and reviewed evidence close them. A passing legacy test suite alone does not close security or inventory correctness issues.
