import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, listQueues } from "@/lib/aws/connectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    let nextToken: string | undefined;
    const queues: { id: string; arn: string; name: string }[] = [];

    do {
      const res = await listQueues(client, {
        InstanceId: connectInstanceId,
        QueueTypes: ["STANDARD"],
        NextToken: nextToken,
        MaxResults: 100,
      });

      if (res.QueueSummaryList) {
        for (const queue of res.QueueSummaryList) {
          queues.push({
            id: queue.Id || "",
            arn: queue.Arn || "",
            name: queue.Name || "",
          });
        }
      }

      nextToken = res.NextToken;
    } while (nextToken);

    return NextResponse.json({ queues });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list queues";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
