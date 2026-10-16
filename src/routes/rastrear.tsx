import { createFileRoute } from "@tanstack/react-router";
import { TrackingPage } from "@/components/monster/order-tracking-pages";

export const Route = createFileRoute("/rastrear")({
  head: () => ({ meta: [{ title: "Acompanhar pedido · Monster" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: TrackingPage,
});
