import { createFileRoute } from "@tanstack/react-router";
import { InternalTrackingPreview } from "@/components/monster/order-tracking-pages";

export const Route = createFileRoute("/previsualizar-rastreio")({
  head: () => ({ meta: [
    { title: "Prévia interna do pós-venda · Monster" },
    { name: "robots", content: "noindex,nofollow,noarchive" },
  ] }),
  component: InternalTrackingPreview,
});
