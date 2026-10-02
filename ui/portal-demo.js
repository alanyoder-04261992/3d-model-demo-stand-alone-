// In-memory demonstration only. This module never calls a staff API or Identity.
import { validate, resolve } from '../model/company.js';
import { toState, fromState } from '../model/design.js';
import { priceParts } from '../model/pricing.js';

const clone=value=>structuredClone(value);
function fail(message,status=422){const error=new Error(message);error.status=status;throw error;}

export function createDemoWorkspace(template,manufacturer,library){
  const initial=clone(template);initial.brand.name='Demo Barn Company';initial.brand.short=initial.brand.name;
  const catalogue=resolve(template,manufacturer,library);
  const companies=new Map([[initial.id,{company:initial,version:1}]]),memberships=new Map();
  const lots=new Map(['north','south'].map(side=>[`demo-${side}`,{id:`demo-${side}`,slug:`demo-${side}`,companyId:initial.id,name:`${side==='north'?'North':'South'} dealer lot`,phone:'',email:`${side}@example.invalid`,website:'',embedOrigins:[],active:true,version:1}]));
  const orders=new Map(['UT','LB'].map((type,i)=>{
    const size='10x16',lot=[...lots.values()][i];
    const state=toState({v:1,company:template.id,type,size,dormer:'none'},catalogue).state;
    return [`sample-${i+1}`,{id:`sample-${i+1}`,version:1,companyId:initial.id,lotId:lot.id,lotName:lot.name,status:i?'quoted':'new',
      contact:{name:`Sample customer ${i+1}`,email:`sample-${i+1}@example.invalid`,note:'Fictional request for exploring the demo.'},
      design:fromState(state,catalogue),price:priceParts(state,catalogue),receivedAt:new Date(Date.UTC(2026,9,1,12+i)).toISOString(),link:'/c/demo/'}];
  }));
  const get=(map,id)=>{const value=map.get(id);if(!value)fail('This sample record was not found.',404);return value;};
  const version=(record,body)=>{if(body?.version!==record.version)fail('Reload this sample record before saving again.',409);};
  const checkCompany=cfg=>{const errors=validate(cfg,manufacturer);if(errors.length)fail(errors.join('\n'));};
  function handle(path,{method='GET',body}={}){
    const url=new URL(path,'https://demo.invalid'),parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if(path==='/me'&&method==='GET')return {user:{id:'demo-owner',name:'Demo owner',email:'Sample workspace'},membership:{role:'admin',companyIds:[...companies.keys()],lotIds:[]},companies:[...companies.values()].map(({company:c,version})=>({id:c.id,name:c.brand.name,status:c.status,version})),lots:[...lots.values()]};
    if(path==='/companies'&&method==='POST'){
      checkCompany(body.company);if(companies.has(body.company.id))fail('This sample company name is already in use.',409);
      const record={company:clone(body.company),version:1};companies.set(body.company.id,record);return record;
    }
    if(parts[0]==='companies'&&parts.length>=3){
      const record=get(companies,parts[1]);
      if(parts[2]==='catalogue'&&parts.length===3){
        if(method==='GET')return record;
        if(method==='PUT'){version(record,body);checkCompany(body.company);if(body.company.id!==parts[1])fail('The company address cannot change.');record.company=clone(body.company);record.version++;return record;}
      }
      if(parts[2]==='lots'){
        if(method==='GET'&&parts.length===3)return {lots:[...lots.values()].filter(l=>l.companyId===parts[1])};
        if(method==='POST'&&parts.length===3){
          if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(body.slug)||!body.name?.trim())fail('Enter a lot name and a valid dealer link name.');
          if(lots.has(body.slug))fail('This sample lot name is already in use.',409);
          const lot={...clone(body),id:body.slug,companyId:parts[1],version:1};lots.set(lot.id,lot);return {lot};
        }
        if(method==='PUT'&&parts.length===4){const lot=get(lots,parts[3]);if(lot.companyId!==parts[1])fail('This lot belongs to another sample company.',404);version(lot,body);Object.assign(lot,clone(body),{id:lot.id,slug:lot.slug,companyId:parts[1],version:lot.version+1});return {lot};}
      }
    }
    if(parts[0]==='orders'){
      if(method==='GET'&&parts.length===1)return {orders:[...orders.values()].filter(o=>o.companyId===url.searchParams.get('companyId'))};
      if(method==='PATCH'&&parts.length===2){const order=get(orders,parts[1]);version(order,body);if(!['new','contacted','quoted','ordered','closed'].includes(body.status))fail('Choose a request status.');order.status=body.status;order.version++;return {order};}
    }
    if(path==='/memberships'&&method==='POST'){
      get(companies,body.companyId);if(memberships.has(body.userId))fail('This sample account already has access.',409);
      if(!body.userId?.trim()||!body.email?.includes('@')||!['dealer','admin'].includes(body.role))fail('Enter sample account details.');
      if(body.role==='dealer'&&get(lots,body.lotId).companyId!==body.companyId)fail('Choose a lot in this sample company.');
      memberships.set(body.userId,clone(body));return {membership:body};
    }
    fail('This action is not available in the demo.',404);
  }
  return {request:async(path,options)=>clone(handle(path,options))};
}
