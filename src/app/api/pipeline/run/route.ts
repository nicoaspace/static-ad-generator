import { NextRequest } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { auth } from "@/auth";
import { LIMITS } from "@/lib/limits";
import { estimateGenerateSeconds, estimateResearchSeconds } from "@/lib/pipeline-estimate";
import {
  acquirePipelineLock,
  checkGenerateRun,
  checkResearchRun,
  enforceQuota,
  recordGenerateRun,
  recordResearchRun,
  reclaimStalePipelineLock,
  releasePipelineLock,
} from "@/lib/quota";

export const dynamic = "force-dynamic";

const PROGRESS_PREFIX = "[PIPELINE_PROGRESS] ";

function sseError(message: string, code?: string) {
  return new Response(
    `data: ${JSON.stringify({ type: "exit", success: false, code: 1, quotaConsumed: false, message, errorCode: code })}\n\n`,
    {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function extractProgressEvents(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const idx = line.indexOf(PROGRESS_PREFIX);
    if (idx === -1) continue;
    try {
      events.push(JSON.parse(line.slice(idx + PROGRESS_PREFIX.length)) as Record<string, unknown>);
    } catch {
      /* ignore malformed progress lines */
    }
  }
  return events;
}

function stripProgressLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.includes(PROGRESS_PREFIX))
    .join("\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const brand = searchParams.get("brand");
  const url = searchParams.get("url");
  const product = searchParams.get("product");
  const type = searchParams.get("type") || "product";

  const templates = searchParams.get("templates");
  const resolution = searchParams.get("resolution") || "512";
  const isPublicVersion = process.env.PUBLIC_VERSION === "true";
  const allowedResolutions = isPublicVersion ? ["512", "1K"] : ["512", "1K", "2K", "4K"];
  const safeResolution = allowedResolutions.includes(resolution) ? resolution : "512";
  const rawVariations = parseInt(searchParams.get("variations") || "2", 10);
  const variations = Math.min(
    Number.isFinite(rawVariations) ? rawVariations : 2,
    LIMITS.MAX_VARIATIONS_PER_TEMPLATE
  );
  const dryRun = searchParams.get("dryRun") === "true";

  if (!action || !brand) {
    return new Response(JSON.stringify({ error: "Missing required parameters: action and brand" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  reclaimStalePipelineLock();

  const templateList = templates
    ? templates.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (action === "research") {
    const check = enforceQuota(checkResearchRun(email, brand));
    if (check) {
      const body = await check.json();
      return sseError(body.error || "Quota exceeded", body.code);
    }
  } else if (action === "generate") {
    const check = enforceQuota(
      checkGenerateRun(email, brand, templateList.length, variations, safeResolution)
    );
    if (check) {
      const body = await check.json();
      return sseError(body.error || "Quota exceeded", body.code);
    }
  } else {
    return new Response(JSON.stringify({ error: "Invalid action type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const estimatedSeconds =
    action === "research"
      ? estimateResearchSeconds()
      : estimateGenerateSeconds(templateList.length, variations, safeResolution, isPublicVersion);

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let finished = false;
      let child: ChildProcess | null = null;

      const safeEnqueue = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const detachChild = () => {
        if (!child) return;
        child.stdout?.removeAllListeners("data");
        child.stderr?.removeAllListeners("data");
        child.removeAllListeners("close");
        child.removeAllListeners("error");
      };

      const handleProcessOutput = (text: string, streamType: "stdout" | "stderr") => {
        for (const progress of extractProgressEvents(text)) {
          safeEnqueue({ type: "progress", ...progress });
        }
        const clean = stripProgressLines(text);
        if (clean) {
          safeEnqueue({ type: streamType, text: clean });
        }
      };

      const finish = (code: number | null, errorMessage?: string) => {
        if (finished) return;
        finished = true;
        detachChild();
        releasePipelineLock();

        if (closed) return;

        const success = code === 0;
        if (success) {
          if (action === "research") {
            recordResearchRun(email);
          } else {
            recordGenerateRun(email);
          }
        }

        safeEnqueue({
          type: "exit",
          code,
          success,
          quotaConsumed: success,
          message: success
            ? undefined
            : errorMessage ||
              (code === null
                ? "The pipeline was interrupted before it could finish."
                : "We encountered an error and couldn't finish generating your ads. Please try again in a few minutes."),
        });
        closeStream();
      };

      let scriptPath = "";
      let args: string[] = [];

      if (action === "research") {
        scriptPath = path.join("skills", "references", "pipeline_research.py");
        if (!url || !product) {
          safeEnqueue({
            type: "error",
            text: "Research requires 'url' and 'product' parameters",
            quotaConsumed: false,
          });
          safeEnqueue({ type: "exit", code: 1, success: false, quotaConsumed: false });
          closeStream();
          return;
        }
        args = [scriptPath, "--brand", brand, "--url", url, "--product", product, "--type", type];
      } else {
        scriptPath = path.join("skills", "references", "pipeline_generate.py");
        args = [
          scriptPath,
          "--brand",
          brand,
          "--type",
          type,
          "--resolution",
          safeResolution,
          "--variations",
          String(variations),
        ];
        if (product) args.push("--product", product);
        if (templates) args.push("--templates", templates);
        if (dryRun) args.push("--dry-run");
      }

      safeEnqueue({
        type: "status",
        text: `Spawning: python -u ${args.join(" ")}`,
      });

      safeEnqueue({
        type: "progress",
        percent: 0,
        message: action === "research" ? "Starting brand research…" : "Starting ad generation…",
        estimatedSeconds,
        ...(isPublicVersion && action === "generate"
          ? { secondsPerImage: LIMITS.PUBLIC_SECONDS_PER_IMAGE }
          : {}),
        phase: "init",
      });

      child = spawn("python", ["-u", ...args], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
        },
        shell: true,
      });

      acquirePipelineLock(email, brand, action, child.pid ?? 0);

      child.stdout?.on("data", (data) => {
        handleProcessOutput(data.toString(), "stdout");
      });

      child.stderr?.on("data", (data) => {
        handleProcessOutput(data.toString(), "stderr");
      });

      child.on("close", (code) => {
        finish(code);
      });

      child.on("error", (err) => {
        finish(null, err.message);
      });

      req.signal.addEventListener("abort", () => {
        if (child && !child.killed) {
          child.kill();
        }
        finish(null, "Connection closed.");
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
