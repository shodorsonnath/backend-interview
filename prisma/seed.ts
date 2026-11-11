import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SPECIALIZATIONS = [
  "Cardiology",
  "Neurology",
  "Pediatrics",
  "Orthopedics",
  "Dermatology",
  "Oncology",
  "General Practice",
] as const;

const CONDITIONS = [
  "Hypertension",
  "Type 2 Diabetes",
  "Asthma",
  "Migraine",
  "Arthritis",
  "Eczema",
  "Anxiety",
  "Back pain",
] as const;

const FIRST = ["Ava", "Noah", "Mia", "Liam", "Zara", "Omar", "Elena", "Raj", "Sofia", "Ken"];
const LAST = ["Patel", "Chen", "Nguyen", "Rivera", "Kim", "Hassan", "Brooks", "Silva", "Okafor", "Grant"];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "test@gmail.com";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD must be set when running the seed.");
  }
  const hash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    create: { email, passwordHash: hash },
    update: { passwordHash: hash },
  });

  const existingDoctors = await prisma.doctor.count();
  if (existingDoctors >= 12) {
    console.log("Seed: doctors already present, skipping synthetic data.");
    return;
  }

  const hospitals = [
    "City General Hospital",
    "St. Mary's Medical Center",
    "Riverside Clinic",
    "Northside Health",
  ];

  const doctors: { id: string; createdAt: Date }[] = [];
  for (let i = 0; i < 14; i++) {
    const createdAt = daysAgo(Math.floor(i * 2.1) % 45);
    const doc = await prisma.doctor.create({
      data: {
        name: `Dr. ${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
        specialization: SPECIALIZATIONS[i % SPECIALIZATIONS.length],
        hospital: hospitals[i % hospitals.length],
        phone: `+1-555-01${String(i).padStart(2, "0")}`,
        email: `doctor${i + 1}@clinic.example`,
        createdAt,
      },
    });
    doctors.push({ id: doc.id, createdAt: doc.createdAt });
  }

  let patientIndex = 0;
  for (const doc of doctors) {
    const count = 3 + (patientIndex % 5);
    for (let j = 0; j < count; j++) {
      patientIndex++;
      const offset = (patientIndex * 3) % 40;
      await prisma.patient.create({
        data: {
          fullName: `${FIRST[patientIndex % FIRST.length]} ${LAST[(patientIndex + j) % LAST.length]}`,
          condition: CONDITIONS[patientIndex % CONDITIONS.length],
          doctorId: doc.id,
          createdAt: daysAgo(offset),
        },
      });
    }
  }

  console.log(`Seed complete: admin ${email}, ${doctors.length} doctors, ${patientIndex} patients.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
