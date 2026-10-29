const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 12);
  const subjects = ["DBMS", "OS", "DSA", "Maths", "Networks"];

  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.user.deleteMany();

  const tutors = [];
  for (let i = 1; i <= 5; i++) {
    tutors.push(
      await prisma.user.create({
        data: {
          name: `Tutor ${i}`, email: `tutor${i}@example.com`, passwordHash,
          role: "TUTOR", verified: true, subjects: [subjects[i - 1]], bio: "Peer tutor",
        },
      })
    );
  }
  for (let i = 1; i <= 15; i++) {
    await prisma.user.create({
      data: { name: `Learner ${i}`, email: `learner${i}@example.com`, passwordHash, verified: true },
    });
  }

  let n = 0;
  for (const t of tutors) {
    for (let d = 1; d <= 12; d++) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + d);
      start.setUTCHours(10, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await prisma.slot.create({
        data: {
          tutorId: t.id, subject: subjects[n++ % subjects.length],
          startUtc: start, endUtc: end, mode: "ONLINE", link: "https://meet.example.com/demo",
        },
      });
    }
  }
  console.log("Seeded 5 tutors, 15 learners, 60 slots");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());