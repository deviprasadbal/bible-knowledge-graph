# Lamplight: A Knowledge Graph of the Bible

> "Your word is a lamp to my feet and a light to my path." (Psalm 119:105)

Lamplight treats the **66 books of the Protestant Bible** as a living network of people, places, events, books,
themes and creeds, and wraps it in a calm, modern web app for curious readers, especially young seekers and people
coming from other faiths. Themes are explored from a philosophical angle, and an optional **Bridges** lens compares
them gently with ideas from Hindu thought.

## Features

- **Reader**: BSB and KJV, or both side by side. Tap any verse to see its cross-references, the people, places and
  events in it, related themes, highlights, notes and bookmarks.
- **Knowledge graph explorer**: focus on any node, browse its neighbours, or **Connect** two nodes to see the
  chain of facts between them (for example, Ruth to David).
- **Big Questions**: 34 themes covering the Big Questions, Core Beliefs, the Five Solas and the Good Life. Each has
  the Protestant view, philosophy, key verses, creed quotations and reflection prompts.
- **People** (3,000+) with family trees, a **Map** of 1,200+ places, a **Timeline** of 500 events, and **Creeds &
  Confessions** with proof texts.
- **Guided journeys**, **Easton's Bible Dictionary**, and **The Pilgrim's Progress** with its Scripture notes linked.
- **My Journey**: reading progress, saved verses, notes and a private journal (kept in the browser, with export/import).
- Global search (⌘K), light and dark themes, a mobile-friendly layout, no tracking.

## Repository layout

```
sources/    raw, unmodified source data + SOURCES.md (licenses)
content/    hand-written layer: themes, book intros, journeys, intro (see CONTENT_GUIDE.md)
pipeline/   Python (standard library only) that builds the graph and app data
graph/      generated graph exports: JSON, Neo4j CSV, schema & example queries
app/        the React + Vite web app
docs/       background reading (knowledge-graph explainer)
.github/    CI: build & deploy to GitHub Pages, Dependabot
```

## Build and run locally

```bash
bash pipeline/build_all.sh        # validate content, build graph/ and app/public/data/
cd app && npm install && npm run dev
```

## Deploy

Every push to `main` builds and publishes the site to GitHub Pages (`.github/workflows/deploy.yml`).

## Sources & licenses

Code: MIT. Graph data and curated content: CC BY-SA 4.0. See [LICENSE](LICENSE) and
[sources/SOURCES.md](sources/SOURCES.md). Scripture is from the Berean Standard Bible and the King James Version (both
public domain). Data comes from Theographic Bible Metadata (CC BY-SA 4.0), OpenBible.info cross-references (CC BY),
and public-domain creeds via Creeds.json.
