import { NextRequest, NextResponse } from "next/server";
import { ProjectConfig } from "@/types/project";
import { getQConnectClient, createAiPrompt, deleteAiPrompt } from "@/lib/aws/qconnectClient";
import { CreateAIPromptCommandInput } from "@aws-sdk/client-qconnect";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import yaml from "js-yaml";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: ProjectConfig = body.config;
    
    // 1. Settings Validation
    if (!config || !config.aws.region || !config.aws.assistantId) {
      return NextResponse.json({ error: "Missing config, region, or assistantId." }, { status: 400 });
    }

    if (!config.aws.modelId || config.aws.modelId.trim() === "") {
      return NextResponse.json({ 
        error: "AI model ID is required for custom prompt deployment. Select a discovered model or enter a model ID manually." 
      }, { status: 400 });
    }

    if (config.aws.deploymentMode.includes("agents") && (!config.aws.connectInstanceId || !config.aws.connectRegion)) {
      return NextResponse.json({ 
        error: "Amazon Connect Instance ID and Region are required to deploy Orchestration Agents. Please set them in the Connect Config section." 
      }, { status: 400 });
    }

    // 2. YAML Validation for Messages format
    for (const agent of config.agents) {
      if (!agent.enabled) continue;
      
      if (agent.apiFormat === "MESSAGES") {
        try {
          const parsed = yaml.load(agent.promptTemplate) as any;
          if (!parsed || typeof parsed !== 'object') {
            return NextResponse.json({ error: `YAML Validation Failed [${agent.name}]: Prompt is not in expected YAML format.` }, { status: 400 });
          }
          if (!parsed.messages || !Array.isArray(parsed.messages)) {
            return NextResponse.json({ error: `YAML Validation Failed [${agent.name}]: Messages array missing or invalid.` }, { status: 400 });
          }
          
          let hasHistory = false;
          for (const msg of parsed.messages) {
            if (typeof msg === "string" && msg.includes("{{$.conversationHistory}}")) {
              hasHistory = true;
            } else if (msg.role && msg.content && typeof msg.content === "string" && msg.content.includes("{{$.conversationHistory}}")) {
              hasHistory = true;
            }
          }
          
          if (!hasHistory) {
             return NextResponse.json({ error: `YAML Validation Failed [${agent.name}]: Missing {{$.conversationHistory}} in messages array.` }, { status: 400 });
          }
        } catch (e: any) {
          return NextResponse.json({ error: `YAML Parse Error [${agent.name}]: ${e.message}` }, { status: 400 });
        }
      }
    }

    // 3. AWS Credentials / Account Check
    let accountId = "";
    try {
      const sts = new STSClient({ region: config.aws.region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account || "";
      if (!accountId) throw new Error("Account ID missing from identity response");
    } catch (err: any) {
      return NextResponse.json({ error: `AWS Credentials Error: Failed to authenticate or fetch STS Identity. Ensure your CLI credentials are valid. Details: ${err.message}` }, { status: 400 });
    }

    // 4. Q Connect API Write Test
    const client = getQConnectClient(config.aws.region);
    const testFormat = config.agents.length > 0 ? config.agents[0].apiFormat : "MESSAGES";

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
          text: testFormat === "MESSAGES" 
            ? "system: \"Test smoke prompt\"\nmessages:\n  - \"{{$.conversationHistory}}\"\n  - role: assistant\n    content: \"<message>\""
            : "Test Prompt {{$.conversationHistory}} <message>",
        },
      },
    };

    let promptId;
    try {
      const createRes = await createAiPrompt(client, payload);
      promptId = createRes.aiPrompt?.aiPromptId;
      if (!promptId) throw new Error("aiPromptId missing in create response");
    } catch (err: any) {
       return NextResponse.json({ error: `Q Connect API Error: Failed to create temporary test prompt. Details: ${err.message}` }, { status: 400 });
    }

    // 5. Cleanup
    let cleanupWarning: string | undefined;
    try {
      await deleteAiPrompt(client, {
        assistantId: config.aws.assistantId,
        aiPromptId: promptId,
      });
    } catch (cleanupErr: any) {
      cleanupWarning = `Failed to delete temporary smoke test prompt (ID: ${promptId}). You may need to delete it manually in AWS.`;
    }

    const checks = {
      settingsVerified: true,
      yamlVerified: true,
      awsCredentialsVerified: true,
      qConnectApiWriteVerified: true,
    };

    return NextResponse.json({
      success: true,
      checks,
      promptData: { aiPromptId: promptId, accountId },
      cleanupWarning,
      message: `Smoke test passed successfully! Validated ${config.agents.filter(a => a.enabled).length} agent(s), STS Identity, and Q Connect APIs.`,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}
