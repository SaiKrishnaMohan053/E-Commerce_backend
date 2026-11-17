# Domain module boundaries — Phase 1.2

These folders are deliberately documentation-only skeletons. Nothing is mounted in Express and no legacy persistence behavior changes.

When implementing a domain, use `api/` for HTTP adapters, `application/` for commands/use cases, `domain/` for business rules, `infrastructure/` for persistence/external adapters, and `index.js` as the *explicit public facade*. Create these subfolders only when needed.

Dependency rules:

1. `domain/` must be framework-agnostic; never import Express/Mongoose or infrastructure.
2. `application/` coordinates domain operations and injected ports; keep transport logic in `api/`.
3. `infrastructure/` implements persistence/provider ports; do not own business invariants.
4. Cross-module imports may target another module's root `index.js` only; never its internals. No module-to-module importing is necessary in Phase 1.2.
5. Shared infrastructure must be minimal and not become a dumping ground for business logic.
6. Keep existing `controllers/`, `models/`, `routes/`, `middleware/`, and `index.js` unchanged until individual migration steps have regression tests.
7. Preserve Phase 0 contracts: transactions and idempotency will be implemented later, not faked here.

The Jest architecture test guards manifest consistency, folder existence, internal cross-module imports and framework imports within future `domain/` JavaScript files. It is not a full dependency graph analyzer.
