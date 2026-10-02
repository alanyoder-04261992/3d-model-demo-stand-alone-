/* CHECK: isolated demo workspace edits and client build boundary.
   Run: node tools/check-portal-demo.mjs (check-all: node) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemoWorkspace } from '../ui/portal-demo.js';
import { learningSiteId } from './site-profiles.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const template=read('companies/demo/company.json'),manufacturer=read('library/manufacturers/standard.json');
const library=read('library/construction.json');
const before=structuredClone(template),demo=createDemoWorkspace(template,manufacturer,library),api=demo.request;
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw new Error('Demo must never make a network request.');};
try{
  const me=await api('/me');assert.equal(me.membership.role,'admin');assert.equal(me.lots.length,2);
  assert.equal(me.companies[0].name,'Demo Barn Company');
  me.companies[0].name='Unintended mutation';assert.equal((await api('/me')).companies[0].name,'Demo Barn Company');
  const cfg=await api('/companies/demo/catalogue');cfg.company.offer.UT.sizes['10x16']=7000;
  const saved=await api('/companies/demo/catalogue',{method:'PUT',body:cfg});assert.equal(saved.version,2);
  assert.equal((await api('/companies/demo/catalogue')).company.offer.UT.sizes['10x16'],7000);
  await assert.rejects(api('/companies/demo/catalogue',{method:'PUT',body:cfg}),e=>e.status===409);
  const invalid=structuredClone(saved);invalid.company.offer.UT.sizes['10x16']=-1;
  await assert.rejects(api('/companies/demo/catalogue',{method:'PUT',body:invalid}));
  const {lot}=await api('/companies/demo/lots',{method:'POST',body:{slug:'demo-west',name:'West sample lot',active:true,embedOrigins:[]}});
  assert.equal((await api('/companies/demo/lots')).lots.length,3);
  const edited=await api('/companies/demo/lots/demo-west',{method:'PUT',body:{...lot,name:'West test',version:1}});assert.equal(edited.lot.version,2);
  assert.equal((await api('/companies/demo/lots')).lots.find(x=>x.id==='demo-west').name,'West test');
  await assert.rejects(api('/companies/demo/lots',{method:'POST',body:{slug:'demo-west',name:'Duplicate'}}),e=>e.status===409);
  const {orders}=await api('/orders?companyId=demo');assert.equal(orders.length,2);
  assert.equal(orders[0].price.total,template.offer.UT.sizes['10x16'],'Recorded sample price stays unchanged after catalogue edit');
  assert.equal(orders[0].link,'/c/demo/');
  assert.ok(orders.every(order=>order.design.items.length>0),'Saved sample designs include normal doors and windows');
  assert.equal((await api('/orders/sample-1',{method:'PATCH',body:{version:1,status:'contacted'}})).order.status,'contacted');
  assert.equal((await api('/orders?companyId=demo')).orders[0].status,'contacted');
  await assert.rejects(api('/orders/sample-1',{method:'PATCH',body:{version:1,status:'closed'}}),e=>e.status===409);
  const member={userId:'sample-member',email:'sample@example.invalid',role:'dealer',companyId:'demo',lotId:lot.id};
  assert.equal((await api('/memberships',{method:'POST',body:member})).membership.userId,member.userId);
  await assert.rejects(api('/memberships',{method:'POST',body:member}),e=>e.status===409);
  const second=structuredClone(template);second.id='second-demo';
  await api('/companies',{method:'POST',body:{company:second}});
  assert.equal((await api('/me')).companies.length,2);assert.deepEqual((await api('/orders?companyId=second-demo')).orders,[]);
  await assert.rejects(api('/companies/second-demo/lots/demo-west',{method:'PUT',body:{...lot,version:2}}),e=>e.status===404);
  await assert.rejects(api('/unexpected',{method:'POST'}),e=>e.status===404);
  const fresh=createDemoWorkspace(template,manufacturer,library);
  assert.equal((await fresh.request('/companies/demo/catalogue')).company.offer.UT.sizes['10x16'],template.offer.UT.sizes['10x16']);
  assert.equal((await fresh.request('/orders?companyId=demo')).orders[0].status,'new');
  assert.deepEqual(template,before,'Input template remains untouched');
}finally{globalThis.fetch=originalFetch;}

for(const client of [false,true]){
  const build=spawnSync(process.execPath,['tools/build-site.mjs',...(client?['--client']:[])],{cwd:root,encoding:'utf8',env:{...process.env,SITE_ID:learningSiteId,INCLUDE_LEARNING_PREVIEW:'true'}});
  assert.equal(build.status,0,build.stdout+build.stderr);
  const bundle=readFileSync(new URL('../'+(client?'dist-client':'dist')+'/ui/portal.js',import.meta.url),'utf8');
  const entry='Leave both fields empty and press Sign in';
  assert.equal(bundle.includes(entry),!client,'Only learning build offers blank login');
  assert.equal(bundle.includes('demo-owner'),!client,'Client bundle excludes the mock account adapter');
}
console.log('PROVED: demo catalogue, lots, orders and simulated assignments work without network access; fresh sessions reset edits; real client build excludes anonymous demo entry and account adapter.');
