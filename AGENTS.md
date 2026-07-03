# Luxe Trade Catalog - Agent Handover Guide

Read this file completely before changing, deploying, synchronizing, or
troubleshooting this project.

## 1. Source Of Truth And Release Topology

- Tencent Cloud (`43.166.137.208`) is the only production primary.
- The canonical production URL is `https://bebeauty.top/`; both
  `bebeauty.top` and `www.bebeauty.top` resolve to Tencent Cloud.
- GitHub (`xie666888/mandy_fisrt_website`) stores source code and operational
  documentation only.
- Alibaba Cloud (`101.132.36.115`) is the warm standby. Never edit products,
  images, the database, or application code there directly.
- Production changes flow in one direction:
  `local development -> GitHub -> Tencent Cloud -> rsync -> Alibaba Cloud`.
- Product/admin changes made on Tencent Cloud are copied to Alibaba Cloud by the
  automated sync. Never reverse this direction unless disaster recovery has
  been explicitly declared.
- Never synchronize a live SQLite database file with plain `rsync`. Create a
  consistent SQLite backup first, then transfer and atomically install it.
- Before enabling `luxe-replication.timer`, all active catalog/order entry
  points must lead to Tencent. A legacy domain may remain on Alibaba only when
  it redirects catalog traffic to `https://bebeauty.top/`; otherwise Alibaba
  could receive orders that the next replication would replace.

## 2. Secrets And Production Data

- Never commit or write passwords, session secrets, private SSH keys, `.env`
  files, database files, product images, customer orders, generated order
  workbooks, backups, or original catalog Excel files into Git.
- Server secrets live only in `/etc/luxe-catalog.env` with mode `0600`.
- SSH private keys remain under the operator's `~/.ssh` or the relevant server's
  `/root/.ssh`. This guide contains aliases and paths, never key contents.
- Do not replace a server environment file while deploying code.
- Do not copy local product data or images over production. Tencent production
  is authoritative.

## 3. Runtime Layout

Both cloud servers use the same application layout:

| Purpose | Path |
| --- | --- |
| Application source | `/opt/luxe-catalog` |
| Python virtual environment | `/opt/luxe-catalog/.venv` |
| SQLite database | `/var/lib/luxe-catalog/catalog.sqlite3` |
| Uploaded images/thumbnails | `/var/lib/luxe-catalog/uploads` |
| Environment file | `/etc/luxe-catalog.env` |
| Application service | `luxe-catalog.service` |
| Nginx configuration | `/etc/nginx/conf.d/luxe-catalog.conf` |
| TLS certificate chain | `/etc/nginx/ssl/bebeauty.top/fullchain.crt` |
| TLS private key | `/etc/nginx/ssl/bebeauty.top/private.key` |
| Daily backups | `/var/backups/luxe-catalog` |

The Python application listens only on `127.0.0.1:4173`. Nginx is the public
entry point. Do not expose port `4173`.

The current `bebeauty.top` certificate covers the root and `www` names and
expires on 2026-10-01. Renew and install its replacement before expiry. Never
commit or synchronize the certificate private key through Git or application
rsync. Keep `HTTPS=1` so admin session cookies retain the `Secure` flag.

## 4. Local And Server SSH

Recommended local aliases:

```text
ssh luxe-tencent
ssh luxe-alibaba
```

Tencent-to-Alibaba replication uses a dedicated key and the unprivileged
`luxesync` account. Alibaba-to-Tencent trust exists for diagnostics, but normal
replication is always Tencent to Alibaba.

Replication definitions are versioned in `deployment/replication/`. The
Tencent timer runs every 15 minutes after it is explicitly enabled. A manual
replication and verification must pass before enabling the timer.

Do not re-enable SSH password login. Do not weaken `AllowUsers`, Fail2ban,
firewall, login rate limiting, or the systemd sandbox to make a deployment
easier.

## 5. Application Architecture

- Backend: Python standard-library HTTP server in `server.py`.
- Database: SQLite with WAL-aware backup handling.
- Frontend: `index.html`, `src/app.js`, and `src/styles.css`.
- Spreadsheet output: `openpyxl`.
- Images: original-resolution files are preserved. Nginx serves product and
  uploaded images directly with long-lived cache headers.
- Authentication: server-side session cookies. Admin access must never return
  to a hard-coded browser password or local-only authentication.

## 6. Product And Admin Rules

- Catalog Excel import/export has been retired. Do not restore catalog import,
  catalog export, reset-from-Excel, or bulk replacement endpoints/UI.
- Order Excel download must remain available to authenticated administrators.
- Creating an order stores its items in SQLite and sends only the order number
  through WhatsApp.
- Product deletion means archive. Never physically delete the database row from
  normal admin operations. Archived products disappear from active listings.
- Products with similar names, SKUs, sizes, or images are still independent
  rows. Never deduplicate products by name, SKU, brand, image, or description.
- Required admin fields: SKU, Brand, Item, Price, Colors/shade options.
- Price and weight must be numeric and greater than zero. Their labels must show
  units.
- Brand input supports type-ahead selection from existing brands and creation
  of a genuinely new brand.
- Main image and each detail image are independently removable. Removing one
  thumbnail must never clear the entire image list.
- Image filenames may contain Chinese or other Unicode characters.
- Admin uploads should show lightweight thumbnails, not filesystem/URL path
  text fields.
- Admin product lists require search and pagination. Saving or archiving must
  give visible feedback near the action, not only at the top of a long page.

## 7. Storefront Behaviour

- Use Arial for storefront UI, admin UI, and every cell in generated order
  Excel files. Order workbooks must also set the Normal/default font to Arial
  and remove theme font schemes; otherwise Chinese Excel can display Songti
  even when populated cells report Arial.
