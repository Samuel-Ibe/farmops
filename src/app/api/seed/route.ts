import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Seed endpoint only available in development" },
        { status: 403 }
      );
    }

    const { stdout, stderr } = await execAsync("npx tsx prisma/seed.ts", {
      cwd: process.cwd(),
      timeout: 60000,
    });

    return NextResponse.json({
      message: "Database seeded successfully",
      output: stdout,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error.message },
      { status: 500 }
    );
  }
}
