# Mandy First Website

A lightweight wholesale cosmetics catalog with:

- Public product browsing, search, filters, product details, and cart
- Order-number creation and WhatsApp contact flow
- Password-protected product administration
- SQLite product and order storage
- Multiple product image uploads and thumbnails
- Order Excel generation for authenticated administrators

The public repository intentionally excludes production databases, product
catalog data, images, spreadsheets, backups, credentials, and server-specific
deployment configuration.

## Requirements

- Python 3.10+
- Packages listed in `requirements.txt`

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:ADMIN_PASSWORD = "choose-a-strong-local-password"
python server.py
```

Open `http://127.0.0.1:4173/`.

On first startup, `ADMIN_PASSWORD` is required to create the initial admin
account. The default username is `admin`; set `ADMIN_USERNAME` to change it.

## Runtime configuration

The server supports these environment variables:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Initial administrator username |
| `ADMIN_PASSWORD` | Initial administrator password |
| `CATALOG_DB` | SQLite database path |
| `UPLOAD_DIR` | Uploaded image directory |
| `WHATSAPP_NUMBER` | Default WhatsApp receiving number |
| `HOST` | Bind address |
| `PORT` | HTTP port |
| `TRUST_PROXY` | Trust reverse-proxy client IP headers when set to `1` |
| `HTTPS` | Add the Secure flag to session cookies when set to `1` |

## Private data

Create and maintain product data through the admin interface. Never commit
SQLite files, product exports, uploaded images, `.env` files, or production
credentials.
