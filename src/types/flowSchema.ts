export interface DiscoveredBlockSchema {
  type: string;
  friendlyName: string;
  sampleParameters: Record<string, unknown>;
  sampleTransitions: Record<string, unknown>;
  sourceFlowId: string;
  sourceFlowName: string;
  discoveredAt: string;
}

export interface BlockSchemaLibrary {
  schemas: Record<string, DiscoveredBlockSchema>;
  lastUpdated: string;
}

export interface ParsedAction {
  identifier: string;
  type: string;
  parameters: Record<string, unknown>;
  transitions: Record<string, unknown>;
}

export interface ParsedFlow {
  id: string;
  name: string;
  type: string;
  actions: ParsedAction[];
  blockTypesFound: string[];
  hasConnectAssistantBlock: boolean;
}
