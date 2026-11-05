/**
 * Date formatting utilities for Vietnamese locale (dd/mm/yyyy)
 * Internal storage always uses ISO YYYY-MM-DD format.
 */

/**
 * Format ISO date string (YYYY-MM-DD) → Vietnamese format (dd/mm/yyyy)
 */
export function formatDateVi(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Format Date object → Vietnamese format (dd/mm/yyyy)
 */
export function formatDateObjVi(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
