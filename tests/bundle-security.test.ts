import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

describe("Bundle Security", () => {
  let bundleContent: string;
  let bundleFiles: { name: string; content: string }[];

  beforeAll(() => {
    const distDir = join(__dirname, "..", "dist", "assets");

    // Build if dist doesn't exist
    if (!existsSync(distDir)) {
      execSync("pnpm build", {
        cwd: join(__dirname, ".."),
        stdio: "pipe",
        timeout: 120000,
        env: { ...process.env, NODE_ENV: "production" },
      });
    }

    const jsFileNames = readdirSync(distDir).filter((f) => f.endsWith(".js"));
    bundleFiles = jsFileNames.map((f) => ({
      name: f,
      content: readFileSync(join(distDir, f), "utf-8"),
    }));
    bundleContent = bundleFiles.map((f) => f.content).join("\n");
  });

  it("should not contain local filesystem paths", () => {
    // This is the critical check — jsxDEV embeds full source paths
    const pathPatterns = [
      /\/home\/[a-z]+\//g, // Linux home dirs
      /\/Users\/[A-Za-z]+\//g, // macOS home dirs
      /[A-Z]:\\Users\\/g, // Windows paths
    ];
    for (const pattern of pathPatterns) {
      const matches = bundleContent.match(pattern);
      expect(matches, `Found local paths: ${matches?.slice(0, 3).join(", ")}`).toBeNull();
    }
  });

  it("should not use jsxDEV runtime (dev JSX)", () => {
    // jsxDEV is the development JSX transform that embeds source file paths
    // Production builds should use jsx/jsxs instead
    const jsxDevCount = (bundleContent.match(/jsxDEV/g) || []).length;
    expect(jsxDevCount, "Bundle contains jsxDEV — build with NODE_ENV=production").toBe(0);
  });

  it("should not contain Cloudflare credentials", () => {
    const FORBIDDEN = [
      "cfk_04hFP161", // Cloudflare API key prefix
      "22c16eaf", // Cloudflare account ID prefix
      "82bbc18a", // D1 database ID prefix
    ];
    for (const s of FORBIDDEN) {
      expect(bundleContent).not.toContain(s);
    }
  });

  it("should not contain private email addresses", () => {
    // Personal addresses are deployment-specific, so this repo's test
    // asserts the generic property instead: no personal Gmail addresses
    // (the mail provider used by the deployment this was extracted from)
    // may appear in the bundle. Deployments can extend this with their
    // own literal addresses in their private test setup.
    expect(bundleContent).not.toMatch(/[a-z0-9._%+-]+@gmail\.com/i);
  });

  it("should not contain Resend API keys", () => {
    // Resend keys start with "re_"
    expect(bundleContent).not.toMatch(/re_[A-Za-z0-9]{20,}/);
  });

  it("should not contain JWT secrets or env var values", () => {
    const FORBIDDEN = [
      "JWT_SECRET",
      "RESEND_API_KEY",
      "AUTH_PASSWORD",
    ];
    for (const s of FORBIDDEN) {
      // Check for the env var name being used as a value (not as a reference)
      expect(bundleContent).not.toMatch(
        new RegExp(`["']${s}["']\\s*:\\s*["'][^"']+["']`)
      );
    }
  });

  it("farm config should be the only file with farm-specific names", () => {
    // The sentinel is the farm `name` from the deployment's local config.
    // The farm config is intentionally bundled with farm-specific data, but
    // NO other bundle file should contain the farm name — that would
    // indicate a source path leak or accidental import.
    //
    // This repo ships no local config (src/farms/local.config.ts is
    // gitignored and provided by each deployment). When it is absent there
    // is no farm-specific name in the source tree, so this check passes
    // trivially: the bundle can only contain the generic example config.
    const localConfigPath = join(__dirname, "..", "src", "farms", "local.config.ts");
    let sentinel: string | null = null;
    if (existsSync(localConfigPath)) {
      const match = readFileSync(localConfigPath, "utf-8").match(
        /name:\s*['"]([^'"]+)['"]/
      );
      sentinel = match?.[1] ?? null;
    }
    if (!sentinel) return; // no local farm config → nothing farm-specific to leak

    const needle = sentinel.toLowerCase();
    const nonConfigFiles = bundleFiles.filter(
      (f) => !f.name.startsWith("farm.config")
    );
    for (const file of nonConfigFiles) {
      const hasSentinel = file.content.toLowerCase().includes(needle);
      expect(
        hasSentinel,
        `"${sentinel}" found in ${file.name} — should only be in farm.config chunk`
      ).toBe(false);
    }
  });
});
