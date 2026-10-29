# mixa Test Store

A fake brand storefront to test the mixa **CSV integration** end to end:

1. **Catalogue CSV**: download a CSV from `/setup` (built from `data/products.csv`) and upload it in the mixa Brands portal. `destinationUrl` is rewritten to this store, so creator links land here.
2. **Website tracking**: the mixa SDK is loaded through **GTM** (or directly, never both). The header shows whether a click ID is saved.
3. **Orders, server to server**: Pay → signed `POST /v1/orders/webhook`. From `/orders` you can **Cancel** (`event: order.cancelled`), **Refund** (`event: order.refunded`) or **Resend**. Every call's request and response is saved and shown on the order page.

## Run

```bash
cp .env.example .env.local   # fill in brand ID, secret, GTM ID
npm install
npm run dev                  # http://localhost:3000
```

| Env | What |
| --- | --- |
| `SITE_URL` | Public URL of this store. Sent as `shopUrl`, used in the exported CSV. |
| `MIXA_BRAND_ID`, `MIXA_WEBHOOK_SECRET` | From onboarding. Server only. |
| `MIXA_WEBHOOK_URL` | Defaults to `https://api.mixa.global/v1/orders/webhook`. |
| `NEXT_PUBLIC_TRACKING_MODE` | `gtm`, `direct` or `none` (coupon only). |
| `NEXT_PUBLIC_GTM_ID` | GTM container. Add the mixa script as a Custom HTML tag, trigger All Pages (snippet on `/setup`). |
| `NEXT_PUBLIC_MIXA_BRAND_ID` | Only for `direct` mode. |

Creator links must reach this store, so for a real test `SITE_URL` must be public (ngrok / cloudflared tunnel or a deploy). Orders are kept in `data/orders.json`, which suits local testing and does not persist on serverless hosts.

## Test flow

1. `/setup` → download CSV → upload in the portal → creator adds a product and gets a link.
2. Open the creator link → header shows `click mx…`.
3. Add to cart → Pay (optionally with an active creator coupon).
4. `/orders/<number>` → check the webhook response (`200` = saved).
5. Cancel or refund from `/orders`, and check the response again.

The **Open fake creator link** button on `/setup` only checks that the script saves a click ID. mixa will not create commission for a click it never issued.

## Backend notes (be-apis, checked 29 Oct 2026)

- `shopUrl` is **required** by `assertWebhookOrderFields`, but the PDF guide does not list it. Without it the backend returns `400 Invalid order`. This store always sends it.
- `OrderEventDto` has **no `event` field**, and the ValidationPipe runs with `whitelist: true`, so `event: "order.cancelled"` is stripped. A cancel then looks like the same order again (idempotency key `wh_<brandId>_<orderNumber>`) and comes back as already received. Cancel and refund will not change commission until the backend handles them.
