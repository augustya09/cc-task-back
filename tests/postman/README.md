# TaskFlow — Postman / Newman Test Integration

## How to export your Postman collection into this codebase

### Step 1 — Export your Collection
1. Open **Postman**
2. In the left sidebar, right-click your collection → **Export**
3. Choose **Collection v2.1** format
4. Save the file as `tests/postman/collection.json` inside this repo

### Step 2 — Export your Environment
1. In Postman, click the **Environments** tab (left sidebar)
2. Click the `⋮` menu next to your environment → **Export**
3. Save it as `tests/postman/environment.json` inside this repo

> ⚠️ **Do not commit real credentials.** Add `tests/postman/environment.json` to `.gitignore` if it contains passwords. Use `environment.example.json` as a safe template instead.

### Step 3 — Install Newman (one-time)
```bash
npm install --save-dev newman newman-reporter-htmlextra
```

### Step 4 — Run the collection
```bash
# Basic run
npx newman run tests/postman/collection.json -e tests/postman/environment.json

# With HTML report
npx newman run tests/postman/collection.json \
  -e tests/postman/environment.json \
  --reporters htmlextra \
  --reporter-htmlextra-export tests/postman/report.html
```

---

## Postman Environment Variables Mapping

These variables should exist in your Postman environment and map to the values below:

| Postman Variable | Value (local dev)               |
|------------------|---------------------------------|
| `base_url`       | `http://localhost:8000`         |
| `access_token`   | *(auto-set by login request)*   |
| `refresh_token`  | *(auto-set by login request)*   |
| `test_email`     | email of your test user         |
| `test_password`  | password of your test user      |

---

## Using Postman credentials in Django tests (pytest)

After exporting your environment, run:

```bash
python manage.py seed_test_users --env tests/postman/environment.json
```

This management command reads your Postman environment file and creates the test users in your database so all your Postman requests work immediately.

See `apps/common/management/commands/seed_test_users.py` for the implementation.
