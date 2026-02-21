import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  username?: string | null;
  role: UserRole;
  ownerId?: string | null;
  name?: string | null;
  email?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export function isAdmin(user: SessionUser) {
  return user.role === "ADMIN";
}

export function isStaff(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "OPERADOR";
}

export function isInvestor(user: SessionUser) {
  return user.role === "INVERSIONISTA";
}

export function canAccessOwner(user: SessionUser, ownerId: string) {
  if (isStaff(user)) return true;
  return isInvestor(user) && !!user.ownerId && user.ownerId === ownerId;
}
