import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  await prisma.business.upsert({
    where: { id: "safulpay-id" },
    update: {},
    create: {
      id: "safulpay-id",
      name: "Safulpay",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log("Seeded Business: Safulpay");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });