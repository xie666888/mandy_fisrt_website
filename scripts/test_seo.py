"""SEO regression tests against a temporary HTTP server and synthetic data."""
import http.client
import json
import re
import sqlite3
import sys
import threading
import unittest
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from scripts.submit_indexnow import changed_urls


class SeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = sqlite3.connect(':memory:', check_same_thread=False)
        cls.db.row_factory = sqlite3.Row
        cls.db.execute('''CREATE TABLE products (
            id TEXT PRIMARY KEY, sku TEXT, brand TEXT, name TEXT, category TEXT,
            price REAL, stock INTEGER, weight REAL, description TEXT,
            colors_json TEXT, image TEXT, images_json TEXT, published INTEGER,
            archived_at INTEGER, sort_order INTEGER, updated_at INTEGER,
            first_published_at INTEGER DEFAULT 0)''')
        cls.db.execute('CREATE TABLE orders(items_json TEXT)')
        cls.patch = patch.object(server, 'connect', return_value=cls.db)
        cls.patch.start()
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.CatalogHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.thread.join()
        cls.httpd.server_close()
        cls.patch.stop()
        cls.db.close()

    def setUp(self):
        self.db.execute('DELETE FROM products')
        for product_id, published, archived in [('sample', True, 0), ('draft', False, 0), ('archived', True, 1)]:
            server.upsert_product(self.db, dict(id=product_id, sku=product_id, brand='A & B', name='Gloss <special>',
                category='Lip', price=5.25, weight=.1, colors=['01', 'warm pink'],
                description='Size: 5cm. </script><script>bad()</script>', image='./src/assets/uploads/main.png',
                images=['./src/assets/uploads/detail.png'], published=published, archived_at=archived))
        self.db.execute("UPDATE products SET archived_at=1 WHERE id='archived'")
        self.db.commit()

    def request(self, path, method='GET'):
        connection = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=5)
        connection.request(method, path)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read().decode()
        connection.close()
        return result

    def test_home_has_real_public_product_and_collection_links(self):
        status, headers, body = self.request('/')
        self.assertEqual(status, 200)
        self.assertIn('/product/sample', body)
        self.assertNotIn('/product/draft', body)
        self.assertNotIn('/product/archived', body)
        self.assertIn('?brand=A+%26+B', body)
        self.assertIn('Gloss &lt;special&gt;', body)
        self.assertIn('$5.25', body)
        self.assertIn('replica products', body)
        self.assertEqual(headers['Cache-Control'], 'no-cache')

    def test_single_collection_self_canonical_and_unknown_404(self):
        status, _, body = self.request('/?brand=A+%26+B')
        self.assertEqual(status, 200)
        canonical = re.search(r'rel="canonical" href="([^"]+)"', body)[1]
        self.assertEqual(unescape(canonical), server.collection_url('brand', 'A & B'))
        self.assertIn('A &amp; B Wholesale Beauty Products', body)
        self.assertEqual(self.request('/?brand=missing')[0], 404)
        for path in ['/?brand=A+%26+B&category=Lip', '/?q=Gloss', '/?new=1', '/?sort=price']:
            self.assertIn('noindex,follow', self.request(path)[2])

    def test_product_schema_images_faq_shades_escaping_and_404(self):
        status, _, body = self.request('/product/sample')
        self.assertEqual(status, 200)
        data = [json.loads(value) for value in re.findall(r'<script type="application/ld\+json">(.*?)</script>', body, re.S)]
        product = next(value for value in data if value['@type'] == 'Product')
        self.assertEqual(product['offers']['price'], '5.25')
        self.assertEqual(len(product['image']), 2)
        self.assertTrue(all(image.startswith(server.PUBLIC_BASE_URL + '/src/') for image in product['image']))
        self.assertIn('<li>warm pink</li>', body)
        self.assertIn('Are these products authentic?', body)
        self.assertNotIn('<script>bad()', body)
        self.assertEqual(self.request('/product/draft')[0], 404)
        self.assertEqual(self.request('/product/archived')[0], 404)
        self.assertEqual(self.request('/product/missing')[0], 404)

    def test_sitemap_collections_details_and_no_private_rows(self):
        status, _, body = self.request('/sitemap.xml')
        self.assertEqual(status, 200)
        root = ET.fromstring(body)
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
        urls = [entry.text for entry in root.findall('s:url/s:loc', ns)]
        self.assertEqual(len(urls), 5)
        self.assertIn(server.PUBLIC_BASE_URL + '/ordering', urls)
        self.assertIn(server.collection_url('brand', 'A & B'), urls)
        self.assertEqual(len(root.findall('s:url/i:image', ns)), 2)
        self.assertNotIn('/product/draft', body)

    def test_head_redirects_discovery_ordering_and_private_files(self):
        status, headers, body = self.request('/', 'HEAD')
        self.assertEqual(status, 200)
        self.assertGreater(int(headers['Content-Length']), 0)
        self.assertEqual(body, '')
        self.assertEqual(self.request('/index.html')[0], 301)
        self.assertEqual(self.request('/ordering')[0], 200)
        self.assertIn('replica products', self.request('/ordering')[2])
        self.assertIn('/ordering)', self.request('/llms.txt')[2])
        self.assertIn('Disallow: /api/', self.request('/robots.txt')[2])
        self.assertEqual(self.request('/AGENTS.md')[0], 403)
        self.assertEqual(self.request('/deployment/seo/luxe-indexnow.service')[0], 403)

    def test_indexnow_notifies_only_changes_and_deletions(self):
        self.assertEqual(changed_urls({'a': '1', 'b': '1', 'd': '1'}, {'a': '1', 'b': '2', 'c': '3'}), ['b', 'c', 'd'])
        self.assertEqual(changed_urls({'a': '1'}, {'a': '1'}), [])


if __name__ == '__main__':
    unittest.main()
