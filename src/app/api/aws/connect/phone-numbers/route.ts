import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, listPhoneNumbers, listPhoneNumbersV2 } from "@/lib/aws/connectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    const phoneNumbers: { id: string; phoneNumber: string; countryCode: string; type: string }[] = [];

    try {
      let nextToken: string | undefined;
      do {
        const res = await listPhoneNumbersV2(client, {
          TargetArn: undefined,
          InstanceId: connectInstanceId,
          NextToken: nextToken,
          MaxResults: 100,
        });

        if (res.ListPhoneNumbersSummaryList) {
          for (const pn of res.ListPhoneNumbersSummaryList) {
            phoneNumbers.push({
              id: pn.PhoneNumberId || "",
              phoneNumber: pn.PhoneNumber || "",
              countryCode: pn.PhoneNumberCountryCode || "",
              type: pn.PhoneNumberType || "",
            });
          }
        }

        nextToken = res.NextToken;
      } while (nextToken);
    } catch (_v2err: unknown) {
      let nextToken: string | undefined;
      do {
        const res = await listPhoneNumbers(client, {
          InstanceId: connectInstanceId,
          NextToken: nextToken,
          MaxResults: 100,
        });

        if (res.PhoneNumberSummaryList) {
          for (const pn of res.PhoneNumberSummaryList) {
            phoneNumbers.push({
              id: pn.Id || "",
              phoneNumber: pn.PhoneNumber || "",
              countryCode: pn.PhoneNumberCountryCode || "",
              type: pn.PhoneNumberType || "",
            });
          }
        }

        nextToken = res.NextToken;
      } while (nextToken);
    }

    return NextResponse.json({ phoneNumbers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list phone numbers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
