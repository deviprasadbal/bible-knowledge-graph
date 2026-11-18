# Curated Content Guide

The `content/` folder holds the **hand-written** layer of the knowledge graph. It sits on top of the
downloaded sources in `../sources/` and supplies the meaning the raw data lacks: themes, book introductions,
reading journeys, and the philosophical "Bridges" lens.

## Audience and voice

* **Reader.** A thoughtful young seeker, possibly from another faith (the project owner is Hindu), who wants to
  understand the Bible **as Protestant Christians read it**.
* **Stance.** Explain faithfully and warmly from a mainstream, historic Protestant viewpoint (Reformation:
  Luther, Calvin, the Westminster and Heidelberg tradition, evangelical scholarship). Phrase beliefs as
  "Protestants believe…", "Christians read this as…". Don't preach at the reader, but don't water the
  teaching down either.
* **Respect.** This is a holy book to billions of people. No jokes, no slang, no emoji. Be reverent and clear, and
  write the way a good teacher talks to a curious student.
* **Philosophy.** Where it helps, open the deeper question (being, knowledge, ethics, meaning, time,
  suffering). Name thinkers where relevant (Augustine, Aquinas, Pascal, Kierkegaard, Luther, Calvin,
  Jonathan Edwards, C. S. Lewis, Bonhoeffer, and on the critical side Hume, Nietzsche, Camus) but
  **paraphrase; never quote copyrighted modern works**. Quoting Scripture is fine, using the BSB wording.
* **Honesty.** Mark scholarly uncertainty (authorship, dates) briefly and fairly, and give the traditional
  Protestant view first.
* **Plain English.** Short sentences. Define any technical term the first time you use it.

## Bible reference format (strict)

Use OSIS book codes:
`Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev`

* A single verse is `John.3.16`.
* A whole chapter is `Ps.23`.
* A range uses the full reference at both ends: `Matt.5.1-Matt.7.29` or `John.1.1-John.1.18`.
* Single-chapter books still need a chapter number: `Jude.1.24`, `Phlm.1.6`.

Run `python3 -I pipeline/validate_content.py` from the project root. It must print `content OK`.

## Shared theme ids (use exactly these)

Big Questions: `why-anything`, `who-is-god`, `human-nature`, `evil-and-suffering`, `meaning`,
`truth-and-revelation`, `death-and-hope`, `freedom-and-providence`, `time-and-history`

Core Beliefs: `trinity`, `incarnation`, `sin-and-the-fall`, `covenant`, `atonement`, `resurrection`,
`holy-spirit`, `kingdom-of-god`, `church`, `new-creation`

The Five Solas (Reformation): `sola-scriptura`, `sola-fide`, `sola-gratia`, `solus-christus`, `soli-deo-gloria`

The Good Life: `love`, `forgiveness`, `justice-and-mercy`, `prayer`, `wisdom`, `faith-and-doubt`,
`humility`, `sabbath-and-rest`, `work-and-vocation`, `peace`

## Files and schemas

