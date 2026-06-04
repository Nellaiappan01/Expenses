/**
 * Correction tally: find missing Stock In when Out > Opening + In,
 * or godown count does not match the ledger.
 */

export type ItemTallyResult = {
  opening: number;
  totalIn: number;
  totalOut: number;
  expected: number;
  godown: number;
  variance: number;
  missingInQty: number;
  status: "ok" | "correction_in" | "correction_count" | "correction_out";
  hint: string;
  needsCorrection: boolean;
};

export function computeItemTally(params: {
  godown: number;
  openingCount?: number;
  totalIn: number;
  totalOut: number;
}): ItemTallyResult {
  const godown = params.godown ?? 0;
  const totalIn = params.totalIn ?? 0;
  const totalOut = params.totalOut ?? 0;

  const opening =
    params.openingCount !== undefined && params.openingCount !== null
      ? params.openingCount
      : 0;

  const available = opening + totalIn;
  const expected = available - totalOut;
  const variance = godown - expected;
  const missingInQty = Math.max(0, totalOut - available);

  let status: ItemTallyResult["status"] = "ok";
  let hint = "In and Out entries match godown";
  let needsCorrection = false;

  if (missingInQty > 0 || expected < 0) {
    status = "correction_in";
    needsCorrection = true;
    hint = `Out ${totalOut} pcs but Opening ${opening} + In ${totalIn} = ${available} only — add Stock In for ${missingInQty || Math.abs(expected)} pcs`;
  } else if (variance < 0) {
    status = "correction_in";
    needsCorrection = true;
    hint = `Godown ${godown} but book shows ${expected} — add Stock In for ${Math.abs(variance)} pcs (or fix count)`;
  } else if (variance > 0) {
    status = "correction_out";
    needsCorrection = true;
    hint = `Godown ${godown} is ${variance} more than book (${expected}) — add Stock Out or update count`;
  }

  return {
    opening,
    totalIn,
    totalOut,
    expected,
    godown,
    variance,
    missingInQty: missingInQty || (expected < 0 ? Math.abs(expected) : 0),
    status,
    hint,
    needsCorrection,
  };
}

export function formatTallyLine(t: ItemTallyResult): string {
  return `${t.opening} + In ${t.totalIn} − Out ${t.totalOut} = ${t.expected}`;
}
