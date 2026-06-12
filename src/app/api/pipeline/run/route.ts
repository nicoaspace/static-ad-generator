import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action"); // "research" | "generate"
  const brand = searchParams.get("brand");
  const url = searchParams.get("url");
  const product = searchParams.get("product");
  const type = searchParams.get("type") || "product"; // "product" | "service"
  
  // Generation specific parameters
  const templates = searchParams.get("templates"); // e.g. "1,7,13"
  const resolution = searchParams.get("resolution") || "1K";
  const variations = searchParams.get("variations") || "4";
  const dryRun = searchParams.get("dryRun") === "true";

  if (!action || !brand) {
    return new Response(JSON.stringify({ error: "Missing required parameters: action and brand" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let scriptPath = "";
      let args: string[] = [];

      if (action === "research") {
        scriptPath = path.join("skills", "references", "pipeline_research.py");
        if (!url || !product) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: "Research requires 'url' and 'product' parameters" })}\n\n`));
          controller.close();
          return;
        }
        args = [
          scriptPath,
          "--brand", brand,
          "--url", url,
          "--product", product,
          "--type", type
        ];
      } else if (action === "generate") {
        scriptPath = path.join("skills", "references", "pipeline_generate.py");
        args = [
          scriptPath,
          "--brand", brand,
          "--type", type,
          "--resolution", resolution,
          "--variations", variations
        ];
        if (product) {
          args.push("--product", product);
        }
        if (templates) {
          args.push("--templates", templates);
        }
        if (dryRun) {
          args.push("--dry-run");
        }
      } else {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: "Invalid action type" })}\n\n`));
        controller.close();
        return;
      }

      // Enqueue start message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "status", text: `Spawning: python ${args.join(" ")}` })}\n\n`));

      // Spawn process
      // On Windows, sometimes 'python' is mapped, sometimes we need to use 'py' or absolute path.
      // We will try running 'python' and fallback to standard execution.
      const child = spawn("python", args, {
        cwd: process.cwd(),
        env: { ...process.env },
        shell: true, // Use shell to correctly handle python executable in conda paths on Windows
      });

      child.stdout.on("data", (data) => {
        const text = data.toString();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "stdout", text })}\n\n`));
      });

      child.stderr.on("data", (data) => {
        const text = data.toString();
        // Stderr sometimes contains warning or standard progress. Keep it distinct.
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "stderr", text })}\n\n`));
      });

      child.on("close", (code) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "exit", code })}\n\n`));
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
