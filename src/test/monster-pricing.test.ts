import { describe,it,expect } from "vitest";
import {calculateTotal,customerSchema,addressSchema} from "../components/monster/checkout-schema";
import content from "../components/monster/content.json";
describe("Monster checkout",()=>{
 it("calculates every delivery/add-on combination in cents",()=>{for(const s of ["pac","sedex"] as const)for(const cup of [false,true])for(const pack of [false,true])expect(calculateTotal(s,cup,pack)).toBe((s==="pac"?1437:2286)+(cup?1990:0)+(pack?1990:0));});
 it("rejects invalid customer and address inputs",()=>{expect(customerSchema.safeParse({name:"A",email:"bad",document:"1",phone:"1"}).success).toBe(false);expect(addressSchema.safeParse({cep:"1",street:"",number:"",complement:"",neighborhood:"",city:"",state:"XX"}).success).toBe(false);});
 it("retains all original quiz choices",()=>{expect(content.quiz_questions).toHaveLength(9);expect(content.quiz_questions.reduce((n,q)=>n+q.options.length,0)).toBe(32);});
});
