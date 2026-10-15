import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { digits, type CheckoutFields } from "./checkout-schema";
import { lookupCep, CepLookupError, type CepAddress } from "./cep-lookup";
const addressKeys = ["street", "neighborhood", "city", "state"] as const;
export interface CepFeedback {
  loading: boolean;
  message: string;
  retry?: () => void;
}

/** Lives with checkout so returning to delivery does not overwrite manual corrections. */
export function useCepLookup(
  fields: CheckoutFields,
  setFields: Dispatch<SetStateAction<CheckoutFields>>,
  enabled: boolean,
): CepFeedback {
  const cep = digits(fields.cep);
  const latest = useRef(fields);
  latest.current = fields;
  const resolved = useRef<{ cep: string; attempt: number } | null>(null);
  const autofilled = useRef<{ cep: string; address: CepAddress } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState({ cep: "", status: "idle", message: "" });
  useEffect(() => {
    if (!enabled || !/^\d{8}$/.test(cep)) return;
    if (resolved.current && resolved.current.cep !== cep) resolved.current = null;
    if (resolved.current?.cep === cep && resolved.current.attempt === attempt) return;
    let active = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const previous = autofilled.current;
    const snapshot = { ...latest.current };
    // A new CEP must not retain an address supplied automatically for another CEP.
    if (previous && previous.cep !== cep) {
      addressKeys.forEach((key) => {
        if (snapshot[key] === previous.address[key]) snapshot[key] = "";
      });
      setFields((current) => {
        if (digits(current.cep) !== cep) return current;
        const next = { ...current };
        addressKeys.forEach((key) => {
          if (next[key] === previous.address[key]) next[key] = "";
        });
        return next;
      });
    }
    setFeedback({ cep, status: "loading", message: "Buscando endereço pelo CEP…" });
    const debounce = setTimeout(async () => {
      timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const address = await lookupCep(cep, controller.signal);
        if (!active || controller.signal.aborted || digits(latest.current.cep) !== cep) return;
        setFields((current) => {
          if (digits(current.cep) !== cep) return current;
          const next = { ...current };
          addressKeys.forEach((key) => {
            // Preserve a customer's edit made while this request was in flight.
            if (current[key] === snapshot[key]) next[key] = address[key];
          });
          return next;
        });
        autofilled.current = { cep, address };
        resolved.current = { cep, attempt };
        setFeedback({
          cep,
          status: "success",
          message:
            address.street && address.neighborhood
              ? "Endereço preenchido. Confira os dados e informe o número."
              : "CEP localizado. Complete a rua, o bairro e o número, se necessário.",
        });
      } catch (error) {
        if (!active || digits(latest.current.cep) !== cep) return;
        setFeedback({
          cep,
          status: "error",
          message:
            error instanceof CepLookupError && error.code === "NOT_FOUND"
              ? "CEP não encontrado. Confira o CEP ou preencha o endereço manualmente."
              : "Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.",
        });
      } finally {
        clearTimeout(timeout);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [cep, enabled, attempt, setFields]);
  const current = enabled && feedback.cep === cep && /^\d{8}$/.test(cep);
  return {
    loading: current && feedback.status === "loading",
    message: current ? feedback.message : "",
    ...(current && feedback.status === "error"
      ? { retry: () => setAttempt((value) => value + 1) }
      : {}),
  };
}
