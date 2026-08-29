# Idea Creation API Guide

## Issue Fixed
The idea creation endpoint was previously incomplete and not returning proper responses. This has now been fixed with two endpoints available.

---

## Option 1: Direct Idea Creation (Simple)
**Endpoint:** `POST /v1/ideas`  
**Authentication:** Required (JWT Bearer Token)

### Request Payload
```json
{
  "title": "AI Email Scrapper",
  "category": "AI & data",
  "description": "Testing this app",
  "mvp": "MVP description optional",
  "bid": 1
}
```

### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Example Response
```json
{
  "id": "idea_abc123xyz",
  "authorId": "user_123",
  "title": "AI Email Scrapper",
  "category": "AI & data",
  "description": "Testing this app",
  "mvpDetails": "MVP description optional",
  "status": "PENDING_PAYMENT",
  "currentBidCents": 100,
  "upvoteCount": 0,
  "createdAt": "2026-08-30T10:30:00.000Z",
  "updatedAt": "2026-08-30T10:30:00.000Z"
}
```

---

## Option 2: Create Idea with Payment Checkout
**Endpoint:** `POST /v1/payments/idea-checkout`  
**Authentication:** Required (JWT Bearer Token)

### Request Payload
```json
{
  "title": "AI Email Scrapper",
  "category": "AI & data",
  "description": "Testing this app",
  "mvp": "MVP description optional",
  "bid": 1,
  "ideaId": null
}
```

### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Example Response
```json
{
  "checkoutUrl": "https://test.dodopayments.com/checkout/session_123...",
  "sessionId": "session_abc123xyz"
}
```

This endpoint:
1. Creates an idea with status `PENDING_PAYMENT`
2. Creates an idea bid with amount in cents
3. Initiates a Dodo payment checkout session
4. Returns the checkout URL for the user to complete payment

---

## Valid Categories
```
- "Climate"
- "AI & data"
- "Health"
- "Future of work"
- "Consumer"
- "Education"
```

---

## Validation Rules

| Field | Rules |
|-------|-------|
| `title` | Max 80 characters |
| `description` | Max 500 characters |
| `category` | Must be one of the valid categories |
| `mvp` | Optional, max 1000 characters |
| `bid` | Integer, min 1, max 100,000 |

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Category must be a valid category",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 503 Service Unavailable (Dodo not configured)
```json
{
  "statusCode": 503,
  "message": "Payments are not configured. Set DODO_PAYMENTS_API_KEY and DODO_IDEA_BID_PRODUCT_ID.",
  "error": "Service Unavailable"
}
```

---

## Testing with cURL

### Create idea directly:
```bash
curl -X POST http://localhost:4000/v1/ideas \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Email Scrapper",
    "category": "AI & data",
    "description": "Testing this app",
    "mvp": "",
    "bid": 1
  }'
```

### Create idea with checkout:
```bash
curl -X POST http://localhost:4000/v1/payments/idea-checkout \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Email Scrapper",
    "category": "AI & data",
    "description": "Testing this app",
    "mvp": "",
    "bid": 1
  }'
```

---

## Changes Made

✅ **Fixed issues in `api/src/ideas.ts`:**
1. Added proper `POST /v1/ideas` endpoint for direct idea creation
2. Added `IdeasService.create()` method
3. Fixed and formatted the `PaymentsService.ideaCheckout()` method to properly return `checkoutUrl` and `sessionId`
4. Reformatted all minified code for readability and maintainability
5. Added comprehensive webhook handling for Dodo payment events

✅ **Build verified and passing**
- All TypeScript compilation successful
- All routes properly mapped
- Full end-to-end flow supported
