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

## Run it with Docker

Needs only [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows or Mac) or Docker Engine with the Compose plugin (Linux). Node.js isn't needed. The commands below work in PowerShell, Terminal and bash.

```powershell
cd $HOME                                   # not C:\Windows\System32
git clone -b anavrin-store https://github.com/s-rakim/anavrin2.0.git
cd anavrin2.0
cp server/.env.example server/.env         # then open server/.env and set your admin email and password
docker compose up -d --build
```

Open **http://localhost:8080**. The first build takes a few minutes. To use another port, copy `.env.example` to `.env` and change `ANAVRIN_PORT`.

| Task | Command |
| --- | --- |
| See the logs | `docker compose logs -f app` |
| Stop / start | `docker compose stop` / `docker compose start` |
| Apply changes to `server/.env` | `docker compose up -d` |
| Update to the latest code | `git pull`, then `docker compose up -d --build` |
| Make someone an admin | `docker compose exec app node scripts/make-admin.js someone@example.com` (add a password to create a new account) |
| Back up | `docker compose stop app`, `docker compose cp app:/data ./anavrin-backup`, `docker compose start app` |
| Restore a backup | `docker compose stop app`, `docker compose cp ./anavrin-backup/. app:/data`, `docker compose run --rm --no-deps -u root app chown -R node:node /data`, `docker compose start app` |

The database, uploaded product images and login secret live in the `anavrin-data` Docker volume. They survive restarts, rebuilds and `docker compose down`. **`docker compose down -v` deletes them.**

### Going live with HTTPS

Phones only share their location with HTTPS sites, so riders need HTTPS for live tracking. Phones on your Wi-Fi can open `http://<your computer's IP>:8080` to shop, but riders' GPS won't work that way.

To serve the store on your own domain, with free automatic certificates from Let's Encrypt (via the bundled [Caddy](https://caddyserver.com) container):

1. Point your domain's DNS (an `A` record) at the server's public IP, and open ports 80 and 443.
2. Copy `.env.example` to `.env` and set `DOMAIN=shop.example.co.ke`.
3. Run `docker compose --profile https up -d --build`.

The store is then at `https://shop.example.co.ke`. Also set `ANAVRIN_PORT=127.0.0.1:8080` in `.env`, so the plain-HTTP port isn't open to the internet. If you use a Google Maps key, add the domain to the key's allowed websites. Use the same `--profile https` on later `up` commands.

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
- run `npm run make-admin -- someone@example.com` (add a password to create a new admin account). Under Docker, use the command in the table above.

## Maps and live tracking

- **Checkout:** the shopper drops a pin on the map. They can search a place, tap the map, drag the red pin or use their phone's location. The pin is required and must be in Kenya.
- **Shopper tracking:** the shopper's home page shows the store, their pin and the rider moving live, with the route travelled so far, the distance and an approximate arrival time.
- **Riders:** while carrying an order, a rider's phone shares its GPS position (there's an on/off switch). Each delivery card shows a map and a **Navigate in Google Maps** button. It opens turn-by-turn directions in the Google Maps app, motorbike mode where Google offers it, going first to the store and then to the customer. Riders only see a rough area for a job until they accept it.
- **Privacy:**
  - Only the customer whose delivery is under way *right now* sees the rider live.
  - Customers waiting for pickup, or queued behind another drop-off, see "Your rider is finishing another delivery" and no location.
  - Riders carrying several orders pick which one they're heading to ("Deliver this one next").
  - A customer can't see the rider's route after their order is delivered.
  - Delivery trails are deleted 30 days after an order ends, and a rider's last position after 7 days.
- **Failed deliveries:**
  - A rider can mark an order **Couldn't deliver**, with a reason. The order goes back to the store and the pool.
  - Admins can cancel an unpaid order even while it's out for delivery; its stock is returned.
- **When the rider's location goes quiet** (phone locked, Google Maps app in front, weak signal), the customer sees "Rider's live location paused" with when they were last seen, not a stale arrival time.
- **Admins:** **Admin → Live map** shows every rider's position and every open order's pin. The order drawer shows the same live map for one order.

### Choosing a map

| Setting | What you get |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` set | Google Maps (current vector maps, Advanced Markers), Google place search and address lookup |
| Not set (default) | A free open map ([OpenFreeMap](https://openfreemap.org), OpenStreetMap data) with the same pins, lines and live tracking |

If the Google key is rejected (wrong key, billing off, site not allowed), every map switches to the open map automatically.

**Google setup:**
1. Create a key in Google Cloud.
2. Enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
3. Restrict the key to your website's address.
4. Optionally create a **Map ID** and set `GOOGLE_MAPS_MAP_ID`.

**Open-map search:** without a Google key, place search (for signed-in shoppers) uses the public OpenStreetMap Nominatim service through the server. Its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) allows one request per second for the whole app and no search-as-you-type. The server enforces both, caches results, and identifies itself with `NOMINATIM_CONTACT`. That is fine for testing and light use; for real traffic, add a Google key or point `NOMINATIM_URL` at your own geocoder.

**Things to know:**
- Phones only share location on **HTTPS** sites (or `localhost`).
- A web page can't track a rider in the background. Riders should keep the Anavrin page open, with the screen on, while delivering.
- Set the store's position with `STORE_LAT`, `STORE_LNG` and `STORE_NAME`.
- **Devices without WebGL2:** some older budget phones can't draw the open map. They get a "map can't be shown" panel, but search and "use my location" still work, and the pin becomes optional for them.
- **Security policy with Google Maps:** with a Google key set, the site's Content-Security-Policy allows only Google's Maps script hosts (no inline scripts). If a Google feature you enable later is blocked, set `CSP_GOOGLE_COMPAT=true` to use Google's full documented allowlist.
- **Google's terms:** pin addresses and coordinates that came from Google search or address lookup are cleared after 30 days, as the Google Maps Platform terms require.

## How it fits together

```
client/   React + Vite + Tailwind storefront and portals (motion for animation, Recharts for charts,
          Google Maps via @vis.gl/react-google-maps or MapLibre + OpenFreeMap)
server/   Express API + Socket.IO + SQLite (node:sqlite), JWT auth
  src/routes/auth.js      sign up, rider applications, single login
  src/routes/catalog.js   public products and categories
  src/routes/orders.js    checkout, order tracking, confirm receipt, cancel
  src/routes/rider.js     rider dashboard, accept, pick up, confirm payment, deliver
  src/routes/admin.js     overview, inventory, images, restock, orders, people, hiring, transactions
  src/realtime.js         socket rooms: admins, riders, and one per user
  src/tracking.js         rider GPS stream, delivery trails, admin fleet positions
  src/routes/geo.js       open-map place search proxy (Nominatim, rate limited and cached)
```

Order flow: **placed → confirmed (admin) → rider assigned → on the way → delivered (rider, after payment) → received (shopper)**. Stock is reserved at checkout and returned on cancellation; every change is logged in `stock_movements`.

Data lives in `server/data/` (SQLite database, uploaded images, generated token secret), or in the `anavrin-data` volume under Docker. Back it up.

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
- Sessions use a bearer token stored in the browser. For a public launch, consider moving to an HTTP-only cookie, putting the app behind HTTPS (behind a reverse proxy, set `TRUST_PROXY` to the proxy's address, or `true`; Docker Compose sets it for you) and adding Safaricom Daraja (STK push) to confirm M-Pesa payments automatically instead of riders entering the code.
