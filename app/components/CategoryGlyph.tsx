import type { CategoryIconKey } from "@/lib/categoryVisuals";

export default function CategoryGlyph({
  icon,
  className = "h-4 w-4",
}: {
  icon: CategoryIconKey;
  className?: string;
}) {
  const props = {
    className,
    fill: "none" as const,
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  if (icon === "labour") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (icon === "water") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3s7 7.5 7 11.5A7 7 0 115 14.5C5 10.5 12 3 12 3z" />
      </svg>
    );
  }
  if (icon === "lining") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  }
  if (icon === "scrap") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    );
  }
  if (icon === "heap") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 20h18M5 20V10l7-6 7 6v10" />
      </svg>
    );
  }
  if (icon === "kankani") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }
  if (icon === "tea") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v2m4-2v2m4-2v2M5 8h12a2 2 0 012 2v1a4 4 0 01-4 4h-1a5 5 0 01-5-5V8H5z" />
      </svg>
    );
  }
  if (icon === "truck") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h11v10H3V7zm11 3h4l3 3v4h-7v-7zM7 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    );
  }
  if (icon === "fuel") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3h6v4m-6 0h6m-6 0H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-4l4 2V9l-4 2V9a2 2 0 00-2-2" />
      </svg>
    );
  }
  if (icon === "driver") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z" />
      </svg>
    );
  }
  if (icon === "money") {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.5 0-4 1.2-4 2.5S9.5 13 12 13s4 1.2 4 2.5S14.5 18 12 18m0-10v-2m0 14v-2M5 12a7 7 0 1114 0 7 7 0 01-14 0z" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h10a1 1 0 011 1v16l-6-3-6 3V4a1 1 0 011-1z" />
    </svg>
  );
}
