export function isBlockedPathForInvestor(pathname: string) {
  return (
    pathname.startsWith("/purchases") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/investors") ||
    pathname.startsWith("/api/purchases") ||
    pathname.startsWith("/api/sales") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/investors") ||
    pathname.startsWith("/api/capital/reconcile") ||
    pathname.startsWith("/api/health")
  );
}
