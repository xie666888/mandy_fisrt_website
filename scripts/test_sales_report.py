import io
import io
import json
import sqlite3
import unittest

import server


class SalesReportTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(
            """
            CREATE TABLE products (
                id TEXT PRIMARY KEY,
                sku TEXT,
                brand TEXT,
                name TEXT,
                price REAL,
                image TEXT,
                published INTEGER,
                archived_at INTEGER
            );
            CREATE TABLE orders (
                order_no TEXT PRIMARY KEY,
                items_json TEXT,
                created_at INTEGER
            );
            INSERT INTO products VALUES
                ('p1', 'SKU-1', 'Brand A', 'Product A', 3.5, '', 1, 0),
                ('p2', 'SKU-2', 'Brand B', 'Product B', 5.0, '', 1, 0),
                ('p3', 'SKU-3', 'Brand C', 'Unsold product', 8.0, '', 1, 0);
            """
        )
        self.db.executemany(
            "INSERT INTO orders VALUES (?, ?, ?)",
            [
                ("O1", json.dumps([{"id": "p1", "qty": 2, "price": 3.5}]), 100),
                (
                    "O2",
                    json.dumps([
                        {"id": "p1", "qty": 3, "price": 4.0},
                        {"id": "p2", "qty": 8, "price": 5.0},
                    ]),
                    200,
                ),
                ("O3", json.dumps([{"id": "p2", "qty": 1, "price": 5.0}]), 300),
            ],
        )

    def tearDown(self):
        self.db.close()

    def test_units_orders_and_revenue_are_aggregated(self):
        rows = server.sales_report_rows(self.db)
        self.assertEqual([row["id"] for row in rows], ["p2", "p1"])
        self.assertEqual(rows[0]["units_sold"], 9)
        self.assertEqual(rows[0]["order_count"], 2)
        self.assertEqual(rows[0]["revenue"], 45.0)
        self.assertEqual(rows[1]["units_sold"], 5)
        self.assertEqual(rows[1]["order_count"], 2)
        self.assertEqual(rows[1]["revenue"], 19.0)
        all_rows = server.sales_report_rows(self.db, None, include_zero=True)
        self.assertEqual([row["id"] for row in all_rows], ["p2", "p1", "p3"])
        self.assertEqual(all_rows[2]["units_sold"], 0)
        brand_rows = server.sales_report_rows(self.db, None, include_zero=True, sort_by_brand=True)
        self.assertEqual([row["id"] for row in brand_rows], ["p1", "p2", "p3"])

    def test_report_workbook_has_expected_sheet_and_font(self):
        rows = server.sales_report_rows(self.db, None, include_zero=True, sort_by_brand=True)
        workbook_data = server.build_sales_report_workbook(rows)
        self.assertGreater(len(workbook_data), 0)
        from openpyxl import load_workbook

        workbook = load_workbook(io.BytesIO(workbook_data), read_only=False)
        sheet = workbook["All Products"]
        self.assertEqual(sheet["A1"].value, "All Products Sales Statistics")
        self.assertEqual(sheet["J6"].value, 5)
        self.assertEqual(sheet["I6"].value, 19)
        self.assertEqual(sheet["J8"].value, 0)
        self.assertEqual(sheet["J5"].value, "Units Sold")
        self.assertEqual(sheet["A1"].font.name, "Arial")
        self.assertEqual(sheet["H6"].font.name, "Arial")


if __name__ == "__main__":
    unittest.main()
