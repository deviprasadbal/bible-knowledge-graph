"""Validate the curated content files in ../content against the source data.

Usage:  python3 -I pipeline/validate_content.py
Checks: every Bible reference exists in the BSB, theme ids are consistent, person slugs exist in
Theographic, and creed references point at real creed items.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CONTENT, OSIS, SRC, load_json, ref_exists  # noqa: E402

errors: list[str] = []


def check_ref(ref, where):
    if not isinstance(ref, str) or not ref_exists(ref):
        errors.append(f"{where}: bad Bible ref {ref!r}")


def creed_items(name):
    p = SRC / "creeds" / f"{name}.json"
    if not p.exists():
        return None
    d = load_json(p)
    data = d.get("Data")
    items = set()
    if isinstance(data, list):
        for x in data:
            for k in ("Number", "Article", "Chapter"):
                if k in x:
                    items.add(str(x[k]))
    return items


def main():
    slugs = {p["fields"]["slug"] for p in load_json(SRC / "theographic/people.json")}
    theme_ids = set()
    tp = CONTENT / "themes.json"
    if tp.exists():
        themes = load_json(tp)
        theme_ids = {t["id"] for t in themes}
        for t in themes:
            w = f"themes[{t['id']}]"
            for r in t.get("keyVerses", []):
                check_ref(r, w)
            for s in t.get("people", []):
                if s not in slugs:
                    errors.append(f"{w}: unknown person slug {s!r}")
            for c in t.get("creeds", []):
                items = creed_items(c.get("creed", ""))
                if items is None:
                    errors.append(f"{w}: unknown creed {c.get('creed')!r}")
                elif c.get("item") and items and str(c["item"]) not in items:
                    errors.append(f"{w}: creed {c['creed']} has no item {c['item']!r}")
            for rel in t.get("related", []):
                if rel not in theme_ids:
                    errors.append(f"{w}: unknown related theme {rel!r}")
    bp = CONTENT / "books.json"
    if bp.exists():
        books = load_json(bp)
        got = [b["osis"] for b in books]
        if got != OSIS:
            errors.append(f"books.json must list all 66 books in canonical order (missing: {set(OSIS)-set(got)})")
        for b in books:
            check_ref(b.get("keyVerse"), f"books[{b.get('osis')}]")
            if theme_ids:
                for th in b.get("themes", []):
                    if th not in theme_ids:
                        errors.append(f"books[{b['osis']}]: unknown theme {th!r}")
    jp = CONTENT / "journeys.json"
    if jp.exists():
        for j in load_json(jp):
            for i, s in enumerate(j.get("steps", [])):
                check_ref(s.get("ref"), f"journeys[{j['id']}].steps[{i}]")
    ip = CONTENT / "intro.json"
    if ip.exists():
        intro = load_json(ip)
        for sec in intro.get("sections", []):
            for r in sec.get("refs", []):
                check_ref(r, f"intro[{sec.get('id')}]")
    vp = CONTENT / "votd.json"
    if vp.exists():
        for r in load_json(vp):
            check_ref(r, "votd")
    if errors:
        print("\n".join(errors))
        print(f"\n{len(errors)} problem(s)")
        sys.exit(1)
    print("content OK")


if __name__ == "__main__":
    main()
