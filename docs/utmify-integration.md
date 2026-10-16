# UTMify — Pixel and PinguPag Pix order statuses

## Site installation

- `public/utmify-pixel.js` contains the decoded loader from the supplied snippet. Pixel ID: `6ad16da395251dffc52bd4c2`; vendor SDK: `https://cdn.utmify.com.br/scripts/pixel/pixel.js`.
- `src/routes/__root.tsx` includes the loader exactly once, after the existing parameter-preservation and Meta Pixel scripts. The Meta Pixel ID `1078609691707266` and Meta events are not changed.
- The checkout includes the seven Utmify-defined fields `src`, `sck`, `utm_source`, `utm_campaign`, `utm_medium`, `utm_content`, and `utm_term`. Missing fields are `null` (including organic visits). The existing `tracking-params.js` carries **all** URL query keys across the funnel, including Facebook `fbclid`, custom keys, duplicates and empty values. At checkout, a bounded privacy-filtered snapshot of these arbitrary parameters is associated with the Pix reference inside the encrypted signed receipt. On verified approval, the same original snapshot is returned for the existing Tag Manager `purchase` event, even if the user has visited another link in the meantime. Sensitive URL keys, email-like values and oversized data are excluded from analytics.

**UTMify API limitation:** UTMify's documented order endpoint defines only the seven listed `trackingParameters` properties. Additional keys are retained for on-site continuity and per-order `dataLayer` purchase attribution, **not** appended as undocumented API fields. The UTMify pixel may also inspect the preserved URL, but support for interpreting custom names is provider-dependent. There is no guarantee that arbitrary custom parameters appear as distinct UTMify dashboard columns.

## Server setup (required for reporting orders)

1. In the deployment environment (server-side secrets), create `UTMIFY_API_TOKEN` using a Utmify credential from **Integrações → Webhooks → Credenciais de API**. Never configure it as `VITE_*` or insert it in HTML/browser scripts.
2. Publish/redeploy the site with the server environment configured, and confirm the selected Utmify dashboard/credential. The user supplied the *pixel ID*, **not** the API credential; the pixel alone does not enable order submission.
3. Generate a small test Pix and confirm that Utmify registers `waiting_payment` with the seven tracking fields. Pay it using a real approved test order if appropriate; confirm `paid` with the same order ID. Do not treat Pix creation as proof of payment.
4. If PinguPag already independently posts orders to Utmify, select one authoritative integration to avoid duplicate order records or events. Verify that the UTMify dashboard pixel is not configured to forward events a second time to the same existing Meta Pixel.

## Server protocol

- After the gateway actually returns a Pix code, `createPix` reports `waiting_payment` to `POST https://api.utmify.com.br/api-credentials/orders` using `x-api-token` on the server only.
- On `checkPixPayment`, a valid HMAC-signed reference/amount and gateway status are required. Only an explicit `approved` response triggers `paid`; failed/refunded/chargeback statuses map to their supported Utmify statuses.
- The signed 24-hour receipt optionally contains AES-GCM encrypted customer and attribution context (never exposed in clear text to browser storage). The same transaction ID, UTC creation timestamp, customer and campaign fields accompany status updates.
- The Utmify integration is best effort with a 2.5-second timeout. Provider failures do **not** stop checkout, alter the PinguPag request or produce fake approved purchases. No API token means Pix and the existing Meta events continue normally, but there are no Utmify order API calls.
- Status reconciliation currently depends on a visible payment page or the visitor returning with the pending signed receipt. Browser-only status checks cannot guarantee server-to-server notification after the visitor closes the page. For that, add an authenticated, durable gateway webhook/queue and reconcile orders from the provider.
- Only a single line item containing the complete order value is sent, with unknown gateway fees represented as 0 (no fees are inferred). Adjust when actual fee information is made available.

Official API format: https://docs.utmify.com.br/envio-de-vendas
Official pixel guidance: https://utmify.gitbook.io/central-de-ajuda/pixel-utmify/configurando-o-pixel-utmify

## Duplicação e origem: controles locais

- Um pedido gerado e confirmado conserva exatamente o mesmo `orderId` na UTMify.
  O servidor evita reenviar `orderId + status` em chamadas simultâneas ou repetidas
  no **mesmo processo** (limite de memória e expiração de 24 h); entrega falha
  continua apta a novas tentativas. Ambientes serverless com múltiplos processos
  requerem deduplicação na plataforma por `orderId` ou persistência durável.
- O botão Pix ignora envios simultâneos na mesma instância do checkout.
  `dataLayer.purchase` agora é registrado apenas uma vez por referência mesmo
  após recarregar, e usa `event_id: <orderId>`, correspondente ao
  `eventID` enviado pelo Pixel Meta do próprio site.
- A captura da origem combina UTMs e identificadores preservados no
  `tracking_params_v1` (30 dias), a API `TrackingParams`, e a URL corrente.
  A URL corrente prevalece quando um mesmo parâmetro aparece em mais de uma
  fonte. Somente os sete campos documentados são enviados como
  `trackingParameters` à UTMify; demais identificadores permitidos permanecem
  no envelope do pedido e `dataLayer`. Tráfego orgânico legitimamente sem
  UTMs permanece sem atribuição paga.
- **Integrações externas:** se o gateway PinguPag também estiver conectado
  diretamente à mesma conta UTMify, desligue uma das duas fontes de criação de
  pedidos. A desduplicação dentro deste site não controla envios de terceiros.
  Se a Meta receber Purchase via GTM, pixel Utmify e Pixel deste site,
  configure o mesmo `event_id` entre Browser e CAPI, ou mantenha um único
  emissor por evento. O código não pode corrigir regras externas da conta.
