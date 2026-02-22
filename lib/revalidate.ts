import { revalidatePath } from "next/cache";

export function revalidateUiPaths(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // In tests or non-request contexts, Next cache store may be unavailable.
    }
  }
}
