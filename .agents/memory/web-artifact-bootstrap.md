---
name: Web artifact bootstrap
description: Optional Replit Vite plugins may be scaffolded as catalog dependencies without matching root catalog entries.
---

When a generated React/Vite artifact cannot install because optional Replit Vite plugins reference missing workspace catalog entries, keep the app buildable by removing those dev-only plugins and their conditional config imports.

**Why:** The workspace install is shared across all packages, so one unresolved optional catalog entry blocks dependency installation and prevents otherwise valid frontend validation.

**How to apply:** Check the root catalog before adding scaffolded plugin dependencies; only retain plugins that resolve from the current workspace catalog.