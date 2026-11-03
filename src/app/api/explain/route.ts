import { getDb } from "@/lib/server/db";
import { createClaudeExplainer, explainHandler } from "@/lib/server/explain";
import { requestIdentity } from "@/lib/server/request-identity";

export const POST = explainHandler(createClaudeExplainer(), { getDb, identify: requestIdentity });

export const maxDuration = 60;
