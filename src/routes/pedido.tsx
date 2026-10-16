import { createFileRoute } from "@tanstack/react-router";
import { ConfirmationPage } from "@/components/monster/order-tracking-pages";

export const Route = createFileRoute("/pedido")({
  head: () => ({ meta: [{ title: "Confirmação do pedido · Monster" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ConfirmationPage,
});
