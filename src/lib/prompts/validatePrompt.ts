import yaml from "js-yaml";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePromptYaml(promptText: string): ValidationResult {
  const errors: string[] = [];
  let parsed: any;

  try {
    parsed = yaml.load(promptText);
  } catch (e: any) {
    return { isValid: false, errors: [`YAML parsing error: ${e.message}`] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { isValid: false, errors: ["YAML root must be an object."] };
  }

  // 1. Top-level `system` exists
  if (!("system" in parsed)) {
    errors.push("Missing top-level 'system' property.");
  }

  // 2. Top-level `messages` exists
  if (!("messages" in parsed)) {
    errors.push("Missing top-level 'messages' property.");
  } else {
    // 3. `messages` is an array
    if (!Array.isArray(parsed.messages)) {
      errors.push("'messages' must be an array.");
    }
  }

  // 4. Prompt includes `{{$.conversationHistory}}`
  if (!promptText.includes("{{$.conversationHistory}}")) {
    errors.push("Prompt is missing {{$.conversationHistory}} placeholder.");
  }

  // 5. Prompt includes `{{$.toolConfigurationList}}`
  if (!promptText.includes("{{$.toolConfigurationList}}")) {
    errors.push("Prompt is missing {{$.toolConfigurationList}} placeholder. (Needed where tools/actions are expected)");
  }

  // 6. Customer-facing rules include `<message>` guidance.
  if (!promptText.includes("<message>")) {
    errors.push("Prompt appears to be missing customer-facing <message> tag guidance.");
  }

  // 7. Prompt does not contain accidental placeholder text such as `TODO`
  if (promptText.includes("TODO")) {
    errors.push("Prompt contains accidental 'TODO' placeholder text.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
