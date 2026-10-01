import { getUser, getSettings, handleAuthCallback, login, signup, logout, onAuthChange,
  requestPasswordRecovery, updateUser, acceptInvite } from '@netlify/identity';
import { encodeSync } from '../model/design.js';

const content=document.querySelector('#content'), notice=document.querySelector('#notice');
const navigation=document.querySelector('#navigation'), scope=document.querySelector('#scope'), account=document.querySelector('#account');
const state={me:null,companyId:'',view:'orders',dirty:false,saving:0,epoch:0,authMode:'login',inviteToken:null,settings:null,authSetupMessage:''};
const statuses=['new','contacted','quoted','ordered','closed'];
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const clone=value=>JSON.parse(JSON.stringify(value));
let nextId=0, authBusy=false;

function el(tag,attrs={},...children){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(value==null) continue;
    if(key==='class') node.className=value;
    else if(key==='text') node.textContent=value;
    else if(key.startsWith('on')&&typeof value==='function') node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key in node && !key.startsWith('aria-')) node[key]=value;
    else node.setAttribute(key,String(value));
  }
  for(const child of children.flat()) if(child!=null) node.append(child.nodeType?child:document.createTextNode(String(child)));
  return node;
}
function button(label,handler,variant='secondary'){return el('button',{type:'button',class:`button ${variant}`,onclick:handler},label);}
function message(text,error=false){notice.textContent=text;notice.className=`notice${error?' error':''}`;notice.hidden=!text;notice.setAttribute('role',error?'alert':'status');}
function field(label,{value='',type='text',hint,wide=false,options,...attrs}={}){
  const id=`portal-field-${++nextId}`;
  const input=options?el('select',{id,...attrs},options.map(([v,t])=>el('option',{value:v},t))):type==='textarea'?el('textarea',{id,...attrs}):el('input',{id,type,...attrs});
  input.value=value??'';
  const wrapper=el('div',{class:`field${wide?' wide':''}`},el('label',{htmlFor:id},label),input);
  if(hint){const help=el('p',{class:'hint',id:`${id}-help`},hint);input.setAttribute('aria-describedby',help.id);wrapper.append(help);}
  return {wrapper,input};
}
function check(label,checked=false){const input=el('input',{type:'checkbox',checked});return {input,wrapper:el('label',{class:'check-label'},input,label)};}
function heading(title,subtitle,...actions){return el('header',{class:'page-heading'},el('div',{},el('h1',{},title),el('p',{},subtitle)),actions.length?el('div',{class:'actions'},actions):null);}
function panel(title,...children){return el('section',{class:'panel'},title?el('h2',{},title):null,children);}
function empty(title,body,...actions){return el('section',{class:'empty'},el('h2',{},title),el('p',{},body),el('div',{class:'actions'},actions));}
function date(value){const d=new Date(value);return Number.isNaN(d.valueOf())?'Date unavailable':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
function currency(value){return typeof value==='number'&&Number.isFinite(value)?money.format(value):'Unavailable';}
function statusBadge(status){return el('span',{class:`badge ${statuses.includes(status)||status==='suspended'?status:''}`},status?status[0].toUpperCase()+status.slice(1):'Unknown');}
function allowedLink(value){try{const u=new URL(value,location.origin);return u.origin===location.origin&&['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function apiPath(path){return `/api/dealer${path}`;}
async function api(path,{method='GET',body}={}){
  const response=await fetch(apiPath(path),{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let result;try{result=await response.json();}catch{throw new Error('The workspace service did not return a valid response. Try again.');}
  if(!response.ok){
    const details=Array.isArray(result.details)?result.details.join('\n'):'';
    const text=result.message||result.error||'This request could not be completed.';
    const err=new Error(response.status===409?'Someone changed this record while you were editing. Reload it before saving again.':`${typeof text==='string'?text:'This request could not be completed.'}${details?'\n'+details:''}`);
    err.status=response.status;throw err;
  }
  return result;
}
async function staticJSON(path){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('The catalogue template could not be loaded.');return response.json();}
function formAction(form,work){
  const feedback=el('div',{'aria-live':'polite',hidden:true});form.append(feedback);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.dataset.busy||!form.reportValidity())return;
    const controls=[...form.querySelectorAll('button,input,select,textarea')],previous=controls.map(x=>x.disabled);
    form.dataset.busy='true';state.saving++;controls.forEach(x=>x.disabled=true);form.setAttribute('aria-busy','true');feedback.hidden=true;
    try{await work();}catch(error){feedback.className='form-error';feedback.textContent=error.message||'Please try again.';feedback.hidden=false;feedback.setAttribute('role','alert');feedback.scrollIntoView({block:'nearest'});}
    finally{state.saving--;controls.forEach((x,i)=>x.disabled=previous[i]);delete form.dataset.busy;form.removeAttribute('aria-busy');}
  });
  return feedback;
}
function setDirty(){state.dirty=true;}
function leave(){if(state.saving){message('Please wait for the current request to finish.');return false;}if(state.dirty&&!window.confirm('Leave without saving your changes?'))return false;state.dirty=false;return true;}
function clearPrivate(){state.epoch++;state.me=null;state.companyId='';state.dirty=false;content.replaceChildren();scope.replaceChildren();navigation.replaceChildren();account.replaceChildren();scope.hidden=navigation.hidden=account.hidden=true;}
function admin(){return state.me?.membership?.role==='admin';}
function company(){return state.me?.companies?.find(c=>c.id===state.companyId);}
function companyPath(suffix=''){return `/companies/${encodeURIComponent(state.companyId)}${suffix}`;}
function accountIdCard(user){
  return empty('Your account is ready for access','Ask your business owner or administrator to assign this verified account to your company or dealer lot.',
    button('Check access again',()=>loadWorkspace()));
}

function renderAuth(mode='login'){
  clearPrivate();state.authMode=mode;content.setAttribute('aria-busy','false');
  const special=['recovery','invite'].includes(mode);
  const title={login:'Sign in',signup:'Create your account',forgot:'Reset your password',recovery:'Set a new password',invite:'Accept your invitation'}[mode];
  const intro=el('section',{class:'auth-intro'},el('h1',{},'One catalogue. Every dealer lot.'),el('p',{},'Manage your building prices, connect your dealer lots and follow each customer request in one place.'));
  const form=el('form',{},el('h2',{},title));
  let name,email,password,confirmPassword;
  if(mode==='signup'){name=field('Your name',{required:true,autocomplete:'name',maxLength:120});form.append(name.wrapper);}
  if(!special){email=field('Email address',{type:'email',required:true,autocomplete:'email',maxLength:254});form.append(email.wrapper);}
  if(mode!=='forgot'){
    password=field(special?'New password':'Password',{type:'password',required:true,minLength:mode==='login'?1:10,maxLength:256,autocomplete:mode==='login'?'current-password':'new-password',hint:mode==='login'?null:'Use at least 10 characters.'});form.append(password.wrapper);
    if(special){confirmPassword=field('Confirm new password',{type:'password',required:true,minLength:10,autocomplete:'new-password'});form.append(confirmPassword.wrapper);}
  }
  form.append(el('button',{class:'button',type:'submit'},mode==='forgot'?'Send recovery email':title));
  const feedback=formAction(form,async()=>{
    authBusy=true;
    try{
      if(mode==='forgot'){await requestPasswordRecovery(email.input.value.trim());feedback.className='form-message';feedback.textContent='If an account exists for this address, check your email for the recovery link.';feedback.hidden=false;return;}
      if(confirmPassword&&confirmPassword.input.value!==password.input.value)throw new Error('The two passwords do not match.');
      if(mode==='signup'){
        const user=await signup(email.input.value.trim(),password.input.value,{full_name:name.input.value.trim()});
        if(!user.confirmedAt){renderAuth('login');message('Check your email to confirm your account, then sign in. Your business administrator will assign access.');return;}
      }else if(mode==='login') await login(email.input.value.trim(),password.input.value);
      else if(mode==='recovery') await updateUser({password:password.input.value});
      else if(mode==='invite'){await acceptInvite(state.inviteToken,password.input.value);state.inviteToken=null;}
      state.authMode='login';message('');await loadWorkspace();
    }finally{authBusy=false;}
  });
  const links=el('div',{class:'actions'});
  if(mode==='login'){
    if(state.settings&&!state.settings.disableSignup)links.append(el('button',{type:'button',class:'text-button',onclick:()=>renderAuth('signup')},'Create account'));
    links.append(el('button',{type:'button',class:'text-button',onclick:()=>renderAuth('forgot')},'Forgot password?'));
  }else if(!special)links.append(el('button',{type:'button',class:'text-button',onclick:()=>renderAuth('login')},'Back to sign in'));
  const authPanel=el('section',{class:'auth-panel'},form,links,el('p',{class:'auth-note'},mode==='signup'?'Creating an account does not grant company access. Your administrator assigns your role after you confirm your email.':'Access is limited to the company and dealer lots assigned to your account.'));
  if(state.authSetupMessage)authPanel.prepend(el('p',{class:'form-error',role:'alert'},state.authSetupMessage));
  content.replaceChildren(el('div',{class:'auth-wrap'},intro,authPanel));
}

function renderChrome(){
  const me=state.me, companies=me.companies||[];
  scope.hidden=navigation.hidden=account.hidden=false;scope.replaceChildren();navigation.replaceChildren();account.replaceChildren();
  if(companies.length){
    const picker=field('Company',{value:state.companyId,options:companies.map(c=>[c.id,c.name])});
    picker.input.addEventListener('change',()=>{if(!leave()){picker.input.value=state.companyId;return;}state.companyId=picker.input.value;openView('orders',false);});
    scope.append(picker.wrapper);
  }
  scope.append(el('p',{},admin()?'Owner / administrator':'Dealer lot access'));
  for(const [key,label] of [['orders','Order inbox'],...(admin()?[['catalogue','Catalogue & prices'],['lots','Dealer lots'],['team','Team access']]:[])]){
    navigation.append(el('button',{type:'button',class:'nav-button','aria-current':state.view===key?'page':null,onclick:()=>openView(key)},label));
  }
  const userText=el('div',{},el('p',{},me.user.name||'Signed in'),el('p',{},me.user.email));
  account.append(userText,el('button',{type:'button',class:'text-button',onclick:async()=>{
    if(!leave())return;authBusy=true;
    try{await logout();}catch(error){message(error.message,true);}finally{authBusy=false;renderAuth();}
  }},'Sign out'));
}

async function loadWorkspace(){
  const epoch=++state.epoch;state.dirty=false;scope.hidden=navigation.hidden=account.hidden=true;content.setAttribute('aria-busy','true');content.replaceChildren(el('p',{class:'loading'},'Loading your account…'));
  try{
    const me=await api('/me');if(epoch!==state.epoch)return;
    state.me=me;state.companyId=me.companies?.some(c=>c.id===state.companyId)?state.companyId:(me.companies?.[0]?.id||'');
    if(!me.membership){
      renderChrome();scope.hidden=navigation.hidden=true;
      const box=accountIdCard(me.user);box.insertBefore(el('p',{},'Your account ID'),box.lastChild);box.insertBefore(el('code',{},me.user.id),box.lastChild);
      box.insertBefore(el('p',{class:'hint'},me.user.email),box.lastChild);
      content.replaceChildren(heading('Account access','Your company controls which records you can open.'),box);return;
    }
    await openView('orders',false);
  }catch(error){if(epoch!==state.epoch)return;if(error.status===401){renderAuth();message('Sign in to open your workspace.');}else{content.replaceChildren(empty('Workspace unavailable',error.message,button('Try again',()=>loadWorkspace())));message(error.message,true);}}
  finally{if(epoch===state.epoch)content.setAttribute('aria-busy','false');}
}
async function openView(view,ask=true){
  if(ask&&!leave())return;
  state.view=view;const epoch=++state.epoch;renderChrome();message('');content.setAttribute('aria-busy','true');content.replaceChildren(el('p',{class:'loading'},'Loading…'));
  try{
    if(!state.companyId){
      if(admin())renderNewCompany();
      else content.replaceChildren(heading('Order inbox','Customer requests from your assigned dealer lots.'),empty('No dealer lot assigned','Ask your company administrator to assign a dealer lot, then check access again.',button('Check access',()=>loadWorkspace())));
    }else if(view==='catalogue'){
      const data=await api(companyPath('/catalogue'));const manufacturer=await staticJSON(`/library/manufacturers/${encodeURIComponent(data.company.manufacturer||'standard')}.json`);
      if(epoch===state.epoch)renderCatalogue(data,manufacturer);
    }else if(view==='lots'||view==='team'){
      const data=await api(companyPath('/lots'));if(epoch===state.epoch)(view==='lots'?renderLots(data.lots):renderTeam(data.lots));
    }else{
      const params=new URLSearchParams({companyId:state.companyId});const data=await api(`/orders?${params}`);if(epoch===state.epoch){renderOrders(data.orders||[]);if(data.truncated)message('Showing the latest 500 requests. Older requests are not included in this list.');}
    }
  }catch(error){if(epoch===state.epoch){if(error.status===401){renderAuth();message('Your session has expired. Sign in again to continue.',true);}else content.replaceChildren(empty('Could not open this page',error.message,button('Try again',()=>openView(view,false))));}}
  finally{if(epoch===state.epoch)content.setAttribute('aria-busy','false');}
}

function renderNewCompany(){
  const form=el('form',{class:'panel'});const grid=el('div',{class:'form-grid'});
  const name=field('Business name',{required:true,maxLength:120,autocomplete:'organization'}),id=field('Company address name',{required:true,pattern:'[a-z0-9][a-z0-9-]{1,39}',maxLength:40,hint:'2–40 lowercase letters, numbers or hyphens. This cannot be changed later.'});
  const template=field('Starting building catalogue',{value:'starter',options:[['starter','Three styles: utility, loft barn and garage'],['demo','Complete standard building line']]});
  const email=field('Business email',{type:'email',required:true}),phone=field('Business phone',{type:'tel'});
  grid.append(name.wrapper,id.wrapper,template.wrapper,email.wrapper,phone.wrapper);form.append(grid,el('p',{class:'hint'},'The new catalogue starts inactive. Review all template prices and options before activating it or sharing a dealer link.'),el('div',{class:'form-footer'},el('button',{type:'submit',class:'button'},'Create company catalogue')));
  formAction(form,async()=>{
    const cfg=clone(await staticJSON(`/companies/${template.input.value}/company.json`));
    cfg.id=id.input.value.trim();cfg.status='suspended';
    cfg.brand={...cfg.brand,name:name.input.value.trim(),short:name.input.value.trim(),initials:name.input.value.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join(''),phone:phone.input.value.trim(),email:email.input.value.trim(),website:'',tagline:'',logo:'',colors:{header:'#0A2C49',accent:'#146D85'}};
    cfg.leads={mode:'none',fields:{name:'required',phone:'required',email:'optional',zip:'required',address:'optional',note:'optional'},images:false};
    cfg.embed={origins:[],shareUrl:''};cfg.license={plan:'hosted',renews:''};cfg.features={...cfg.features,framingView:false,buildPlayback:false};cfg.notes={finePrint:'',sizeNotes:{}};cfg.cfg=1;delete cfg._help;
    const saved=await api('/companies',{method:'POST',body:{company:cfg}});state.companyId=saved.company.id;await loadWorkspace();await openView('catalogue',false);message('Company created and inactive. Review the catalogue, then activate it when the prices are ready.');
  });
  content.replaceChildren(heading('Set up your business','Create the catalogue your dealer lots will share.'),form);
}

function priceTable(rows){
  const table=el('table',{},el('thead',{},el('tr',{},el('th',{},'Item'),el('th',{class:'money'},'Price (USD)'),el('th',{},'Offered')))),body=el('tbody');table.append(body);
  for(const row of rows){
    const input=el('input',{type:'number',min:row.min??0,step:'0.01',value:row.price??'',required:row.enabled,'aria-label':`${row.name} price in dollars`});
    const enabled=check(`Offer ${row.name}`,row.enabled);enabled.wrapper.lastChild.textContent='Offered';input.disabled=!row.enabled;
    enabled.input.setAttribute('aria-label',`Offer ${row.name}`);
    enabled.input.addEventListener('change',()=>{input.disabled=!enabled.input.checked;input.required=enabled.input.checked;setDirty();});
    body.append(el('tr',{},el('td',{},row.name,row.hint?el('span',{class:'order-summary'},row.hint):null),el('td',{class:'money'},input),el('td',{},enabled.wrapper)));
    row.read=()=>enabled.input.checked?Number(input.value):null;
  }
  return el('div',{class:'table-wrap'},table);
}
function accordion(title,children,open=false){return el('details',{class:'accordion',open},el('summary',{},title),el('div',{class:'accordion-body'},children));}
function renderCatalogue(data,manufacturer){
  const draft=clone(data.company),form=el('form');form.addEventListener('input',setDirty);form.addEventListener('change',setDirty);
  const brandName=field('Company name',{value:draft.brand.name,required:true,maxLength:120}),status=field('Catalogue availability',{value:draft.status,options:[['suspended','Inactive — dealer links unavailable'],['active','Active — available through dealer links']]});
  const phone=field('Phone',{value:draft.brand.phone,type:'tel'}),email=field('Email',{value:draft.brand.email,type:'email'});
  const finePrint=field('Price and delivery note',{value:draft.notes?.finePrint,type:'textarea',wide:true,maxLength:1500});
  const details=el('div',{class:'form-grid'},brandName.wrapper,status.wrapper,phone.wrapper,email.wrapper,finePrint.wrapper);
  form.append(panel('Company details',details));
  const styleRows=[],stylesBox=el('div');form.append(stylesBox);
  for(const [style,offering] of Object.entries(draft.offer||{})){
    const rows=Object.entries(offering.sizes).map(([size,price])=>({style,size,name:size.replace('x',' × ')+' ft',price,enabled:true,min:0.01}));
    styleRows.push(...rows);
  }
  function drawStyles(){
    for(const row of styleRows)if(row.read){row.price=row.read();row.enabled=row.price!=null;}
    stylesBox.replaceChildren();
    for(const style of new Set(styleRows.map(r=>r.style))){const rows=styleRows.filter(r=>r.style===style);stylesBox.append(accordion(draft.offer?.[style]?.name||manufacturer.styles?.[style]?.name||style,priceTable(rows),true));}
  }
  drawStyles();
  const newStyle=field('Style',{options:Object.entries(manufacturer.styles||{}).map(([id,s])=>[id,s.name||id])}),newWidth=field('Width (ft)',{type:'number',min:1,max:100,step:1}),newLength=field('Length (ft)',{type:'number',min:1,max:200,step:1}),newPrice=field('Building price (USD)',{type:'number',min:0.01,step:0.01});
  const addSize=button('Add building size',()=>{
    if(![newWidth,newLength,newPrice].every(f=>f.input.value&&f.input.checkValidity())){message('Enter a whole-foot width and length, plus a price above zero.',true);return;}
    const size=`${Number(newWidth.input.value)}x${Number(newLength.input.value)}`,style=newStyle.input.value;
    if(styleRows.some(r=>r.style===style&&r.size===size)){message('This size is already listed. Edit its price or Offered checkbox above.',true);return;}
    styleRows.push({style,size,name:size.replace('x',' × ')+' ft',price:Number(newPrice.input.value),enabled:true,min:0.01});drawStyles();newWidth.input.value=newLength.input.value=newPrice.input.value='';setDirty();message('Building size added to your draft. Save the catalogue to publish this change.');
  },'secondary small');
  form.append(accordion('Add a building size',[el('div',{class:'form-grid'},newStyle.wrapper,newWidth.wrapper,newLength.wrapper,newPrice.wrapper),el('div',{class:'form-footer'},addSize)]));
  const itemRows=Object.entries(manufacturer.items||{}).map(([id,item])=>({id,name:draft.items?.[id]?.name||item.name||id,price:typeof draft.items?.[id]==='object'?draft.items[id].price:draft.items?.[id],enabled:Object.hasOwn(draft.items||{},id)}));
  form.append(accordion('Doors, windows & fixtures',priceTable(itemRows)));
  const optionRows=[],groupNames={dormers:'Dormers',ramps:'Ramps',elec:'Electrical packages',misc:'Other options',rates:'Area-based upgrades'};
  for(const [group,label] of Object.entries(groupNames)){
    const rows=Object.entries(manufacturer.options?.[group]||{}).map(([id,item])=>({group,id,name:item.name||id,hint:group==='rates'?`Price per square foot of ${item.basis||'floor'} area`:item.desc,price:draft.options?.[group]?.[id],enabled:Object.hasOwn(draft.options?.[group]||{},id)}));
    optionRows.push(...rows);if(rows.length)form.append(accordion(label,priceTable(rows)));
  }
  const extras=clone(draft.options?.extras||[]),extraBox=el('div'),extraInputs=[];
  function addExtra(extra={key:'',name:'',input:'check',price:0}){
    const key=field('Option code',{value:extra.key,required:true,pattern:'[a-zA-Z0-9_-]+',maxLength:60,hint:'Keep existing codes unchanged for saved designs.'}),name=field('Name',{value:extra.name,required:true,maxLength:120});
    const type=field('Selection',{value:extra.input,options:[['check','On / off'],['qty','Quantity'],['lf','Per linear foot'],['sqftF','Per floor square foot'],['sqftW','Per wall square foot'],['sqftR','Per roof square foot'],['pct','Percent of building price']]}),price=field('Price / rate',{value:extra.price,type:'number',min:0,step:0.01,required:true});
    const row=el('div',{class:'extra-row'},name.wrapper,key.wrapper,type.wrapper,price.wrapper);
    const entry={extra,key,name,type,price,removed:false};extraInputs.push(entry);
    row.append(button('Remove',()=>{entry.removed=true;row.remove();setDirty();},'secondary small'));extraBox.append(row);
  }
  extras.forEach(addExtra);
  form.append(accordion('Your additional options',[extraBox,button('Add an option',()=>{addExtra();setDirty();},'secondary small')]));
  const review=check('I have reviewed these prices and options for all of this company’s dealer lots.',false);
  form.append(panel(null,review.wrapper,el('p',{class:'hint'},'Turning off a required building item or dormer can make a catalogue invalid. The server checks the complete catalogue before saving.')));
  const save=el('button',{type:'submit',class:'button'},'Save catalogue');
  form.append(el('div',{class:'sticky-save actions'},save,button('Reload saved catalogue',()=>{if(leave())openView('catalogue',false);}),el('span',{class:'hint'},`Revision ${data.version}`)));
  formAction(form,async()=>{
    if(status.input.value==='active'&&!review.input.checked)throw new Error('Confirm that you have reviewed the prices and options before saving an active catalogue.');
    const result=clone(draft);result.brand.name=brandName.input.value.trim();result.brand.short=result.brand.name;result.brand.phone=phone.input.value.trim();result.brand.email=email.input.value.trim();result.status=status.input.value;result.notes={...result.notes,finePrint:finePrint.input.value};
    const offered={};for(const row of styleRows){const price=row.read();if(price!=null){offered[row.style]??={...draft.offer[row.style],sizes:{}};offered[row.style].sizes[row.size]=price;}}
    if(!Object.keys(offered).length)throw new Error('Keep at least one building size in the catalogue.');result.offer=offered;
    result.categories=(result.categories||[]).map(([name,ids])=>[name,ids.filter(id=>Object.hasOwn(offered,id))]).filter(([,ids])=>ids.length);
    const categorized=new Set(result.categories.flatMap(([,ids])=>ids)),uncategorized=Object.keys(offered).filter(id=>!categorized.has(id));if(uncategorized.length)result.categories.push(['Buildings',uncategorized]);
    if(!offered[result.defaults.style])result.defaults.style=Object.keys(offered)[0];
    if(!Object.hasOwn(offered[result.defaults.style].sizes,result.defaults.size))result.defaults.size=Object.keys(offered[result.defaults.style].sizes)[0];
    result.items={};for(const row of itemRows){const price=row.read();if(price!=null)result.items[row.id]=typeof draft.items?.[row.id]==='object'?{...draft.items[row.id],price}:price;}
    result.options={};for(const row of optionRows){const price=row.read();if(price!=null){result.options[row.group]??={};result.options[row.group][row.id]=price;}}
    result.options.extras=extraInputs.filter(x=>!x.removed).map(x=>({...x.extra,key:x.key.input.value.trim(),name:x.name.input.value.trim(),input:x.type.input.value,price:Number(x.price.input.value)}));
    result.cfg=(Number(result.cfg)||0)+1;
    await api(companyPath('/catalogue'),{method:'PUT',body:{company:result,version:data.version}});state.dirty=false;await loadWorkspace();await openView('catalogue',false);message('Catalogue saved. All dealer lots for this company use these prices and options.');
  });
  content.replaceChildren(heading('Catalogue & prices',`${company()?.name||draft.brand.name} · One price book shared by every dealer lot.`),form);
}

function parseOrigins(text){
  const values=[...new Set(text.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean))];
  if(values.length>10)throw new Error('Use at most 10 website origins.');
  return values.map(value=>{let url;try{url=new URL(value);}catch{throw new Error(`Enter a full HTTPS website address: ${value}`);}if(url.protocol!=='https:'||url.origin!==value||url.username||url.password)throw new Error(`Use only the HTTPS origin, with no path or trailing slash: ${url.origin}`);return value;});
}
function renderLotForm(lot,onCancel){
  const form=el('form',{class:'panel'});form.append(el('h2',{},lot?'Edit dealer lot':'Add a dealer lot'));const grid=el('div',{class:'form-grid'});
  const name=field('Lot name',{value:lot?.name,required:true,maxLength:120}),slug=field('Dealer link name',{value:lot?.slug,required:true,pattern:'[a-z0-9][a-z0-9-]{1,39}',maxLength:40,disabled:!!lot,hint:'Used in the dealer’s unique designer link. It cannot be changed later.'});
  const phone=field('Contact phone',{value:lot?.phone,type:'tel'}),email=field('Contact email',{value:lot?.email,type:'email'}),website=field('Dealer website',{value:lot?.website,type:'url',placeholder:'https://'});
  const origins=field('Websites allowed to embed this lot’s designer',{value:(lot?.embedOrigins||[]).join('\n'),type:'textarea',wide:true,hint:'One HTTPS origin per line, such as https://your-domain.com. Include the www version separately if you use it.'});
  const active=check('Dealer link active',lot?lot.active:true);grid.append(name.wrapper,slug.wrapper,phone.wrapper,email.wrapper,website.wrapper,origins.wrapper);form.append(grid,el('div',{class:'form-footer'},active.wrapper,el('div',{class:'actions'},button('Cancel',onCancel),el('button',{type:'submit',class:'button'},lot?'Save dealer lot':'Create dealer lot'))));
  form.addEventListener('input',setDirty);form.addEventListener('change',setDirty);
  formAction(form,async()=>{
    const values={name:name.input.value.trim(),phone:phone.input.value.trim(),email:email.input.value.trim(),website:website.input.value.trim(),embedOrigins:parseOrigins(origins.input.value),active:active.input.checked};
    await api(companyPath(lot?`/lots/${encodeURIComponent(lot.id)}`:'/lots'),{method:lot?'PUT':'POST',body:lot?{...values,version:lot.version}:{...values,slug:slug.input.value.trim()}});
    state.dirty=false;await openView('lots',false);message(lot?'Dealer lot saved.':'Dealer lot created. Copy its unique designer link or embed code below.');
  });return form;
}
function renderLots(lots){
  const list=el('div'),editor=el('div');
  function showEditor(lot){if(!leave())return;editor.replaceChildren(renderLotForm(lot,()=>{if(leave())editor.replaceChildren();}));editor.scrollIntoView({block:'start'});}
  for(const lot of lots){
    const url=new URL(`/d/${encodeURIComponent(lot.slug)}/`,location.origin).href;
    const snippet=`<div id="shed-designer"></div>\n<script src="${location.origin}/embed.js" data-lot="${lot.slug}" data-height="720"></script>`;
    const code=el('pre',{class:'code-copy'},snippet);
    const copy=button('Copy embed code',async()=>{try{await navigator.clipboard.writeText(snippet);message(`Embed code copied for ${lot.name}.`);}catch{message('Select and copy the embed code shown below.',true);}},'secondary small');
    const box=panel(null,el('div',{class:'lot-header'},el('div',{},el('h2',{},lot.name),el('p',{},[lot.phone,lot.email].filter(Boolean).join(' · ')||'No contact details yet.')),statusBadge(lot.active?'active':'suspended')),
      el('div',{class:'lot-links'},el('a',{href:url,target:'_blank',rel:'noopener'},'Open dealer designer'),button('Copy link',async()=>{try{await navigator.clipboard.writeText(url);message('Dealer link copied.');}catch{message(url);}},'secondary small'),button('Edit lot',()=>showEditor(lot),'secondary small')),
      el('p',{class:'hint'},url),el('p',{class:'hint'},lot.embedOrigins?.length?`Allowed websites: ${lot.embedOrigins.join(', ')}`:'Add allowed websites before embedding this designer.'),code,copy);
    list.append(box);
  }
  if(!lots.length)list.append(empty('Connect your first dealer lot','Each lot gets its own designer link and inbox. The company catalogue controls its prices and options.'));
  content.replaceChildren(heading('Dealer lots',`${company()?.name} · Unique links, shared building prices.`,button('Add dealer lot',()=>showEditor(null),'')),editor,list);
}

function renderTeam(lots){
  const form=el('form',{class:'panel'}),grid=el('div',{class:'form-grid'});
  const userId=field('Verified account ID',{required:true,maxLength:120,hint:'The user finds this after signing in with their confirmed email.'}),email=field('Account email',{required:true,type:'email',maxLength:254});
  const role=field('Role',{value:'dealer',options:[['dealer','Dealer — assigned lot’s orders'],['admin','Owner / administrator — company settings and all lots']]});
  const lot=field('Dealer lot',{value:lots[0]?.id||'',options:lots.length?lots.map(x=>[x.id,x.name]):[['','Create a dealer lot first']],required:true});
  role.input.addEventListener('change',()=>{lot.wrapper.hidden=role.input.value==='admin';lot.input.required=role.input.value==='dealer';});
  grid.append(userId.wrapper,email.wrapper,role.wrapper,lot.wrapper);form.append(el('h2',{},'Assign an existing account'),el('p',{class:'muted'},'Ask the person to create an account and confirm their email first. This form grants access; it does not send an invitation.'),grid,el('div',{class:'form-footer'},el('p',{class:'hint'},'Access applies only to this company. Existing assignments cannot be replaced here.'),el('button',{type:'submit',class:'button'},'Grant access')));
  formAction(form,async()=>{
    if(role.input.value==='dealer'&&!lot.input.value)throw new Error('Create a dealer lot before assigning a dealer.');
    await api('/memberships',{method:'POST',body:{userId:userId.input.value.trim(),email:email.input.value.trim(),role:role.input.value,companyId:state.companyId,...(role.input.value==='dealer'?{lotId:lot.input.value}:{})}});
    userId.input.value='';email.input.value='';message('Access granted. The user can sign in and refresh their workspace.');
  });
  content.replaceChildren(heading('Team access',`${company()?.name} · Assign the right access to each person.`),form);
}

function renderOrders(orders){
  const search=field('Find a request',{type:'search',placeholder:'Name, email or order reference'}),status=field('Status',{options:[['','All statuses'],...statuses.map(x=>[x,x[0].toUpperCase()+x.slice(1)])]});search.wrapper.classList.add('search');
  const lotOptions=[...new Map(orders.map(x=>[x.lotId,x.lotName||x.lotId])).entries()];
  const lot=field('Dealer lot',{options:[['','All assigned lots'],...lotOptions]});
  const results=el('div'),count=el('p',{class:'hint','aria-live':'polite'});
  function draw(){
    const query=search.input.value.toLocaleLowerCase().trim();
    const rows=orders.filter(o=>(!status.input.value||o.status===status.input.value)&&(!lot.input.value||o.lotId===lot.input.value)&&(!query||[o.id,o.contact?.name,o.contact?.email,o.contact?.phone].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
    count.textContent=`${rows.length} ${rows.length===1?'request':'requests'}`;
    if(!rows.length){results.replaceChildren(empty(orders.length?'No matching requests':'Your inbox is ready',orders.length?'Try another name, status or dealer lot.':'Customer requests will appear here when someone submits a design through an assigned dealer link.'));return;}
    const table=el('table',{class:'order-table'},el('thead',{},el('tr',{},...['Customer / building','Status','Dealer lot','Received','Total'].map(t=>el('th',{},t))))),body=el('tbody');
    for(const order of rows){
      const open=el('button',{class:'order-open',type:'button',onclick:()=>renderOrder(order,orders)},order.contact?.name||'Customer request',el('span',{class:'order-summary'},`${order.design?.size||''} ${order.design?.type||''}`.trim()||order.id));
      body.append(el('tr',{},el('td',{},open),el('td',{},statusBadge(order.status)),el('td',{},order.lotName||order.lotId),el('td',{},date(order.receivedAt)),el('td',{class:'money'},currency(order.price?.total))));
    }
    table.append(body);results.replaceChildren(el('div',{class:'panel table-wrap'},table));
  }
  search.input.addEventListener('input',draw);status.input.addEventListener('change',draw);lot.input.addEventListener('change',draw);
  content.replaceChildren(heading('Order inbox',`${company()?.name} · ${admin()?'Requests from every dealer lot.':'Requests from your assigned dealer lots.'}`,button('Refresh',()=>openView('orders'))),el('div',{class:'tools'},search.wrapper,status.wrapper,lot.wrapper),count,results);draw();
}
function descriptionList(entries){const dl=el('dl',{class:'details'});for(const [label,value] of entries)dl.append(el('dt',{},label),el('dd',{},value||'Not provided'));return dl;}
function renderOrder(order,orders){
  const contact=order.contact||{},design=order.design||{},price=order.price||{};
  const status=field('Request status',{value:order.status,options:statuses.map(x=>[x,x[0].toUpperCase()+x.slice(1)])}),form=el('form',{},status.wrapper,el('div',{class:'form-footer'},el('button',{type:'submit',class:'button'},'Update status')));
  formAction(form,async()=>{const response=await api(`/orders/${encodeURIComponent(order.id)}`,{method:'PATCH',body:{status:status.input.value,version:order.version}});const index=orders.findIndex(x=>x.id===order.id);orders[index]=response.order;renderOrder(response.order,orders);message('Request status updated.');});
  const contacts=descriptionList([['Name',contact.name],['Phone',contact.phone],['Email',contact.email],['ZIP code',contact.zip],['Address',contact.address],['Message',contact.note],...(contact.smsOk!=null?[['Text permission',contact.smsOk?'Yes':'No']]:[])]);
  const colors=Object.entries(design.colors||{}).filter(([,v])=>v).map(([k,v])=>`${k[0].toUpperCase()+k.slice(1)}: ${v}`).join('\n');
  const building=descriptionList([['Style',design.type],['Size',design.size],['Colours',colors],['Dealer lot',order.lotName||order.lotId],['Received',date(order.receivedAt)],['Reference',order.id]]);
  let link=allowedLink(order.link);try{if(link){const url=new URL(link);url.hash=`d=${encodeSync(design)}&view=1`;link=url.href;}}catch{link=null;}
  const designActions=link?el('div',{class:'form-footer'},el('a',{class:'button secondary',href:link,target:'_blank',rel:'noopener'},'Open saved design')):el('p',{class:'hint'},'The saved design link is unavailable.');
  const priceTable=el('table',{},el('tbody',{},el('tr',{},el('td',{},'Building'),el('td',{class:'money'},currency(price.base))),...(Array.isArray(price.lines)?price.lines:[]).map(line=>el('tr',{},el('td',{},String(line[0]||'Option')),el('td',{class:'money'},currency(line[1])))),el('tr',{},el('td',{class:'grand-total'},'Total'),el('td',{class:'money grand-total'},currency(price.total)))));
  content.replaceChildren(heading(contact.name||'Customer request',`${order.lotName||'Dealer lot'} · ${order.id}`,button('Back to inbox',()=>renderOrders(orders))),el('div',{class:'detail-grid'},el('div',{},panel('Customer details',contacts),panel('Saved building',building,designActions)),el('div',{},panel('Recorded price',priceTable,el('p',{class:'hint'},'Calculated by the server when the request was received. Later catalogue changes do not change this recorded total.')),panel('Follow-up',form))));
}

window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
onAuthChange((event)=>{
  if(authBusy)return;
  if(event==='logout'){message('');renderAuth();}
  else if(event==='recovery')renderAuth('recovery');
  else if(event==='login'&&!['invite','recovery'].includes(state.authMode))loadWorkspace();
});
async function start(){
  authBusy=true;
  try{
    const callback=await handleAuthCallback();
    try{state.settings=await getSettings();state.authSetupMessage='';}catch(error){state.settings=null;state.authSetupMessage=error.status===404||error.name==='MissingIdentityError'?'Account sign-in has not been set up for this site. Ask the site administrator to enable the account service before signing in.':'The account service is unavailable. Please try again later or contact your site administrator.';}
    if(callback?.type==='invite'){state.inviteToken=callback.token;renderAuth('invite');return;}
    if(callback?.type==='recovery'){renderAuth('recovery');return;}
    const user=await getUser();if(user)await loadWorkspace();else renderAuth();
    if(callback?.type==='confirmation')message('Email confirmed. Your company administrator controls your workspace access.');
  }catch(error){if(error.status===404||error.name==='MissingIdentityError')state.authSetupMessage='Account sign-in has not been set up for this site. Ask the site administrator to enable the account service before signing in.';renderAuth();message(error.message||'Sign-in is not available. Please try again.',true);}
  finally{authBusy=false;content.setAttribute('aria-busy','false');}
}
start();
