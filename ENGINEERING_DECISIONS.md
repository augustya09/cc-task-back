# Engineering Decisions

This document explains the choices I made while building this project, why I made them, the problems I ran into along the way, and what I'd do differently with more time. I'm relatively new to Django and backend development in general, so some of these decisions were learned the hard way — through actual bugs, not just reading docs beforehand.

## 1. Project Structure

I organized the project into separate Django apps by domain, instead of putting everything in one big app:

```
apps/
├── common/          # shared BaseModel and the error handler
├── authentication/  # custom User model, JWT login/signup/logout
├── teams/           # Team, Membership, ActivityLog
└── projects/        # Project, Task, Comment
```

I chose this because each app maps to one concept from the spec, so it's easy to find where something lives. `config/` only holds settings and root URL routing — no business logic — so it's obvious at a glance what's infrastructure and what's actual app code.

`apps/common/` exists because `Team`, `Project`, `Task`, and `User` all needed the same three fields (a UUID id, `created_at`, `updated_at`). Instead of repeating them in every model, I put them in one abstract `BaseModel` class that everything else inherits from.

I picked Django REST Framework because it comes with a lot of the CRUD/serialization/permission machinery built in (like `ModelViewSet` and `ModelSerializer`), which meant I could focus more on the actual business logic (roles, permissions) instead of writing repetitive boilerplate for every endpoint.

## 2. Database Design

I used a **UUID primary key** instead of Django's default auto-incrementing integer ID, on every model. My reasoning: if IDs are just 1, 2, 3..., anyone can guess `/api/tasks/4/`, `/api/tasks/5/` and potentially see data they shouldn't be poking around in. UUIDs make that much harder to guess.

