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
    const FORBIDDEN = [
      "spencer.ahrens@gmail.com",
      "eva.sahrens@gmail.com",
    ];
    for (const s of FORBIDDEN) {
      expect(bundleContent.toLowerCase()).not.toContain(s.toLowerCase());
    }
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
    // The farm config is intentionally bundled with farm-specific data.
    // But NO other bundle file should contain "kahiliholo" — that would
    // indicate a source path leak or accidental import.
    const nonConfigFiles = bundleFiles.filter(
      (f) => !f.name.startsWith("farm.config")
    );
    for (const file of nonConfigFiles) {
      const hasKahiliholo = file.content.toLowerCase().includes("kahiliholo");
      expect(
        hasKahiliholo,
        `"kahiliholo" found in ${file.name} — should only be in farm.config chunk`
      ).toBe(false);
    }
  });
});
