import type { SessionUser } from "@/lib/authz";
import { isInvestor } from "@/lib/authz";

export function resolveOwnerScope(user: SessionUser, requestedOwnerId?: string | null) {
  if (isInvestor(user)) {
    return user.ownerId ?? "";
  }
  return requestedOwnerId ?? "";
}

export function canQueryOwner(user: SessionUser, ownerId: string) {
  if (!ownerId) return false;
  if (isInvestor(user)) {
    return user.ownerId === ownerId;
  }
  return true;
}
