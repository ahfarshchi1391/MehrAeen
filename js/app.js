

const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat('fa-IR').format(Number(n)||0)+" تومان";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let remoteProducts=[];
let settingsCache=null;

function getCart(){return JSON.parse(localStorage.getItem("mehrayin_cart")||"[]")}
function saveCart(c){localStorage.setItem("mehrayin_cart",JSON.stringify(c));updateCartCount()}
function getLocalSettings(){return JSON.parse(localStorage.getItem("mehrayin_settings")||"null")||{card:"",owner:"",aboutImage:""}}
function toast(t){const e=document.createElement("div");e.className="toast";e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2600)}
function updateCartCount(){const n=getCart().reduce((s,i)=>s+i.qty,0);document.querySelectorAll("#cartCount").forEach(e=>e.textContent=n)}
function setupTheme(){const saved=localStorage.getItem("mehrayin_theme");if(saved==="dark")document.body.classList.add("dark");const b=$("#themeToggle");if(b)b.onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("mehrayin_theme",document.body.classList.contains("dark")?"dark":"light")}}

async function dbProducts(){
  const {data,error}=await supabaseClient.from('products').select('*').eq('is_active',true).order('created_at',{ascending:false});
  if(error){console.error(error);return remoteProducts}
  remoteProducts=(data||[]).map(p=>({
    id:p.id,name:p.name,price:Number(p.price),oldPrice:Number(p.old_price||0),discount:Number(p.discount||0),category:p.category||'عمومی',description:p.description||'',emoji:p.emoji||'♡',image:(p.image_urls&&p.image_urls[0])||'',image_urls:p.image_urls||[],stock:Number(p.stock||0),created:new Date(p.created_at).getTime()
  }));
  return remoteProducts;
}
async function getProducts(){return dbProducts()}

async function getSettings(){
  if(settingsCache)return settingsCache;
  const {data,error}=await supabaseClient.from('store_settings').select('*').eq('id',1).maybeSingle();
  if(error){console.error(error);return getLocalSettings()}
  settingsCache={
    card:data?.card_number||'', owner:data?.card_owner||'',
    aboutImage:data?.about_image_url||'', aboutText:data?.about_text||'',
    storeName:data?.store_name||'مهرآیین', phone:data?.store_phone||'', address:data?.store_address||''
  };
  return settingsCache;
}

