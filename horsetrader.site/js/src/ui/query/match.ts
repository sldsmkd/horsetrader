/**
 * Shared text-match primitives for the entity query seam. Both the entity
 * search and the oshi index reduce to the same ranked prefix-word match over a
 * normalised haystack — this is the one place that logic lives.
 */

/** NFKD-fold, lowercase, collapse non-alphanumerics to single spaces. */
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Rank `query` against a `haystack` of space-joined search terms.
 *
 * Every query word must prefix some haystack term, or the entry is dropped
 * (`null`). Exact full-haystack match ranks 0, any other match ranks 1.
 *
 * Single-character query words match only against `identityHaystack` (defaults
 * to `haystack`) — so a lone letter narrows on identity tokens (a character
 * name) rather than incidental costume/title tokens. Callers that don't need
 * that distinction omit the argument and single letters match the full set.
 */
export function rankPrefixMatch(
  haystack: string,
  query: string,
  identityHaystack: string = haystack,
): number | null {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return null;

  const terms = haystack.split(" ").filter(Boolean);
  const identityTerms = identityHaystack.split(" ").filter(Boolean);
  if (
    !words.every((word) => {
      const candidates = word.length === 1 ? identityTerms : terms;
      return candidates.some((term) => term.startsWith(word));
    })
  ) {
    return null;
  }
  return haystack === words.join(" ") ? 0 : 1;
}
