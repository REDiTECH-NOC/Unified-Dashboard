/**
 * Shared CSS Grid column templates for ticket table header + rows.
 *
 * Columns (by DOM order):
 *   1. Chevron (16px)   — always
 *   2. Priority (12px)  — always
 *   3. Ticket # (60px)  — always
 *   4. Summary (1fr)    — always
 *   5. Board (~130px)   — md+
 *   6. Company (~160px) — lg+
 *   7. Status (130px)   — always
 *   8. Hours (55px)     — md+
 *   9. Item (~110px)    — xl+
 *  10. Updated (90px)   — sm+
 */
export const GRID_COLS = [
  "grid-cols-[16px_12px_60px_1fr_130px]",
  "sm:grid-cols-[16px_12px_60px_1fr_130px_90px]",
  "md:grid-cols-[16px_12px_60px_1fr_130px_130px_55px_90px]",
  "lg:grid-cols-[16px_12px_60px_1fr_130px_160px_130px_55px_90px]",
  "xl:grid-cols-[16px_12px_60px_1fr_130px_160px_130px_55px_110px_90px]",
].join(" ");

export const GRID_COLS_ACTIONS = [
  "grid-cols-[16px_12px_60px_1fr_130px_80px]",
  "sm:grid-cols-[16px_12px_60px_1fr_130px_90px_80px]",
  "md:grid-cols-[16px_12px_60px_1fr_130px_130px_55px_90px_80px]",
  "lg:grid-cols-[16px_12px_60px_1fr_130px_160px_130px_55px_90px_80px]",
  "xl:grid-cols-[16px_12px_60px_1fr_130px_160px_130px_55px_110px_90px_80px]",
].join(" ");
