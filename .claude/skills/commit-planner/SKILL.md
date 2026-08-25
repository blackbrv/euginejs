# Commit Message Template

All commit messages must follow this format:

```text
<type>: <short description>
```

Examples:

```text
Update: backend authentication method
Update: frontend login page
Fix: navbar mobile overflow
Refactor: extract payment validation service
Add: user onboarding flow
Docs: update installation guide
Chore: upgrade dependencies
```

---

# Commit Message Rules

## Description Requirements

Descriptions should:

- be short and specific
- describe the actual change
- mention the affected scope when possible
- avoid vague wording

Good:

- `Update: backend authentication method`
- `Update: frontend login page`
- `Fix: token refresh race condition`

Bad:

- `Update: auth`
- `Fix: bug`
- `Changes`
- `Update: stuff`

---

# Scope-Based Commit Separation

If backend and frontend changes can stand independently, separate them into different commits.

Example:

## Good

```text
Update: backend authentication method
Update: frontend login page
```

## Avoid

```text
Update: authentication system
```

unless both changes are tightly coupled and cannot function independently.

---

# Preferred Commit Types

| Type     | Usage                                          |
| -------- | ---------------------------------------------- |
| Update   | Existing feature improvements                  |
| Add      | New feature or functionality                   |
| Fix      | Bug fixes                                      |
| Refactor | Internal restructuring without behavior change |
| Remove   | Deleted features or dead code                  |
| Docs     | Documentation changes                          |
| Test     | Test-related updates                           |
| Chore    | Maintenance, tooling, dependencies             |

---

# Atomic Commit Rule

Each commit should ideally represent:

- one concern
- one feature scope
- one logical change

Avoid mixing:

- frontend + unrelated backend
- refactors + features
- formatting + functional changes
- dependency updates + feature work

---

# Important Notes

Don't do co-authored by with any of my commit, so all of this commit is will only by me, and you will not co-authored any of my commit. For some commit that need to be co-authored, add me as the co-authored commit.