### `themes.json` is an array of objects
```json
{
  "id": "sola-gratia",
  "title": "Grace Alone",
  "category": "five-solas",            // big-questions | core-beliefs | five-solas | good-life
  "icon": "gift",                      // one lucide icon name from the list below
  "hook": "Can you receive what you could never earn?",   // a short philosophical question, under 70 chars
  "summary": "120-180 words: what Protestants believe and why, grounded in Scripture.",
  "philosophy": "100-160 words: the deeper philosophical question, with thinkers in conversation.",
  "keyVerses": ["Eph.2.8-Eph.2.9", "Rom.3.23-Rom.3.24"],  // 4-8 refs
  "people": ["paul_2479"],             // 0-5 Theographic person slugs (look up in sources/theographic/people.json, field fields.slug)
  "related": ["sola-fide", "atonement"],   // 2-5 theme ids
  "creeds": [{"creed": "heidelberg_catechism", "item": "60", "label": "Heidelberg Catechism Q60"}],  // 1-3
  "reflect": ["three short open questions for personal reflection"],
  "bridge": {                          // or null if no honest parallel exists
    "concept": "Bhakti and Prapatti",
    "tradition": "Hindu (Sri Vaishnava)",
    "resonance": "60-100 words on what genuinely echoes.",
    "difference": "60-100 words on where the two really part ways.",
    "invitation": "One sentence inviting the reader to think further, not a conclusion."
  }
}
```
Creed items: `creed` is a filename in `sources/creeds/` without `.json`. `item` matches the item's
`Number` (catechisms), `Article` (confessions such as Belgic or Canons) or `Chapter` (Westminster Confession,
1689 London Baptist). For single-text creeds (Apostles', Nicene, Athanasian, Chalcedonian) use `"item": ""`.
Open the file and check that the item really says what you claim.

Lucide icons allowed: `sparkles sun moon star mountain flame droplets wind leaf sprout tree-pine heart
hand-heart hands gift crown cross scroll book-open feather key compass map hourglass clock infinity eye
shield scale anchor lamp waves dove church bird users user baby skull door-open link globe music
lightbulb sunrise`.

**Bridges rules.** Compare with Hindu thought (Vedanta, the Upanishads, the Bhagavad Gita, Bhakti
saints, the Sri Vaishnava "monkey vs. kitten" grace debate, karma, dharma, moksha, maya, avatara,
Brahman/Atman, Nasadiya Sukta, and so on) only where the parallel is real. Be scholarly and fair to **both**
traditions: avoid the lazy view that "all religions say the same thing", and don't treat either one as
lesser. Speak of Hindu ideas in their own terms and acknowledge the diversity within Hinduism (Advaita,
Vishishtadvaita, Dvaita). The "difference" field must state the Protestant claim clearly.

### `books.json` is an array of all 66 books in canonical order
```json
{
  "osis": "Gen", "name": "Genesis", "testament": "OT",
  "section": "Law",            // Law | History | Poetry & Wisdom | Major Prophets | Minor Prophets | Gospels | Acts | Paul's Letters | General Letters | Prophecy
  "genre": "Narrative",
  "oneLine": "Under 110 characters.",
  "summary": "60-100 words.",
  "author": "Traditionally Moses",   // note uncertainty briefly
  "date": "c. 1440-1400 BC (traditional)",
  "keyVerse": "Gen.1.1",
  "themes": ["why-anything", "covenant"],   // 2-4 theme ids
  "startHere": false,           // true for about 8 books best for a first-time reader
  "readingTip": "One practical sentence for a first-time reader."
}
```

### `journeys.json` holds 8-10 guided reading paths
```json
{
  "id": "big-story", "title": "The Big Story in 8 Steps",
  "subtitle": "One sentence.", "level": "first-steps",     // first-steps | deeper
  "minutes": 40, "icon": "map",
  "steps": [{"ref": "Gen.1.1-Gen.2.3", "title": "Creation", "note": "40-80 words: what to notice, why it matters."}]
}
```
Suggested journeys: The Big Story; Who Is Jesus? (one Gospel's arc); The Sermon on the Mount; Grace (Paul in
Romans and Galatians); Suffering and Lament (Job, Psalms, Lamentations); Wisdom for Life (Proverbs,
Ecclesiastes, James); Prophets and Justice; Love (1 Cor 13, 1 John, Hosea, Luke 15); The Reformation's Bible
(the passages Luther and Calvin found decisive); Endings and Beginnings (the resurrection and Revelation 21-22).

### `intro.json` is the welcome and explainer content
```json
{
  "sections": [{"id": "what-is-the-bible", "title": "...", "body": "markdown, 120-220 words", "refs": ["2Tim.3.16"]}],
  "storyActs": [{"act": 1, "title": "Creation", "ref": "Gen.1.1-Gen.2.3", "text": "40-60 words"}],
  "glossary": [{"term": "Gospel", "definition": "One or two sentences."}],
  "forSeekers": "markdown, 150-250 words: a warm note to readers from other faiths on how to approach this app."
}
```
Sections: What is the Bible?; Old and New Testaments; The Protestant canon (66 books, and why not the
Apocrypha); How Protestants read the Bible; The Reformation in brief; The Five Solas; How to use this
knowledge graph. Story acts: Creation, Fall, Promise (Abraham/Israel), Law and Kingdom, Exile and Prophets,
Jesus, Church, New Creation. Glossary: 35-45 terms.
