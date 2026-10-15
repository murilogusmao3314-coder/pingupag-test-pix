// Server transport for the endpoint specified in the supplied PinguPag documentation.
export const PIX_ENDPOINT = "https://pagamento-processador.org.ua/gateway/v1/transaction";

export class GatewayRedirectError extends Error {
  constructor() {
    super("Unsafe or excessive gateway redirect");
    this.name = "GatewayRedirectError";
  }
}

/** Match --location while keeping credentials on this HTTPS gateway only. No retries. */
export async function requestPixGateway(body: string, key: string): Promise<Response> {
  return requestGateway(new URL(PIX_ENDPOINT), "POST", body, key);
}

/** Read-only status lookup, using the documented reference filter. */
export async function queryPixGateway(reference: string, key: string): Promise<Response> {
  const url = new URL("/gateway/v1/query", PIX_ENDPOINT);
  url.searchParams.set("action", "list_transactions");
  url.searchParams.set("external_id", reference);
  return requestGateway(url, "GET", undefined, key);
}

async function requestGateway(
  url: URL,
  method: string,
  requestBody: string | undefined,
  key: string,
): Promise<Response> {
  const origin = new URL(PIX_ENDPOINT).origin;
  const signal = AbortSignal.timeout(18000);
  for (let redirects = 0; redirects <= 2; redirects++) {
    const headers: Record<string, string> = { "X-API-Key": key, Accept: "application/json" };
    if (requestBody !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(url.href, {
      method,
      redirect: "manual",
      headers,
      signal,
      ...(requestBody !== undefined ? { body: requestBody } : {}),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === 2) throw new GatewayRedirectError();
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new GatewayRedirectError();
    }
    if (
      next.origin !== origin ||
      next.username ||
      next.password ||
      !next.pathname.startsWith("/gateway/v1/")
    )
      throw new GatewayRedirectError();
    // Standard POST redirect semantics avoid resubmitting a transaction after 303/302.
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      method = "GET";
      requestBody = undefined;
    }
    url = next;
  }
  throw new GatewayRedirectError();
}

export function gatewayNetworkFailure(error: unknown): { code: string; error: string } {
  if (error instanceof GatewayRedirectError)
    return {
      code: "GATEWAY_REDIRECT",
      error:
        "O gateway redirecionou para um endereço não autorizado ou entrou em um ciclo. Verifique a configuração com o provedor.",
    };
  let current = error;
  const codes = new Set<string>();
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const entry = current as Record<string, unknown>;
    if (typeof entry["code"] === "string") codes.add(entry["code"]);
    if (entry["name"] === "TimeoutError" || entry["name"] === "AbortError")
      return {
        code: "GATEWAY_TIMEOUT",
        error:
          "O gateway não respondeu no prazo. Nenhuma nova tentativa foi feita automaticamente; confira a cobrança no painel antes de tentar outra vez.",
      };
    current = entry["cause"];
  }
  if (codes.has("ENOTFOUND") || codes.has("EAI_AGAIN"))
    return {
      code: "GATEWAY_DNS",
      error:
        "O servidor não conseguiu resolver o domínio do gateway. O provedor precisa verificar o DNS do endpoint.",
    };
  if ([...codes].some((code) => /CERT|TLS|SSL/.test(code)))
    return {
      code: "GATEWAY_TLS",
      error:
        "Não foi possível validar a conexão HTTPS do gateway. O provedor precisa verificar o certificado TLS.",
    };
  if (codes.has("ECONNREFUSED") || codes.has("ECONNRESET"))
    return {
      code: "GATEWAY_CONNECTION",
      error:
        "O gateway recusou ou interrompeu a conexão do servidor. Verifique a disponibilidade e a liberação de acesso com o provedor.",
    };
  return {
    code: "GATEWAY_NETWORK",
    error:
      "O servidor do site não conseguiu alcançar o gateway. Verifique DNS, HTTPS e liberação de acesso no provedor antes de criar outra cobrança.",
  };
}

export function gatewayHttpFailure(
  response: Response,
  payload: unknown,
): { code: string; error: string } | null {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  if (
    response.headers.get("cf-mitigated") === "challenge" ||
    data["cloudflare_error"] === true ||
    data["error_code"] === 1010
  )
    return {
      code: "GATEWAY_BLOCKED",
      error:
        "O gateway bloqueou a conexão do servidor (Cloudflare). Solicite ao provedor a liberação da API para o servidor deste site.",
    };
  if (response.status === 401)
    return {
      code: "GATEWAY_AUTH",
      error:
        "O gateway rejeitou a X-API-Key (HTTP 401). Confira a chave no servidor e se a loja está ativa.",
    };
  if (response.status === 403)
    return {
      code: "GATEWAY_FORBIDDEN",
      error:
        "O gateway negou acesso à API (HTTP 403). Confira as permissões da loja e a liberação do servidor com o provedor.",
    };
  if (!response.ok)
    return {
      code: `GATEWAY_HTTP_${response.status}`,
      error: `O gateway recusou a requisição (HTTP ${response.status}). Confira a cobrança e a configuração no painel do provedor antes de tentar novamente.`,
    };
  if (data["success"] === false || data["status"] === "error" || data["status"] === "failed")
    return {
      code: "GATEWAY_REJECTED",
      error:
        "O gateway recusou a criação da cobrança. Confira os dados e a configuração da loja no painel.",
    };
  return null;
}
