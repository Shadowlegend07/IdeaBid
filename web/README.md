# IdeaBid web app

Open `index.html` for a complete responsive web preview. To connect it to the Nest API, set `window.IDEABID_API_URL` before `app.js` loads.

## Dodo Payments

Create a one-time $1 IdeaBid listing product in Dodo, then set `DODO_PAYMENTS_API_KEY`, `DODO_IDEA_BID_PRODUCT_ID`, and `DODO_PAYMENTS_WEBHOOK_KEY` on the API. Register the HTTPS webhook `https://api.your-domain.com/v1/payments/dodo/webhook`.

Checkout is created server-side; no payment secret is exposed to the browser. The API verifies webhook HMAC signatures, ignores duplicate events, and publishes an idea only after `payment.succeeded`.
