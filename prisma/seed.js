const { PrismaClient, OwnerType, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const operatorUsername = process.env.SEED_OPERATOR_USERNAME || "operador";
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || "operador12345";
  const investorUsername = process.env.SEED_INVESTOR_USERNAME || "inversionista";
  const investorPassword = process.env.SEED_INVESTOR_PASSWORD || "inversionista12345";
  const investorId = process.env.SEED_INVESTOR_ID || "inv_lic";
  const investorName = process.env.SEED_INVESTOR_NAME || "Lic";
  const motoIslaId = process.env.SEED_MOTOISLA_ID || "motoisla";

  await prisma.owner.upsert({
    where: { id: investorId },
    update: {},
    create: {
      id: investorId,
      name: investorName,
      type: OwnerType.INVESTOR,
      initialCapital: 30000,
    },
  });

  await prisma.owner.upsert({
    where: { id: motoIslaId },
    update: {},
    create: {
      id: motoIslaId,
      name: "MotoIsla",
      type: OwnerType.MOTOISLA,
      initialCapital: 0,
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      username: adminUsername,
      email: `${adminUsername}@local.motoisla`,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const operatorHash = await bcrypt.hash(operatorPassword, 10);
  await prisma.user.upsert({
    where: { username: operatorUsername },
    update: {
      passwordHash: operatorHash,
      role: UserRole.OPERADOR,
      ownerId: null,
    },
    create: {
      username: operatorUsername,
      email: `${operatorUsername}@local.motoisla`,
      passwordHash: operatorHash,
      role: UserRole.OPERADOR,
      ownerId: null,
    },
  });

  const investorHash = await bcrypt.hash(investorPassword, 10);
  await prisma.user.upsert({
    where: { username: investorUsername },
    update: {
      passwordHash: investorHash,
      role: UserRole.INVERSIONISTA,
      ownerId: investorId,
    },
    create: {
      username: investorUsername,
      email: `${investorUsername}@local.motoisla`,
      passwordHash: investorHash,
      role: UserRole.INVERSIONISTA,
      ownerId: investorId,
    },
  });

  console.log("Seed completo:");
  console.log(`- Investor: ${investorId}`);
  console.log(`- MotoIsla: ${motoIslaId}`);
  console.log(`- Admin username: ${adminUsername}`);
  console.log(`- Operador username: ${operatorUsername}`);
  console.log(`- Inversionista username: ${investorUsername} (ownerId=${investorId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
