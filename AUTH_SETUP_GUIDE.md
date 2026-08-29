# IdeaBid Authentication Setup Guide

## Architecture Overview

```
┌─────────────────────────┐
│   Frontend Web App       │
│  (localhost:8080)       │
│  - HTML/CSS/JS          │
│  - Auth Modal           │
│  - Idea Board           │
└────────────┬────────────┘
             │ HTTP Requests
             │ API_URL: http://localhost:4000
             ↓
┌─────────────────────────┐
│   Backend API Server    │
│  (localhost:4000)       │
│  - NestJS Application   │
│  - Auth Routes          │
│  - Profile Routes       │
│  - Payment Routes       │
└────────────┬────────────┘
             │ Database Queries
             ↓
┌─────────────────────────┐
│   PostgreSQL Database   │
│  (localhost:5432)       │
│  - Users, Ideas, Bids   │
└─────────────────────────┘
```

---

## Required URLs

### Frontend Server
- **URL**: `http://localhost:8080`
- **Port**: 8080
- **Purpose**: Serves the web interface (HTML, CSS, JS)

### Backend API Server
- **URL**: `http://localhost:4000`
- **Port**: 4000 (from `.env` or default)
- **Purpose**: Handles authentication, ideas, payments

### Environment Configuration

All URLs are configured in [.env](.env):

```
WEB_ORIGIN=http://localhost:8080              # Frontend origin for CORS
DATABASE_URL=postgresql://storyverse:storyverse@localhost:5432/storyverse
REDIS_URL=redis://localhost:6379
```

---

## Step-by-Step Startup Instructions

### 1. Start Docker Services (Database, Redis, MinIO)

**Prerequisites:** Docker Desktop must be installed

```powershell
# Navigate to project root
cd A:\Project\IdeaBid-production-source

# Start all services in background
docker compose up -d

# Verify services started
docker compose ps
```

**Expected output:**
```
NAME        STATUS
postgres    Up
redis       Up
minio       Up
```

**Verify connections:**
```powershell
# Test Postgres
psql -h localhost -U storyverse -d storyverse -c "SELECT 1"

# Test Redis
redis-cli ping  # Should return PONG
```

---

### 2. Initialize Database (First Time Only)

```powershell
cd A:\Project\IdeaBid-production-source\api

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Verify migration
npx prisma db push
```

---

### 3. Install Dependencies

**Backend:**
```powershell
cd A:\Project\IdeaBid-production-source\api
npm install
```

**Frontend:**
```powershell
cd A:\Project\IdeaBid-production-source\web
npm install
```

---

### 4. Start Backend Server

**Terminal 1:**
```powershell
cd A:\Project\IdeaBid-production-source\api
npm run start:dev
```

**Expected output:**
```
[Nest] 12345  - 08/30/2026, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 08/30/2026, 10:30:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 08/30/2026, 10:30:01 AM     LOG [NestFactory] Nest application successfully started
Listening on port 4000
```

**Verify API is running:**
```powershell
Invoke-WebRequest -Uri http://localhost:4000/docs -Method GET
# Or open in browser: http://localhost:4000/docs
```

---

### 5. Start Frontend Server

**Terminal 2:**
```powershell
cd A:\Project\IdeaBid-production-source\web
npx http-server -p 8080 -c-1
```

**Expected output:**
```
Starting up http-server, serving .
Available on:
  http://127.0.0.1:8080
  http://localhost:8080
Press CTRL-C to stop the server
```

**Open in browser:**
```
http://localhost:8080
```

---

## Testing the Auth Flow

### 1. Verify Backend is Running

**Test API connectivity:**
```bash
curl -X GET http://localhost:4000/docs
# Should return Swagger UI HTML
```

### 2. Test Signup Endpoint

```bash
curl -X POST http://localhost:4000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "name": "Test User",
    "username": "test_user_001"
  }'
```

**Expected response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "onboardingCompleted": false,
  "user": {
    "id": "cuid_...",
    "email": "test@example.com",
    "name": "Test User",
    "username": "test_user_001",
    "subscriptionTier": "FREE"
  }
}
```

### 3. Test Signin Endpoint

```bash
curl -X POST http://localhost:4000/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### 4. Test Frontend Auth Modal

1. Open `http://localhost:8080` in your browser
2. Click "Sign up" button
3. Fill in form:
   - Email: `test@example.com`
   - Name: `Test User`
   - Password: `TestPass123`
4. Click "Create account"
5. Should see success toast and modal closes

---

## Common Issues & Fixes

### Issue: `ERR_CONNECTION_REFUSED` on frontend

**Cause:** Backend server is not running on port 4000

**Fix:**
1. Check if backend server is running: `npm run start:dev` in `api/` folder
2. Verify port 4000 is not already in use: `netstat -ano | findstr :4000`
3. Check firewall settings

### Issue: Database connection error

**Cause:** PostgreSQL is not running or DATABASE_URL is incorrect

**Fix:**
```powershell
# Verify Postgres is running
docker compose ps postgres

# Check connection string
echo $env:DATABASE_URL

# Restart database
docker compose restart postgres
```

### Issue: CORS errors in browser console

**Cause:** WEB_ORIGIN in .env doesn't match frontend URL

**Fix:**
```env
# If frontend is on different port, update:
WEB_ORIGIN=http://localhost:8080
```

### Issue: "Email already in use" on signup

**Cause:** Account already exists in database

**Fix:**
```powershell
# Use unique email for testing
# Or clear database and recreate:
docker compose exec postgres psql -U storyverse -d storyverse -c "DELETE FROM \"User\";"
```

---

## Environment Variables Checklist

✅ Required for auth:
- `JWT_ACCESS_SECRET=my-very-secret-access-token-key`
- `JWT_REFRESH_SECRET=my-very-secret-refresh-token-key`
- `WEB_ORIGIN=http://localhost:8080`
- `PORT=4000` (optional, defaults to 4000)

✅ Required for database:
- `DATABASE_URL=postgresql://storyverse:storyverse@localhost:5432/storyverse`

✅ Required for payments (if testing checkout):
- `DODO_PAYMENTS_API_KEY=your_key`
- `DODO_IDEA_BID_PRODUCT_ID=your_product_id`
- `DODO_PAYMENTS_WEBHOOK_KEY=your_webhook_key`

---

## Complete Auth Flow

1. **User opens frontend** → `http://localhost:8080`
2. **User clicks "Sign up"** → Auth modal opens
3. **User fills form** → Sends POST to `http://localhost:4000/v1/auth/signup`
4. **Backend validates** → Checks email/username uniqueness
5. **Backend creates user** → Hashes password with Argon2
6. **Backend generates tokens** → Returns accessToken + refreshToken
7. **Frontend stores tokens** → localStorage keys: `ideabid-access-token`, `ideabid-refresh-token`
8. **Frontend closes modal** → Shows success toast
9. **User can now** → Create ideas, upvote, and access protected routes

---

## File Locations

| File | Purpose |
|------|---------|
| [api/src/auth.ts](api/src/auth.ts) | Authentication service & controller |
| [api/src/profile.ts](api/src/profile.ts) | Profile creation & updates |
| [web/app.js](web/app.js) | Frontend auth modal logic |
| [web/index.html](web/index.html) | Auth modal HTML |
| [.env](.env) | Environment configuration |
| [api/src/main.ts](api/src/main.ts) | Backend server entry point |

---

## Debugging Tips

### Check backend logs
```powershell
# Monitor in real-time
cd A:\Project\IdeaBid-production-source\api
npm run start:dev
# Look for route initialization logs
```

### Check frontend network requests
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try signup
4. Look for POST to `/v1/auth/signup`
5. Check response tab for errors

### Test with Postman/Insomnia
- Import Swagger: `http://localhost:4000/docs`
- All auth endpoints are documented there

---

## Summary

| Component | URL | Status Check |
|-----------|-----|--------------|
| Frontend | `http://localhost:8080` | Open in browser |
| Backend API | `http://localhost:4000` | `curl http://localhost:4000/docs` |
| Database | `localhost:5432` | `docker compose ps` |
| Redis | `localhost:6379` | `redis-cli ping` |

All auth credentials and validation are in [api/src/auth.ts](api/src/auth.ts). The frontend sends requests to `API_URL` which is set in [web/app.js](web/app.js) line 1.
