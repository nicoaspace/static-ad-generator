import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Manually load variables from env/.env.local to pass to the Next.js compilation context
const env: Record<string, string> = {};
const envPath = path.join(process.cwd(), "env", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
      env[key.trim()] = value;
      process.env[key.trim()] = value;
    }
  });
}

const nextConfig: NextConfig = {
  /* config options here */
  env,
};

export default nextConfig;
