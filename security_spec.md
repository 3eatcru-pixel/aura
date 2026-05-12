# Security Specification for Lumen Scribe

## 1. Data Invariants
- A user can only access their own user profile.
- A project belongs to a single owner (the creator).
- Characters, Lore, Versions, Schedules, and ChatMessages are sub-resources of a Project and must inherit its access permissions.
- Only the owner of a project can read or write to it and its sub-resources.
- `ownerId` and `createdAt` are immutable after creation.
- All IDs must match `^[a-zA-Z0-9_\\-]+$`.

## 2. The Dirty Dozen Payloads (Attack Vectors)
1. **Identity Spoofing**: Attempt to create a project with another user's `ownerId`.
2. **Access Escalation**: User A attempts to read User B's project by ID.
3. **Sub-resource Leak**: User A attempts to add a character to User B's project.
4. **Immutability Breach**: Attempt to change the `ownerId` of an existing project.
5. **Timestamp Forge**: Attempt to set a future `createdAt` timestamp from the client.
6. **Shadow Fields**: Create a character with extra hidden fields like `isAdmin: true`.
7. **Orphaned Write**: Create a character sub-resource for a project ID that doesn't exist.
8. **Resource Exhaustion**: Send a 1MB string as a character name.
9. **Type Mismatch**: Send a boolean where a string (Project description) is expected.
10. **Global Read Attempt**: Attempt to list all projects in the database.
11. **ID Poisoning**: Use a 2KB string of special characters as a `projectId`.
12. **Status Skipping**: If we had statuses, attempting to jump from 'draft' to 'published' without proper validation.

## 3. Test Runner
(This would be implemented in `firestore.rules.test.ts` if a testing environment was provided. I will ensure the rules handle these cases.)
