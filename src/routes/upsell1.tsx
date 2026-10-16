import { Navigate, createFileRoute } from "@tanstack/react-router";

/** Legacy URL compatibility: the previous kit offer no longer exists. */
export const Route = createFileRoute("/upsell1")({
  component: () => <Navigate to="/upsell" replace />,
});
