import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDS_ROOT = path.join(process.cwd(), "brands");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");
    const file = searchParams.get("file");

    if (!brand || !file) {
      return NextResponse.json({ success: false, error: "Brand and file parameters are required" }, { status: 400 });
    }

    // Path traversal safety checks
    if (brand.includes("..") || brand.includes("/") || brand.includes("\\")) {
      return NextResponse.json({ success: false, error: "Invalid brand parameter" }, { status: 400 });
    }

    if (file.includes("..")) {
      return NextResponse.json({ success: false, error: "Invalid file path traversal attempt" }, { status: 400 });
    }

    // Construct full path
    const filePath = path.join(BRANDS_ROOT, brand, file);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ success: false, error: "Target is not a file" }, { status: 400 });
    }

    // Read file as stream
    const fileStream = fs.createReadStream(filePath);
    
    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".txt") contentType = "text/plain";
    else if (ext === ".md") contentType = "text/markdown";

    // Cast fileStream to any to fit Next.js response body requirements
    return new NextResponse(fileStream as any, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
