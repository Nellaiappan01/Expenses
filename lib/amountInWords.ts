const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function wordsBelow100(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function wordsBelow1000(n: number): string {
  if (n === 0) return "";
  if (n < 100) return wordsBelow100(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES[hundred]} hundred`;
  return rest ? `${head} ${wordsBelow100(rest)}` : head;
}

function integerToIndianWords(n: number): string {
  if (n === 0) return "zero";

  const parts: string[] = [];
  let remaining = n;

  if (remaining >= 10_000_000) {
    const crore = Math.floor(remaining / 10_000_000);
    parts.push(`${wordsBelow100(crore)} crore`);
    remaining %= 10_000_000;
  }
  if (remaining >= 100_000) {
    const lakh = Math.floor(remaining / 100_000);
    parts.push(`${wordsBelow100(lakh)} lakh`);
    remaining %= 100_000;
  }
  if (remaining >= 1_000) {
    const thousand = Math.floor(remaining / 1_000);
    parts.push(`${wordsBelow100(thousand)} thousand`);
    remaining %= 1_000;
  }
  if (remaining > 0) {
    parts.push(wordsBelow1000(remaining));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** e.g. 200 → "Two hundred rupees only", 1.5 → "One rupee and fifty paise only" */
export function amountInWords(amount: string | number): string {
  const raw = typeof amount === "number" ? String(amount) : amount.trim();
  if (!raw) return "";

  const normalized = raw.replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return "";

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "Zero rupees only";

  const [rupeesPart, paisePart = ""] = normalized.split(".");
  const rupees = Number(rupeesPart);
  const paise = paisePart ? Number(paisePart.padEnd(2, "0").slice(0, 2)) : 0;

  if (!Number.isFinite(rupees) || !Number.isFinite(paise)) return "";

  const rupeeWord = rupees === 1 ? "rupee" : "rupees";
  let result = `${integerToIndianWords(rupees)} ${rupeeWord}`;

  if (paise > 0) {
    const paiseWord = paise === 1 ? "paise" : "paise";
    result += ` and ${integerToIndianWords(paise)} ${paiseWord}`;
  }

  return `${capitalizeFirst(result)} only`;
}
