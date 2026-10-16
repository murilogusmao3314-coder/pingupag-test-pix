import { z } from "zod";
export const digits = (value: string) => value.replace(/\D/g, "");
export const customerSchema = z.object({
 name: z.string().trim().min(3,"Digite seu nome completo.").max(120).refine(v => v.split(/\s+/).length >= 2,"Digite seu nome completo."),
 email: z.string().trim().email("Digite um e-mail válido.").max(200),
 document: z.string().transform(digits).refine(v => /^\d{11}$/.test(v),"Digite um CPF válido (11 dígitos)."),
 phone: z.string().transform(digits).refine(v => /^\d{10,11}$/.test(v),"Digite um celular com DDD."),
});
export const addressSchema = z.object({
 cep:z.string().transform(digits).refine(v => /^\d{8}$/.test(v),"Digite um CEP válido."),
 street:z.string().trim().min(1,"Digite o endereço.").max(150),
 number:z.string().trim().min(1,"Digite o número.").max(20),
 complement:z.string().trim().max(100),
 neighborhood:z.string().trim().min(1,"Digite o bairro.").max(100),
 city:z.string().trim().min(1,"Digite a cidade.").max(100),
 state:z.string().trim().toUpperCase().refine(v => /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(v),"Digite o estado (UF)."),
});
export type Shipping = "pac" | "sedex";
export function calculateTotal(shipping:Shipping, cup:boolean, pack:boolean):number {
 return (shipping === "pac" ? 990 : 1894) + (cup ? 1990 : 0) + (pack ? 1990 : 0);
}
export function money(cents:number):string { return `R$ ${(cents/100).toFixed(2).replace(".",",")}`; }
export type CheckoutFields = z.input<typeof customerSchema> & z.input<typeof addressSchema>;
export const emptyFields:CheckoutFields={name:"",email:"",document:"",phone:"",cep:"",street:"",number:"",complement:"",neighborhood:"",city:"",state:""};
