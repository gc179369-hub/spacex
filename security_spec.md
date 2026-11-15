# SpaceX Firestore Security Specification

## 1. Data Invariants
1. All user profiles (`/users/{userId}`) and favorite subcollections (`/users/{userId}/favoriteCreators/{favId}`, `/users/{userId}/favoritePosts/{favId}`) are strictly private and readable/writable only by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. Anonymous/unauthenticated users cannot read or write any Firestore document.
3. Every favorite document must carry `uid == request.auth.uid` and `savedAt == request.time`.
4. All document IDs (`userId`, `favId`) must satisfy `isValidId()` (`^[a-zA-Z0-9_\-]+$`, length 1..128).
5. All string fields enforce explicit `.size()` boundaries matching `firebase-blueprint.json` to prevent resource exhaustion.
6. Updates to `UserProfile` strictly preserve `uid` and `createdAt`, allow only `['displayName', 'email', 'photoURL', 'updatedAt']`, and mandate `updatedAt == request.time`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated `get` on `/users/userA/favoriteCreators/patreon_1` -> `PERMISSION_DENIED`.
2. Cross-user `get` (`auth.uid = userB` reading `/users/userA`) -> `PERMISSION_DENIED`.
3. Cross-user `list` (`auth.uid = userB` listing `/users/userA/favoritePosts`) -> `PERMISSION_DENIED`.
4. Identity spoofing on create (`auth.uid = userA` writing `{ uid: 'userB' }`) -> `PERMISSION_DENIED`.
5. Unverified email (`email_verified: false`) writing favorite -> `PERMISSION_DENIED`.
6. Shadow field injection (`{ ...valid, isAdmin: true }`) -> `PERMISSION_DENIED` (`hasOnly` rejection).
7. Missing required field (`{ uid: 'userA', id: '1' }`) -> `PERMISSION_DENIED`.
8. Client-forged timestamp (`savedAt: '2020-01-01'`) -> `PERMISSION_DENIED` (`savedAt == request.time`).
9. Oversized string poisoning (`title` > 400 chars) -> `PERMISSION_DENIED`.
10. Invalid document ID (`favId = '../etc/passwd'` or > 128 chars) -> `PERMISSION_DENIED`.
11. Immutable `createdAt` tampering on `UserProfile` update -> `PERMISSION_DENIED`.
12. Unknown collection access (`/public/anything`) -> `PERMISSION_DENIED` (catch-all deny).
