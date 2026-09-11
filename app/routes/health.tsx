import type { LoaderFunctionArgs } from "react-router";

/** Render / uptime health check — no auth. */
export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
