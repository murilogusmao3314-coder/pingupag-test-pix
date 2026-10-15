import type { ComponentProps } from "react";
import type { CheckoutFields } from "./checkout-schema";
import { formatCpf, formatPhone, maskInput } from "./input-masks";
export interface FieldsProps {
  fields: CheckoutFields;
  update: (key: keyof CheckoutFields, value: string) => void;
}
interface FieldProps extends Omit<ComponentProps<"input">, "onChange"> {
  field: keyof CheckoutFields;
  label: string;
  fields: CheckoutFields;
  update: FieldsProps["update"];
}
function Field({ field, label, fields, update, ...props }: FieldProps) {
  const masked = field === "document" || field === "phone";
  const value =
    field === "document"
      ? formatCpf(fields[field])
      : field === "phone"
        ? formatPhone(fields[field])
        : fields[field];
  return (
    <div className="mst-field">
      <label htmlFor={`co-${field}`}>{label}</label>
      <div className={field === "phone" ? "mst-phone-input" : undefined}>
        {field === "phone" && (
          <span
            className="mst-phone-prefix"
            id="co-phone-country"
            aria-label="Código do país: Brasil, mais 55"
          >
            +55
          </span>
        )}
        <input
          id={`co-${field}`}
          name={field}
          value={value}
          onChange={(e) =>
            update(field, masked ? maskInput(e.currentTarget, field) : e.currentTarget.value)
          }
          maxLength={masked ? 32 : 100}
          {...props}
        />
      </div>
    </div>
  );
}
export function CustomerFields(props: FieldsProps) {
  return (
    <>
      <h2 className="mst-h2">
        Seus dados
        <br />
        <span className="mst-lime">de resgate</span>
      </h2>
      <p className="mst-sub">
        Seu copo foi liberado por <b>R$ 0</b> — complete os dados para seguir.
      </p>
      <Field
        {...props}
        field="name"
        label="Nome completo"
        placeholder="Como está no documento"
        autoComplete="name"
        maxLength={120}
      />
      <Field
        {...props}
        field="email"
        label="E-mail"
        placeholder="para receber o rastreio"
        type="email"
        autoComplete="email"
        maxLength={200}
      />
      <div className="mst-grid-2 mst-contact-fields">
        <Field
          {...props}
          field="document"
          label="CPF"
          inputMode="numeric"
          placeholder="000.000.000-00"
        />
        <Field
          {...props}
          field="phone"
          label="Celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-describedby="co-phone-country"
          placeholder="(DDD) 99999-9999"
        />
      </div>
    </>
  );
}
export function AddressFields(props: FieldsProps) {
  return (
    <>
      <div className="mst-kicker">Endereço de entrega</div>
      <div className="mst-grid-2">
        <Field
          {...props}
          field="cep"
          label="CEP"
          inputMode="numeric"
          placeholder="00000-000"
          autoComplete="postal-code"
          maxLength={9}
        />
        <Field {...props} field="number" label="Número" placeholder="Nº" maxLength={20} />
      </div>
      <Field
        {...props}
        field="street"
        label="Endereço"
        placeholder="Rua / avenida"
        autoComplete="address-line1"
        maxLength={150}
      />
      <Field
        {...props}
        field="complement"
        label="Complemento (opcional)"
        placeholder="Apartamento, bloco…"
        autoComplete="address-line2"
      />
      <Field {...props} field="neighborhood" label="Bairro" placeholder="Seu bairro" />
      <div className="mst-grid-2">
        <Field
          {...props}
          field="city"
          label="Cidade"
          placeholder="Sua cidade"
          autoComplete="address-level2"
        />
        <Field
          {...props}
          field="state"
          label="UF"
          placeholder="SP"
          maxLength={2}
          autoComplete="address-level1"
        />
      </div>
    </>
  );
}
