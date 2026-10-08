# Anavrin

An online store for the Kenyan market with three connected portals: shoppers, delivery riders and admins. Everything updates in real time across all three.

- **Shoppers** browse the store, preview any item, check out with a phone number and directions for the rider (no street address), pay with M-Pesa or cash on delivery, follow their order live and confirm receipt.
- **Riders** apply through a hiring form. Once an admin hires them they get a dashboard with their delivery count, the buyer's name, phone (call, SMS, WhatsApp) and directions, plus buttons to start a delivery, confirm payment (M-Pesa code or cash) and mark it delivered.
- **Admins** get a dashboard for orders, users, riders, stock and transactions: confirm and assign orders, hire riders, restock, edit items and prices, change product images, and watch the stock table and every stock movement live.

There is one login page for everyone. The account's role decides where it lands.

## Run it

Requires **Node.js 22.13 or newer** (the database uses Node's built-in SQLite).

```bash
npm run setup          # installs root, server and client dependencies
cp server/.env.example server/.env   # then set your admin email and password
npm run dev            # API on :4000, store on http://localhost:5173
```

For production:

```bash
npm run build          # builds the storefront into client/dist
npm start              # serves the API, websockets and the built store on :4000
```

### Accounts

On first start the server creates:

| Role | Email | Password |
| --- | --- | --- |
| Admin | value of `ADMIN_EMAIL` (default `admin@anavrin.co.ke`) | value of `ADMIN_PASSWORD` (default `Admin@2026`) |
| Demo shopper | `customer@anavrin.co.ke` | `Customer@2026` |
| Demo rider | `rider@anavrin.co.ke` | `Rider@2026` |

Set `SEED_DEMO_USERS=false` to skip the demo accounts, and **change the admin password before going live**.

### Controlling who is an admin

Nobody can sign up as an admin. You can:

- promote or demote accounts from **Admin → People**, or
- run `npm run make-admin -- someone@example.com` (add a password to create a new admin account).

## How it fits together

```
client/   React + Vite + Tailwind storefront and portals (motion for animation, Recharts for charts)
server/   Express API + Socket.IO + SQLite (node:sqlite), JWT auth
  src/routes/auth.js      sign up, rider applications, single login
  src/routes/catalog.js   public products and categories
  src/routes/orders.js    checkout, order tracking, confirm receipt, cancel
  src/routes/rider.js     rider dashboard, accept, pick up, confirm payment, deliver
  src/routes/admin.js     overview, inventory, images, restock, orders, people, hiring, transactions
  src/realtime.js         socket rooms: admins, riders, and one per user
```

Order flow: **placed → confirmed (admin) → rider assigned → on the way → delivered (rider, after payment) → received (shopper)**. Stock is reserved at checkout and returned on cancellation; every change is logged in `stock_movements`.

Data lives in `server/data/` (SQLite database, uploaded images, generated token secret). Back this folder up.

## Design notes

- Silver-blue palette taken from the logo, with the berry purple used sparingly for deals and badges.
- Apple-style liquid glass navigation: a floating glass header and phone tab bar with a "water bubble" that glides to the active or hovered item. On Chromium browsers the glass also refracts what's behind it.
- Scroll-linked animation: a parallax hero, a category rail that moves sideways as you scroll, sections and products that reveal as they enter the screen, a progress bar, and animated transitions between pages. Motion is reduced automatically for people who turn on "reduce motion".
- Product card and liquid-glass styling adapted from 21st.dev components.

## Security

- Passwords hashed with bcrypt; role and account status are re-checked from the database on every request and socket connection.
- Login and sign-up are rate limited. Security headers and a Content-Security-Policy are set on the storefront.
- Image uploads are admin-only, limited to 5 MB, and stored with an extension derived from the image type.
- Riders only see a buyer's phone number and directions after accepting the delivery.
- Sessions use a bearer token stored in the browser. For a public launch, consider moving to an HTTP-only cookie, putting the app behind HTTPS (set `TRUST_PROXY=true` behind a proxy) and adding Safaricom Daraja (STK push) to confirm M-Pesa payments automatically instead of riders entering the code.
