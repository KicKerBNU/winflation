---
name: diagnose-firestore-permission-denied
description: >
  Use this skill when a Firestore client-side write fails with
  "Missing or insufficient permissions" (or `permission-denied`), or when the
  user reports that saving something isn't working and the network call is
  silently rejected. Common in projects with multiple modules sharing one user
  doc (e.g. `users/{uid}`) where the deployed rule is field-restricted via
  `hasOnly([...])` and silently rejects newly-added fields. This skill walks
  through a structured diagnostic flow — auth state, doc path, write payload,
  deployed rule — and recommends the minimal rule change. Triggers: "save
  isn't working", "permission-denied", "insufficient permissions", "Firestore
  write fails", "the new field doesn't save".
---

# diagnose-firestore-permission-denied

Use this skill when a Firestore *client-side* write fails. It assumes Firebase
JS SDK (`firebase/firestore`), not admin SDK.

For server-side verification of script output (admin SDK), use the sibling
skill `verify-firestore-script-output` instead.

## When to invoke

- The user reports "save isn't working" / "the country isn't saving" / "the
  setting won't persist" and the failure is silent in the UI.
- Browser console shows `FirebaseError: Missing or insufficient permissions.`
  or `code: 'permission-denied'`.
- A `setDoc`, `updateDoc`, `addDoc`, or `deleteDoc` call rejects in production
  but works locally with rules emulator open.
- A write to a previously-working doc starts failing after a new field was
  added.

Do NOT invoke for:
- Read failures (`get`, `onSnapshot`) — usually a different rule branch; the
  same diagnostic flow applies but the fix is `allow read` not `allow write`.
- Server-side admin SDK errors — admin bypasses rules, so a permission error
  there means a service-account or doc-path issue, not rules.
- Authentication failures (`auth/...` errors). Those mean the user isn't
  signed in; this skill assumes they are.

## The most common cause

In any project where multiple modules share one user doc (typically
`users/{uid}`), a previously-deployed rule may use `hasOnly([...])` to
field-restrict writes:

```javascript
match /users/{uid} {
  allow read: if request.auth.uid == uid;
  allow write: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['followed', 'followedMeta']);   // ← only these fields
}
```

When a new module starts writing a different field (e.g. `taxCountryCode`),
the rule rejects it silently — `setDoc({merge: true})` returns a rejected
promise that the calling code may swallow with an empty catch.

This is the #1 cause of "permission-denied on a doc the user can read fine."

## Steps

### 1. Confirm the symptom

Ask the user (or check the console) for:
- The exact error message — is it `Missing or insufficient permissions` or
  something else? Other errors (network, quota, invalid argument) need
  different fixes.
- Which UI action triggered it.
- Whether *reading* the same doc works (e.g. does the rest of the page render
  data from that doc?). If reads work and writes don't, it's almost certainly
  a write-rule problem.

### 2. Improve error surfacing first

If the failure is silent in the UI, surface it before debugging — otherwise
each iteration requires the user to dig in DevTools.

In the calling code, change `catch {}` to:

```javascript
} catch (err) {
  console.error('[<feature>] Save failed:', err)
  errorDetail.value = err instanceof Error ? err.message : String(err)
  status.value = 'error'
}
```

And render `errorDetail` inline so the user sees the message without opening
DevTools.

### 3. Identify the four pieces of evidence

For the failing write, you need:

1. **Doc path** — the full path being written. Read the calling code:
   ```typescript
   doc(db, 'users', uid)            // → "users/{uid}"
   doc(db, 'orgs', orgId, 'members', memberId)  // → "orgs/{orgId}/members/{memberId}"
   ```
2. **Auth UID** — confirm `request.auth.uid` will resolve. Add a one-line
   check before the write:
   ```typescript
   if (!auth.user?.uid) throw new Error('Not authenticated.')
   ```
   Silent returns are bad — they make a permission error look like success.
3. **Write payload** — the exact fields being merged into the doc. From the
   calling code:
   ```typescript
   await setDoc(ref, { taxCountryCode, taxCountryUpdatedAt }, { merge: true })
   //                  ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
   //                  these are the keys the rule must allow
   ```
