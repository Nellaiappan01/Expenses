export type BrandBadgeStyle = {
  bg: string;
  text: string;
  ring: string;
};

const KNOWN_BRANDS: Record<string, BrandBadgeStyle> = {
  mrf: { bg: "bg-[#E31937]", text: "text-white", ring: "ring-[#b8142c]" },
  apollo: { bg: "bg-[#0047AB]", text: "text-white", ring: "ring-[#003580]" },
  ceat: { bg: "bg-[#F05A28]", text: "text-white", ring: "ring-[#c9481f]" },
  jk: { bg: "bg-[#1B8F4E]", text: "text-white", ring: "ring-[#15703d]" },
  jktyre: { bg: "bg-[#1B8F4E]", text: "text-white", ring: "ring-[#15703d]" },
  bridgestone: { bg: "bg-[#E60012]", text: "text-white", ring: "ring-[#b8000e]" },
  michelin: { bg: "bg-[#FFBE00]", text: "text-[#1a1a1a]", ring: "ring-[#cc9800]" },
  goodyear: { bg: "bg-[#FFDD00]", text: "text-[#1a1a1a]", ring: "ring-[#d4b800]" },
  yokohama: { bg: "bg-[#E4002B]", text: "text-white", ring: "ring-[#b80022]" },
  continental: { bg: "bg-[#FFA500]", text: "text-[#1a1a1a]", ring: "ring-[#cc8400]" },
  tvs: { bg: "bg-[#E31E24]", text: "text-white", ring: "ring-[#b8181d]" },
  birla: { bg: "bg-[#0066B3]", text: "text-white", ring: "ring-[#004d87]" },
  maxxis: { bg: "bg-[#00A651]", text: "text-white", ring: "ring-[#008541]" },
  falken: { bg: "bg-[#00A0E9]", text: "text-white", ring: "ring-[#0080ba]" },
  pirelli: { bg: "bg-[#FFD700]", text: "text-[#1a1a1a]", ring: "ring-[#ccac00]" },
  dunlop: { bg: "bg-[#FFD100]", text: "text-[#1a1a1a]", ring: "ring-[#cca700]" },
  hankook: { bg: "bg-[#F37321]", text: "text-white", ring: "ring-[#c25c1a]" },
  nexen: { bg: "bg-[#6B2C91]", text: "text-white", ring: "ring-[#552374]" },
  firestone: { bg: "bg-[#E31837]", text: "text-white", ring: "ring-[#b6132c]" },
  amara: { bg: "bg-[#C9A227]", text: "text-white", ring: "ring-[#a1841f]" },
  amar: { bg: "bg-[#C9A227]", text: "text-white", ring: "ring-[#a1841f]" },
  gold: { bg: "bg-[#D4AF37]", text: "text-[#1a1a1a]", ring: "ring-[#aa8c2c]" },
  ldr: { bg: "bg-[#5C6BC0]", text: "text-white", ring: "ring-[#4a56a0]" },
};

const FALLBACK_PALETTES: BrandBadgeStyle[] = [
  { bg: "bg-violet-600", text: "text-white", ring: "ring-violet-700" },
  { bg: "bg-teal-600", text: "text-white", ring: "ring-teal-700" },
  { bg: "bg-rose-600", text: "text-white", ring: "ring-rose-700" },
  { bg: "bg-cyan-700", text: "text-white", ring: "ring-cyan-800" },
  { bg: "bg-fuchsia-600", text: "text-white", ring: "ring-fuchsia-700" },
  { bg: "bg-lime-600", text: "text-white", ring: "ring-lime-700" },
  { bg: "bg-indigo-600", text: "text-white", ring: "ring-indigo-700" },
  { bg: "bg-orange-600", text: "text-white", ring: "ring-orange-700" },
];

function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashBrand(brand: string): number {
  let h = 0;
  for (let i = 0; i < brand.length; i++) {
    h = (h * 31 + brand.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getBrandBadgeStyle(brand: string): BrandBadgeStyle {
  const key = normalizeBrandKey(brand);
  if (!key) {
    return FALLBACK_PALETTES[0];
  }
  if (KNOWN_BRANDS[key]) {
    return KNOWN_BRANDS[key];
  }
  const knownEntries = Object.entries(KNOWN_BRANDS).sort((a, b) => b[0].length - a[0].length);
  for (const [known, style] of knownEntries) {
    if (known.length >= 3 && key.includes(known)) {
      return style;
    }
  }
  return FALLBACK_PALETTES[hashBrand(key) % FALLBACK_PALETTES.length];
}
