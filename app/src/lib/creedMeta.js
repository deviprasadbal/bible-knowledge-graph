// Shared metadata for the Creeds index and reader pages (Creeds.jsx, Creed.jsx).
import { bookByOsis, formatRef, parseRef } from './data';

export const FORMATS = {
  Creed: { label: 'Creed', plural: 'Creeds', unit: ['text', 'texts'] },
  Confession: { label: 'Confession', plural: 'Confessions', unit: ['chapter', 'chapters'] },
  Catechism: { label: 'Catechism', plural: 'Catechisms', unit: ['question', 'questions'] },
  Canon: { label: 'Articles', plural: 'Articles & canons', unit: ['article', 'articles'] },
  HenrysCatechism: { label: 'Catechism exposition', plural: 'Expositions', unit: ['question', 'questions'] },
};
export const FORMAT_ORDER = ['Creed', 'Confession', 'Catechism', 'Canon', 'HenrysCatechism'];
export const formatInfo = (f) => FORMATS[f] || { label: f || 'Document', plural: f || 'Documents', unit: ['item', 'items'] };

// A few documents name their parts differently.
const UNIT_OVERRIDES = {
  council_of_orange: ['canon', 'canons'],
  ten_theses_of_berne: ['thesis', 'theses'],
  canons_of_dort: ['head of doctrine', 'heads of doctrine'],
};

export const ERAS = [
  {
    id: 'early', title: 'The Early Church', short: 'Early Church', range: 'Before 600', from: 100, to: 600,
    test: (y) => y < 600,
    blurb: 'In the first centuries, Christians summed up the apostles’ teaching in short “rules of faith”, and then, after long debates about who Jesus is, in the creeds of the great councils.',
  },
  {
    id: 'medieval', title: 'Medieval & Pre-Reformation', short: 'Medieval', range: '600–1516', from: 600, to: 1517,
    test: (y) => y >= 600 && y <= 1516,
    blurb: 'Through the medieval centuries the Western church received the Apostles’ and Athanasian Creeds in the forms still used today. The Apostles’ Creed has much older roots in the baptismal confession of the early church in Rome.',
  },
  {
    id: 'reformation', title: 'The Reformation', short: 'Reformation', range: '1517–1650', from: 1517, to: 1650,
    test: (y) => y >= 1517 && y <= 1650,
    blurb: 'From 1517, when Luther posted his Ninety-five Theses, Protestant churches across Europe wrote confessions and catechisms to teach their people and to explain their faith to rulers and critics.',
  },
  {
    id: 'post', title: 'After the Reformation', short: 'After 1650', range: 'After 1650', from: 1650, to: 1900,
    test: (y) => y > 1650,
    blurb: 'Later generations, especially Baptists and Presbyterians in Britain and America, adapted these standards and wrote catechisms for children, households and new churches.',
  },
];
export const eraOf = (y) => ERAS.find((e) => e.test(y ?? 9999)) || ERAS[ERAS.length - 1];

export const FEATURED = [
  {
    id: 'apostles_creed', icon: 'cross',
    blurb: 'The best-known summary of Christian belief, rooted in the baptismal confession of the early church in Rome. Short enough to learn by heart.',
  },
  {
    id: 'nicene_creed', icon: 'sun',
    blurb: 'Written by the councils of Nicaea (325) and Constantinople (381) to confess that Jesus is “Light of Light, very God of very God”. Shared by nearly every Christian tradition.',
  },
  {
    id: 'westminster_shorter_catechism', icon: 'compass',
    blurb: 'One hundred and seven questions and answers, opening with the most famous of all: what is the chief end of man?',
  },
  {
    id: 'heidelberg_catechism', icon: 'hand-heart',
    blurb: 'A warm, personal catechism from Germany that begins by asking: what is your only comfort in life and in death?',
  },
];

// Short origin notes for well-known documents whose source data has no origin story.
export const CONTEXT = {
  nicene_creed:
    'In 325 the Council of Nicaea met to answer Arius, a priest who taught that the Son of God was a created being. The council confessed that the Son is “of one substance” with the Father. In 381 the Council of Constantinople enlarged the creed, especially its words about the Holy Spirit. The phrase “and the Son” was added later in the Latin West, and the Eastern churches do not use it.',
  heidelberg_catechism:
    'Frederick III, ruler of the Palatinate in Germany, asked for a catechism to teach the young and to guide pastors. Written mainly by Zacharias Ursinus and published in Heidelberg in 1563, its 129 questions follow a simple path: our misery, our deliverance in Christ, and our gratitude.',
  westminster_shorter_catechism:
    'The Westminster Assembly, called by the English Parliament in 1643, was asked to reform the teaching and worship of the Church of England. Beside its Confession and Larger Catechism it prepared this Shorter Catechism for beginners and children. It became the most widely used catechism in the English-speaking Reformed world.',
};

export function docYear(d) {
  const lbl = String(d?.yearLabel ?? d?.year ?? '').trim();
  if (d?.year != null && d.year < 1000 && /\d/.test(lbl)) return lbl.replace(/(\d+)/, 'AD $1');
  return lbl;
}

// Small spelling slips in the source metadata, corrected for display.
const NAME_FIXES = { 'First Council of Constantsnople': 'First Council of Constantinople' };
export const cleanName = (n) => NAME_FIXES[n] || n;

export function authorLine(authors, max = 2) {
  const a = (authors || []).filter(Boolean).map(cleanName);
  if (!a.length) return '';
  if (a.length <= max) return a.length === 2 ? `${a[0]} and ${a[1]}` : a[0];
  const rest = a.length - (max - 1);
  return `${a.slice(0, max - 1).join(', ')} and ${rest} others`;
}

export function unitFor(d) {
  return UNIT_OVERRIDES[d?.id] || formatInfo(d?.format).unit;
}

export function itemCountLabel(d) {
  const n = d?.items ?? d?.content?.length ?? 0;
  if (d?.format === 'Creed' && n <= 1) return 'A single text';
  const [one, many] = unitFor(d);
  return `${n} ${n === 1 ? one : many}`;
}

/** Compact reference label for chips, e.g. "1 Cor 6:19" or "Rom 3:23–24". */
export function shortRef(ref) {
  const p = parseRef(ref);
  const full = formatRef(ref);
  if (!p) return full;
  const name = bookByOsis(p.start.b)?.name;
  const abbr = p.start.b.replace(/^([1-3])/, '$1 ');
  return name ? full.split(name).join(abbr) : full;
}

/** Tidy shouted titles ("CONCERNING GOD", "WHAT is the chief end") for display. */
export function tidyTitle(t) {
  const s = String(t || '').trim();
  if (!s) return s;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    const small = new Set(['of', 'the', 'and', 'in', 'on', 'to', 'a', 'an', 'for', 'or', 'by', 'with', 'from', 'unto']);
    return s.toLowerCase().replace(/[a-z][a-z']*/g, (w, i) => (i > 0 && small.has(w) ? w : w[0].toUpperCase() + w.slice(1)));
  }
  return s.replace(/^([A-Z])([A-Z]+)(\s+[a-z])/, (_, a, b, c) => a + b.toLowerCase() + c);
}
