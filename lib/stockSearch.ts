/** Fields searched on stock items (godown, evening check, movement, public view). */
export type StockSearchable = {
  name: string;
  sku?: string;
  brand?: string;
  size?: string;
  category?: string;
  location?: string;
  notes?: string;
};

/** Split into lowercase alphanumeric tokens (10.00 R20 LDR → 10, 00, r20, ldr). */
export function tokenizeStockText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

export function queryTokens(query: string): string[] {
  return tokenizeStockText(query.trim());
}

function tokenMatchesWord(queryToken: string, word: string): boolean {
  if (!queryToken) return false;
  return word === queryToken || word.startsWith(queryToken);
}

function tokensMatchWords(words: string[], queryToks: string[]): boolean {
  if (queryToks.length === 0) return true;
  return queryToks.every((qt) => words.some((w) => tokenMatchesWord(qt, w)));
}

export function stockSearchWords(item: StockSearchable): string[] {
  const parts = [
    item.name,
    item.sku,
    item.brand,
    item.size,
    item.category,
    item.location,
    item.notes,
  ].filter((p): p is string => !!p?.trim());

  return [...new Set(parts.flatMap(tokenizeStockText))];
}

/**
 * Word-aware stock search. Avoids false positives like "LD" matching "Go**ld**".
 * Each query token must match a whole word (exact or prefix), e.g. LD → LDR, LD.
 */
export function matchesStockSearch(item: StockSearchable, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  const qToks = queryTokens(q);
  if (qToks.length === 0) return true;

  const allWords = stockSearchWords(item);
  if (tokensMatchWords(allWords, qToks)) return true;

  const fields = [
    item.name,
    item.sku,
    item.brand,
    item.size,
    item.category,
    item.location,
    item.notes,
  ];

  return fields.some((field) => {
    if (!field?.trim()) return false;
    return tokensMatchWords(tokenizeStockText(field), qToks);
  });
}

/** Higher = better match. 0 = no match. */
export function scoreStockSearch(item: StockSearchable, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const qToks = queryTokens(query);
  if (qToks.length === 0) return 0;

  const nameLower = item.name.toLowerCase().trim();
  const nameWords = tokenizeStockText(item.name);
  const allWords = stockSearchWords(item);

  if (nameLower === q) return 100;
  if (nameLower.startsWith(q)) return 90;

  if (tokensMatchWords(nameWords, qToks)) {
    const exact = qToks.filter((qt) => nameWords.some((w) => w === qt)).length;
    return 75 + exact * 8;
  }

  if (tokensMatchWords(allWords, qToks)) {
    const inName = qToks.filter((qt) => nameWords.some((w) => tokenMatchesWord(qt, w))).length;
    return 45 + inName * 10 + qToks.length * 3;
  }

  return 0;
}
