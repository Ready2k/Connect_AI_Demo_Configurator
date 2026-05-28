import { ProjectConfig } from "@/types/project";

export function computeDeployedName(baseName: string, config: ProjectConfig, timestamp: number): string {
  const mode = config.aws.nameSuffixMode || "environment_and_timestamp";
  const env = config.environmentName;

  switch (mode) {
    case "environment":
      return `${baseName}_${env}`;
    case "timestamp":
      return `${baseName}_${timestamp}`;
    case "environment_and_timestamp":
      return `${baseName}_${env}_${timestamp}`;
    case "none":
    default:
      return baseName;
  }
}
