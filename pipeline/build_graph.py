"""Build the Bible Knowledge Graph from ../sources and ../content.

Outputs
  graph/            portable graph exports (JSON node-link, Neo4j CSV + Cypher)
  app/public/data/  sharded JSON consumed by the web app

Usage (from project root):  python3 -I pipeline/build_graph.py
"""
from __future__ import annotations

import collections
import csv
import json
import math
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (APP_DATA, CONTENT, GRAPH, OSIS, OSIS_INDEX, SRC, load_bsb, load_json,  # noqa: E402
                    write_json)

TG = SRC / "theographic"


def log(*a):
    print("·", *a, flush=True)


def year(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def letter(s: str) -> str:
    c = (s or "_")[0].lower()
    return c if c.isalpha() else "_"


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def split_refs(refs):
    """Creed proof refs sometimes come comma-joined; normalise to a flat list."""
    out = []
    for r in refs or []:
        for p in str(r).split(","):
            p = p.strip()
            if p:
                out.append(p)
    return out


def book_of(ref: str):
    b = ref.split(".")[0]
    return b if b in OSIS_INDEX else None


# --------------------------------------------------------------------------------------------
# Load Theographic records and build rec-id lookups
# --------------------------------------------------------------------------------------------
log("loading Theographic metadata")
people_raw = load_json(TG / "people.json")
places_raw = load_json(TG / "places.json")
events_raw = load_json(TG / "events.json")
books_raw = load_json(TG / "books.json")
chapters_raw = load_json(TG / "chapters.json")
groups_raw = load_json(TG / "peopleGroups.json")
easton_raw = load_json(TG / "easton.json")
defs_raw = load_json(TG / "definitions.json")
verses_raw = load_json(TG / "verses.json")

verse_rec = {r["id"]: r["fields"]["osisRef"] for r in verses_raw}
person_rec = {r["id"]: r["fields"]["slug"] for r in people_raw}
place_rec = {r["id"]: r["fields"]["slug"] for r in places_raw}
event_rec = {r["id"]: f"e{r['fields']['eventID']}" for r in events_raw}
group_rec = {r["id"]: "g-" + slugify(r["fields"]["groupName"]) for r in groups_raw}
book_rec = {r["id"]: r["fields"]["osisName"] for r in books_raw}
easton_rec = {r["id"]: r["fields"] for r in easton_raw}

defs_by_rec = {r["id"]: r["fields"].get("text", "") for r in defs_raw}
defs_by_slug = {}
for r in defs_raw:
    f = r["fields"]
    if f.get("slug") and f.get("text"):
        defs_by_slug.setdefault(f["slug"], f["text"])


def map_ids(recs, table):
    return [table[x] for x in (recs or []) if x in table]


def verse_key(ref):
    b, c, v = ref.split(".")
    return (OSIS_INDEX[b], int(c), int(v))


# Verse-level tagging: which people / places / events appear in each verse
log("indexing verse tags")
person_verses = collections.defaultdict(list)
place_verses = collections.defaultdict(list)
event_verses = collections.defaultdict(list)
verse_links = collections.defaultdict(dict)  # osis book -> {"c.v": [people, places, events]}
for r in verses_raw:
    f = r["fields"]
    ref = f["osisRef"]
    ppl = list(dict.fromkeys(map_ids(f.get("people"), person_rec)))
    plc = list(dict.fromkeys(map_ids(f.get("places"), place_rec)))
    evs = list(dict.fromkeys(map_ids(f.get("event"), event_rec)))
    for p in ppl:
        person_verses[p].append(ref)
    for p in plc:
        place_verses[p].append(ref)
    for e in evs:
        event_verses[e].append(ref)
    if ppl or plc or evs:
        b, c, v = ref.split(".")
        verse_links[b][f"{c}.{v}"] = [ppl, plc, evs]


def book_counts(refs):
    c = collections.Counter(r.split(".")[0] for r in refs)
    return dict(sorted(c.items(), key=lambda kv: OSIS_INDEX[kv[0]]))


def easton_text(recs):
    """Join the Easton's dictionary items (split into numbered parts) for given rec ids."""
    parts = []
    for rid in recs or []:
        e = easton_rec.get(rid)
        if e and e.get("dictText"):
            parts.append((e.get("index", 0), e["dictText"].strip()))
    return "\n\n".join(t for _, t in sorted(parts))


# --------------------------------------------------------------------------------------------
# Curated content
# --------------------------------------------------------------------------------------------
def load_content(name, default):
    p = CONTENT / name
    if p.exists():
        return load_json(p)
    log(f"WARNING: content/{name} missing; using empty default")
    return default


themes = load_content("themes.json", [])
books_content = {b["osis"]: b for b in load_content("books.json", [])}
journeys = load_content("journeys.json", [])
intro = load_content("intro.json", {})

# --------------------------------------------------------------------------------------------
# Graph assembly
# --------------------------------------------------------------------------------------------
nodes: dict[str, dict] = {}
edges: list[tuple[str, str, str, float]] = []
edge_seen = set()


def add_node(nid, ntype, label, **props):
    nodes[nid] = {"id": nid, "type": ntype, "label": label, **props}


def add_edge(s, t, rel, w=1.0, undirected=False):
    if s not in nodes or t not in nodes or s == t:
        return
    key = (min(s, t), max(s, t), rel) if undirected else (s, t, rel)
    if key in edge_seen:
        return
    edge_seen.add(key)
    edges.append((s, t, rel, w))


# Books
log("books")
book_meta = {}
writers_by_book = {}
for r in sorted(books_raw, key=lambda r: r["fields"]["bookOrder"]):
    f = r["fields"]
    osis = f["osisName"]
    cur = books_content.get(osis, {})
    book_meta[osis] = {
        "osis": osis, "name": f["bookName"], "order": f["bookOrder"],
        "testament": "OT" if f["testament"].startswith("Old") else "NT",
        "division": f.get("bookDiv"), "chapters": f.get("chapterCount"), "verses": f.get("verseCount"),
        "peopleCount": f.get("peopleCount"), "placeCount": f.get("placeCount"),
        **{k: v for k, v in cur.items() if k not in ("osis", "name", "testament")},
    }
    writers_by_book[osis] = f.get("writers") or []
    add_node(f"book:{osis}", "Book", f["bookName"], testament=book_meta[osis]["testament"],
             division=f.get("bookDiv"), chapters=f.get("chapterCount"), size=f.get("verseCount"))

# People groups
for r in groups_raw:
    f = r["fields"]
    add_node(group_rec[r["id"]], "Group", f["groupName"], size=len(f.get("members") or []))

# People
log("people")
people_detail = {}
people_index = []
for r in people_raw:
    f = r["fields"]
    slug = f["slug"]
    verses = sorted(set(person_verses.get(slug, [])), key=verse_key)
    vc = max(len(verses), f.get("verseCount") or 0)
    sub = f.get("Disambiguation (temp)") if f.get("ambiguous") else None
    if sub and (len(sub) > 70 or sub.strip() == f["name"]):
        sub = None
    add_node(f"person:{slug}", "Person", f.get("displayTitle") or f["name"], gender=f.get("gender"),
             size=vc, subtitle=sub)
    people_index.append({"id": slug, "l": f.get("displayTitle") or f["name"], "sub": sub,
                         "g": (f.get("gender") or "")[:1], "vc": vc,
                         "y0": year(f.get("minYear")), "y1": year(f.get("maxYear"))})
    people_detail[slug] = {
        "id": slug, "name": f.get("displayTitle") or f["name"], "subtitle": sub, "gender": f.get("gender"),
        "aka": [a.strip() for a in (f.get("alsoCalled") or "").split(",") if a.strip()],
        "born": year(f.get("birthYear")), "died": year(f.get("deathYear")),
        "minYear": year(f.get("minYear")), "maxYear": year(f.get("maxYear")),
        "birthPlace": map_ids(f.get("birthPlace"), place_rec), "deathPlace": map_ids(f.get("deathPlace"), place_rec),
        "father": map_ids(f.get("father"), person_rec), "mother": map_ids(f.get("mother"), person_rec),
        "children": map_ids(f.get("children"), person_rec), "siblings": map_ids(f.get("siblings"), person_rec),
        "partners": map_ids(f.get("partners"), person_rec), "groups": map_ids(f.get("memberOf"), group_rec),
        "events": map_ids(f.get("events"), event_rec), "verseCount": vc, "books": book_counts(verses),
        "verses": verses[:80],
        "summary": defs_by_slug.get(slug) or "",
        "easton": easton_text(f.get("eastons")),
    }

# Places
log("places")
places_detail = {}
places_index = []
for r in places_raw:
    f = r["fields"]
    slug = f["slug"]
    verses = sorted(set(place_verses.get(slug, [])), key=verse_key)
    lat = f.get("latitude") or f.get("openBibleLat")
    lon = f.get("longitude") or f.get("openBibleLong")
    try:
        lat, lon = round(float(lat), 5), round(float(lon), 5)
    except (TypeError, ValueError):
        lat = lon = None
    vc = max(len(verses), f.get("verseCount") or 0)
    add_node(f"place:{slug}", "Place", f.get("displayTitle") or f.get("kjvName"), size=vc,
             featureType=f.get("featureType"), lat=lat, lon=lon)
    places_index.append({"id": slug, "l": f.get("displayTitle"), "lat": lat, "lon": lon,
                         "ft": f.get("featureType") or "Other", "vc": vc})
    places_detail[slug] = {
        "id": slug, "name": f.get("displayTitle"), "kjvName": f.get("kjvName"), "esvName": f.get("esvName"),
        "featureType": f.get("featureType"), "featureSubType": f.get("featureSubType"),
        "lat": lat, "lon": lon, "precision": f.get("precision"), "comment": f.get("comment"),
        "aka": [a.strip() for a in (f.get("otherNames") or f.get("aliases") or "").split(",") if a.strip()]
        if isinstance(f.get("otherNames") or f.get("aliases") or "", str) else [],
        "partOf": map_ids(f.get("partOf"), place_rec), "verseCount": vc, "books": book_counts(verses),
        "verses": verses[:80], "summary": defs_by_slug.get(slug) or "",
        "easton": easton_text(f.get("eastons")),
        "events": map_ids(f.get("eventsHere"), event_rec),
        "peopleBorn": map_ids(f.get("peopleBorn"), person_rec),
        "peopleDied": map_ids(f.get("peopleDied"), person_rec),
    }

# Events
log("events")
events_out = []
for r in events_raw:
    f = r["fields"]
    eid = f"e{f['eventID']}"
    vs = sorted(set(map_ids(f.get("verses"), verse_rec)) | set(event_verses.get(eid, [])), key=verse_key)
    add_node(f"event:{eid}", "Event", f["title"], year=year(f.get("startDate")), size=len(vs))
    events_out.append({
        "id": eid, "title": f["title"], "year": year(f.get("startDate")), "sort": f.get("sortKey"),
        "duration": f.get("duration"), "people": list(dict.fromkeys(map_ids(f.get("participants"), person_rec))),
        "places": list(dict.fromkeys(map_ids(f.get("locations"), place_rec))),
        "groups": map_ids(f.get("groups"), group_rec),
        "partOf": map_ids(f.get("partOf"), event_rec), "after": map_ids(f.get("predecessor"), event_rec),
        "book": book_of(vs[0]) if vs else None, "first": vs[0] if vs else None,
        "verses": vs[:40], "verseCount": len(vs), "notes": f.get("notes"),
        "summary": " ".join(defs_by_rec.get(d, "") for d in (f.get("definitions") or [])[:1]).strip(),
    })
events_out.sort(key=lambda e: (e["sort"] if e["sort"] is not None else 0))

# Themes
log("themes")
for t in themes:
    add_node(f"theme:{t['id']}", "Theme", t["title"], category=t.get("category"), size=50)

# Creeds
log("creeds")
creeds_index = []
creeds_full = {}
TYPO_FIXES = {"First Council of Constantsnople": "First Council of Constantinople"}  # known source typos
creed_proofs = collections.defaultdict(list)  # creed id -> list of refs
for p in sorted((SRC / "creeds").glob("*.json")):
    cid = p.stem
    d = load_json(p)
    m = d["Metadata"]
    data = d["Data"]
    items = []
    if isinstance(data, dict):  # single-text creed
        items.append({"n": "", "title": m["Title"], "text": data.get("Content", ""), "proofs": []})
    else:
        for x in data:
            if "Question" in x:
                proofs = [ref for pr in x.get("Proofs", []) for ref in split_refs(pr.get("References"))]
                sub = [{"q": s.get("Question"), "a": s.get("Answer")} for s in x.get("SubQuestions", []) or []]
                items.append({"n": str(x["Number"]), "title": x["Question"], "text": x.get("Answer", ""),
                              "proofs": proofs, "sub": sub or None})
            elif "Sections" in x:
                secs = []
                proofs_all = []
                for s in x["Sections"]:
                    pr = [ref for q in s.get("Proofs", []) or [] for ref in split_refs(q.get("References"))]
                    proofs_all += pr
                    secs.append({"n": str(s.get("Section", "")), "text": s.get("Content", ""), "proofs": pr})
                items.append({"n": str(x["Chapter"]), "title": x.get("Title", ""), "sections": secs,
                              "text": "", "proofs": proofs_all})
            else:
                pr = [ref for q in x.get("Proofs", []) or [] for ref in split_refs(q.get("References"))]
                items.append({"n": str(x.get("Article", "")), "title": x.get("Title", ""),
                              "text": x.get("Content", ""), "proofs": pr})
    for it in items:
        creed_proofs[cid] += it["proofs"]
    yr = year(re.sub(r"[^0-9-]", "", str(m.get("Year", ""))) or None)
    authors = [TYPO_FIXES.get(a, a) for a in (m.get("Authors") or [])]
    meta = {"id": cid, "title": m["Title"], "year": yr, "yearLabel": m.get("Year"), "authors": authors,
            "location": m.get("Location"), "language": m.get("OriginalLanguage"), "format": m.get("CreedFormat"),
            "story": m.get("OriginStory") or "", "source": m.get("SourceUrl"), "attribution": m.get("SourceAttribution"),
            "items": len(items), "proofCount": len(creed_proofs[cid])}
    creeds_index.append(meta)
    creeds_full[cid] = {**meta, "content": items}
    add_node(f"creed:{cid}", "Creed", m["Title"], year=yr, format=m.get("CreedFormat"), size=len(items))
creeds_index.sort(key=lambda c: (c["year"] if c["year"] is not None else 9999))

# ---------------------------------------------------------------- edges
log("edges")
for slug, d in people_detail.items():
    me = f"person:{slug}"
    for p in d["father"] + d["mother"]:
        add_edge(f"person:{p}", me, "PARENT_OF")
    for c in d["children"]:
        add_edge(me, f"person:{c}", "PARENT_OF")
    for s in d["siblings"]:
        add_edge(me, f"person:{s}", "SIBLING_OF", undirected=True)
    for s in d["partners"]:
        add_edge(me, f"person:{s}", "MARRIED_TO", undirected=True)
    for p in d["birthPlace"]:
        add_edge(me, f"place:{p}", "BORN_IN")
    for p in d["deathPlace"]:
        add_edge(me, f"place:{p}", "DIED_IN")
    for g in d["groups"]:
        add_edge(me, g, "MEMBER_OF")
    for b, n in d["books"].items():
        add_edge(me, f"book:{b}", "APPEARS_IN", n)

for osis, ws in writers_by_book.items():
    for w in ws:
        add_edge(f"person:{w}", f"book:{osis}", "WROTE")
for r in chapters_raw:  # chapter-level authorship (e.g. Psalms by David, Asaph...)
    f = r["fields"]
    b = f["osisRef"].split(".")[0]
    for w in map_ids(f.get("writer"), person_rec):
        add_edge(f"person:{w}", f"book:{b}", "WROTE")

for slug, d in places_detail.items():
    for b, n in d["books"].items():
        add_edge(f"place:{slug}", f"book:{b}", "MENTIONED_IN", n)
    for p in d["partOf"]:
        add_edge(f"place:{slug}", f"place:{p}", "PART_OF")

for e in events_out:
    me = f"event:{e['id']}"
    for p in e["people"]:
        add_edge(f"person:{p}", me, "PARTICIPATED_IN")
    for p in e["places"]:
        add_edge(me, f"place:{p}", "OCCURRED_AT")
    for g in e["groups"]:
        add_edge(g, me, "PARTICIPATED_IN")
    for a in e["after"]:
        add_edge(me, f"event:{a}", "FOLLOWS")
    for a in e["partOf"]:
        add_edge(me, f"event:{a}", "PART_OF")
    if e["book"]:
        add_edge(me, f"book:{e['book']}", "RECORDED_IN")

for t in themes:
    me = f"theme:{t['id']}"
    for rel in t.get("related", []):
        add_edge(me, f"theme:{rel}", "RELATED_TO", undirected=True)
    for p in t.get("people", []):
        add_edge(me, f"person:{p}", "EXEMPLIFIED_BY")
    for c in t.get("creeds", []):
        add_edge(me, f"creed:{c['creed']}", "CONFESSED_IN")
    for b in dict.fromkeys(book_of(r) for r in t.get("keyVerses", [])):
        if b:
            add_edge(me, f"book:{b}", "TAUGHT_IN")
for osis, b in book_meta.items():
    for th in b.get("themes", []) or []:
        add_edge(f"book:{osis}", f"theme:{th}", "EXPLORES")

for cid, refs in creed_proofs.items():
    for b, n in collections.Counter(filter(None, (book_of(r) for r in refs))).items():
        add_edge(f"creed:{cid}", f"book:{b}", "CITES", n)

# Cross references -> per-verse lists (app) + book-to-book "ECHOES" aggregate (graph)
log("cross references")
xref = collections.defaultdict(lambda: collections.defaultdict(list))
book_pair = collections.Counter()
incoming_votes = collections.Counter()
xref_strong = []
with open(SRC / "crossrefs/cross_references.txt", encoding="utf-8") as fh:
    next(fh)
    for line in fh:
        a, b, v = line.rstrip("\n").split("\t")[:3]
        v = int(v)
        if v < 2:
            continue
        sb = a.split(".")[0]
        tb = b.split(".")[0]
        if sb not in OSIS_INDEX or tb not in OSIS_INDEX:
            continue
        _, c, vs = a.split(".")
        xref[sb][f"{c}.{vs}"].append((b, v))
        if sb != tb:
            book_pair[(sb, tb)] += v
        incoming_votes[b.split("-")[0]] += v
        if v >= 10:
            xref_strong.append((a, b, v))
for sb, verses in xref.items():
    for k, lst in verses.items():
        lst.sort(key=lambda x: -x[1])
        verses[k] = lst[:12]
per_book_echo = collections.defaultdict(list)
for (sb, tb), w in book_pair.items():
    per_book_echo[sb].append((w, tb))
for sb, lst in per_book_echo.items():
    for w, tb in sorted(lst, reverse=True)[:6]:
        add_edge(f"book:{sb}", f"book:{tb}", "ECHOES", w)

log(f"graph: {len(nodes)} nodes, {len(edges)} edges")

# --------------------------------------------------------------------------------------------
# Write portable graph exports
# --------------------------------------------------------------------------------------------
log("writing graph/ exports")
GRAPH.mkdir(exist_ok=True)
rel_counts = collections.Counter(e[2] for e in edges)
type_counts = collections.Counter(n["type"] for n in nodes.values())
write_json(GRAPH / "bible_kg.json", {
    "meta": {"name": "Bible Knowledge Graph (Protestant canon)", "license": "CC BY-SA 4.0 (derived from Theographic)",
             "nodeTypes": type_counts, "relations": rel_counts},
    "nodes": list(nodes.values()),
    "edges": [{"source": s, "target": t, "type": r, "weight": w} for s, t, r, w in edges],
})

neo = GRAPH / "neo4j"
neo.mkdir(exist_ok=True)
with open(neo / "nodes.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["id:ID", ":LABEL", "name", "props"])
    for n in nodes.values():
        props = {k: v for k, v in n.items() if k not in ("id", "type", "label") and v is not None}
        w.writerow([n["id"], n["type"], n["label"], json.dumps(props, ensure_ascii=False)])
    bsb = load_bsb()
    for b in OSIS:
        for c, vs in bsb[b].items():
            for v, txt in vs.items():
                w.writerow([f"verse:{b}.{c}.{v}", "Verse", f"{book_meta[b]['name']} {c}:{v}",
                            json.dumps({"text": txt}, ensure_ascii=False)])
with open(neo / "edges.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow([":START_ID", ":END_ID", ":TYPE", "weight:float"])
    for s, t, r, wt in edges:
        w.writerow([s, t, r, wt])
    for slug, refs in person_verses.items():
        for ref in dict.fromkeys(refs):
            w.writerow([f"verse:{ref}", f"person:{slug}", "MENTIONS", 1])
    for slug, refs in place_verses.items():
        for ref in dict.fromkeys(refs):
            w.writerow([f"verse:{ref}", f"place:{slug}", "MENTIONS", 1])
    for eid, refs in event_verses.items():
        for ref in dict.fromkeys(refs):
            w.writerow([f"verse:{ref}", f"event:{eid}", "DESCRIBES", 1])
    for a, b, v in xref_strong:
        if "-" in a or "-" in b:
            a, b = a.split("-")[0], b.split("-")[0]
        w.writerow([f"verse:{a}", f"verse:{b}", "CROSS_REFERENCES", v])
    for t in themes:
        for r in t.get("keyVerses", []):
            w.writerow([f"theme:{t['id']}", f"verse:{r.split('-')[0]}", "KEY_VERSE", 1])

# --------------------------------------------------------------------------------------------
# Write web-app data
# --------------------------------------------------------------------------------------------
log("writing app/public/data")
if APP_DATA.exists():
    shutil.rmtree(APP_DATA)
APP_DATA.mkdir(parents=True)

# Bible texts. KJV uses Theographic's linked markdown (names link to people/places).
bsb = load_bsb()
kjv_md = collections.defaultdict(lambda: collections.defaultdict(dict))
for r in verses_raw:
    f = r["fields"]
    b, c, v = f["osisRef"].split(".")
    kjv_md[b][int(c)][int(v)] = (f.get("mdText") or f.get("verseText") or "").strip()


def to_arrays(chapters):
    out = []
    for c in sorted(chapters):
        vs = chapters[c]
        mx = max(vs)
        out.append([vs.get(i) for i in range(1, mx + 1)])
    return out


for b in OSIS:
    write_json(APP_DATA / f"bible/bsb/{b}.json", to_arrays(bsb[b]))
    write_json(APP_DATA / f"bible/kjv/{b}.json", to_arrays(kjv_md[b]))
    write_json(APP_DATA / f"xref/{b}.json", {k: v for k, v in xref[b].items()})
    write_json(APP_DATA / f"links/{b}.json", verse_links.get(b, {}))

# Compact graph for the explorer: node array + edge index triples
node_list = list(nodes.values())
idx = {n["id"]: i for i, n in enumerate(node_list)}
REL = sorted(rel_counts)
TYPE_CODE = {"Person": "P", "Place": "L", "Event": "E", "Book": "B", "Theme": "T", "Creed": "C", "Group": "G"}
write_json(APP_DATA / "graph.json", {
    "rels": REL,
    "nodes": [{"id": n["id"], "t": TYPE_CODE[n["type"]], "l": n["label"],
               "s": n.get("size") or 1, **({"sub": n["subtitle"]} if n.get("subtitle") else {})} for n in node_list],
    "edges": [[idx[s], idx[t], REL.index(r), round(w, 1)] for s, t, r, w in edges],
})

people_index.sort(key=lambda p: -p["vc"])
write_json(APP_DATA / "people.json", people_index)
places_index.sort(key=lambda p: -p["vc"])
write_json(APP_DATA / "places.json", places_index)
for kind, detail in (("people", people_detail), ("places", places_detail)):
    shards = collections.defaultdict(dict)
    for k, v in detail.items():
        shards[letter(k)][k] = v
    for l, d in shards.items():
        write_json(APP_DATA / f"{kind}/{l}.json", d)
write_json(APP_DATA / "events.json", events_out)
write_json(APP_DATA / "groups.json", {group_rec[r["id"]]: {"name": r["fields"]["groupName"],
                                                            "members": map_ids(r["fields"].get("members"), person_rec)}
                                       for r in groups_raw})

# Easton's dictionary grouped by term
dict_terms = collections.OrderedDict()
for r in sorted(easton_raw, key=lambda r: r["fields"].get("index", 0)):
    f = r["fields"]
    label = f.get("termLabel") or f.get("dictLookup")
    if not label or not f.get("dictText"):
        continue
    key = slugify(label)
    entry = dict_terms.setdefault(key, {"id": key, "term": label, "text": [], "match": set()})
    entry["text"].append(f["dictText"].strip())
    # matchSlugs is a plain slug, "unmatched", or a Python-list-like string "['a_1', 'b_2']"
    for s in re.findall(r"[a-z0-9_]+_\d+", str(f.get("matchSlugs") or "")):
        if s:
            entry["match"].add(s)
dict_index = []
dict_shards = collections.defaultdict(dict)
for key, e in dict_terms.items():
    text = "\n\n".join(t for t in e["text"] if t)
    dict_index.append({"id": key, "l": e["term"], "n": len(text)})
    dict_shards[letter(key)][key] = {"term": e["term"], "text": text, "links": sorted(e["match"])}
write_json(APP_DATA / "dictionary/index.json", dict_index)
for l, d in dict_shards.items():
    write_json(APP_DATA / f"dictionary/{l}.json", d)

# Creeds
write_json(APP_DATA / "creeds/index.json", creeds_index)
for cid, c in creeds_full.items():
    write_json(APP_DATA / f"creeds/{cid}.json", c)

# Curated content (+ theographic stats merged into books)
write_json(APP_DATA / "books.json", [book_meta[b] for b in OSIS])
write_json(APP_DATA / "themes.json", themes)
write_json(APP_DATA / "journeys.json", journeys)
write_json(APP_DATA / "intro.json", intro)

# Verse of the day: the most cross-referenced verses (famous passages surface naturally)
# Verse of the day: a hand-picked list of well-loved, welcoming passages (content/votd.json)
votd = load_content("votd.json", [])
if not votd:  # fallback: most cross-referenced verses
    votd = [r for r, _ in incoming_votes.most_common(1200) if r.count(".") == 2][:366]
write_json(APP_DATA / "votd.json", votd)

stats = {
    "books": 66, "chapters": sum(len(bsb[b]) for b in OSIS), "verses": sum(len(v) for b in OSIS for v in bsb[b].values()),
    "people": len(people_detail), "places": len(places_detail), "events": len(events_out),
    "themes": len(themes), "creeds": len(creeds_index), "dictionary": len(dict_index),
    "crossrefs": sum(len(l) for b in xref.values() for l in b.values()),
    "nodes": len(nodes), "edges": len(edges), "relations": rel_counts, "nodeTypes": type_counts,
}
write_json(APP_DATA / "stats.json", stats, pretty=True)
write_json(GRAPH / "stats.json", stats, pretty=True)
log("done", json.dumps({k: v for k, v in stats.items() if not isinstance(v, dict)}))
