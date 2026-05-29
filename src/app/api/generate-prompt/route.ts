import { NextRequest, NextResponse } from "next/server";
import { getBedrockClient, converseWithModel } from "@/lib/aws/bedrockClient";

const SYSTEM_PROMPT = `You are an expert at writing Amazon Q in Connect AI Agent prompt templates in YAML.

REQUIRED YAML STRUCTURE — follow this exactly:

system: |
  [System instructions for the agent — can use XML-style sections like <identity>, <scope>, <voice-behaviour>, etc.]

  All customer-facing spoken output MUST be wrapped in <message> tags:
    Correct:   <message>How can I help you today?</message>
    Incorrect: How can I help you today?

  Include this exactly:
  <tools>
  {{$.toolConfigurationList}}
  </tools>

  Include this exactly:
  <system-variables>
  contactId: {{$.contactId}}
  instanceId: {{$.instanceId}}
  sessionId: {{$.sessionId}}
  assistantId: {{$.assistantId}}
  dateTime: {{$.dateTime}}
  responseLanguage: {{$.locale}}
  </system-variables>

messages:
  - "{{$.conversationHistory}}"
  - role: assistant
    content: "<message>"

MANDATORY RULES:
1. Top-level keys are ONLY "system:" and "messages:". No other top-level keys.
2. "system:" MUST use the YAML block scalar indicator (|) on the same line.
3. All content under "system:" must be indented by 2 spaces.
4. "messages:" array must contain EXACTLY two entries — do not add more:
   - First entry: the literal string "{{$.conversationHistory}}" (quoted)
   - Second entry: role: assistant / content: "<message>"
5. {{$.toolConfigurationList}} must appear inside <tools> tags in the system block.
6. {{$.locale}} must appear at least once (in the system-variables block is sufficient).
7. No TODO comments.
8. This is a VOICE call — keep responses short, conversational, no bullet points, no special characters in spoken output.
9. Return ONLY the YAML — no markdown fences, no explanation text, no prose before or after.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      description: string;
      agentName?: string;
      modelId: string;
      region: string;
    };

    const { description, agentName, modelId, region } = body;

    if (!description?.trim() || !modelId?.trim() || !region?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: description, modelId, region" },
        { status: 400 }
      );
    }

    const client = getBedrockClient(region);

    const userMessage = `Generate an Amazon Q in Connect AI Agent prompt template for this agent:

Agent name: ${agentName?.trim() || "AI Agent"}
Agent purpose: ${description.trim()}

Return ONLY the YAML — no markdown fences, no extra text.`;

    const raw = await converseWithModel(
      client,
      modelId,
      [{ role: "user", content: [{ text: userMessage }] }],
      SYSTEM_PROMPT
    );

    const promptYaml = raw.replace(/^```(?:yaml)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/, "$1").trim();

    return NextResponse.json({ promptYaml });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate prompt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
