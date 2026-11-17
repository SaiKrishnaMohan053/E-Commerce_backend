# Users module

**Ownership:** User profiles and user-account administration; no implicit operational role elevation.

**Status:** planned only. No runtime integration or domain behavior implemented in Phase 1.2.

**Boundaries:** Keep HTTP adapters in `api/`, orchestration in `application/`, business rules in `domain/`, database/providers in `infrastructure/`, and expose only deliberate cross-module contracts through a root `index.js` once implementation begins.

**Compatibility:** Existing legacy routes and data models remain unchanged until an explicitly tested migration.
