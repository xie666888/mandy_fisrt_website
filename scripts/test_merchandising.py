"""Run with python scripts/test_merchandising.py; uses an isolated database."""
import json
import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class MerchandisingTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("""CREATE TABLE products (
            id TEXT PRIMARY KEY, sku TEXT, brand TEXT, name TEXT, category TEXT,
            price REAL, stock INTEGER, weight REAL, description TEXT,
            colors_json TEXT, image TEXT, images_json TEXT, published INTEGER,
            archived_at INTEGER, sort_order INTEGER, updated_at INTEGER,
            first_published_at INTEGER DEFAULT 0)""")
        self.db.execute("CREATE TABLE orders(items_json TEXT)")

    def tearDown(self):
        self.db.close()

    def product(self, product_id, **kwargs):
        return dict(id=product_id, sku=product_id, name="Same name", **kwargs)

    def test_first_publication_survives_edits_and_republishing(self):
        with patch.object(server, "now", return_value=100):
            server.upsert_product(self.db, self.product("a", published=False))
        self.assertEqual(self.db.execute("SELECT first_published_at FROM products").fetchone()[0], 0)
        with patch.object(server, "now", return_value=200):
            server.upsert_product(self.db, self.product("a"))
        with patch.object(server, "now", return_value=300):
            server.upsert_product(self.db, self.product("a", published=False))
            server.upsert_product(self.db, self.product("a"))
        self.assertEqual(self.db.execute("SELECT first_published_at FROM products").fetchone()[0], 200)
        self.db.execute("UPDATE products SET first_published_at=-1")
        server.upsert_product(self.db, self.product("a"))
        self.assertEqual(self.db.execute("SELECT first_published_at FROM products").fetchone()[0], -1)

    def test_top_ten_aggregates_shades_by_id_and_excludes_inactive(self):
        for index in range(12):
            server.upsert_product(self.db, self.product(str(index)))
            self.db.execute("INSERT INTO orders VALUES (?)", (json.dumps([
                {"id": str(index), "qty": index + 1, "color": "01"},
                {"id": str(index), "qty": index + 1, "color": "02"},
            ]),))
        self.db.execute("UPDATE products SET archived_at=1 WHERE id='11'")
        self.db.execute("INSERT INTO orders VALUES ('invalid')")
        self.assertEqual(server.best_seller_ids(self.db), {str(i) for i in range(1, 11)})


if __name__ == "__main__":
    unittest.main()