4. **Deployed rule** — ask the user to paste the rule for that doc from
   their Firebase console (Build → Firestore Database → Rules tab). If the
   repo has a `firestore.rules` file, read it directly — but the *deployed*
   rule is what matters. Console > repo file when they disagree.

### 4. Match the rule against the payload

Read the rule for the matching doc path. Look for these patterns and what
they imply:

- **`allow write: if request.auth.uid == uid`** — owner-only, no field
  restriction. If this is the deployed rule and the write still fails, the
  problem isn't the rule. Check auth state, doc path typos, or quota.

- **`allow write: if … && request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`**
  — field-restricted. Check whether every key in the write payload is in the
  `hasOnly` list. If even one is missing → that's the bug.

- **`allow write: if false`** — public/no-write collection. The write is
  intentionally rejected; calling code shouldn't be writing here.

- **No matching rule** — Firestore default-denies. Add a `match` block.

- **`allow create` vs `allow update`** — splitting these can let the user
  create the doc but not modify existing fields. Check whether the doc
  already exists.

### 5. Recommend the fix

For the field-restriction case (most common), there are two clean fixes:

**(a) Owner-only — recommended for non-sensitive per-user data:**

```javascript
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;
}
```

This is the simpler rule and standard for per-user profile docs. The user
can write any field on their own doc; nothing on anyone else's. An attacker
who already has the user's auth token can write extra fields, but they can
also read all the existing data — adding fields isn't a meaningful
escalation.

**(b) Expand the field allowlist — keep the defensive posture:**

```javascript
match /users/{uid} {
  allow read: if request.auth.uid == uid;
  allow write: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['followed', 'followedMeta', 'taxCountryCode', 'taxCountryUpdatedAt']);
}
```

Pick (b) when:
- The doc holds sensitive fields (payment info, admin flags) that no module
  should ever overwrite.
- The project explicitly wants every module to declare its fields up front.

Otherwise (a) is the simpler default.

### 6. Tell the user how to deploy

Rules are NOT auto-deployed unless the project has a `firebase.json` +
Firebase CLI in CI. For most projects:

1. https://console.firebase.google.com → select the project
2. **Build → Firestore Database → Rules** tab
3. Replace the relevant `match` block with the new rule
4. **Publish**

Once published, the user retries the failing action — no code redeploy
needed, the rule applies live.

### 7. Optionally version-control the rule

If the repo has no `firestore.rules` file, offer to create one at the repo
root with the new rule. It doesn't auto-deploy (Firebase CLI does that), but
it gives the rule a home next to the code that depends on it. Good
housekeeping.

## Output format for the user

Short and concrete. Example:

```
Confirmed: it's the Firestore rule.

Symptom: setDoc to users/{uid} with field `taxCountryCode` returns
permission-denied.

Cause: deployed rule restricts writes to ['followed', 'followedMeta'] only.
The new field is rejected silently.

Fix (owner-only — recommended):
  match /users/{uid} {
    allow read, write: if request.auth.uid == uid;
  }

Deploy via Firebase Console → Firestore → Rules → Publish.
After publishing, retry the save — should work immediately.
```

## Notes / edge cases

- **Cached rule evaluation**: Firestore evaluates rules per request, no
  caching. After Publishing, retry is immediate. If a write still fails 30
  seconds later, the rule didn't actually save (check for a yellow "Unsaved
  changes" banner in the console).
- **Emulator divergence**: if local writes succeed via the Firestore emulator
  but production fails, your `firestore.rules` file in the repo doesn't match
  the deployed rule. The emulator uses the file; production uses what was
  last published. Reconcile.
- **Multiple modules writing one doc**: the standard pattern in this project
  is `setDoc({merge: true})` from each module, owning its own field
  namespace. The rule must allow all of them. When adding a new module that
  writes per-user data, update the rule before merging.
- **Don't loosen rules to fix something else**: if the symptom is something
  other than permission-denied (e.g. invalid argument, quota), don't relax
  the rule — diagnose the real cause.
- **Hosted rule changes are immediate but the failing tab needs no reload**:
  Firestore SDK retries on permission-denied reads but not writes. The user
  just needs to click "Save" again after the rule is published.
