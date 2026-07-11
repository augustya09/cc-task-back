# Collaborative Project & Task Management Backend

A backend for a collaborative project and task management system, built with Django REST Framework and PostgreSQL. Supports team-based collaboration with role-based access control (RBAC) across Teams, Projects, Tasks, and Comments.

## Tech Stack

- **Framework:** Django 6.0 + Django REST Framework
- **Database:** PostgreSQL 16 (via Docker)
- **Authentication:** JWT (djangorestframework-simplejwt) with refresh token blacklisting
- **Filtering:** django-filter
- **Containerization:** Docker + Docker Compose

## Features

- Email-based JWT authentication (signup, login, logout, token refresh)
- Team creation and membership management with four roles: Owner, Maintainer, Member, Viewer
- Role-based invite and role-change permissions
- Projects scoped to teams, with create/edit/delete restricted by role
- Tasks with status, priority, multi-user assignment, and role-scoped update permissions
- Comments open to all team roles, including Viewers
- Team activity log tracking key events (team created, member joined, invites, role changes)
- Search and filter on tasks (by title, status, priority) with pagination
- Centralized, structured error responses across the entire API

## Project Structure

```
task_manager/
├── apps/
│   ├── common/            # Shared BaseModel (UUID pk, timestamps) and the
│   │                       centralized DRF exception handler
│   ├── authentication/    # Custom User model, JWT auth, signup/login/logout
│   ├── teams/              # Team, Membership, ActivityLog models + RBAC logic
│   └── projects/          # Project, Task, Comment models + permissions
├── config/
│   ├── settings.py
│   └── urls.py
├── manage.py
├── requirements.txt
├── docker-compose.yml
├── .env.example
└── README.md
```

### Why this structure

Business logic is split into apps by domain (`authentication`, `teams`, `projects`), with `config/` reserved purely for project-level settings and routing. `apps/common/` holds cross-cutting infrastructure — the abstract `BaseModel` (UUID primary keys instead of sequential integers, to prevent resource enumeration) and the centralized exception handler used by every app — so it has no dependency on any domain app, avoiding circular imports.

## Setup Instructions

### Prerequisites
- Python 3.11+
- Docker Desktop (for PostgreSQL)

### 1. Clone and create a virtual environment

```bash
git clone <your-repo-url>
cd task_manager
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

`.env` requires:
```
DEBUG=True
SECRET_KEY=<your-secret-key>
DATABASE_URL=postgres://task_user:task_pass@localhost:5432/task_db
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 4. Start PostgreSQL via Docker

```bash
docker compose up -d db
```

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Run the development server

```bash
python manage.py runserver
```

The API is now available at `http://127.0.0.1:8000/`.

## Running Locally — Quick Verification

Once the server is running, confirm the setup with a signup request:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "TestPass123!"}'
```

A `201` response with the created user's `id`, `username`, and `email` confirms the database connection and core auth flow are working.

## API Overview

All endpoints are prefixed with `/api/v1/`.

### Authentication (`/api/v1/auth/`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup/` | Register a new user |
| POST | `/login/` | Log in, returns access + refresh tokens |
| POST | `/logout/` | Blacklist a refresh token |
| POST | `/token/refresh/` | Get a new access token from a refresh token |

### Teams (`/api/v1/teams/`)
| Method | Endpoint | Description | Required Role |
|---|---|---|---|
| POST | `/teams/` | Create a team (creator becomes Owner) | Any authenticated user |
| GET | `/teams/` | List teams the user belongs to | Any member |
| POST | `/teams/{id}/join/` | Join a team as a Member | Any authenticated user |
| POST | `/teams/{id}/invite/` | Invite a user by email | Owner, Maintainer |
| GET | `/teams/{id}/members/` | List members and roles | Any member |
| PATCH | `/teams/{id}/members/{user_id}/role/` | Change a member's role | Owner only |
| GET | `/teams/{id}/activity/` | View team activity log | Any member |

### Projects (`/api/v1/projects/`)
| Method | Endpoint | Description | Required Role |
|---|---|---|---|
| POST | `/projects/` | Create a project under a team | Owner, Maintainer |
| GET | `/projects/` | List accessible projects | Any member |
| PATCH / DELETE | `/projects/{id}/` | Edit or delete a project | Owner, Maintainer |

### Tasks (`/api/v1/tasks/`)
| Method | Endpoint | Description | Required Role |
|---|---|---|---|
| POST | `/tasks/` | Create a task | Owner, Maintainer, Member |
| GET | `/tasks/?status=&priority=&search=` | List/filter/search tasks | Any member |
| PATCH | `/tasks/{id}/` | Update task fields | Owner, Maintainer, or assigned Member |
| PATCH | `/tasks/{id}/` (with `assigned_to_ids`) | Reassign a task | Owner, Maintainer only |
| DELETE | `/tasks/{id}/` | Delete a task | Owner, Maintainer |

### Comments (`/api/v1/comments/`)
| Method | Endpoint | Description | Required Role |
|---|---|---|---|
| POST | `/comments/` | Add a comment to a task | Any team role, including Viewer |
| GET | `/comments/` | List accessible comments | Any member |

## Error Response Format

Every error response follows a consistent structure, produced by a centralized DRF exception handler:

```json
{
    "success": false,
    "message": "Validation Failed",
    "errors": {
        "email": ["Invalid email format."]
    }
}
```

## Role Permission Matrix

| Feature | Owner | Maintainer | Member | Viewer |
|---|---|---|---|---|
| View Team | ✅ | ✅ | ✅ | ✅ |
| Invite Members | ✅ | ✅ | ❌ | ❌ |
| Change Roles | ✅ | ❌ | ❌ | ❌ |
| Create Project | ✅ | ✅ | ❌ | ❌ |
| Edit/Delete Project | ✅ | ✅ | ❌ | ❌ |
| Create Task | ✅ | ✅ | ✅ | ❌ |
| Assign Task | ✅ | ✅ | ❌ | ❌ |
| Update Assigned Task | ✅ | ✅ | ✅ (own only) | ❌ |
| Delete Task | ✅ | ✅ | ❌ | ❌ |
| View Tasks | ✅ | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ✅ |

## API Documentation

A Postman collection covering all endpoints, including role-based positive and negative test cases, is available at `docs/Task_Manager_API.postman_collection.json`.

## Further Reading

See `ENGINEERING_DECISIONS.md` for the reasoning behind architectural choices, database design, authentication strategy, tradeoffs, and known limitations.