async function uploadPublicImage(file,folder){
  if(!file||!file.size)return '';
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${folder}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabaseClient.storage.from('site-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'image/jpeg'});
  if(error)throw error;
  const {data}=supabaseClient.storage.from('site-images').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadReceipt(file){
  if(!file||!file.size)return '';
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`orders/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabaseClient.storage.from('receipts').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'image/jpeg'});
  if(error)throw error;
  return path;
}

async function addToCart(id,qty=1){let c=getCart(),item=c.find(x=>x.id===id);if(item)item.qty+=qty;else c.push({id,qty});saveCart(c);toast("محصول به سبد خرید اضافه شد ♡")}

async function renderHome(){
 const grid=$("#productGrid");if(!grid)return;
 const products=await getProducts();
 let list=[...products],query=($("#searchInput")?.value||"").trim(),cat=window.activeCat||"همه";
 if(query)list=list.filter(p=>p.name.includes(query)||p.category.includes(query));
 if(cat!=="همه")list=list.filter(p=>p.category===cat);
 const sort=$("#sortSelect")?.value;if(sort==="cheap")list.sort((a,b)=>a.price-b.price);if(sort==="expensive")list.sort((a,b)=>b.price-a.price);if(sort==="newest")list.sort((a,b)=>(b.created||0)-(a.created||0));
 grid.innerHTML=list.map(p=>`<article class="product-card"><span class="badge">${p.discount||0}%</span><a href="product.html?id=${p.id}"><div class="product-image">${p.image?`<img src="${p.image}" alt="${escapeHtml(p.name)}">`:`<span>${p.emoji||"♡"}</span>`}</div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><div><span class="price">${money(p.price)}</span>${p.oldPrice?`<span class="old-price">${money(p.oldPrice)}</span>`:""}</div></a><div class="product-actions"><button onclick="addToCart(${p.id})">افزودن به سبد</button><a href="product.html?id=${p.id}">جزئیات</a></div></div></article>`).join("");
 $("#emptyState")?.classList.toggle("hidden",list.length>0);
 const cats=["همه",...new Set(products.map(p=>p.category).filter(Boolean))];const cr=$("#categories");if(cr)cr.innerHTML=cats.map(c=>`<button class="${c===cat?"active":""}" onclick="window.activeCat=${JSON.stringify(c)};renderHome()">${escapeHtml(c)}</button>`).join("");
}

async function renderProduct(){
 const box=$("#productDetail");if(!box)return;
 const id=Number(new URLSearchParams(location.search).get("id")),p=(await getProducts()).find(x=>Number(x.id)===id);
 if(!p){box.innerHTML='<div class="panel">محصول پیدا نشد.</div>';return}
 const imgs=p.image_urls?.length?p.image_urls:(p.image?[p.image]:[]);
 const img=imgs[0]?`<img id="mainImg" src="${imgs[0]}" alt="${escapeHtml(p.name)}">`:`<div id="mainImg" class="placeholder">${p.emoji||"♡"}</div>`;
 box.innerHTML=`<div class="product-detail"><div><div class="gallery-main" id="gallery">${img}${imgs.length>1?`<button class="gallery-arrow gallery-next" id="nextImg">›</button><button class="gallery-arrow gallery-prev" id="prevImg">‹</button>`:''}</div><div class="thumbs">${imgs.map((u,i)=>`<button class="thumb ${i===0?'active':''}" data-img="${escapeAttr(u)}"><img src="${escapeAttr(u)}" alt=""></button>`).join("")}</div></div><div class="detail"><span class="eyebrow">${escapeHtml(p.category||"محصول مهرآیین")}</span><h1>${escapeHtml(p.name)}</h1><p class="detail-desc">${escapeHtml(p.description||"محصول دست‌ساز مهرآیین.")}</p><div><span class="price">${money(p.price)}</span>${p.oldPrice?` <span class="old-price">${money(p.oldPrice)}</span>`:""}</div><p class="stock-line ${p.stock>0?'in-stock':'out-stock'}">${p.stock>0?`موجودی: ${p.stock} عدد`:'ناموجود'}</p><div class="quantity"><button id="minus">−</button><b id="qty">1</b><button id="plus">+</button></div><button class="primary-btn" id="addDetail" ${p.stock<=0?'disabled':''}>${p.stock>0?'افزودن به سبد خرید':'فعلاً ناموجود'}</button></div></div>`;
 let q=1,currentIndex=0;const setImage=i=>{if(!imgs.length)return;currentIndex=(i+imgs.length)%imgs.length;$("#mainImg").src=imgs[currentIndex];box.querySelectorAll('.thumb').forEach((x,j)=>x.classList.toggle('active',j===currentIndex));};$("#minus").onclick=()=>{q=Math.max(1,q-1);$("#qty").textContent=q};$("#plus").onclick=()=>{q=Math.min(Math.max(1,p.stock||999),q+1);$("#qty").textContent=q};$("#addDetail").onclick=()=>addToCart(p.id,q);
 box.querySelectorAll('.thumb').forEach((b,i)=>b.onclick=()=>setImage(i));$("#nextImg")?.addEventListener('click',e=>{e.stopPropagation();setImage(currentIndex+1)});$("#prevImg")?.addEventListener('click',e=>{e.stopPropagation();setImage(currentIndex-1)});
 $("#gallery").onclick=e=>{if(e.target.closest('.gallery-arrow'))return;if(imgs.length){const current=$("#mainImg").src;const l=document.createElement("div");l.className="lightbox";l.innerHTML=`<button>×</button><img src="${current}" alt="">`;l.onclick=e=>{if(e.target===l||e.target.tagName==="BUTTON")l.remove()};document.body.appendChild(l)}};
}

async function renderCart(){
 const box=$("#cartView");if(!box)return;const products=await getProducts(),cart=getCart();
 if(!cart.length){box.innerHTML='<div class="panel empty">سبد خرید شما خالی است.<br><br><a class="primary-btn" href="index.html">مشاهده محصولات</a></div>';return}
 let total=0;box.innerHTML=`<div class="panel">${cart.map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));if(!p)return"";total+=p.price*i.qty;return `<div class="cart-row"><div class="mini-image">${p.image?`<img src="${p.image}" alt="">`:`${p.emoji||"♡"}`}</div><div><b>${escapeHtml(p.name)}</b><div class="muted">${money(p.price)}</div></div><div class="quantity"><button onclick="changeQty(${p.id},-1)">−</button><b>${i.qty}</b><button onclick="changeQty(${p.id},1)">+</button></div><div><b>${money(p.price*i.qty)}</b><br><button class="small-btn" onclick="removeCart(${p.id})">حذف</button></div></div>`}).join("")}<div class="cart-total"><span>مبلغ نهایی</span><span>${money(total)}</span></div><a class="primary-btn full" href="checkout.html">ادامه ثبت سفارش</a></div>`;
}
function changeQty(id,d){let c=getCart(),i=c.find(x=>Number(x.id)===Number(id));if(!i)return;i.qty+=d;if(i.qty<=0)c=c.filter(x=>Number(x.id)!==Number(id));saveCart(c);renderCart()}
function removeCart(id){saveCart(getCart().filter(x=>Number(x.id)!==Number(id)));renderCart();toast("محصول حذف شد")}
async function cartTotal(){const ps=await getProducts();return getCart().reduce((s,i)=>{const p=ps.find(x=>Number(x.id)===Number(i.id));return s+(p?p.price*i.qty:0)},0)}

async function renderCheckout(){
 const sum=$("#checkoutSummary");if(!sum)return;const total=await cartTotal();if(!getCart().length){location.href="cart.html";return}
 const products=await getProducts();sum.innerHTML=`<h2>خلاصه سفارش</h2>${getCart().map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));return `<p>${escapeHtml(p?.name||"")} × ${i.qty}<br><b>${money((p?.price||0)*i.qty)}</b></p>`}).join("")}<hr><h2>مبلغ نهایی: ${money(total)}</h2>`;
 const s=await getSettings();$("#checkoutCard").textContent=s.card||"شماره کارت هنوز توسط مدیر تنظیم نشده است.";$("#copyCheckoutCard").onclick=()=>copyText(s.card);$("#checkoutForm").onsubmit=submitOrder;
}
function copyText(t){if(!t)return toast("شماره کارت هنوز تنظیم نشده است");navigator.clipboard?.writeText(t);toast("کپی شد")}

let orderSubmitting=false;
async function submitOrder(e){
 e.preventDefault();
 if(orderSubmitting)return;
 const formEl=e.target;
 const submitBtn=formEl.querySelector('button[type="submit"]');
 const originalText=submitBtn?.textContent||'ثبت نهایی سفارش';
 orderSubmitting=true;
 if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='در حال ثبت سفارش...';}
 try{
   const s=await getSettings();
   if(!s.card)throw new Error('مدیر هنوز شماره کارت را تنظیم نکرده است');
   const file=$("#receipt").files[0];
   if(!file)throw new Error('لطفاً تصویر فیش را انتخاب کنید');
   const form=Object.fromEntries(new FormData(formEl));
   const products=await getProducts();
   const cart=getCart();
   if(!cart.length)throw new Error('سبد خرید خالی است');
   const items=cart.map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));return {product_id:p?.id||null,product_name:p?.name||"محصول",price:p?.price||0,quantity:i.qty}}).filter(x=>x.product_id);
   if(!items.length)throw new Error('محصولات سبد خرید دیگر در فروشگاه موجود نیستند');
   const receiptPath=await uploadReceipt(file);
   const total=items.reduce((a,x)=>a+x.price*x.quantity,0);
   const {data:order,error:orderErr}=await supabaseClient.from('orders').insert({customer_name:`${form.firstName} ${form.lastName}`,customer_phone:form.phone,customer_address:`${form.province}، ${form.city}، ${form.address}${form.postalCode?`، کدپستی: ${form.postalCode}`:''}`,total_price:total,payment_status:'در انتظار بررسی',order_status:'جدید',receipt_url:receiptPath}).select('id').single();
   if(orderErr)throw orderErr;
   const rows=items.map(x=>({...x,order_id:order.id}));
   const {error:itemErr}=await supabaseClient.from('order_items').insert(rows);
   if(itemErr)throw itemErr;
   localStorage.removeItem("mehrayin_cart");
   updateCartCount();
   alert("سفارش با موفقیت ثبت شد.\nشماره سفارش: MA-"+String(order.id).padStart(6,'0'));
   location.href="index.html";
 }catch(err){
   console.error(err);
   toast(err.message||"ثبت سفارش انجام نشد. دوباره تلاش کنید");
   orderSubmitting=false;
   if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=originalText;}
 }
}
async function setupAbout(){const n=$("#donationCard");if(n){const s=await getSettings();n.textContent=s.card||"شماره کارت هنوز توسط مدیر تنظیم نشده است";$("#copyDonation").onclick=()=>copyText(s.card);const phone=$("#storePhone");if(phone){phone.textContent=s.phone||"شماره تماس هنوز توسط مدیر تنظیم نشده است";}const addr=$("#storeAddress");if(addr){addr.textContent=s.address||"آدرس هنوز توسط مدیر تنظیم نشده است";}const name=$("#storeName");if(name){name.textContent=s.storeName||"مهرآیین";}}}

async function initAdmin(){
 const app=$("#adminApp");if(!app)return;
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(session)return renderAdmin(session);
 app.innerHTML=`<section class="panel admin-login"><span class="eyebrow">ورود به بخش مدیریت</span><h1>مخصوص مدیر سایت</h1><p class="muted">این بخش فقط برای مدیر سایت است.</p><form id="loginForm"><label>ایمیل مدیر<input name="email" type="email" autocomplete="username" required></label><label>رمز عبور<input name="pass" type="password" autocomplete="current-password" required></label><button class="primary-btn full">ورود به پنل مدیریت</button></form><p class="muted admin-security-note">اطلاعات ورود در این صفحه نمایش داده نمی‌شود.</p></section>`;
 $("#loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await supabaseClient.auth.signInWithPassword({email:f.get('email').trim(),password:f.get('pass')});if(error){toast("ایمیل یا رمز عبور اشتباه است");return}renderAdmin(data.session)};
}

async function renderAdmin(session){
 const app=$("#adminApp");const email=session?.user?.email||"مدیر";app.innerHTML=`<div class="admin-layout"><aside class="admin-nav"><h3>مدیریت مهرآیین</h3><small class="admin-email">${escapeHtml(email)}</small><button class="active" data-tab="dashboard">داشبورد</button><button data-tab="products">محصولات</button><button data-tab="orders">سفارش‌ها</button><button data-tab="settings">تنظیمات فروشگاه</button><button id="logoutBtn">خروج</button></aside><section class="admin-content" id="adminContent"></section></div>`;
 app.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{app.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");adminTab(b.dataset.tab)});
 $("#logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();location.reload()};adminTab("dashboard");
}

async function adminTab(tab){
 const c=$("#adminContent");if(!c)return;
 if(tab==="dashboard"){
   const [{data:products},{data:orders}]=await Promise.all([supabaseClient.from('products').select('id'),supabaseClient.from('orders').select('id,total_price')]);
   c.innerHTML=`<h1>داشبورد</h1><div class="stat-grid"><div class="stat">محصولات<strong>${products?.length||0}</strong></div><div class="stat">سفارش‌ها<strong>${orders?.length||0}</strong></div><div class="stat">مبلغ سفارش‌ها<strong>${money((orders||[]).reduce((a,o)=>a+Number(o.total_price||0),0))}</strong></div></div><div class="panel" style="margin-top:18px"><h2>مدیریت آنلاین</h2><p class="muted">اطلاعات این پنل از دیتابیس واقعی Supabase خوانده می‌شود.</p></div>`;
 }
 if(tab==="products"){
   const {data:products,error}=await supabaseClient.from('products').select('*').order('created_at',{ascending:false});if(error)return showAdminError(error);
   const activeCount=(products||[]).filter(p=>p.is_active).length;
   c.innerHTML=`<div class="admin-heading-row"><div><h1>مدیریت محصولات</h1><p class="muted">${products?.length||0} محصول ثبت شده · ${activeCount} محصول فعال</p></div></div>
   <div class="panel"><h2>افزودن محصول جدید</h2><form id="productForm" class="admin-form">
   <label>نام محصول<input name="name" required></label>
   <label>قیمت فعلی (تومان)<input name="price" type="number" min="0" required></label>
   <label>قیمت قبلی (تومان)<input name="oldPrice" type="number" min="0"></label>
   <label>درصد تخفیف<input name="discount" type="number" min="0" max="100"></label>
   <label>دسته‌بندی<input name="category" required placeholder="مثلاً صنایع دستی"></label>
   <label>موجودی<input name="stock" type="number" min="0" value="0"></label>
   <label>ایموجی جایگزین تصویر<input name="emoji" placeholder="مثلاً 🏺"></label>
   <label class="wide">توضیحات<textarea name="description" rows="4"></textarea></label>
   <label class="wide">تصاویر محصول <input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp"><small class="muted">می‌توانی چند عکس را همزمان انتخاب کنی.</small></label>
   <label class="wide checkbox-row"><input name="isActive" type="checkbox" checked> محصول در فروشگاه نمایش داده شود</label>
   <button class="primary-btn wide">افزودن محصول</button></form></div>
   <div class="admin-product-list">${(products||[]).map(p=>{const imgs=p.image_urls||[];return `<div class="admin-product admin-product-rich"><div class="admin-product-thumb">${imgs[0]?`<img src="${escapeAttr(imgs[0])}" alt="">`:`<span>${escapeHtml(p.emoji||'♡')}</span>`}</div><div class="grow"><b>${escapeHtml(p.name)}</b><div class="muted">${money(p.price)} · موجودی: ${Number(p.stock||0)} · ${p.is_active?'فعال':'غیرفعال'}</div><small class="muted">${imgs.length} تصویر · ${escapeHtml(p.category||'عمومی')}</small></div><button class="small-btn" onclick="editProduct(${p.id})">ویرایش</button><button class="danger" onclick="deleteProduct(${p.id})">حذف</button></div>`}).join('')}</div>`;
   $("#productForm").onsubmit=addProduct;
 }
 if(tab==="orders"){
   const {data:orders,error}=await supabaseClient.from('orders').select('*').order('created_at',{ascending:false});if(error)return showAdminError(error);
   c.innerHTML=`<h1>سفارش‌ها</h1><div class="panel">${orders?.length?`<table class="admin-table"><thead><tr><th>شماره</th><th>مشتری</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${orders.map(o=>`<tr><td>MA-${String(o.id).padStart(6,'0')}</td><td>${escapeHtml(o.customer_name)}</td><td>${new Date(o.created_at).toLocaleString('fa-IR')}</td><td>${money(o.total_price)}</td><td><select onchange="setOrderStatus(${o.id},this.value)">${['جدید','در حال بررسی','پرداخت تأیید شد','در حال آماده‌سازی','ارسال شد','تکمیل شد','لغو شد'].map(x=>`<option ${x===o.order_status?'selected':''}>${x}</option>`).join('')}</select></td><td><div class="order-actions"><button class="small-btn" onclick="viewOrder(${o.id})">مشاهده</button><button class="danger" onclick="deleteOrder(${o.id})">حذف</button></div></td></tr>`).join('')}</tbody></table>`:'هنوز سفارشی ثبت نشده است.'}</div>`;
 }
 if(tab==="settings"){
   const s=await getSettings();c.innerHTML=`<h1>تنظیمات فروشگاه</h1>