- Color/shade options split only on `/`. Spaces and hyphens are literal content:
  `1/2/3` becomes three choices; `1-2-3` and `1 2 3` remain one choice.
- Size, gross weight, and net weight are product information, not selectable
  shade/type options.
- Add-to-cart must keep the customer on the current page and show a clear cart
  animation/confirmation. Navigation to the cart happens only from the cart
  control.
- Product images and related-product links must open the detail view at the top
  where selection and add-to-cart controls are visible.
- Product and media paths rendered by JavaScript must be root-relative
  (`/src/...`) or absolute. Never render stored `./src/...` paths unchanged on
  nested routes such as `/product/<id>`.
- Detail pages recommend other products from the same brand and category.
- Brand/category labels on product cards are clickable filters.
- Product cards have Quick Add, fixed image bounds, and preserve image aspect
  ratio without overflow.
- The header/search/cart area and the desktop brand sidebar remain usable while
  scrolling.
- Keep the product grid space-efficient. Do not restore the removed oversized
  hero/banner, price-range controls, or decorative top-right product blocks.
- Keep interfaces operational and compact: no nested cards, oversized
  marketing sections, or explanatory text that consumes product space.

## 8. Performance And Security Invariants

- Keep Nginx direct image serving, Gzip compression, open-file cache, immutable
  image caching, security headers, and API/login rate limits.
- Keep Fail2ban jails for SSH, forbidden-path scans, and Nginx rate-limit abuse.
- Keep the backend bound to localhost and retain firewalld.
- Preserve the application systemd hardening directives and automatic restart.
- Do not add Redis without measured evidence. The current workload is
  read-heavy, SQLite is small, and Nginx/browser caching removes most static I/O.
- Avoid returning full-size image bytes from API responses; APIs return paths.
- Do not lower original image resolution as a performance shortcut. Use browser
  sizing, lazy loading, thumbnails in admin, and caching.

## 9. SEO And GEO Invariants

- The canonical public origin is `https://bebeauty.top`.
- Every published product has a stable, crawlable
  `/product/<percent-encoded-product-id>` URL. Keep product IDs stable.
- `/sitemap.xml` is generated from published, non-archived SQLite rows and must
  contain the home page plus every public product.
- `/robots.txt` must reference the canonical sitemap and disallow `/api/`.
- `/llms.txt` provides concise, factual catalog and ordering context for
  generative search systems. Keep it aligned with the visible Q/A and actual
  business process.
- Product pages must retain server-rendered title, description, canonical,
  Open Graph tags, Product schema, Breadcrumb schema, FAQ schema, semantic H1,
  image alt text, and related product links.
- Product cards use real anchor URLs even though JavaScript enhances navigation.
- API responses retain `X-Robots-Tag: noindex, nofollow`.
- Never add fake reviews, ratings, inventory claims, authenticity claims,
  delivery guarantees, company addresses, or certifications to structured
  data. GEO content must remain specific, consistent, and verifiable.
- Archived or unpublished products must return `404` from their product URL and
  must not appear in the sitemap.

## 10. Safe Change Workflow

1. Read this guide and inspect `git status` before editing.
2. Work only on source/configuration files needed for the change.
3. Run syntax checks and focused tests locally.
4. Verify no secrets or production data are staged.
5. Commit and push code/documentation to GitHub.
6. Back up Tencent production before a risky schema or data change.
7. Deploy code to Tencent without replacing its database, uploads, environment
   file, or virtual environment.
8. Restart `luxe-catalog`, test Nginx, then verify storefront, admin login,
   product API, image loading, and order Excel.
9. Trigger or wait for Tencent-to-Alibaba synchronization.
10. Verify Alibaba database integrity, counts, images, service status, and a
    sample public request.

Manual replication and timer commands:

```text
sudo systemctl start luxe-replication.service
sudo systemctl status luxe-replication.service
sudo systemctl enable --now luxe-replication.timer
```

Never use `rsync --delete` against a computed or unverified path. Verify both
absolute source and destination paths first. Code sync may delete obsolete code
only inside `/opt/luxe-catalog`; data sync may delete obsolete uploaded images
only inside `/var/lib/luxe-catalog/uploads`.

## 11. Required Verification

For each release, check at minimum:

- Python syntax: `python -m py_compile server.py`
- SQLite: `PRAGMA integrity_check` returns `ok`
- Nginx: `sudo nginx -t`
- Services: `nginx`, `luxe-catalog`, `firewalld`, and `fail2ban` are active
- Public home and `/api/products` return HTTP `200`
- Backend port `4173` is not publicly reachable
- Admin login/session works
- Create/update/archive and multi-image upload/delete work independently
- Existing order Excel downloads successfully and every populated cell uses
  Arial; the workbook Normal style is Arial and `styles.xml` contains no theme
  font scheme
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and a sample `/product/...` URL
  return HTTP `200`
- Sitemap URL count equals published product count plus one home URL
- Product HTML contains canonical, Product JSON-LD and semantic product content
- Tencent and Alibaba product/order counts match after replication

## 12. Backup And Recovery

- Tencent creates a complete daily backup and retains the newest three.
- Backups include application source, uploads, a consistent SQLite snapshot,
  environment/service configuration, Nginx configuration, TLS certificate and
  private key, Fail2ban jail configuration, and replication units.
- Alibaba is a warm standby, not a substitute for versioned backups.
- Before restoring, validate the archive and database integrity. Stop the app,
  restore atomically, fix ownership to `luxe:luxe`, start the service, and run
  the verification checklist.
- In a disaster, explicitly promote Alibaba before accepting admin writes.
  Disable the normal Tencent-to-Alibaba timer while Alibaba is promoted.
