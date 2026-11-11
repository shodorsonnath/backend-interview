import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { paginationSchema, paginateMeta } from "../lib/pagination.js";
import { createdAtFilter } from "../lib/dates.js";

export const patientsRouter = Router();
patientsRouter.use(requireAdmin);

const listPatientsSchema = paginationSchema.extend({
  search: z.string().optional(),
  condition: z.string().optional(),
  doctorId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updatePatientSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  condition: z.string().min(1).max(500).optional(),
  doctorId: z.string().optional(),
});

patientsRouter.get("/conditions", async (_req, res, next) => {
  try {
    const rows = await prisma.patient.findMany({
      distinct: ["condition"],
      select: { condition: true },
      orderBy: { condition: "asc" },
    });
    res.json({ conditions: rows.map((r) => r.condition) });
  } catch (err) {
    next(err);
  }
});

patientsRouter.get("/", async (req, res, next) => {
  try {
    const q = listPatientsSchema.parse(req.query);
    const where = {
      AND: [
        q.doctorId ? { doctorId: q.doctorId } : {},
        q.condition
          ? { condition: { equals: q.condition, mode: "insensitive" as const } }
          : {},
        q.search
          ? {
              fullName: { contains: q.search, mode: "insensitive" as const },
            }
          : {},
        createdAtFilter(q.from, q.to) ? { createdAt: createdAtFilter(q.from, q.to) } : {},
      ],
    };

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          doctor: { select: { id: true, name: true, specialization: true } },
        },
      }),
    ]);

    res.json({
      patients,
      meta: paginateMeta(total, q.page, q.pageSize),
    });
  } catch (err) {
    next(err);
  }
});

patientsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updatePatientSchema.parse(req.body);
    if (data.doctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { id: data.doctorId } });
      if (!doctor) {
        throw new AppError(400, "Invalid doctorId", "VALIDATION_ERROR");
      }
    }
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, "Patient not found", "NOT_FOUND");
    }
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data,
      include: {
        doctor: { select: { id: true, name: true, specialization: true } },
      },
    });
    res.json({ patient });
  } catch (err) {
    next(err);
  }
});

patientsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, "Patient not found", "NOT_FOUND");
    }
    await prisma.patient.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
