import { NextResponse } from "next/server";
import { deployProject } from "@/lib/aws/deployService";
import { ProjectConfig } from "@/types/project";

export async function POST(request: Request) {
  try {
    const { config, timestamp } = await request.json();
    if (!config || !config.aws.region || !config.aws.assistantId) {
      return NextResponse.json({ error: "Missing config, region, or assistantId." }, { status: 400 });
    }

    if (!config.aws.modelId || config.aws.modelId.trim() === "") {
      return NextResponse.json({ 
        success: false, 
        error: "AI model ID is required for custom prompt deployment. Select a discovered model or enter a model ID manually." 
      }, { status: 400 });
    }


    const result = await deployProject(config as ProjectConfig, timestamp || Date.now());
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
  }
}
