"""Apply the minimal primary Nginx SEO change, validating before reload."""
import re
import shutil
import subprocess
import time
from pathlib import Path

config = Path('/etc/nginx/conf.d/luxe-catalog.conf')
original = config.read_text()
updated = original
if '# catalog-server-rendering' not in original:
    root_location = '''    location = / {
        # catalog-server-rendering
        limit_req zone=luxe_site burst=40 nodelay;
        proxy_pass http://127.0.0.1:4173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        include /etc/nginx/snippets/luxe-security-headers.conf;
    }'''
    updated, count = re.subn(r'    location = / \{.*?\n    \}', lambda _: root_location, updated, flags=re.S)
    if count != 1:
        raise SystemExit('Unexpected home location count; inspect config manually.')
    updated, count = re.subn(r'    location = /index\.html \{.*?\n    \}',
                            '    location = /index.html {\n        return 301 /$is_args$args;\n    }', updated, flags=re.S)
    if count != 1:
        raise SystemExit('Unexpected index location count; inspect config manually.')
    if updated.count('server_name _;') != 1:
        raise SystemExit('Unexpected default server; inspect config manually.')
    updated = updated.replace('server_name _;', '''server_name _;
    if ($host = www.bebeauty.top) { return 301 https://bebeauty.top$request_uri; }''')
    backup = Path('/var/backups/luxe-catalog') / f'nginx-before-seo-{int(time.time())}.conf'
    shutil.copy2(config, backup)
    config.write_text(updated)
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except subprocess.CalledProcessError:
        config.write_text(original)
        raise
print('Nginx catalog rendering configuration verified.')
