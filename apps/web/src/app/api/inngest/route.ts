import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processCmdWebhook, nightlyUat, uatOnDemand } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processCmdWebhook, nightlyUat, uatOnDemand],
});
