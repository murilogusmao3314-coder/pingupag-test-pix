import { useEffect,useState,type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPix } from "@/lib/pix.functions";
import { cn } from "@/lib/utils";
import { Action,Photo } from "./primitives";
import { customerSchema,addressSchema,emptyFields,calculateTotal,money,type CheckoutFields,type Shipping } from "./checkout-schema";
import { CustomerFields,AddressFields } from "./checkout-fields";
import { ShippingOptions,Extras,Totals,Seals } from "./order";
import { Payment,type PixPayment } from "./payment";
export function Checkout({onClose}:{onClose:()=>void}) {
 const [step,setStep]=useState(1);const [fields,setFields]=useState(emptyFields);const [shipping,setShipping]=useState<Shipping>("pac");const [cup,setCup]=useState(false);const [pack,setPack]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);const [payment,setPayment]=useState<PixPayment|null>(null);
 const createPayment=useServerFn(createPix);const total=calculateTotal(shipping,cup,pack);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[]);
 useEffect(()=>{document.querySelector(".mst-co")?.scrollTo({top:0});},[step,payment]);
 function update(key:keyof CheckoutFields,value:string){setFields(old=>({...old,[key]:value}));}
 function back(){if(pending)return;setError("");if(payment){setPayment(null);return;}if(step===1)onClose();else setStep(step-1);}
 async function submit(e:FormEvent){e.preventDefault();if(pending)return;setError("");
 const customer=customerSchema.safeParse(fields);
 if(!customer.success){setError(customer.error.issues[0]?.message??"Confira seus dados.");setStep(1);return;}
 if(step===1){setStep(2);return;}
 const address=addressSchema.safeParse(fields);
 if(!address.success){setError(address.error.issues[0]?.message??"Confira o endereço.");setStep(2);return;}
 if(step===2){setStep(3);return;}
 setPending(true);
 try{const result=await createPayment({data:{...customer.data,amount:total,description:`Copo Monster 1,15L — envio ${shipping.toUpperCase()}${cup?" +1 copo":""}${pack?" + fardo 6x473ml":""}`}});if(result.ok)setPayment({qr_code:result.qr_code,qr_code_base64:result.qr_code_base64});else setError(result.error);}catch{setError("Não foi possível gerar o PIX. Tente novamente em instantes.");}finally{setPending(false);}
 }
 return <div className="mst-co" role="dialog" aria-modal="true" aria-label="Checkout do resgate"><header className="mst-co-head"><Button variant="ghost" className="mst-co-back" aria-label="Voltar" onClick={back} disabled={pending}><ArrowLeft/></Button><span className="mst-co-brand"><Photo file="monster-logo.png" alt="Monster"/><span>Monster Drinkware</span></span><span className="mst-co-secure">Ambiente seguro</span></header><form id="monster-checkout" onSubmit={submit} noValidate><div className="mst-co-body">{payment?<><Payment payment={payment} onBack={()=>setPayment(null)}/><Totals shipping={shipping} cup={cup} pack={pack}/></>:<><div className="mst-steps-nav">{["Seus dados","Entrega","Pagamento"].map((label,i)=><div className={cn("mst-step",step===i+1&&"is-on",step>i+1&&"is-done")} key={label}><i>{i+1}</i><span>{label}</span></div>)}</div>{step===1&&<CustomerFields fields={fields} update={update}/>} {step===2&&<><h2 className="mst-h2">Onde entregar<br/><span className="mst-lime">o seu copo</span></h2><ShippingOptions shipping={shipping} onChange={setShipping}/><AddressFields fields={fields} update={update}/></>}{step===3&&<><h2 className="mst-h2">Pague só o envio<br/>e leve o seu <span className="mst-lime">copo grátis</span></h2><p className="mst-sub">O copo custa R$ 0,00. O total corresponde à entrega escolhida e aos adicionais que você selecionar.</p><Extras cup={cup} pack={pack} toggle={key=>key==="cup"?setCup(!cup):setPack(!pack)}/><Totals shipping={shipping} cup={cup} pack={pack}/><div className="mst-pay-tabs"><div className="mst-pay-tab is-on">PIX<small>Aprovação pelo seu banco</small></div></div><p className="mst-disclosure">Ao gerar o Pix, você cria uma cobrança real. Os dados de entrega permanecem apenas nesta sessão; a integração atual envia à PinguPag os dados pessoais e o total, sem registrar um pedido de envio.</p></>}{error&&<p className="mst-err" role="alert">{error}</p>}<Seals/></>}</div></form>{!payment&&<div className="mst-bar-fixed"><div className="mst-bar-in"><div className="mst-bar-top"><span>Copo Monster · R$ 0</span><b>Total {money(total)}</b></div><Action type="submit" form="monster-checkout" disabled={pending}>{pending?"Gerando PIX…":step<3?"Continuar":`Gerar PIX de ${money(total)}`}</Action></div></div>}</div>;
}
