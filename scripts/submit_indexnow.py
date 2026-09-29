"""Notify IndexNow of changed public URLs; does not guarantee indexing."""
import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ORIGIN = 'https://bebeauty.top'
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


def changed_urls(previous, current):
    return sorted(url for url in set(previous) | set(current)
                  if url not in previous or url not in current or previous[url] != current[url])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir', type=Path, required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    key = (args.state_dir / 'indexnow.key').read_text().strip()
    if not re.fullmatch(r'[a-f0-9]{32,128}', key):
        raise SystemExit('Invalid IndexNow key')
    ledger = args.state_dir / 'submitted.json'
    previous = json.loads(ledger.read_text()) if ledger.exists() else {}
    request = Request(ORIGIN + '/sitemap.xml', headers={'User-Agent': 'BeBeauty-IndexNow/1.0'})
    with urlopen(request, timeout=60) as response:
        sitemap = ET.fromstring(response.read(10 * 1024 * 1024))
    current = {entry.findtext('s:loc', namespaces=NS): entry.findtext('s:lastmod', default='', namespaces=NS)
               for entry in sitemap.findall('s:url', NS)}
    for url in set(previous) | set(current):
        if not url or urlparse(url).scheme != 'https' or urlparse(url).netloc != 'bebeauty.top':
            raise SystemExit('Sitemap/ledger contains a non-canonical URL')
    changed = changed_urls(previous, current)
    if args.dry_run:
        print(f'{len(current)} public URLs; {len(changed)} new, updated or deleted URLs. No submission made.')
        return
    for start in range(0, len(changed), 10000):
        payload = {'host': 'bebeauty.top', 'key': key, 'keyLocation': ORIGIN + '/indexnow-key.txt',
                   'urlList': changed[start:start + 10000]}
        request = Request('https://api.indexnow.org/indexnow', data=json.dumps(payload).encode(),
                          headers={'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'BeBeauty-IndexNow/1.0'})
        with urlopen(request, timeout=60) as response:
            if response.status not in (200, 202):
                raise SystemExit(f'Unexpected IndexNow response: {response.status}')
            print(f'IndexNow accepted {len(payload["urlList"])} URLs (HTTP {response.status}); indexing is not guaranteed.')
    # Persist only after all submissions succeed; failures retry next run.
    temporary = ledger.with_suffix('.tmp')
    temporary.write_text(json.dumps(current, sort_keys=True), encoding='utf-8')
    os.replace(temporary, ledger)
    if not changed:
        print('No changed URLs; no IndexNow request sent.')


if __name__ == '__main__':
    main()
