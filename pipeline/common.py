"""Shared helpers for the Bible Knowledge Graph pipeline (standard library only)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "sources"
CONTENT = ROOT / "content"
GRAPH = ROOT / "graph"
APP_DATA = ROOT / "app" / "public" / "data"

OSIS = ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov "
        "Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark "
        "Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet "
        "2Pet 1John 2John 3John Jude Rev").split()
OSIS_INDEX = {o: i for i, o in enumerate(OSIS)}


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data, pretty: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


@lru_cache(maxsize=1)
def load_bsb() -> dict[str, dict[int, dict[int, str]]]:
    """Return {osis: {chapter: {verse: text}}} from the BSB tab-separated file."""
    line_re = re.compile(r"^(.+?) (\d+):(\d+)\t(.*)$")
    out: dict[str, dict[int, dict[int, str]]] = {}
    names: list[str] = []
    with open(SRC / "bible/bsb/bsb.txt", encoding="utf-8-sig") as f:
        for raw in f:
            m = line_re.match(raw.rstrip("\r\n"))
            if not m:
                continue
            name, c, v, text = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4).strip()
            if not names or names[-1] != name:
                names.append(name)
            osis = OSIS[len(names) - 1]
            out.setdefault(osis, {}).setdefault(c, {})[v] = text
    assert len(names) == 66, f"expected 66 BSB books, got {len(names)}"
    return out


@lru_cache(maxsize=1)
def load_kjv() -> dict[str, dict[int, dict[int, str]]]:
    d = load_json(SRC / "bible/kjv/KJV.json")
    out = {}
    assert len(d["books"]) == 66
    for i, b in enumerate(d["books"]):
        out[OSIS[i]] = {ch["chapter"]: {v["verse"]: v["text"].strip() for v in ch["verses"]} for ch in b["chapters"]}
    return out


REF_RE = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$")


def parse_ref(ref: str):
    """Parse 'John.3.16', 'John.3' or a range 'Matt.5.1-Matt.7.29' / 'John.3.16-John.3.18'.
    Returns list of (osis, chapter, verse) tuples covering the reference (verse None = whole chapter)."""
    parts = ref.split("-")
    if len(parts) > 2:
        raise ValueError(f"bad ref {ref}")
    start = REF_RE.match(parts[0])
    if not start or start.group(1) not in OSIS_INDEX:
        raise ValueError(f"bad ref {ref}")
    if len(parts) == 1:
        return [(start.group(1), int(start.group(2)), int(start.group(3)) if start.group(3) else None)]
    end = REF_RE.match(parts[1])
    if not end or end.group(1) not in OSIS_INDEX:
        raise ValueError(f"bad ref {ref}")
    return [(start.group(1), int(start.group(2)), int(start.group(3)) if start.group(3) else None),
            (end.group(1), int(end.group(2)), int(end.group(3)) if end.group(3) else None)]


def ref_exists(ref: str) -> bool:
    bsb = load_bsb()
    try:
        pts = parse_ref(ref)
    except ValueError:
        return False
    for b, c, v in pts:
        if b not in bsb or c not in bsb[b]:
            return False
        if v is not None and v not in bsb[b][c]:
            return False
    if len(pts) == 2:
        a, z = pts
        if (OSIS_INDEX[a[0]], a[1], a[2] or 0) > (OSIS_INDEX[z[0]], z[1], z[2] or 0):
            return False
    return True


def ref_text(ref: str, max_verses: int = 6) -> str:
    """Return BSB text for a reference (truncated to max_verses)."""
    bsb = load_bsb()
    pts = parse_ref(ref)
    b, c, v = pts[0]
    if len(pts) == 1:
        if v is None:
            vs = list(bsb[b][c].items())
        else:
            vs = [(v, bsb[b][c][v])]
        return " ".join(t for _, t in vs[:max_verses])
    out = []
    eb, ec, ev = pts[1]
    for ch in range(c, ec + 1):
        for vn, t in bsb[b][ch].items():
            if ch == c and v and vn < v:
                continue
            if ch == ec and ev and vn > ev:
                break
            out.append(t)
            if len(out) >= max_verses:
                return " ".join(out) + " …"
    return " ".join(out)
