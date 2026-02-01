import { ALLOWED_PACKAGES } from "../agents/tools";

/**
 * Extract package names from architecture markdown PACKAGES: section.
 * Format expected: "PACKAGES:\n- package-name: reason\n- other-package: reason"
 * Only returns packages that are in the ALLOWED_PACKAGES whitelist.
 */
export function extractPackagesFromArchitecture(architecture: string): string[] {
  const packagesMatch = architecture.match(/PACKAGES:\s*\n((?:- .+\n?)*)/);
  if (!packagesMatch) return [];

  const lines = packagesMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
  const packages: string[] = [];

  for (const line of lines) {
    // Format: "- package-name: reason" or "- @scope/package: reason"
    const match = line.match(/^-\s+(@?[a-z0-9-~][a-z0-9-._~/]*?)(?::|\s)/);
    if (match) {
      const pkg = match[1].trim();
      if (ALLOWED_PACKAGES.has(pkg)) {
        packages.push(pkg);
      }
    }
  }

  return packages;
}
