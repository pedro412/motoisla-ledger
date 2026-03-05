import { db } from "@/lib/db";

export async function getSetting(key: string): Promise<string | null> {
  const s = await db.systemSetting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export async function getOpexRate(): Promise<number> {
  const val = await getSetting("opex_rate");
  const rate = parseFloat(val ?? "0.175");
  return isNaN(rate) ? 0.175 : Math.max(0, Math.min(1, rate));
}

export async function setSetting(key: string, value: string, actorUserId?: string) {
  await db.systemSetting.upsert({
    where: { key },
    update: { value, updatedByUserId: actorUserId ?? null },
    create: { key, value, updatedByUserId: actorUserId ?? null },
  });
}
