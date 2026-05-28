import { NextRequest, NextResponse } from "next/server";
import { ProjectConfig } from "@/types/project";
import { getQConnectClient, createAiPrompt, getAiPrompt, deleteAiPrompt } from "@/lib/aws/qconnectClient";
import { CreateAIPromptCommandInput } from "@aws-sdk/client-qconnect";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: ProjectConfig = body.config;
    
    if (!config || !config.aws.region || !config.aws.assistantId) {
      return NextResponse.json({ error: "Missing config, region, or assistantId." }, { status: 400 });
    }

    if (!config.aws.modelId || config.aws.modelId.trim() === "") {
      return NextResponse.json({ 
        success: false, 
        error: "AI model ID is required for custom prompt deployment. Select a discovered model or enter a model ID manually." 
      }, { status: 400 });
    }

    const client = getQConnectClient(config.aws.region);
    const testFormat = config.agents.customerIntentRouter.apiFormat;

    const payload: CreateAIPromptCommandInput = {
      assistantId: config.aws.assistantId,
      name: `SMOKE_TEST_DO_NOT_USE_${Date.now()}`,
      type: "ORCHESTRATION",
      templateType: "TEXT",
      visibilityStatus: "SAVED",
      apiFormat: testFormat,
      modelId: config.aws.modelId,
      templateConfiguration: {
        textFullAIPromptEditTemplateConfiguration: {
          text: "Test Prompt {{$.conversationHistory}} <message>",
        },
      },
    };

    // 1. Create a SAVED prompt
    const createRes = await createAiPrompt(client, payload);
    const promptId = createRes.aiPrompt?.aiPromptId;

    if (!promptId) {
      throw new Error("Smoke test failed: aiPromptId missing in create response.");
    }

    // 2. Read it back
    const getRes = await getAiPrompt(client, {
      assistantId: config.aws.assistantId,
      aiPromptId: promptId,
    });

    const promptData = getRes.aiPrompt;
    if (!promptData) {
      throw new Error("Smoke test failed: aiPrompt missing in get response.");
    }

    // 3. Confirm matching properties
    const checks: any = {
      aiPromptIdExists: !!promptData.aiPromptId,
      typeIsOrchestration: promptData.type === "ORCHESTRATION",
      templateTypeIsText: promptData.templateType === "TEXT",
      apiFormatMatches: promptData.apiFormat === testFormat,
      visibilityStatusIsSaved: promptData.visibilityStatus === "SAVED",
    };

    if (promptData.modelId) {
      checks.modelIdMatches = promptData.modelId === config.aws.modelId;
    }

    const allPassed = Object.values(checks).every(Boolean);

    let message = allPassed ? "Smoke test passed successfully." : "Smoke test failed property validation.";
    if (!promptData.modelId) {
      message += " (Note: AWS API did not return modelId in GetAIPrompt, which is normal for some regions).";
    }

    let cleanupWarning: string | undefined;

    // 4. Cleanup
    try {
      await deleteAiPrompt(client, {
        assistantId: config.aws.assistantId,
        aiPromptId: promptId,
      });
    } catch (cleanupErr: any) {
      cleanupWarning = `Failed to delete temporary smoke test prompt. ID: ${promptId}, Name: ${payload.name}. Error: ${cleanupErr.message}`;
    }

    return NextResponse.json({
      success: allPassed,
      checks,
      promptData,
      cleanupWarning,
      message,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
