import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDS_ROOT = path.join(process.cwd(), "brands");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");

    if (!brand) {
      return NextResponse.json({ success: false, error: "Brand parameter is required" }, { status: 400 });
    }

    const promptsPath = path.join(BRANDS_ROOT, brand, "prompts.json");
    if (!fs.existsSync(promptsPath)) {
      return NextResponse.json({ success: false, error: "prompts.json not found for this brand. Run Phase 2 first." }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { brand, data } = await req.json();

    if (!brand || !data) {
      return NextResponse.json({ success: false, error: "Brand and data fields are required" }, { status: 400 });
    }

    const promptsPath = path.join(BRANDS_ROOT, brand, "prompts.json");
    
    // Create folder if it doesn't exist (safety fallback)
    fs.mkdirSync(path.dirname(promptsPath), { recursive: true });

    // Write file back
    fs.writeFileSync(promptsPath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({ success: true, message: "Prompts updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
