const HASHTAG_RE = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50})/gu;
const MENTION_RE = /(?:^|[^\p{L}\p{N}_@])@([a-z0-9_.]{3,30})/giu;

export function extractHashtags(text = '') {
  const tags = new Set();
  for (const m of text.matchAll(HASHTAG_RE)) tags.add(m[1].toLowerCase());
  return [...tags].slice(0, 30);
}

export function extractMentions(text = '') {
  const names = new Set();
  for (const m of text.matchAll(MENTION_RE)) names.add(m[1].toLowerCase());
  return [...names].slice(0, 20);
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
