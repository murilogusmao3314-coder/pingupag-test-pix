/** Keep the gateway contract national: DDD + number, without the fixed +55. */
export function phoneInputDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^\s*\+55/.test(value)) return digits.slice(2);
  if (/^\s*0055/.test(value)) return digits.slice(4);
  // A national number with DDD 55 has 10/11 digits and must keep its DDD.
  if (
    !value.trimStart().startsWith("(") &&
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  )
    return digits.slice(2);
  return digits;
}
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\.\d{3})(\d)/, "$1-$2");
}
export function formatPhone(value: string): string {
  const digits = phoneInputDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const subscriber = digits.slice(2);
  const split = subscriber.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, split)}${subscriber.length > split ? `-${subscriber.slice(split)}` : ""}`;
}

/** Preserve the editing position when punctuation is inserted or removed. */
export function maskInput(input: HTMLInputElement, field: "document" | "phone"): string {
  const raw = input.value;
  const position = input.selectionStart ?? raw.length;
  const formatted = field === "phone" ? formatPhone(raw) : formatCpf(raw);
  const removedPrefix =
    field === "phone" ? raw.replace(/\D/g, "").length - phoneInputDigits(raw).length : 0;
  const before = Math.max(0, raw.slice(0, position).replace(/\D/g, "").length - removedPrefix);
  let caret = position === raw.length ? formatted.length : 0;
  if (position !== raw.length && before > 0) {
    let count = 0;
    caret = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i]!) && ++count === before) {
        caret = i + 1;
        break;
      }
    }
  }
  input.value = formatted;
  input.setSelectionRange(caret, caret);
  return formatted;
}
