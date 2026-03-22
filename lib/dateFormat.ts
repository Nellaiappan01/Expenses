/**
 * Global date format: DD/MM/YYYY
 */
export function formatDateDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T12:00:00") : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}:${month}:${year}`;
}

/** With optional time for datetime values */
export function formatDateTimeDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatDateDDMMYYYY(d);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${hours}:${mins}`;
}