<div class="panel"><form id="settingsForm" class="admin-form">
<label>نام فروشگاه<input name="storeName" value="${escapeAttr(s.storeName||'مهرآیین')}" required></label>
<label>شماره تماس<input name="phone" value="${escapeAttr(s.phone||'')}" placeholder="مثلاً 0912..."></label>
<label>آدرس فروشگاه<input name="address" value="${escapeAttr(s.address||'')}" placeholder="آدرس یا توضیح محل"></label>
<label>شماره کارت مقصد<input name="card" value="${escapeAttr(s.card)}" placeholder="6037..."></label>
<label>نام صاحب حساب<input name="owner" value="${escapeAttr(s.owner)}"></label>
<label class="wide">متن درباره ما<textarea name="aboutText" rows="6">${escapeHtml(s.aboutText||'ما یک گروه از هیئت متوسلین به چهارده معصوم(ع) هستیم که با فروش این محصولات دست‌ساز همراه با کودک و نوجوان پول آن را خرج کمک به آسیب‌دیدگان جنگ می‌کنیم.')}</textarea></label>
<label>تصویر بخش درباره ما (اختیاری)<input name="aboutImage" type="file" accept="image/jpeg,image/png,image/webp"></label>
${s.aboutImage?`<img class="admin-about-preview" src="${s.aboutImage}" alt="تصویر درباره ما">`:''}
<button class="primary-btn">ذخیره همه تنظیمات</button></form></div>`;$("#settingsForm").onsubmit=saveSettings;
 }
}

async function addProduct(e){
 e.preventDefault();
 const f=new FormData(e.target),files=[...e.target.querySelector('input[name="images"]').files];
 const btn=e.target.querySelector('button[type="submit"]');
 try{
   if(btn){btn.disabled=true;btn.textContent='در حال افزودن...'}
   const imageUrls=[];
   for(const file of files){imageUrls.push(await uploadPublicImage(file,'products'))}
   const payload={name:f.get('name'),price:Number(f.get('price'))||0,old_price:Number(f.get('oldPrice'))||0,discount:Number(f.get('discount'))||0,category:f.get('category')||'عمومی',description:f.get('description')||'',emoji:f.get('emoji')||'♡',image_urls:imageUrls,stock:Number(f.get('stock'))||0,is_active:f.get('isActive')==='on'};
   const {error}=await supabaseClient.from('products').insert(payload);if(error)throw error;
   toast('محصول با موفقیت اضافه شد');adminTab('products');
 }catch(err){console.error(err);toast(err.message||'افزودن محصول انجام نشد');if(btn){btn.disabled=false;btn.textContent='افزودن محصول'}}
}
async function editProduct(id){
 const {data:p,error}=await supabaseClient.from('products').select('*').eq('id',id).single();
 if(error||!p){toast('محصول پیدا نشد');return}
 const imgs=p.image_urls||[];
 const modal=document.createElement('div');modal.className='order-modal';modal.id='productEditModal';
 modal.innerHTML=`<div class="order-modal-box product-edit-box" role="dialog" aria-modal="true"><button class="modal-close" aria-label="بستن">×</button><div class="order-modal-head"><div><span class="eyebrow">ویرایش محصول</span><h2>${escapeHtml(p.name)}</h2></div></div><form id="editProductForm" class="admin-form"><label>نام محصول<input name="name" value="${escapeAttr(p.name)}" required></label><label>قیمت فعلی (تومان)<input name="price" type="number" min="0" value="${Number(p.price)||0}" required></label><label>قیمت قبلی<input name="oldPrice" type="number" min="0" value="${Number(p.old_price)||0}"></label><label>درصد تخفیف<input name="discount" type="number" min="0" max="100" value="${Number(p.discount)||0}"></label><label>دسته‌بندی<input name="category" value="${escapeAttr(p.category||'عمومی')}" required></label><label>موجودی<input name="stock" type="number" min="0" value="${Number(p.stock)||0}"></label><label>ایموجی جایگزین<input name="emoji" value="${escapeAttr(p.emoji||'♡')}"></label><label class="wide">توضیحات<textarea name="description" rows="5">${escapeHtml(p.description||'')}</textarea></label><div class="wide current-images"><b>تصاویر فعلی</b><div class="edit-image-grid">${imgs.length?imgs.map((u,i)=>`<div><img src="${escapeAttr(u)}" alt="تصویر ${i+1}"></div>`).join(''):'<span class="muted">تصویری ثبت نشده است.</span>'}</div></div><label class="wide">افزودن تصاویر جدید<input name="newImages" type="file" multiple accept="image/jpeg,image/png,image/webp"><small class="muted">تصاویر جدید به تصاویر فعلی اضافه می‌شوند.</small></label><label class="wide checkbox-row"><input name="replaceImages" type="checkbox"> تصاویر قبلی حذف و با تصاویر جدید جایگزین شوند</label><label class="wide checkbox-row"><input name="isActive" type="checkbox" ${p.is_active?'checked':''}> محصول در فروشگاه نمایش داده شود</label><div class="order-modal-footer wide"><button type="button" class="small-btn" id="cancelEdit">انصراف</button><button type="submit" class="primary-btn" id="saveProductEdit">ذخیره تغییرات</button></div></form></div>`;
 document.body.appendChild(modal);
 const close=()=>modal.remove();modal.querySelector('.modal-close').onclick=close;modal.querySelector('#cancelEdit').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close()});
 modal.querySelector('#editProductForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),files=[...e.target.querySelector('input[name="newImages"]').files],btn=modal.querySelector('#saveProductEdit');try{btn.disabled=true;btn.textContent='در حال ذخیره...';let imageUrls=[...(p.image_urls||[])];if(files.length){const uploaded=[];for(const file of files)uploaded.push(await uploadPublicImage(file,'products'));imageUrls=f.get('replaceImages')==='on'?uploaded:[...imageUrls,...uploaded];}const payload={name:f.get('name'),price:Number(f.get('price'))||0,old_price:Number(f.get('oldPrice'))||0,discount:Number(f.get('discount'))||0,category:f.get('category')||'عمومی',description:f.get('description')||'',emoji:f.get('emoji')||'♡',image_urls:imageUrls,stock:Number(f.get('stock'))||0,is_active:f.get('isActive')==='on'};const {error}=await supabaseClient.from('products').update(payload).eq('id',id);if(error)throw error;toast('تغییرات محصول ذخیره شد');close();adminTab('products')}catch(err){console.error(err);toast(err.message||'ذخیره تغییرات انجام نشد');btn.disabled=false;btn.textContent='ذخیره تغییرات'}};
}
async function deleteProduct(id){if(confirm('این محصول حذف شود؟\nاین کار قابل بازگشت نیست.')){const {data:p}=await supabaseClient.from('products').select('image_urls').eq('id',id).single();const {error}=await supabaseClient.from('products').delete().eq('id',id);if(error)toast('حذف محصول انجام نشد');else{toast('محصول حذف شد');if(p?.image_urls?.length){const paths=p.image_urls.map(u=>{try{return new URL(u).pathname.split('/site-images/')[1]}catch{return null}}).filter(Boolean);if(paths.length)await supabaseClient.storage.from('site-images').remove(paths)}adminTab('products')}}}
async function setOrderStatus(id,status){const {error}=await supabaseClient.from('orders').update({order_status:status}).eq('id',id);if(error)toast('تغییر وضعیت انجام نشد');else toast('وضعیت سفارش تغییر کرد')}
async function deleteOrder(id){
 if(!confirm('این سفارش به‌طور کامل حذف شود؟\nاین کار قابل بازگشت نیست.'))return;
 const {data:o,error:readError}=await supabaseClient.from('orders').select('receipt_url').eq('id',id).single();
 if(readError){toast('اطلاعات سفارش پیدا نشد');return;}
 const {error}=await supabaseClient.from('orders').delete().eq('id',id);
 if(error){console.error(error);toast('حذف سفارش انجام نشد؛ احتمالاً دسترسی حذف در Supabase فعال نشده است.')}
 else{
   if(o?.receipt_url){await supabaseClient.storage.from('receipts').remove([o.receipt_url]);}
   toast('سفارش حذف شد');
   adminTab('orders');
 }
}
async function viewOrder(id){
 const {data:o,error}=await supabaseClient.from('orders').select('*').eq('id',id).single();if(error||!o)return;
 const {data:items}=await supabaseClient.from('order_items').select('*').eq('order_id',id);
 let receiptHtml='<p class="muted">فیش پرداخت برای این سفارش ثبت نشده است.</p>';
 if(o.receipt_url){
   const {data}=await supabaseClient.storage.from('receipts').createSignedUrl(o.receipt_url,3600);
   if(data?.signedUrl){
     const url=escapeAttr(data.signedUrl);
     receiptHtml=`<a class="receipt-preview-link" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="تصویر فیش پرداخت"><span>برای مشاهده فیش در اندازه بزرگ‌تر روی تصویر بزنید</span></a>`;
   }
 }
 const itemsHtml=(items||[]).map(x=>`<div class="order-item-row"><div><b>${escapeHtml(x.product_name)}</b><span>${x.quantity} عدد × ${money(x.price)}</span></div><b>${money(x.price*x.quantity)}</b></div>`).join('')||'<p class="muted">محصولی ثبت نشده است.</p>';
 const statusOptions=['جدید','در حال بررسی','پرداخت تأیید شد','در حال آماده‌سازی','ارسال شد','تکمیل شد','لغو شد'].map(x=>`<option value="${escapeAttr(x)}" ${x===o.order_status?'selected':''}>${escapeHtml(x)}</option>`).join('');
 const modal=document.createElement('div');modal.className='order-modal';modal.id='orderModal';
 modal.innerHTML=`<div class="order-modal-box" role="dialog" aria-modal="true"><button class="modal-close" aria-label="بستن">×</button><div class="order-modal-head"><div><span class="eyebrow">جزئیات سفارش</span><h2>MA-${String(o.id).padStart(6,'0')}</h2><span class="muted">${new Date(o.created_at).toLocaleString('fa-IR')}</span></div><span class="status-badge">${escapeHtml(o.order_status)}</span></div><div class="order-detail-grid"><section class="order-detail-section"><h3>اطلاعات مشتری</h3><p><span>نام</span><b>${escapeHtml(o.customer_name)}</b></p><p><span>شماره همراه</span><b>${escapeHtml(o.customer_phone)}</b></p><p><span>آدرس</span><b>${escapeHtml(o.customer_address)}</b></p></section><section class="order-detail-section"><h3>وضعیت سفارش</h3><label>وضعیت<select id="modalOrderStatus">${statusOptions}</select></label><p><span>وضعیت پرداخت</span><b>${escapeHtml(o.payment_status||'نامشخص')}</b></p></section></div><section class="order-detail-section"><h3>محصولات سفارش</h3><div class="order-items-list">${itemsHtml}</div><div class="order-grand-total"><b>مبلغ نهایی</b><b>${money(o.total_price)}</b></div></section><section class="order-detail-section"><h3>فیش پرداخت</h3>${receiptHtml}</section><div class="order-modal-footer"><button class="danger" id="modalDeleteOrder">حذف سفارش</button><button class="small-btn" id="modalCloseBtn">بستن</button><button class="primary-btn" id="modalSaveStatus">ذخیره وضعیت</button></div></div>`;
 document.body.appendChild(modal);
 const close=()=>modal.remove();
 modal.querySelector('.modal-close').onclick=close;modal.querySelector('#modalCloseBtn').onclick=close;
 modal.querySelector('#modalDeleteOrder').onclick=async()=>{close();await deleteOrder(id)};
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 modal.querySelector('#modalSaveStatus').onclick=async()=>{const status=modal.querySelector('#modalOrderStatus').value;const btn=modal.querySelector('#modalSaveStatus');btn.disabled=true;const {error}=await supabaseClient.from('orders').update({order_status:status}).eq('id',id);if(error){toast('تغییر وضعیت انجام نشد');btn.disabled=false}else{toast('وضعیت سفارش ذخیره شد');close();adminTab('orders')}};
}
async function saveSettings(e){e.preventDefault();const f=new FormData(e.target),file=f.get('aboutImage');try{const old=await getSettings();const aboutImage=await uploadPublicImage(file,'about')||old.aboutImage||null;const payload={
    store_name:f.get('storeName')||'مهرآیین',
    store_phone:f.get('phone')||'',
    store_address:f.get('address')||'',
    card_number:f.get('card')||'', card_owner:f.get('owner')||'',
    about_text:f.get('aboutText')||'', about_image_url:aboutImage,
    updated_at:new Date().toISOString()
  };const {error}=await supabaseClient.from('store_settings').update(payload).eq('id',1);if(error)throw error;settingsCache=null;await setupAbout();toast('تنظیمات ذخیره شد')}catch(err){console.error(err);toast('ذخیره تنظیمات انجام نشد')}}
function showAdminError(err){console.error(err);$('#adminContent').innerHTML=`<div class="panel"><h2>خطا در ارتباط با دیتابیس</h2><p class="muted">${escapeHtml(err.message||'خطای ناشناخته')}</p></div>`}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function escapeAttr(v){return escapeHtml(v)}

async function init(){setupTheme();updateCartCount();await Promise.allSettled([renderHome(),renderProduct(),renderCart(),renderCheckout(),setupAbout()]);await initAdmin();const si=$("#searchInput");if(si){si.addEventListener('input',renderHome);$("#sortSelect")?.addEventListener('change',renderHome)}}
document.addEventListener('DOMContentLoaded',init);
