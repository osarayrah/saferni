---
name: Sync state compatibility
description: Rules for extending the per-user cross-device sync payload without losing existing app state.
---

Sync writes should preserve fields omitted by older clients, while explicitly supplied fields replace their stored values. New synced collections belong in their own top-level field rather than being mixed into trips or preferences.

**Why:** Web and mobile clients can be updated independently, and a legacy client must not erase newer saved data or preferences during a normal sync.

**How to apply:** When adding sync data, make the response include a safe empty default, accept the field as optional for compatibility, and merge omitted fields from the existing user row before writing.