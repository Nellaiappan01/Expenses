type IconProps = { className?: string };

/** Front-view truck tyre with tread — no image file needed */
export function TyreLogoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="5.25" stroke="currentColor" strokeWidth="1.35" opacity="0.85" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M5.1 18.9l1.4-1.4M17.5 6.5l1.4-1.4"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M4.2 15.2c1.2-3.8 4.2-6.2 7.8-6.2s6.6 2.4 7.8 6.2M4.2 8.8c1.2 3.8 4.2 6.2 7.8 6.2s6.6-2.4 7.8-6.2"
        opacity="0.9"
      />
    </svg>
  );
}

/** Truck silhouette for shop / alignment branding */
export function TruckLogoIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 16.5h19" />
      <path d="M4 16.5V8.75A1.25 1.25 0 015.25 7.5H14v9" />
      <path d="M14 8h4.35a1.25 1.25 0 011.15.75l1.75 4.2a1.25 1.25 0 01.1.5V16.5H14" />
      <circle cx="7.25" cy="16.5" r="2.1" />
      <circle cx="17.75" cy="16.5" r="2.1" />
      <path d="M9.35 16.5h5.9" />
      <path d="M16.5 12.25H14" />
      <path d="M5.25 10.25h3.5M5.25 12.75h2.5" opacity="0.7" />
    </svg>
  );
}
