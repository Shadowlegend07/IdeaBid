# Auth Flow Implementation Checklist

## Problem Diagnosis

Your error: `POST http://localhost:4000/v1/auth/signup net::ERR_CONNECTION_REFUSED`

**Root Cause:** Backend server is NOT running on port 4000

---

## Quick Fix (30 seconds)

### 1. Start Backend Server

**Terminal 1:**
```powershell
cd A:\Project\IdeaBid-production-source\api
npm run start:dev
```

✅ Wait for this message:
```
Listening on port 4000
```

### 2. Start Frontend Server

**Terminal 2:**
```powershell
cd A:\Project\IdeaBid-production-source\web
npx http-server -p 8080 -c-1
```

✅ Visit: `http://localhost:8080`

### 3. Test Signup

Click "Sign up" → Fill form → Click "Create account"

✅ Should succeed with success toast

---

## Required Services Checklist

Before running servers, ensure these are ready:

- [ ] **Docker Desktop running**
  ```powershell
  docker --version
  # Should return Docker version, not "not found"
  ```

- [ ] **Database container running**
  ```powershell
  docker compose ps postgres
  # Should show "postgres ... Up"
  ```

- [ ] **Redis container running**
  ```powershell
  docker compose ps redis
  # Should show "redis ... Up"
  ```

**If containers aren't running:**
```powershell
cd A:\Project\IdeaBid-production-source
docker compose up -d
docker compose ps  # Verify all are running
```

---

## Configuration Verification

### Backend Configuration

**File:** [.env](.env)

```env
DATABASE_URL=postgresql://storyverse:storyverse@localhost:5432/storyverse
WEB_ORIGIN=http://localhost:8080
JWT_ACCESS_SECRET=my-very-secret-access-token-key
JWT_REFRESH_SECRET=my-very-secret-refresh-token-key
```

✅ **Verify:** All values are present and correct

### Frontend Configuration

**File:** [web/app.js](web/app.js) Line 1

```javascript
const API_URL = window.IDEABID_API_URL || localStorage.getItem('ideabid-api-url') || 'http://localhost:4000';
```

✅ **Verify:** Defaults to `http://localhost:4000`

---

## Step-by-Step Setup

### Phase 1: Environment Setup (One time)

- [ ] **Install dependencies**
  ```powershell
  cd A:\Project\IdeaBid-production-source\api
  npm install
  
  cd A:\Project\IdeaBid-production-source\web
  npm install
  ```

- [ ] **Setup database**
  ```powershell
  cd A:\Project\IdeaBid-production-source\api
  npm run prisma:generate
  npm run prisma:migrate
  ```

- [ ] **Verify .env exists**
  ```powershell
  ls A:\Project\IdeaBid-production-source\.env
  # Should not error
  ```

### Phase 2: Service Startup (Every session)

- [ ] **Start Docker services**
  ```powershell
  cd A:\Project\IdeaBid-production-source
  docker compose up -d
  ```

- [ ] **Verify database connection**
  ```powershell
  psql -h localhost -U storyverse -d storyverse -c "SELECT 1"
  # Should return "1"
  ```

- [ ] **Start backend server** (Terminal 1)
  ```powershell
  cd A:\Project\IdeaBid-production-source\api
  npm run start:dev
  # Wait for "Listening on port 4000"
  ```

- [ ] **Start frontend server** (Terminal 2)
  ```powershell
  cd A:\Project\IdeaBid-production-source\web
  npx http-server -p 8080 -c-1
  ```

### Phase 3: Verification

- [ ] **Check backend is running**
  ```powershell
  curl http://localhost:4000/docs
  # Should return HTML (Swagger UI)
  ```

- [ ] **Check frontend is running**
  ```powershell
  curl http://localhost:8080
  # Should return HTML
  ```

- [ ] **Open in browser**
  - Navigate to: `http://localhost:8080`
  - Should load with header and idea list

- [ ] **Test auth modal**
  - Click "Sign up" button
  - Modal should appear
  - Fill form with:
    - Email: `test@example.com`
    - Name: `Test User`
    - Password: `TestPass123`
  - Click "Create account"
  - Should see success toast

---

## API Endpoint Reference

### Authentication Endpoints

**All endpoints located in:** [api/src/auth.ts](api/src/auth.ts)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/v1/auth/signup` | POST | No | Create new account |
| `/v1/auth/signin` | POST | No | Login existing account |
| `/v1/auth/register` | POST | No | Alias for signup |
| `/v1/auth/login` | POST | No | Alias for signin |
| `/v1/auth/refresh` | POST | No | Refresh access token |
| `/v1/auth/google` | POST | No | Google OAuth |
| `/v1/auth/onboarding` | POST | Yes | Complete onboarding |

### Profile Endpoints

**All endpoints located in:** [api/src/profile.ts](api/src/profile.ts)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/v1/profile/me` | GET | Yes | Get current user |
| `/v1/profile` | POST | Yes | Create profile |
| `/v1/profile/me` | POST | Yes | Update profile |

---

## Testing Auth Manually

### Test Signup via cURL

