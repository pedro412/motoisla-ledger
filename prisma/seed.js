const { PrismaClient, OwnerType, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const VALID_SEED_MODES = new Set(["dev", "bootstrap", "safe"]);
const DEFAULT_BOOTSTRAP_OWNERS = [
  { id: "inv_lic", name: "Lic", type: OwnerType.INVESTOR, initialCapital: 30000 },
  { id: "motoisla", name: "MotoIsla", type: OwnerType.MOTOISLA, initialCapital: 0 },
];

function resolveSeedMode(env, nodeEnv) {
  const raw = String(env.SEED_MODE || "").trim().toLowerCase();
  if (raw) {
    if (!VALID_SEED_MODES.has(raw)) {
      throw new Error(`SEED_MODE inválido: "${raw}". Valores permitidos: dev|bootstrap|safe`);
    }
    return raw;
  }
  if (String(nodeEnv || "").toLowerCase() === "production") return "safe";
  return "dev";
}

function parseBootstrapOwners(rawJson) {
  if (!rawJson || !String(rawJson).trim()) {
    throw new Error("SEED_BOOTSTRAP_OWNERS_JSON es requerido en SEED_MODE=bootstrap");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("SEED_BOOTSTRAP_OWNERS_JSON no es JSON válido");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("SEED_BOOTSTRAP_OWNERS_JSON debe ser un arreglo con al menos un owner");
  }

  const owners = parsed.map((item, idx) => normalizeOwner(item, idx));
  const ids = new Set();
  for (const owner of owners) {
    if (ids.has(owner.id)) throw new Error(`Owner duplicado en bootstrap: ${owner.id}`);
    ids.add(owner.id);
  }
  return owners;
}

function normalizeOwner(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`Owner inválido en posición ${idx}`);
  }
  const id = String(item.id || "").trim();
  const name = String(item.name || "").trim();
  const type = String(item.type || "").trim().toUpperCase();
  const initialCapital = Number(item.initialCapital);

  if (!id) throw new Error(`Owner en posición ${idx} no tiene id`);
  if (!name) throw new Error(`Owner ${id} no tiene name`);
  if (type !== OwnerType.INVESTOR && type !== OwnerType.MOTOISLA) {
    throw new Error(`Owner ${id} tiene type inválido: ${type}`);
  }
  if (!Number.isFinite(initialCapital) || initialCapital < 0) {
    throw new Error(`Owner ${id} tiene initialCapital inválido: ${item.initialCapital}`);
  }
  return { id, name, type, initialCapital };
}

async function seedOwners(prismaClient, owners) {
  let count = 0;
  for (const owner of owners) {
    await prismaClient.owner.upsert({
      where: { id: owner.id },
      update: {
        name: owner.name,
        type: owner.type,
        initialCapital: owner.initialCapital,
      },
      create: {
        id: owner.id,
        name: owner.name,
        type: owner.type,
        initialCapital: owner.initialCapital,
      },
    });
    count += 1;
  }
  return count;
}

async function seedDevUsers(prismaClient, bcryptModule, env, investorId) {
  const adminUsername = env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = env.SEED_ADMIN_PASSWORD || "admin12345";
  const operatorUsername = env.SEED_OPERATOR_USERNAME || "operador";
  const operatorPassword = env.SEED_OPERATOR_PASSWORD || "operador12345";
  const investorUsername = env.SEED_INVESTOR_USERNAME || "inversionista";
  const investorPassword = env.SEED_INVESTOR_PASSWORD || "inversionista12345";

  const passwordHash = await bcryptModule.hash(adminPassword, 10);
  await prismaClient.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash, role: UserRole.ADMIN, ownerId: null },
    create: {
      username: adminUsername,
      email: `${adminUsername}@local.motoisla`,
      passwordHash,
      role: UserRole.ADMIN,
      ownerId: null,
    },
  });

  const operatorHash = await bcryptModule.hash(operatorPassword, 10);
  await prismaClient.user.upsert({
    where: { username: operatorUsername },
    update: { passwordHash: operatorHash, role: UserRole.OPERADOR, ownerId: null },
    create: {
      username: operatorUsername,
      email: `${operatorUsername}@local.motoisla`,
      passwordHash: operatorHash,
      role: UserRole.OPERADOR,
      ownerId: null,
    },
  });

  const investorHash = await bcryptModule.hash(investorPassword, 10);
  await prismaClient.user.upsert({
    where: { username: investorUsername },
    update: { passwordHash: investorHash, role: UserRole.INVERSIONISTA, ownerId: investorId },
    create: {
      username: investorUsername,
      email: `${investorUsername}@local.motoisla`,
      passwordHash: investorHash,
      role: UserRole.INVERSIONISTA,
      ownerId: investorId,
    },
  });

  return {
    count: 3,
    usernames: {
      adminUsername,
      operatorUsername,
      investorUsername,
    },
  };
}

function inferDefaultDevOwners(env) {
  const investorId = env.SEED_INVESTOR_ID || "inv_lic";
  const investorName = env.SEED_INVESTOR_NAME || "Lic";
  const motoIslaId = env.SEED_MOTOISLA_ID || "motoisla";
  return {
    investorId,
    owners: [
      { id: investorId, name: investorName, type: OwnerType.INVESTOR, initialCapital: 30000 },
      { id: motoIslaId, name: "MotoIsla", type: OwnerType.MOTOISLA, initialCapital: 0 },
    ],
  };
}

async function runSeed(options = {}) {
  const prismaClient = options.prisma || new PrismaClient();
  const bcryptModule = options.bcrypt || bcrypt;
  const env = options.env || process.env;
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV;
  const logger = options.logger || console;

  const mode = resolveSeedMode(env, nodeEnv);
  const isProduction = String(nodeEnv || "").toLowerCase() === "production";
  if (mode === "dev" && isProduction) {
    throw new Error("SEED_MODE=dev está bloqueado en producción.");
  }

  if (mode === "safe") {
    logger.log("[seed] SEED_MODE=safe -> no-op. No se crearán owners ni usuarios.");
    return { mode, ownersCreated: 0, usersCreated: 0 };
  }

  if (mode === "bootstrap") {
    const owners = parseBootstrapOwners(env.SEED_BOOTSTRAP_OWNERS_JSON);
    const ownersCreated = await seedOwners(prismaClient, owners);
    await prismaClient.systemSetting.upsert({
      where: { key: "opex_rate" },
      update: {},
      create: { key: "opex_rate", value: "0.175" },
    });
    logger.log(`[seed] bootstrap completado. Owners upserted: ${ownersCreated}. Usuarios creados: 0.`);
    return { mode, ownersCreated, usersCreated: 0 };
  }

  const devOwners = inferDefaultDevOwners(env);
  const ownersCreated = await seedOwners(prismaClient, devOwners.owners);
  await prismaClient.systemSetting.upsert({
    where: { key: "opex_rate" },
    update: {},
    create: { key: "opex_rate", value: "0.175" },
  });
  const users = await seedDevUsers(prismaClient, bcryptModule, env, devOwners.investorId);
  logger.log("[seed] dev completado (solo desarrollo).");
  logger.log(`- Owners upserted: ${ownersCreated}`);
  logger.log(`- Admin username: ${users.usernames.adminUsername}`);
  logger.log(`- Operador username: ${users.usernames.operatorUsername}`);
  logger.log(`- Inversionista username: ${users.usernames.investorUsername} (ownerId=${devOwners.investorId})`);
  return { mode, ownersCreated, usersCreated: users.count };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  runSeed({ prisma })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  runSeed,
  resolveSeedMode,
  parseBootstrapOwners,
};
