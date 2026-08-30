import type { MilestoneStatus } from "@/lib/types";
export interface FundingInput { milestoneId:string; contractId:string; clientId:string; amount:number; currency:string; }
export interface FundingSession { id:string; provider:string; status:"PENDING"|"FUNDED"; checkoutUrl?:string; }
export interface ReleaseInput { milestoneId:string; contractId:string; amount:number; currency:string; expertId:string; }
export interface MarketplacePaymentProvider {createFundingSession(input:FundingInput):Promise<FundingSession>;releaseFunds(input:ReleaseInput):Promise<{providerActionId:string;accepted:boolean}>;refundFunds(input:ReleaseInput):Promise<{providerActionId:string;accepted:boolean}>;}
export interface MilestoneRecord {id:string;contractId:string;clientId:string;expertId:string;amount:number;currency:string;status:MilestoneStatus;}
