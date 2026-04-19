import Handlebars from "handlebars";
import type { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import ky, { type Options as KyOptions } from "ky";
Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);
  return safeString;
});
type HttpRequestData = {
  variableName: string;
  endPoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
};
export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({
  nodeId,
  data,
  context,
  step,
}) => {
  if (!data.endPoint) {
    throw new NonRetriableError("HTTP Request node: No endpoint configured");
  }
  if (!data.variableName) {
    throw new NonRetriableError("Variable name not configured");
  }
  if (!data.method) {
    throw new NonRetriableError("Method not configured");
  }
  const result = await step.run("http-request", async () => {
    const endpoint = Handlebars.compile(data.endPoint)(context);
    const method = data.method;
    const options: KyOptions = { method };
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const resolved = Handlebars.compile(data.body || "{}")(context);
      JSON.parse(resolved);
      options.body = resolved;
      options.headers = {
        "Content-type": "application/json",
      };
    }
    const response = await ky(endpoint, options);
    const contentType = response.headers.get("content-type");
    const responseData = contentType?.includes("application/json")
      ? await response.json()
      : await response.text();
    const responsePayload = {
      httpResponse: {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      },
    };

    return {
      ...context,
      [data.variableName]: responsePayload,
    };
  });
  return result;
};
