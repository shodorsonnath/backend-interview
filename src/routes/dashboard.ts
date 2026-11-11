import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { dayEndUtc, dayStartUtc } from "../lib/dates.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAdmin);

const dashboardQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const q = dashboardQuerySchema.parse(req.query);
    const from = q.from ?? defaultRangeStart();
    const to = q.to ?? defaultRangeEnd();

    const [totalDoctors, totalPatients, patientsPerDoctor, doctorDaily, patientDaily] =
      await Promise.all([
        prisma.doctor.count(),
        prisma.patient.count(),
        prisma.doctor.findMany({
          select: {
            id: true,
            name: true,
            _count: { select: { patients: true } },
          },
          orderBy: { name: "asc" },
        }),
        dailyRegistrations("doctor", from, to),
        dailyRegistrations("patient", from, to),
      ]);

    res.json({
      totals: { doctors: totalDoctors, patients: totalPatients },
      patientsPerDoctor: patientsPerDoctor.map((d) => ({
        doctorId: d.id,
        doctorName: d.name,
        count: d._count.patients,
      })),
      registrations: {
        from,
        to,
        doctors: doctorDaily,
        patients: patientDaily,
      },
    });
  } catch (err) {
    next(err);
  }
});

function defaultRangeEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultRangeStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 29);
  return d.toISOString().slice(0, 10);
}

async function dailyRegistrations(
  kind: "doctor" | "patient",
  from: string,
  to: string,
): Promise<{ date: string; count: number }[]> {
  const start = dayStartUtc(from);
  const end = dayEndUtc(to);
  const table = kind === "doctor" ? "Doctor" : "Patient";

  const rows = await prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(
    `
    SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
    FROM "${table}"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
    GROUP BY day
    ORDER BY day ASC
    `,
    start,
    end,
  );

  const map = new Map(
    rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
  );

  const result: { date: string; count: number }[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const endDay = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
