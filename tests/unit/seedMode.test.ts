const { runSeed, resolveSeedMode, parseBootstrapOwners } = require("../../prisma/seed.js");

function makePrismaMock() {
  return {
    owner: { upsert: vi.fn().mockResolvedValue(null) },
    user: { upsert: vi.fn().mockResolvedValue(null) },
    systemSetting: { upsert: vi.fn().mockResolvedValue(null) },
  };
}

describe("seed mode policy", () => {
  it("defaults to safe in production when SEED_MODE is not set", () => {
    expect(resolveSeedMode({}, "production")).toBe("safe");
  });

  it("safe mode creates neither owners nor users", async () => {
    const prisma = makePrismaMock();
    const result = await runSeed({
      prisma,
      env: { SEED_MODE: "safe" },
      nodeEnv: "production",
      logger: { log: vi.fn() },
    });

    expect(result.mode).toBe("safe");
    expect(result.ownersCreated).toBe(0);
    expect(result.usersCreated).toBe(0);
    expect(prisma.owner.upsert).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("bootstrap mode creates owners and no users", async () => {
    const prisma = makePrismaMock();
    const result = await runSeed({
      prisma,
      env: {
        SEED_MODE: "bootstrap",
        SEED_BOOTSTRAP_OWNERS_JSON:
          '[{"id":"inv_a","name":"Inv A","type":"INVESTOR","initialCapital":20000},{"id":"motoisla","name":"MotoIsla","type":"MOTOISLA","initialCapital":0}]',
      },
      nodeEnv: "production",
      logger: { log: vi.fn() },
    });

    expect(result.mode).toBe("bootstrap");
    expect(result.ownersCreated).toBe(2);
    expect(result.usersCreated).toBe(0);
    expect(prisma.owner.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("bootstrap parsing fails on invalid JSON", () => {
    expect(() => parseBootstrapOwners("not-json")).toThrow("JSON válido");
  });

  it("dev mode creates owners and demo users", async () => {
    const prisma = makePrismaMock();
    const bcryptMock = {
      hash: vi.fn().mockResolvedValue("hashed"),
    };
    const result = await runSeed({
      prisma,
      bcrypt: bcryptMock,
      env: { SEED_MODE: "dev" },
      nodeEnv: "development",
      logger: { log: vi.fn() },
    });

    expect(result.mode).toBe("dev");
    expect(result.ownersCreated).toBe(2);
    expect(result.usersCreated).toBe(3);
    expect(prisma.owner.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(3);
  });
});