```bash
curl -X POST http://localhost:4000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "name": "Test User",
    "username": "test_user_123"
  }'
```

**Expected response:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "onboardingCompleted": false,
  "user": {
    "id": "cuid_...",
    "email": "test@example.com",
    "name": "Test User",
    "username": "test_user_123"
  }
}
```

### Test Signin via cURL

```bash
curl -X POST http://localhost:4000/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

---

## Error Troubleshooting

### Error: `ERR_CONNECTION_REFUSED`

**Cause:** Backend not running

**Solution:**
1. Open new terminal
2. Run: `npm run start:dev` in `api/` folder
3. Wait for "Listening on port 4000"
4. Retry signup in browser

### Error: `CORS error` in console

**Cause:** WEB_ORIGIN doesn't match frontend URL

**Solution:**
1. Check [.env](.env) has: `WEB_ORIGIN=http://localhost:8080`
2. If frontend is on different port, update WEB_ORIGIN
3. Restart backend: stop and `npm run start:dev` again

### Error: `Email already in use`

**Cause:** Account with that email exists

**Solution:**
- Use different email: `test2@example.com`
- Or clear database:
  ```powershell
  docker compose exec postgres psql -U storyverse -d storyverse -c "DELETE FROM \"User\";"
  ```

### Error: `Database connection failed`

**Cause:** PostgreSQL not running or DATABASE_URL incorrect

**Solution:**
```powershell
# Check if Postgres is running
docker compose ps postgres

# If not running, start it
docker compose up -d postgres

# Verify connection
psql -h localhost -U storyverse -d storyverse -c "SELECT 1"
```

### Error: `Invalid email or password` on signin

**Cause:** User doesn't exist or password is wrong

**Solution:**
1. Create account first via signup
2. Use exact same email and password
3. Check for typos (passwords are case-sensitive)

---

## File Locations & Responsibilities

| File | Responsibility |
|------|-----------------|
| [api/src/auth.ts](api/src/auth.ts) | Auth logic: signup, signin, validation |
| [api/src/profile.ts](api/src/profile.ts) | Profile creation & updates |
| [api/src/auth-profile.spec.ts](api/src/auth-profile.spec.ts) | Auth tests |
| [web/app.js](web/app.js) | Frontend auth modal & API calls |
| [web/index.html](web/index.html) | Auth modal HTML structure |
| [.env](.env) | Configuration: API ports, JWT secrets |
| [api/src/main.ts](api/src/main.ts) | Backend server startup & CORS |

---

## Deployment URLs

### Local Development (Your Machine)

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:8080 | 8080 |
| Backend API | http://localhost:4000 | 4000 |
| Swagger Docs | http://localhost:4000/docs | 4000 |
| Database | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

### Production (To be deployed later)

Update these when deploying to production:
- `WEB_ORIGIN` → production frontend URL
- `API_URL` in frontend → production backend URL
- `DATABASE_URL` → production database
- `JWT_*_SECRET` → strong secrets

---

## Recommended Testing Order

1. ✅ **Can I start the backend?** 
   - Run `npm run start:dev` in api/, see "Listening on port 4000"

2. ✅ **Can I reach the API?**
   - Open browser to `http://localhost:4000/docs`
   - Should show Swagger UI

3. ✅ **Can I start frontend?**
   - Run `npx http-server -p 8080` in web/
   - Open `http://localhost:8080` in browser

4. ✅ **Can I open auth modal?**
   - Click "Sign up" button
   - Modal should appear

5. ✅ **Can I create account?**
   - Fill signup form
   - Click "Create account"
   - Should see success toast

6. ✅ **Can I login with new account?**
   - Click "Log in" button
   - Use email and password from signup
   - Should see success toast

7. ✅ **Is token stored?**
   - Open browser DevTools (F12)
   - Go to Application → Local Storage
   - Should see `ideabid-access-token` and `ideabid-refresh-token`

---

## Next Steps After Auth Works

Once signup/signin works:

1. **Test profile creation** → POST `/v1/profile`
2. **Test idea creation** → POST `/v1/ideas`
3. **Test idea checkout** → POST `/v1/payments/idea-checkout`
4. **Deploy to production** → Update URLs and secrets

---

## Reference Documentation

- **Auth Setup:** [AUTH_SETUP_GUIDE.md](AUTH_SETUP_GUIDE.md)
- **Idea Creation:** [IDEA_CREATION_GUIDE.md](IDEA_CREATION_GUIDE.md)
- **Backend API:** [http://localhost:4000/docs](http://localhost:4000/docs) (when running)
- **Git Commits:** Check repository history for implementation details

---

## Support

If something doesn't work:

1. **Check the logs** → Look at both backend and frontend terminal
2. **Verify connectivity** → Can you reach `http://localhost:4000/docs` in browser?
3. **Check .env** → All required variables present?
4. **Test with cURL** → Try API directly: `curl http://localhost:4000/v1/auth/signup ...`
5. **Review errors** → Copy exact error message and search [AUTH_SETUP_GUIDE.md](AUTH_SETUP_GUIDE.md)

