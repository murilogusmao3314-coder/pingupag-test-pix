# Meta Pixel 1078609691707266

The existing base script initializes the pixel and sends one `PageView` per document. The funnel is a single-page experience: its internal screens use custom step events, not artificial page loads.

| Event                                                                  | Trigger                                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PageView                                                               | Document load (existing base script)                                       |
| ViewContent                                                            | Landing and quiz offer displayed                                           |
| AddToCart                                                              | Prize redemption clicked; each optional item added                         |
| InitiateCheckout                                                       | Checkout opened                                                            |
| Lead                                                                   | Valid customer details submitted to advance to delivery                    |
| AddPaymentInfo                                                         | Valid payment step submitted with Pix selected                             |
| Purchase                                                               | Server query confirms `approved`, matching the signed reference and amount |
| FunnelStepView                                                         | Welcome, each quiz question, analysis, result                              |
| QuizStarted / QuizQuestionView / QuizAnswer / QuizBack / QuizCompleted | Corresponding quiz actions; no answer values sent                          |
| OfferSectionView                                                       | Features, testimonials, FAQ, final offer enter the viewport                |
| FAQOpened                                                              | FAQ item expanded                                                          |
| CheckoutStepView                                                       | Customer, delivery, payment screen displayed                               |
| ShippingSelected                                                       | Delivery method changed                                                    |
| RemoveFromCart                                                         | Optional item removed                                                      |
| PixRequested / PixGenerated / PixViewed / PixCopied                    | Actual corresponding Pix action                                            |
| CheckoutValidationError / CheckoutError                                | Validation failure or Pix creation failure, without raw error details      |
| PixPaymentEnded                                                        | Failed, refunded or chargeback state returned by the query                 |

`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`, `AddPaymentInfo`, `Purchase` use Meta standard events. The other rows use `trackCustom`. Unrelated actions such as registration, subscription, search and appointments are not simulated.

Monetary values use BRL and reais converted from integer cents. Explicit payloads never include customer fields, address, CPF, Pix payloads, tracking capabilities or API keys. Lifecycle events are deduplicated in memory. Event IDs include a document-specific prefix; purchase IDs use the unique order reference. Purchase deduplication also uses localStorage when available.

## Purchase confirmation

Creation retains the existing POST endpoint and payload. A signed 30-minute capability is returned alongside the Pix. The existing server key signs the capability and authenticates the read-only GET `/gateway/v1/query?action=list_transactions&external_id=...`; it is never sent to the browser.

The browser checks while the payment screen is mounted, once immediately and then every 10 seconds, without overlapping calls. Hidden tabs skip queries; returning from a bank app triggers a new check. Queries stop on a terminal state, unmount or after 30 minutes. Responses expose only status, reference and amount, never gateway customer data. The UI shows confirmation only after an approved server response.

Signing or analytics failure never prevents Pix creation. Legacy charges without a capability remain usable with no automatic Purchase event. Gateway/network failure never counts as approval. This is browser Pixel tracking, not Conversions API: closing/reloading the page loses the pending checkout, and blockers can prevent delivery to Meta. Confirmation outside the active payment page requires a separate webhook/CAPI integration.

Reference: supplied PinguPag API documentation, including list-by-reference and the `approved` status.
Meta reference: https://developers.facebook.com/documentation/meta-pixel/reference
