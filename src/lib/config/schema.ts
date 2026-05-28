import { z } from "zod";

export const visibilityStatusSchema = z.enum(["SAVED", "PUBLISHED"]);

export const deploymentModeSchema = z.enum([
  "preview_only",
  "create_prompts_only",
  "create_agents_only",
  "create_prompts_and_agents",
]);

export const demoFailureModeSchema = z.enum([
  "tool_failure_at_list_cards",
  "tool_failure_at_block_card",
  "tool_failure_at_replacement",
  "manual_success_simulation",
]);

export const nameSuffixModeSchema = z.enum([
  "none",
  "environment",
  "timestamp",
  "environment_and_timestamp",
]);

export const awsSettingsSchema = z.object({
  region: z.string().min(1, "AWS Region is required"),
  assistantId: z.string().optional(),
  connectInstanceId: z.string().optional(),
  modelId: z.string().optional().default(""),
  visibilityStatus: visibilityStatusSchema,
  deploymentMode: deploymentModeSchema,
  nameSuffixMode: nameSuffixModeSchema,
});

export const agentConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  agentType: z.literal("ORCHESTRATION"),
  promptType: z.literal("ORCHESTRATION"),
  apiFormat: z.enum(["MESSAGES", "TEXT_COMPLETIONS"]),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  sourceBase: z.literal("SelfServiceOrchestrator").optional(),
  enabled: z.boolean(),
});

export const handoffAttributeSchema = z.object({
  key: z.string().min(1, "Key is required"),
  description: z.string(),
  exampleValue: z.string(),
  required: z.boolean(),
});

export const handoffConfigSchema = z.object({
  humanQueueId: z.string().optional(),
  humanQueueArn: z.string().optional(),
  lambdaRoutingFunctionName: z.string().optional(),
  defaultHandoffReason: z.string(),
  contactAttributes: z.array(handoffAttributeSchema),
});

export const projectConfigSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  environmentName: z.string().min(1, "Environment name is required"),
  aws: awsSettingsSchema,
  agents: z.array(agentConfigSchema),
  handoff: handoffConfigSchema,
  tags: z.record(z.string(), z.string()).optional().default({}),
  demoFailureMode: demoFailureModeSchema,
});
