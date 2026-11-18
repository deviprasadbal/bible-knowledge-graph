# Source Materials

These are the raw, unmodified source files for the Bible Knowledge Graph. Every one is free to use, and
each is listed with where it came from and its license. The build pipeline (`../pipeline/`) reads them
and never changes them.

| Folder | What it is | Source | License |
|---|---|---|---|
| `bible/bsb/bsb.txt` | **Berean Standard Bible** (BSB), a modern English translation, one verse per line | https://bereanbible.com/bsb.txt | Public domain (dedicated by the translators, 2023) |
| `bible/kjv/KJV.json` | **King James Version** (1611/1769), the classic English Protestant Bible | https://github.com/scrollmapper/bible_databases | Public domain (outside the UK) |
| `crossrefs/cross_references.txt` | About 344,000 verse-to-verse cross-references, each with community "votes" for relevance | https://www.openbible.info/labs/cross-references/ | CC BY (OpenBible.info) |
| `theographic/*.json` | **Theographic Bible Metadata**: 3,000+ people, 1,200+ places with coordinates, 500 events, family links, verse-level tagging, and the full text of **Easton's Bible Dictionary** (1897, Presbyterian) | https://github.com/robertrouse/theographic-bible-metadata | CC BY-SA 4.0 (Robert Rouse / viz.bible) |
| `creeds/*.json` | **Historic creeds, confessions and catechisms**: Apostles', Nicene, Athanasian, Chalcedonian, Westminster Confession and Catechisms, Heidelberg Catechism, Belgic Confession, Canons of Dort, 1689 London Baptist Confession, and more, many with Scripture proof texts | https://github.com/NonlinearFruit/Creeds.json | Only the public-domain texts were kept. Eight copyrighted texts in that repo were deliberately removed. |
| `classics/pilgrims_progress.txt` | **The Pilgrim's Progress** by John Bunyan (1678), the best-known Protestant allegory of the spiritual journey | Project Gutenberg eBook #131 | Public domain (Project Gutenberg license) |

## Why these sources

* **Scripture (66 books).** The Protestant canon is 39 Old Testament books and 27 New Testament books.
  The Apocrypha is not included, because Protestant churches do not count it as Scripture.
* **BSB + KJV.** The BSB is a clear, modern, accurate translation. The KJV is the historic text that
  shaped English-speaking Protestantism.
* **Creeds and confessions.** These are how Protestant churches have summed up what the Bible
  teaches: the Reformed, Presbyterian and Baptist traditions, plus the early ecumenical creeds that
  Protestants accept.
* **Easton's Bible Dictionary.** A classic Protestant reference work for the people, places and ideas in Scripture.
* **Cross-references.** These turn the Bible into a network, showing how passages echo and interpret each other.

## Attribution required when deploying publicly

* Theographic Bible Metadata, © Robert Rouse, CC BY-SA 4.0. Derived graph data must be shared under the same license.
* Cross references from OpenBible.info, CC BY.
