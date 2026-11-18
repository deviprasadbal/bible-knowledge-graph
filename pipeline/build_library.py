"""Turn the Project Gutenberg text of The Pilgrim's Progress into reader-friendly JSON.

Splits Part One into "stages" of the journey by landmark, and converts Bunyan's bracketed Scripture
notes (e.g. "[Isa. 64:6; Luke 14:33]") into OSIS references the app can open.
Usage: python3 -I pipeline/build_library.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import APP_DATA, SRC, ref_exists, write_json  # noqa: E402

ABBR = {
    "gen": "Gen", "genesis": "Gen", "exod": "Exod", "ex": "Exod", "exodus": "Exod", "lev": "Lev", "num": "Num",
    "deut": "Deut", "josh": "Josh", "judg": "Judg", "ruth": "Ruth", "1 sam": "1Sam", "2 sam": "2Sam",
    "1 kings": "1Kgs", "2 kings": "2Kgs", "1 kgs": "1Kgs", "2 kgs": "2Kgs", "1 chron": "1Chr", "2 chron": "2Chr",
    "1 chr": "1Chr", "2 chr": "2Chr", "ezra": "Ezra", "neh": "Neh", "esth": "Esth", "job": "Job", "ps": "Ps",
    "psa": "Ps", "psalm": "Ps", "psalms": "Ps", "prov": "Prov", "eccl": "Eccl", "eccles": "Eccl", "song": "Song",
    "cant": "Song", "isa": "Isa", "jer": "Jer", "lam": "Lam", "ezek": "Ezek", "dan": "Dan", "hos": "Hos",
    "joel": "Joel", "amos": "Amos", "obad": "Obad", "jonah": "Jonah", "mic": "Mic", "nah": "Nah", "hab": "Hab",
    "zeph": "Zeph", "hag": "Hag", "zech": "Zech", "mal": "Mal", "matt": "Matt", "mat": "Matt", "mark": "Mark",
    "luke": "Luke", "john": "John", "acts": "Acts", "rom": "Rom", "1 cor": "1Cor", "2 cor": "2Cor", "gal": "Gal",
    "eph": "Eph", "phil": "Phil", "col": "Col", "1 thess": "1Thess", "2 thess": "2Thess", "1 tim": "1Tim",
    "2 tim": "2Tim", "titus": "Titus", "tit": "Titus", "philem": "Phlm", "heb": "Heb", "james": "Jas", "jas": "Jas",
    "1 pet": "1Pet", "2 pet": "2Pet", "1 john": "1John", "2 john": "2John", "3 john": "3John", "jude": "Jude",
    "rev": "Rev",
}
BOOK_RE = re.compile(r"^((?:[123] )?[A-Za-z]+)\.?\s+(\d+)(?::([\d,\- ]+))?$")
CV_RE = re.compile(r"^(\d+)(?::([\d,\- ]+))?$")


def parse_human_refs(s: str) -> list[str]:
    """'Isa. 64:6; Luke 14:33; Acts 16:30,31; 65:2' -> OSIS refs (validated)."""
    out, book = [], None
    for part in re.split(r";", s):
        part = part.strip().rstrip(".")
        if not part:
            continue
        m = BOOK_RE.match(part)
        if m:
            book = ABBR.get(m.group(1).lower().replace(".", ""))
            ch, vs = m.group(2), m.group(3)
        else:
            m2 = CV_RE.match(part)
            if not m2 or not book:
                continue
            ch, vs = m2.group(1), m2.group(2)
        if not book:
            continue
        if not vs:
            cand = [f"{book}.{ch}"]
        else:
            first = re.split(r"[,\-]", vs.strip())[0].strip()
            last = re.split(r"[,\-]", vs.strip())[-1].strip()
            cand = [f"{book}.{ch}.{first}-{book}.{ch}.{last}" if last != first else f"{book}.{ch}.{first}"]
        out += [c for c in cand if ref_exists(c)]
    return out


STAGES = [
    ("The Man with the Burden", None),
    ("The Slough of Despond", "Slough of Despond"),
    ("Mr. Worldly Wiseman", "Worldly Wiseman"),
    ("The Wicket Gate", "Good-will"),
    ("The Interpreter's House", "house of the Interpreter"),
    ("The Cross and the Sepulchre", "came at a place somewhat ascending"),
    ("The Hill Difficulty", "Hill Difficulty"),
    ("The Palace Beautiful", "the name of which was Beautiful"),
    ("Apollyon in the Valley of Humiliation", "Apollyon"),
    ("The Valley of the Shadow of Death", "Valley of the Shadow of Death"),
    ("Faithful", "Faithful"),
    ("Talkative", "Talkative"),
    ("Vanity Fair", "Vanity Fair"),
    ("Hopeful and By-ends", "By-ends"),
    ("Doubting Castle and Giant Despair", "Doubting Castle"),
    ("The Delectable Mountains", "Delectable Mountains"),
    ("Ignorance", "very brisk lad"),
    ("The Enchanted Ground", "make one drowsy"),
    ("The Land of Beulah and the River", "Beulah"),
    ("The Celestial City", "the city stood upon a mighty hill"),
    ("The Conclusion", "The Conclusion."),
]


def main():
    raw = (SRC / "classics/pilgrims_progress.txt").read_text(encoding="utf-8")
    start = raw.index("In the Similitude of a Dream", raw.index("JOHN BUNYAN.\n"))
    end = raw.index("*** END OF THE PROJECT GUTENBERG")
    body = raw[start + len("In the Similitude of a Dream"):end]
    apology_s = raw.index("The Author's Apology for his Book")
    apology = raw[apology_s:raw.index("JOHN BUNYAN.\n", apology_s)]

    def paragraphs(text):
        paras = []
        for p in re.split(r"\n\s*\n", text):
            p = " ".join(line.strip() for line in p.strip().splitlines())
            p = re.sub(r"\{\d+\}\s*", "", p).strip()
            if not p or p.startswith("*"):
                continue
            refs = []

            def sub(m):
                r = parse_human_refs(m.group(1))
                if not r:
                    return ""
                refs.append(r)
                return f"⟦{len(refs) - 1}⟧"

            p = re.sub(r"\s*\[([^\]]+)\]", sub, p)
            paras.append({"t": p, "r": refs} if refs else {"t": p})
        return paras

    paras = paragraphs(body)
    # assign stages in order: each landmark starts at the first later paragraph containing it
    bounds, pos = [0], 0
    for _, key in STAGES[1:]:
        found = next((i for i in range(pos + 1, len(paras)) if key.lower() in paras[i]["t"].lower()), None)
        if found is None:
            bounds.append(None)
            continue
        bounds.append(found)
        pos = found
    stages = []
    valid = [(STAGES[i][0], b) for i, b in enumerate(bounds) if b is not None]
    for i, (title, b) in enumerate(valid):
        e = valid[i + 1][1] if i + 1 < len(valid) else len(paras)
        stages.append({"title": title, "paragraphs": paras[b:e]})
    total_refs = sum(len(p.get("r", [])) for p in paras)
    write_json(APP_DATA / "library/pilgrims-progress.json", {
        "id": "pilgrims-progress", "title": "The Pilgrim's Progress", "subtitle": "From This World to That Which Is to Come",
        "author": "John Bunyan", "year": 1678,
        "about": ("Written largely in prison by a Baptist preacher, Bunyan's allegory follows Christian from the City of "
                  "Destruction to the Celestial City. For three centuries it was, after the Bible, the most widely read "
                  "book in the English-speaking Protestant world. Bunyan's Scripture notes appear as small tags you can open."),
        "source": "Project Gutenberg eBook #131 (public domain)",
        "apology": paragraphs(apology)[1:],
        "stages": stages,
    })
    print(f"· Pilgrim's Progress: {len(stages)} stages, {len(paras)} paragraphs, {total_refs} scripture notes")


if __name__ == "__main__":
    main()
