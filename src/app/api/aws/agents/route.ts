import { NextRequest, NextResponse } from "next/server";
import { getQConnectClient, listAiAgents, getAiPrompt } from "@/lib/aws/qconnectClient";
import { AgentConfig } from "@/types/project";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const assistantId = searchParams.get("assistantId");

    if (!region || !assistantId) {
      return NextResponse.json({ error: "Missing region or assistantId" }, { status: 400 });
    }

    const client = getQConnectClient(region);
    let nextToken: string | undefined;
    const importedAgents: AgentConfig[] = [];

    // Fetch all agents
    do {
      const res = await listAiAgents(client, {
        assistantId,
        nextToken,
        maxResults: 100,
        origin: "CUSTOMER" as any
      });

      if (res.aiAgentSummaries) {
        for (const summary of res.aiAgentSummaries) {
          // We only support importing ORCHESTRATION agents right now
          if (summary.type !== "ORCHESTRATION") continue;

          let promptTemplate = "";
          let apiFormat: "MESSAGES" | "TEXT_COMPLETIONS" = "MESSAGES";

          // Get the AI Prompt if it exists to retrieve the template text
          if (summary.configuration?.orchestrationAIAgentConfiguration?.orchestrationAIPromptId) {
            try {
              const promptRes = await getAiPrompt(client, {
                assistantId,
                aiPromptId: summary.configuration.orchestrationAIAgentConfiguration.orchestrationAIPromptId
              });

              if (promptRes.aiPrompt) {
                const config = promptRes.aiPrompt.templateConfiguration;
                if (config?.textFullAIPromptEditTemplateConfiguration?.text) {
                  promptTemplate = config.textFullAIPromptEditTemplateConfiguration.text;
                }
                if (promptRes.aiPrompt.apiFormat === "TEXT_COMPLETIONS") {
                  apiFormat = "TEXT_COMPLETIONS";
                }
              }
            } catch (promptErr) {
              console.warn(`Failed to fetch prompt for agent ${summary.name}`, promptErr);
            }
          }

          importedAgents.push({
            id: summary.aiAgentId || crypto.randomUUID(),
            name: summary.name || "Unknown Agent",
            description: summary.description || "",
            agentType: "ORCHESTRATION",
            promptType: "ORCHESTRATION",
            apiFormat,
            promptTemplate,
            enabled: true,
          });
        }
      }
      nextToken = res.nextToken;
    } while (nextToken);

    return NextResponse.json({ agents: importedAgents });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list AI Agents" }, { status: 500 });
  }
}
