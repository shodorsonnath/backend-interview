import { z } from "zod";

/** Inclusive date range on UTC calendar days (YYYY-MM-DD). */
export const dateRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (v) => {
      if (v.from && v.to) return v.from <= v.to;
      return true;
    },
    { message: "`from` must be on or before `to`" },
  );

export function dayStartUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function dayEndUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function createdAtFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = dayStartUtc(from);
  if (to) createdAt.lte = dayEndUtc(to);
  return createdAt;
}
