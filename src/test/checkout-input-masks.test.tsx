import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerFields } from "../components/monster/checkout-fields";
import { customerSchema, emptyFields } from "../components/monster/checkout-schema";
import { formatCpf, formatPhone } from "../components/monster/input-masks";
function Form() {
  const [fields, setFields] = useState(emptyFields);
  return (
    <CustomerFields
      fields={fields}
      update={(key, value) => setFields((old) => ({ ...old, [key]: value }))}
    />
  );
}
afterEach(cleanup);
function typeDigits(input: HTMLInputElement, digits: string) {
  for (const digit of digits) fireEvent.change(input, { target: { value: input.value + digit } });
}
function erase(input: HTMLInputElement) {
  let steps = 0;
  while (input.value && steps++ < 30)
    fireEvent.change(input, { target: { value: input.value.slice(0, -1) } });
  expect(input.value).toBe("");
}
describe("Brazilian checkout input", () => {
  it("punctuates CPF progressively and allows deleting it completely", () => {
    render(<Form />);
    const cpf = screen.getByLabelText<HTMLInputElement>("CPF");
    typeDigits(cpf, "1234");
    expect(cpf.value).toBe("123.4");
    typeDigits(cpf, "5678901");
    expect(cpf.value).toBe("123.456.789-01");
    erase(cpf);
    fireEvent.change(cpf, { target: { value: "123.456.789-01" } });
    expect(cpf.value).toBe("123.456.789-01");
  });
  it("keeps +55 visible, formats DDD and subscriber, and preserves the national API contract", () => {
    render(<Form />);
    expect(screen.getByText("+55")).toBeVisible();
    const phone = screen.getByLabelText<HTMLInputElement>("Celular");
    expect(phone.type).toBe("tel");
    expect(phone.autocomplete).toBe("tel-national");
    typeDigits(phone, "11987654321");
    expect(phone.value).toBe("(11) 98765-4321");
    const parsed = customerSchema.parse({
      name: "Cliente Teste",
      email: "test@example.invalid",
      document: "123.456.789-01",
      phone: phone.value,
    });
    expect(parsed.phone).toBe("11987654321");
    expect(parsed.document).toBe("12345678901");
    erase(phone);
    expect(screen.getByText("+55")).toBeVisible();
  });
  it.each(["+55 (11) 98765-4321", "5511987654321", "005511987654321", "(11) 98765-4321"])(
    "accepts pasted/autofilled telephone %s without duplicating Brazil's prefix",
    (value) => {
      render(<Form />);
      const phone = screen.getByLabelText<HTMLInputElement>("Celular");
      fireEvent.change(phone, { target: { value } });
      expect(phone.value).toBe("(11) 98765-4321");
      expect(screen.getAllByText("+55")).toHaveLength(1);
    },
  );
  it("preserves DDD 55 and supports both 10 and 11 national digits", () => {
    expect(formatPhone("55987654321")).toBe("(55) 98765-4321");
    expect(formatPhone("(55) 98765-43219")).toBe("(55) 98765-4321");
    expect(formatPhone("5534567890")).toBe("(55) 3456-7890");
    expect(formatPhone("+55 55 98765-4321")).toBe("(55) 98765-4321");
    expect(formatCpf("letters12345678901999")).toBe("123.456.789-01");
  });
  it("keeps the caret near a middle edit instead of jumping to the end", () => {
    render(<Form />);
    const cpf = screen.getByLabelText<HTMLInputElement>("CPF");
    fireEvent.change(cpf, { target: { value: "12345678901" } });
    // Delete the first separator. The next backspace can now remove a digit.
    fireEvent.change(cpf, {
      target: { value: "123456.789-01", selectionStart: 3, selectionEnd: 3 },
    });
    expect(cpf.value).toBe("123.456.789-01");
    expect(cpf.selectionStart).toBe(3);
    fireEvent.change(cpf, {
      target: { value: "12456.789-01", selectionStart: 2, selectionEnd: 2 },
    });
    expect(cpf.value).toBe("124.567.890-1");
    expect(cpf.selectionStart).toBe(2);
  });
});