**Entity relationships:**
- `Team` and `User` are connected through a `Membership` model, which also stores the person's `role` on that team. I needed this extra table (instead of a simple foreign key) because a user can belong to many teams, and a team has many users — a plain ManyToManyField wouldn't have let me also store the role for each person.
- `Project` belongs to one `Team` (ForeignKey).
- `Task` belongs to one `Project` (ForeignKey), and can be assigned to **multiple** users, so `assigned_to` is a ManyToManyField.
- `Comment` belongs to one `Task` and has one `author`.
- `ActivityLog` belongs to a `Team` and optionally a `User` (I used `SET_NULL` here instead of `CASCADE`, so if a user account is deleted later, we don't lose the historical log entries — they just lose the "who" attribution).

I didn't add any custom database indexes beyond what Django creates automatically for foreign keys and unique constraints. With more time, I'd look at adding an index on `Task.status` and `Task.priority` since those are the fields used for filtering, and filtering on an unindexed column gets slow as the table grows.

## 3. Authentication

I used **JWT (JSON Web Tokens)** instead of Django's default session-based authentication, using the `djangorestframework-simplejwt` package.

My reasoning: JWTs are stateless, meaning the server doesn't need to look anything up in the database just to check if someone is logged in — it just verifies the token's signature. This seemed like the right fit for an API meant to be used by different kinds of clients (not just a browser with cookies).

**Token strategy:** I used a short-lived access token (15 minutes) and a longer-lived refresh token (7 days), with `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` turned on. The idea is: if an access token gets stolen somehow, it's only useful for a short window. The refresh token is what actually gets revoked on logout (via the blacklist app), since JWTs by themselves can't normally be "cancelled" once issued.

**Security consideration I learned about while testing:** while running the server, I saw a warning:
```
InsecureKeyLengthWarning: The HMAC key is 23 bytes long, which is below the minimum recommended length of 32 bytes for SHA256.
```
This is because my local `SECRET_KEY` (used to sign the JWTs) is short. In a real production deployment, I'd generate a longer, cryptographically random secret key specifically for this, rather than reusing Django's default dev key.

## 4. Authorization (RBAC)

The spec asks for four roles per team — Owner, Maintainer, Member, Viewer — each with different permissions across Teams, Projects, Tasks, and Comments.

I implemented this in two different ways depending on the situation:

1. **For custom actions on Teams** (like `invite`, `change_role`), I manually look up the requester's `Membership` for that team and check their role directly inside the view function, before doing anything else.
2. **For Projects, Tasks, and Comments**, I wrote custom DRF `Permission` classes (`ProjectPermission`, `TaskPermission`, `CommentPermission`) that plug into each ViewSet, so the role-checking logic isn't scattered across every view.

One important thing I learned: DRF's `has_object_permission` only runs for actions on an *existing* object (like update or delete) — it does **not** run for `create`, since there's no object yet to check. I originally missed this, and it's actually the exact bug I found while reviewing an AI-generated example earlier in this project — its permission class always returned `True` from `has_permission`, meaning `create` was never actually protected at all. To avoid that mistake, I check permissions manually inside `perform_create()` for anything that needs role restrictions on creation (like "only Owner/Maintainer can create a Project").

I also added a more specific fix partway through: the spec separates "Assign Task" (Owner/Maintainer only) from "Update Assigned Task" (Member, only their own). Originally both went through the same `PATCH` request and field, which meant a Member could technically reassign a task to someone else. I fixed this by checking whether the incoming request specifically includes the `assigned_to_ids` field, and blocking that for Members even on tasks assigned to them.

## 5. Problems Faced

I ran into several real bugs while building and testing this, and I think they're worth being honest about rather than pretending the first version of everything worked:

- **Typos that don't crash immediately.** I misspelled `permission_classes` as `persmission_classes` on my signup view. Python didn't complain at all — it just silently created an unused attribute, and the view fell back to requiring authentication for signup, which obviously doesn't make sense (you can't be logged in before you've signed up). This one taught me that `python manage.py check` only catches syntax errors, not logic mistakes — the only way to catch this kind of bug is to actually test the endpoint.

- **Calling an attribute like a function.** I wrote `request.user()` instead of `request.user` in one place, which crashed with `TypeError: 'User' object is not callable`. Small syntax slip, but it stopped that whole endpoint from working.

- **Wrong enum casing.** I referenced `Membership.Role.Member` instead of `Membership.Role.MEMBER` — the actual constant is all uppercase, and Python doesn't know how to guess what I meant, so it raised an `AttributeError`.

- **A logic bug in `join`.** My `TeamViewSet.get_queryset()` only returns teams the user is *already* a member of, which makes sense for viewing/editing teams — but it broke the `join` action entirely, since obviously you're not a member yet when you're trying to join. I had to specifically bypass the queryset filter for `join` and look the team up directly by ID instead.

- **A serializer/view name mismatch.** I had a class named `ChangeRoleSerailiser` (typo) in `serializers.py`, but referenced `ChangeRoleSerializer` (correct spelling) in `views.py`. This caused an `ImportError` that crashed the entire app on startup, not just one endpoint — a good reminder that a single typo in one file can take down routes in a completely different file that depends on it.

- **JWT token expiry during testing.** Since access tokens only last 15 minutes, I kept hitting `401 Given token not valid for any token type` errors mid-testing session, especially while debugging something else for a while. I ended up building a `Refresh Token` request in Postman to quickly get a new access token without logging in again every time.

- **Leftover suspended server processes.** I used `Ctrl+Z` a few times to pause the `runserver` process instead of stopping it properly with `Ctrl+C`. This left multiple background processes running on different ports, which caused confusing `ECONNREFUSED` and "port already in use" errors that had nothing to do with my actual code. Lesson learned: always fully stop the server, or check `jobs` and `kill` leftover suspended ones.

## 6. Tradeoffs

- **JWT instead of Django sessions or full OAuth.** I went with JWT because it fit an API-first project better and didn't require setting up an external OAuth provider. The tradeoff is JWT is a bit more work to "revoke" (hence the blacklist app), whereas sessions handle that automatically.
- **PostgreSQL instead of a NoSQL database like MongoDB.** This data is very relational (Teams have Members have Roles, Projects belong to Teams, Tasks belong to Projects...), so a relational database with real foreign keys and constraints felt like a more natural fit than a document store.
- **Skipped Redis / caching.** I didn't add any caching layer. With the current scope and expected load, I don't think it's needed yet, and I didn't want to add infrastructure complexity I couldn't properly justify or test.
- **Skipped rate limiting and request logging.** Both were listed as optional "brownie points" in the spec. I focused my remaining time on making sure the core RBAC and CRUD functionality was actually correct and tested, rather than spreading myself across every optional feature.
- **Plain text `description` field on ActivityLog instead of a structured/generic system.** I could have built a more "proper" generic activity-tracking system (the kind that can log changes to any model automatically), but for the scope of this project, a simple `CharField` description written explicitly at each action (e.g., "Alice created the team") was easier to get right and easier to read directly from the database while debugging.

## 7. Future Improvements

If I had more time, I would add:
- Rate limiting on the auth endpoints specifically, since those are the most common target for abuse
- Fuzzy search on task titles (the spec mentions this as optional)
- Database indexes on `Task.status` and `Task.priority`
- A proper generated `SECRET_KEY` and stricter `CORS_ALLOW_ALL_ORIGINS` setting before any real production use
- More complete automated tests (I did most of my testing manually through Postman rather than writing Django's built-in test suite, which I'd want to add for long-term maintainability)
- Notifications when someone is assigned a task or mentioned in a comment