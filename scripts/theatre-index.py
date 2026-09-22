#!/usr/bin/env python3
"""Index public film directory facts; never download or auto-approve film media.

Python standard library + curl. Cached responses stay outside the repository.
The generated catalog contains facts, source links and declared rights, not the
publishers' editorial descriptions. Source failures never replace a good index.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import time
import unicodedata
from urllib.parse import urlencode, urlparse, unquote, parse_qs

ROOT = Path(__file__).resolve().parents[1]
IA_QUERY = "collection:(feature_films) AND mediatype:(movies)"
IA_FIELDS = "identifier,title,year,date,creator,genre,subject,licenseurl,rights,avg_rating,num_reviews,downloads,language"
OC_URL = "https://www.openculture.com/freemoviesonline"
PDM_URL = "https://publicdomainmovies.info/all-movies/"
GENRES = {
    "horror": r"\bhorror\b|\bterror\b",
    "science-fiction": r"\bsci[ -]?fi\b|science fiction|\bfantascienza\b",
    "noir": r"\bnoir\b",
    "comedy": r"\bcomed(?:y|ies|ia)\b|slapstick",
    "drama": r"\bdrama\b|\bdramas\b",
    "documentary": r"documentar(?:y|ies|io)|\bnonfiction\b",
    "animation": r"animat(?:ion|ed)|cartoon",
    "western": r"\bwestern(?:s)?\b",
    "thriller": r"\bthriller(?:s)?\b|suspense",
    "action": r"\baction\b|martial arts|kung fu",
    "adventure": r"\badventure(?:s)?\b",
    "fantasy": r"\bfantasy\b",
    "romance": r"\bromance\b|romantic",
    "musical": r"\bmusical(?:s)?\b",
    "war": r"\bwar\b|propaganda",
    "silent": r"\bsilent\b",
}


def clean(value, limit=240):
    value = html.unescape(str(value or "")).replace("\u00ad", "")
    value = re.sub(r"<[^>]*>", " ", value)
    value = re.sub(r"[\x00-\x1f\u202a-\u202e\u2066-\u2069]", " ", value)
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()[:limit]


def values(value):
    return value if isinstance(value, list) else [value] if value else []


def safe_url(value, hosts=None):
    value = html.unescape(str(value or "")).strip()
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or not host or parsed.username or parsed.password or parsed.port:
        return None
    if hosts and host not in hosts:
        return None
    if host in ("localhost", "0.0.0.0", "127.0.0.1", "::1") or host.endswith((".local", ".internal")):
        return None
    if re.fullmatch(r"[\d.]+", host) or ":" in host:
        return None
    return parsed._replace(scheme="https", fragment=parsed.fragment[:160]).geturl()


def archive_id(value):
    url = safe_url(value, {"archive.org", "www.archive.org"})
    match = re.match(r"/(?:details|embed|download)/([^/?#]+)", urlparse(url).path) if url else None
    identifier = unquote(match[1]) if match else ""
    return identifier if re.fullmatch(r"[A-Za-z0-9_.-]{1,200}", identifier) else None


def categories(text):
    result = [key for key, pattern in GENRES.items() if re.search(pattern, clean(text, 4000), re.I)]
    return result or ["unclassified"]


def year_of(text):
    match = re.search(r"(?<!\d)(18[89]\d|19\d{2}|20[0-2]\d)(?!\d)", str(text))
    return int(match[1]) if match else None


def kind_of(title):
    if re.search(r"\btrailer\b|\btrailers\b", title, re.I):
        return "trailer"
    if re.search(r"\bepisode\b|\bserial\b|\bchapter\b|\bS\d+E\d+\b", title, re.I):
        return "episode"
    if re.search(r"\bcollection\b|^\d[\d,]*\s+.{0,80}\b(?:films|movies)\b|how to watch", title, re.I):
        return "collection"
    return "film"


def declared_rights(license_value=None, rights_value=None):
    for raw in values(license_value):
        url = safe_url(raw, {"creativecommons.org", "www.creativecommons.org"})
        if not url:
            continue
        path = urlparse(url).path
        if path.startswith("/publicdomain/") or path.startswith("/licenses/publicdomain/"):
            return {"status": "public-domain", "label": "Public domain declared", "url": url}
        match = re.fullmatch(r"/licenses/(by(?:-nc)?(?:-sa|-nd)?)/(\d\.\d)(?:/[a-z-]+)?/?", path)
        if match:
            return {"status": "cc", "label": f"CC {match[1].upper()} {match[2]}", "url": url}
    rights = " ".join(clean(v, 400) for v in values(rights_value))
    if re.search(r"public domain|no known copyright", rights, re.I):
        return {"status": "public-domain", "label": "Public domain declared"}
    return {"status": "unknown", "label": "Rights not established"}


class Element:
    def __init__(self, tag="root", attrs=None):
        self.tag, self.attrs, self.children = tag, dict(attrs or []), []
        self.parent = None

    def text(self):
        return "".join(child.text() if isinstance(child, Element) else child for child in self.children)

    def walk(self, tag=None):
        for child in self.children:
            if isinstance(child, Element):
                if tag is None or child.tag == tag:
                    yield child
                yield from child.walk(tag)

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()


class Tree(HTMLParser):
    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        node.parent = self.stack[-1]
        self.stack[-1].children.append(node)
        if tag not in ("area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"):
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_pdm(content):
    category = "unclassified"
    records = {}
    for node in Tree(content).root.walk():
        if node.has_class("wsp-category-title"):
            category = clean(node.text())
        if node.tag != "li" or not node.has_class("wsp-post"):
            continue
        anchor = next(node.walk("a"), None)
        if anchor is None:
            continue
        url = safe_url(anchor.attrs.get("href"), {"publicdomainmovies.info"})
        title = clean(anchor.text())
        if not url or not title:
            continue
        if url in records:
            records[url]["genres"] = sorted(set(records[url]["genres"] + categories(category)))
            continue
        records[url] = {"id": "pdm:" + hashlib.sha256(url.encode()).hexdigest()[:16], "title": title,
                        "year": year_of(title), "yearSource": "title", "genres": categories(category),
                        "kind": kind_of(title), "sources": [{"provider": "pdm", "url": url}],
                        "rights": {"status": "public-domain-us", "label": "Public domain in the U.S. — directory claim"}}
    if not records:
        raise ValueError("Public Domain Movies directory format changed or returned no entries")
    return list(records.values())


def parse_oc(content):
    records = []
    seen = {}
    root = Tree(content).root
    for item in root.walk("li"):
        group = item.parent
        while group is not None:
            if group.has_class("curatedcategory") and next(group.walk("h2"), None) is not None:
                break
            group = group.parent
        if group is not None:
            heading = next(group.walk("h2"), None)
            if heading is None:
                continue
            source_groups = {"Drama": "comedy-drama", "Hitchcock": "noir-horror-thriller", "Kung-fu": "martial-arts", "Westerns": "western", "Silent": "silent", "Documentaries": "documentary", "Animation": "animation"}
            genre = [source_groups[group.attrs["id"]]] if group.attrs.get("id") in source_groups else categories(heading.text())
            strong = next(item.walk("strong"), None)
            title = clean(strong.text(), 5000) if strong else clean(item.text(), 5000)
            title = re.split(r"\s+[—–]\s*|\s+[-‑]\s+", title)[0][:240]
            if not title:
                continue
            links = [safe_url(a.attrs.get("href")) for a in item.walk("a")]
            links = list(dict.fromkeys(url for url in links if url))
            linked_archive = next((archive_id(url) for url in links if archive_id(url)), None)
            curator_link = next((url for url in links if urlparse(url).hostname in ("www.openculture.com", "openculture.com")), OC_URL + "#" + group.attrs.get("id", ""))
            # Read a date as a fact; do not redistribute the article's prose.
            dates = re.findall(r"\((18[89]\d|19\d{2}|20[0-2]\d)\)", clean(item.text(), 5000))
            year = int(dates[-1]) if dates else year_of(title)
            key = (title, year, linked_archive)
            if key in seen:
                seen[key]["genres"] = sorted(set(seen[key]["genres"] + genre))
                continue
            record = {"id": "oc:" + hashlib.sha256(repr(key).encode()).hexdigest()[:16], "title": title,
                      "year": year, "yearSource": "directory", "genres": genre, "kind": kind_of(title),
                      "sources": [{"provider": "openculture", "url": curator_link}],
                      "rights": {"status": "unknown", "label": "Free-to-watch listing; rights not established"}}
            if linked_archive:
                record["archiveId"] = linked_archive
            else:
                for url in links:
                    parsed = urlparse(url)
                    video_id = parsed.path.strip("/") if parsed.hostname == "youtu.be" else parse_qs(parsed.query).get("v", [""])[0] if parsed.hostname in ("www.youtube.com", "youtube.com") else ""
                    if re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
                        record["image"] = {"url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg", "credit": "YouTube / Open Culture", "sourceUrl": curator_link}
                        break
            records.append(record)
            seen[key] = record
    if not records:
        raise ValueError("Open Culture directory format changed or returned no entries")
    return records


def normalize_ia(item):
    identifier = item.get("identifier", "")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,200}", identifier):
        raise ValueError("Invalid Archive identifier")
    title = clean(next(iter(values(item.get("title"))), identifier))
    title_year = year_of(title)
    year = title_year or year_of(item.get("year")) or year_of(item.get("date"))
    record = {"id": "ia:" + identifier, "archiveId": identifier, "title": title, "year": year,
              "yearSource": "title" if title_year else "metadata", "kind": kind_of(title),
              "genres": categories(" ".join(str(v) for field in ("genre", "subject") for v in values(item.get(field)))),
              "sources": [{"provider": "archive", "url": "https://archive.org/details/" + identifier}],
              "rights": declared_rights(item.get("licenseurl"), item.get("rights"))}
    creators = [clean(v, 120) for v in values(item.get("creator"))[:3] if clean(v)]
    if creators:
        record["creators"] = creators
    languages = [clean(v, 35) for v in values(item.get("language"))[:3] if clean(v)]
    if languages:
        record["languages"] = languages
    try:
        rating, votes = float(item.get("avg_rating", 0)), int(item.get("num_reviews", 0))
        if 0 < rating <= 5 and votes > 0:
            record["rating"] = {"value": round(rating, 2), "count": votes}
    except (TypeError, ValueError):
        pass
    try:
        record["downloads"] = max(0, int(item.get("downloads", 0)))
    except (TypeError, ValueError):
        record["downloads"] = 0
    return record


def fetch(url, cache):
    path = cache / (hashlib.sha256(url.encode()).hexdigest() + ".body")
    if path.exists():
        return path.read_bytes()
    result = subprocess.run(["curl", "-fsSL", "--compressed", "--max-time", "50", "--max-filesize", "20000000", "--retry", "1", "--retry-delay", "2", "--user-agent", "CATODO-catalog/1.0 (+https://github.com/enuzzo/catodo)", url], capture_output=True, check=True)
    path.write_bytes(result.stdout)
    return result.stdout


def collect_ia(cache):
    items, identifiers, cursors = [], set(), set()
    cursor = None
    for page in range(1, 102):
        params = {"q": IA_QUERY, "fields": IA_FIELDS, "count": 1000}
        if cursor:
            params["cursor"] = cursor
        data = json.loads(fetch("https://archive.org/services/search/v1/scrape?" + urlencode(params), cache))
        if page == 1:
            initial = data["total"]
        for item in data["items"]:
            if item["identifier"] in identifiers:
                raise ValueError("Repeated Archive identifier; refusing incomplete/looping snapshot")
            identifiers.add(item["identifier"])
            items.append(item)
        print(json.dumps({"source": "archive", "page": page, "records": len(items), "initialTotal": initial}), flush=True)
        cursor = data.get("cursor")
        if not cursor:
            return {"initialTotal": initial, "fetched": len(items), "pages": page, "complete": True, "items": items}
        if cursor in cursors:
            raise ValueError("Repeated Archive cursor")
        cursors.add(cursor)
        time.sleep(.25)
    raise ValueError("Archive collection exceeds safety bound; no snapshot published")


def pdm_image(content, source_url):
    for meta in Tree(content).root.walk("meta"):
        if meta.attrs.get("property") != "og:image":
            continue
        url = safe_url(meta.attrs.get("content"), {"publicdomainmovies.info", "www.publicdomainmovies.info", "i0.wp.com", "i1.wp.com", "i2.wp.com"})
        if url and "header_web" not in url:
            return {"url": url, "credit": "Public Domain Movies", "sourceUrl": source_url}
    return None


def write_catalog(args):
    args.cache.mkdir(parents=True, exist_ok=True)
    ia = json.loads(args.archive_input.read_text()) if args.archive_input else collect_ia(args.cache)
    if not ia.get("complete") or ia["fetched"] != len(ia["items"]) or len({item["identifier"] for item in ia["items"]}) != ia["fetched"]:
        raise ValueError("Archive snapshot is incomplete")
    oc = parse_oc(args.oc_input.read_text() if args.oc_input else fetch(OC_URL, args.cache).decode())
    pdm = parse_pdm(args.pdm_input.read_text() if args.pdm_input else fetch(PDM_URL, args.cache).decode())
    cover_failures = []
    if args.pdm_covers:
        def enrich(record):
            url = record["sources"][0]["url"]
            try:
                image = pdm_image(fetch(url, args.cache).decode(), url)
                if image:
                    record["image"] = image
            except (subprocess.CalledProcessError, UnicodeError) as error:
                cover_failures.append(record["id"])
            return record
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for count, _ in enumerate(pool.map(enrich, pdm), 1):
                if count % 50 == 0:
                    print(json.dumps({"source": "pdm-images", "visited": count, "total": len(pdm), "failed": len(cover_failures)}), flush=True)
    records = [normalize_ia(item) for item in ia["items"]]
    by_archive = {record["archiveId"]: record for record in records}
    merged = 0
    for record in oc + pdm:
        existing = by_archive.get(record.get("archiveId"))
        if existing:
            existing["sources"].extend(source for source in record["sources"] if source not in existing["sources"])
            existing["genres"] = sorted(set(existing["genres"] + record["genres"]) - {"unclassified"}) or ["unclassified"]
            merged += 1
        else:
            records.append(record)
            if record.get("archiveId"):
                by_archive[record["archiveId"]] = record
    # Exact Archive item identity is the only automatic merge key. Similar titles
    # and years do not equate different scores, restorations, languages or files.
    counts = {"archive": len(ia["items"]), "openculture": len(oc), "pdm": len(pdm)}
    report = {"schema": 1, "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "query": IA_QUERY, "sourceCounts": counts, "archiveInitialTotal": ia["initialTotal"],
              "archivePages": ia["pages"], "archiveCursorExhausted": True, "mergedExactArchiveReferences": merged,
              "records": len(records), "pdmCoverFailures": cover_failures,
              "sources": [{"id": "archive", "name": "Internet Archive", "url": "https://archive.org/details/feature_films"},
                          {"id": "openculture", "name": "Open Culture", "url": OC_URL},
                          {"id": "pdm", "name": "Public Domain Movies", "url": PDM_URL}],
              "coverageNote": "All returned Archive feature_films records and direct entries in the two public directory pages. Linked collections are indexed as collections, not recursively counted as individual films. Source listings change over time."}
    data = {"manifest": report, "records": records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    temporary.replace(args.output)
    print(json.dumps({**report, "pdmCoverFailures": len(cover_failures), "bytes": args.output.stat().st_size}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True, help="Dated scratch cache outside the repository")
    parser.add_argument("--output", type=Path, default=ROOT / "public/theatre/archive-index.json")
    parser.add_argument("--archive-input", type=Path)
    parser.add_argument("--oc-input", type=Path)
    parser.add_argument("--pdm-input", type=Path)
    parser.add_argument("--pdm-covers", action="store_true", help="Read public post metadata, at most two requests concurrently")
    write_catalog(parser.parse_args())
