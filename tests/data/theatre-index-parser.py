"""Synthetic directory fixtures; no network, account, or real-media access."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("indexer", Path(__file__).resolve().parents[2] / "scripts/theatre-index.py")
indexer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(indexer)


class DirectoryTests(unittest.TestCase):
    def test_open_culture_nested_groups_duplicates_and_collections(self):
        records = indexer.parse_oc('''<nav><li>Ignore navigation</li></nav>
          <div class="curatedcategory" id="Drama"><h2>Drama</h2><ul>
          <li><strong>Example</strong> — Editorial prose. <a href="https://archive.org/details/example">Free</a> (1940)</li>
          <li>3000 Free Films — Collection description (2020)</li></ul>
          <div class="curatedcategory" id="Animation"><h2>Animation</h2>
          <div class="curatedcategory"><ul>
          <li><strong>Example</strong> — Different prose. <a href="https://archive.org/details/example">Free</a> (1940)</li>
          <li>Drawn Short — Description. <a href="https://www.youtube.com/watch?v=abcdefghijk">Free</a> (1930)</li>
          </ul></div></div></div>''')
        self.assertEqual(len(records), 3)
        self.assertEqual(records[0]["title"], "Example")
        self.assertEqual(records[0]["genres"], ["animation", "comedy-drama"])
        self.assertEqual(records[0]["archiveId"], "example")
        self.assertEqual(records[1]["kind"], "collection")
        self.assertEqual(records[2]["genres"], ["animation"])
        self.assertEqual(records[2]["image"]["url"], "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")
        self.assertNotIn("description", records[0])

    def test_pdm_merges_categories_and_rejects_outside_links(self):
        records = indexer.parse_pdm('''<strong class="wsp-category-title">Horror</strong>
          <li class="wsp-post"><a href="https://publicdomainmovies.info/example/">Example (1930)</a></li>
          <strong class="wsp-category-title">Science Fiction</strong>
          <li class="wsp-post"><a href="https://publicdomainmovies.info/example/">Example (1930)</a></li>
          <li class="wsp-post"><a href="https://publicdomainmovies.info.evil.test/">Bad</a></li>''')
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["genres"], ["horror", "science-fiction"])
        self.assertEqual(records[0]["rights"]["status"], "public-domain-us")

    def test_missing_directory_fails_instead_of_empty_publication(self):
        for parser in (indexer.parse_oc, indexer.parse_pdm):
            with self.assertRaises(ValueError):
                parser("<html>Temporarily unavailable</html>")

    def test_rights_are_declarations_never_approvals(self):
        self.assertEqual(indexer.declared_rights("https://creativecommons.org.evil.test/licenses/by/4.0/")["status"], "unknown")
        self.assertEqual(indexer.declared_rights("https://creativecommons.org/licenses/by-nc-nd/4.0/")["status"], "cc")
        self.assertEqual(indexer.declared_rights(None, "Public Domain")["status"], "public-domain")
        record = indexer.normalize_ia({"identifier": "example", "title": "Example (1930)", "year": "2026", "licenseurl": "https://creativecommons.org/licenses/by/4.0/", "avg_rating": "NaN", "num_reviews": 1})
        self.assertEqual(record["year"], 1930)
        self.assertNotIn("reviewed", record)
        self.assertNotIn("rating", record)
        for url in ("http://127.0.0.1/a", "https://user:pass@archive.org/a", "https://archive.org:123/a", "javascript:alert(1)"):
            self.assertIsNone(indexer.safe_url(url))


if __name__ == "__main__":
    unittest.main()
