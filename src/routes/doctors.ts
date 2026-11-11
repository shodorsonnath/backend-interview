import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { paginationSchema, paginateMeta } from "../lib/pagination.js";
import { createdAtFilter } from "../lib/dates.js";

export const doctorsRouter = Router();
doctorsRouter.use(requireAdmin);

const createDoctorSchema = z.object({
  name: z.string().min(1).max(200),
  specialization: z.string().min(1).max(200),
  hospital: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email(),
});

const listDoctorsSchema = paginationSchema.extend({
  search: z.string().optional(),
  specialization: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createPatientSchema = z.object({
  fullName: z.string().min(1).max(200),
  condition: z.string().min(1).max(500),
});

const listPatientsSchema = paginationSchema;

doctorsRouter.post("/", async (req, res, next) => {
  try {
    const data = createDoctorSchema.parse(req.body);
    const doctor = await prisma.doctor.create({ data });
    res.status(201).json({ doctor });
  } catch (err) {
    next(err);
  }
});

doctorsRouter.get("/", async (req, res, next) => {
  try {
    const q = listDoctorsSchema.parse(req.query);
    const where = {
      AND: [
        q.specialization
          ? { specialization: { equals: q.specialization, mode: "insensitive" as const } }
          : {},
        q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" as const } },
                { hospital: { contains: q.search, mode: "insensitive" as const } },
                { email: { contains: q.search, mode: "insensitive" as const } },
              ],
            }
          : {},
        createdAtFilter(q.from, q.to) ? { createdAt: createdAtFilter(q.from, q.to) } : {},
      ],
    };

    const [total, doctors] = await Promise.all([
      prisma.doctor.count({ where }),
      prisma.doctor.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { patients: true } } },
      }),
    ]);

    res.json({
      doctors,
      meta: paginateMeta(total, q.page, q.pageSize),
    });
  } catch (err) {
    next(err);
  }
});

doctorsRouter.get("/:id", async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { patients: true } } },
    });
    if (!doctor) {
      throw new AppError(404, "Doctor not found", "NOT_FOUND");
    }
    res.json({ doctor });
  } catch (err) {
    next(err);
  }
});

doctorsRouter.get("/:id/patients", async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    if (!doctor) {
      throw new AppError(404, "Doctor not found", "NOT_FOUND");
    }
    const q = listPatientsSchema.parse(req.query);
    const where = { doctorId: doctor.id };
    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
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

doctorsRouter.post("/:id/patients", async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    if (!doctor) {
      throw new AppError(404, "Doctor not found", "NOT_FOUND");
    }
    const data = createPatientSchema.parse(req.body);
    const patient = await prisma.patient.create({
      data: { ...data, doctorId: doctor.id },
    });
    res.status(201).json({ patient });
  } catch (err) {
    next(err);
  }
});

doctorsRouter.delete("/:doctorId/patients/:patientId", async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.patientId },
    });
    if (!patient || patient.doctorId !== req.params.doctorId) {
      throw new AppError(404, "Patient not found for this doctor", "NOT_FOUND");
    }
    await prisma.patient.delete({ where: { id: patient.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
