# Security Specification - Codex AI

## Data Invariants
1. **Ownership**: All user-authored content (Universes, Projects, Chapters, Characters, etc.) must be owned by an authenticated user.
2. **Relational Integrity**: Sub-resources (Chapters, Characters, Lore) must reside under a valid Project, and their access is strictly derived from the Project's ownership.
3. **Immutable History**: `createdAt` timestamps must never be modified after creation.
4. **Monetization Integrity**: Wallets, Purchases, and Payouts are "System-Write-Only." Users can only read their own financial records.
5. **Public Catalog**: Writing to `published_works` or `published_chapters` is restricted to administrative processes or strictly validated automated syncs (system-side).

## The Dirty Dozen Payloads (Identity & Integrity Attack Vectors)

1. **The ID Hijack**: Attempting to create a Project with an `ownerId` that doesn't match the `request.auth.uid`.
2. **The Time Warp**: Sending a `createdAt` value from the future.
3. **The Ghost field**: Adding hidden metadata like `isAdmin: true` to a User profile update.
4. **The Orphan Write**: Creating a Chapter inside a Project ID that the user does not own.
5. **The Wallet Drain**: Attempting to `update` a Wallet's `balanceCoins` via the client SDK.
6. **The Negative Purchase**: Creating a Purchase document with a negative `amountCoins`.
7. **The Status Leap**: Updating a Payout's status from `pending` to `completed` directly from the client.
8. **The ID Poison**: Sending a 2KB string as a `projectId` to bypass ID filters.
9. **The Role Escalation**: Updating a Character's role to something restricted (if roles were enforced).
10. **The Content Injection**: Injecting script tags or excessive data into a Lore entry.
11. **The Version Shadow**: Attempting to write to a project version without owner permissions.
12. **The Purchase Spoof**: Manually creating a purchase record with an arbitrary Stripe session ID.

## Verification Checklist
- [ ] All `create` operations use `isValid[Entity]()`.
- [ ] All `update` operations use `affectedKeys().hasOnly()` to prevent shadow updates.
- [ ] Sub-collection access is guarded by `get(/.../projects/$(projectId)).data.ownerId`.
- [ ] `isValidId()` applied to document IDs.
- [ ] `isAdmin()` lookup is present for administrative actions.
