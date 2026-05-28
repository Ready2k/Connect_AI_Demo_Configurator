import { NextResponse } from "next/server";
import { validatePromptYaml } from "@/lib/prompts/validatePrompt";

export async function POST(request: Request) {
  try {
    const { promptText } = await request.json();
    if (typeof promptText !== "string") {
      return NextResponse.json({ isValid: false, errors: ["promptText must be a string"] }, { status: 400 });
    }
    const result = validatePromptYaml(promptText);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ isValid: false, errors: [e.message] }, { status: 400 });
  }
}
