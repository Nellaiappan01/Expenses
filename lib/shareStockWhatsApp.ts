import { stockHeroUrl } from "@/lib/cloudinaryUrls";

export type StockShareParams = {
  shopName?: string;
  name: string;
  count: number;
  brand?: string;
  size?: string;
  photoUrl?: string;
  /** Claim / approval request — customer & issue (does not change godown). */
  customerName?: string;
  customerPhone?: string;
  issueNote?: string;
  shareKind?: "product" | "approval";
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "product";
}

/** Message text for WhatsApp (title + godown stock + optional photo link). */
export function buildStockWhatsAppText(p: StockShareParams): string {
  if (p.shareKind === "approval" && p.customerName) {
    const lines: string[] = [];
    if (p.shopName?.trim()) {
      lines.push(`*${p.shopName.trim()}*`, "");
    }
    lines.push("*Claim apply*");
    lines.push(`Name: *${p.customerName.trim()}*`);
    if (p.customerPhone?.trim()) {
      lines.push(`Mobile: *${p.customerPhone.trim()}*`);
    }
    lines.push("");
    lines.push(`Product: *${p.name.trim()}*`);
    if (p.issueNote?.trim()) {
      lines.push(`Issue: ${p.issueNote.trim()}`);
    }
    lines.push(`Godown (info): ${p.count} pcs`);
    if (p.photoUrl) {
      lines.push("", `Photo: ${stockHeroUrl(p.photoUrl)}`);
    }
    return lines.join("\n");
  }

  const lines: string[] = [];
  if (p.shopName?.trim()) {
    lines.push(`*${p.shopName.trim()}*`, "");
  }
  lines.push(`*${p.name.trim()}*`);
  if (p.brand?.trim() || p.size?.trim()) {
    lines.push([p.brand?.trim(), p.size?.trim()].filter(Boolean).join(" · "));
  }
  lines.push(`Godown stock: *${p.count}* pcs`);
  if (p.photoUrl) {
    lines.push("", `Photo: ${stockHeroUrl(p.photoUrl)}`);
  }
  return lines.join("\n");
}

/**
 * Share product to WhatsApp: native share with image when supported, else wa.me link.
 */
export async function shareStockOnWhatsApp(
  p: StockShareParams
): Promise<"shared" | "opened" | "cancelled"> {
  const text = buildStockWhatsAppText(p);
  const imageUrl = p.photoUrl ? stockHeroUrl(p.photoUrl) : undefined;

  if (typeof navigator !== "undefined" && navigator.share && imageUrl) {
    try {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], `${sanitizeFilename(p.name)}.jpg`, {
          type: blob.type || "image/jpeg",
        });
        const shareData: ShareData = {
          title: p.name,
          text: buildStockWhatsAppText({ ...p, photoUrl: undefined }),
          files: [file],
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return "shared";
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return "opened";
}
