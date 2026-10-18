(function(){
function safeSrc(value){
  if(!value)return "";
  if(/^\/uploads\/[a-zA-Z0-9._-]+$/.test(value))return value;
  try{
    var url=new URL(value);
    if(url.protocol==="https:"||url.protocol==="http:")return url.href;
  }catch(e){}
  return "";
}
function pagePrefix(){
  var path=location.pathname.replace(/\/index\.html$/,"").replace(/\/$/,"")||"/";
  if(path==="/")return "";
  var slug=path.slice(1).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9/]+/g,"-").replace(/\//g,":");
  if(slug.length>36)slug=slug.slice(0,36);
  return slug+":";
}
function markCopy(){
  var prefix=pagePrefix();
  var counts={};
  document.querySelectorAll("main .kicker, main h1, main h2, main h3, main .prose p, main .lead").forEach(function(node){
    if(node.closest(".people, form, nav"))return;
    if(node.querySelector("*"))return;
    var bucket=prefix+node.tagName.toLowerCase();
    counts[bucket]=(counts[bucket]||0)+1;
    if(!node.getAttribute("data-original"))node.setAttribute("data-original",node.textContent.trim());
    node.setAttribute("data-copy",bucket+":"+counts[bucket]);
  });
}
function applyCopy(copy){
  markCopy();
  if(!copy)return;
  document.querySelectorAll("[data-copy]").forEach(function(node){
    var value=copy[node.getAttribute("data-copy")];
    if(typeof value==="string"&&value)node.textContent=value;
  });
}
function metaDate(iso){
  var date=new Date(iso);
  if(isNaN(date.getTime()))return "";
  return date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
}
function renderBlog(news){
  if((location.pathname.replace(/\/$/,"")||"/")!=="/blog")return;
  var box=document.querySelector("main .cards");
  if(!box||!news||!news.length)return;
  box.replaceChildren();
  news.forEach(function(item){
    var card=document.createElement("article");
    card.className="card";
    card.setAttribute("data-item",item.id);
    card.setAttribute("data-kind","news");
    var src=safeSrc(item.image);
    if(src){
      var img=document.createElement("img");
      img.alt="";
      img.loading="lazy";
      img.src=src;
      card.appendChild(img);
    }
    var body=document.createElement("div");
    var when=metaDate(item.createdAt);
    if(when){
      var meta=document.createElement("p");
      meta.className="meta";
      meta.textContent=when;
      body.appendChild(meta);
    }
    var title=document.createElement("h2");
    title.textContent=item.title||"";
    body.appendChild(title);
    if(item.excerpt){
      var excerpt=document.createElement("p");
      excerpt.textContent=item.excerpt;
      body.appendChild(excerpt);
    }
    var href=item.url||(item.slug?"/post/"+item.slug:"");
    if(href&&(href.charAt(0)==="/"||/^https?:\/\//.test(href))){
      var link=document.createElement("a");
      link.href=href;
      link.textContent="Loe edasi →";
      body.appendChild(link);
    }
    card.appendChild(body);
    box.appendChild(card);
  });
}
function renderPeople(list){
  var box=document.querySelector("main .people");
  if(!box||!list||!list.length)return;
  box.replaceChildren();
  list.forEach(function(person){
    var card=document.createElement("article");
    card.className="person";
    card.setAttribute("data-item",person.id);
    card.setAttribute("data-kind","people");
    var src=safeSrc(person.image);
    if(src){
      var img=document.createElement("img");
      img.alt=person.name||"";
      img.src=src;
      card.appendChild(img);
    }
    var name=document.createElement("b");
    name.textContent=person.name||"";
    card.appendChild(name);
    if(person.role){
      var role=document.createElement("span");
      role.className="role";
      role.textContent=person.role;
      card.appendChild(role);
    }
    var links=document.createElement("div");
    if(person.phone&&/^[0-9+().\s-]{5,40}$/.test(person.phone)){
      var tel=document.createElement("a");
      tel.href="tel:"+person.phone.replace(/[^\d+]/g,"");
      tel.textContent=person.phone;
      links.appendChild(tel);
    }
    if(person.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)){
      var mail=document.createElement("a");
      mail.href="mailto:"+person.email;
      mail.textContent=person.email;
      links.appendChild(mail);
    }
    card.appendChild(links);
    box.appendChild(card);
  });
}
var haldusWanted=/(?:^|[?&])haldus=1(?:&|$)/.test(location.search);
var contentReq=fetch("/api/content").then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
var meReq=!haldusWanted?Promise.resolve(null):fetch("/api/auth/me",{credentials:"same-origin"}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
Promise.all([contentReq,meReq]).then(function(pair){
  var data=pair[0]||{};
  var me=pair[1];
  if(haldusWanted&&!me){location.replace("/admin");return;}
  renderPeople(data.people);
  renderBlog(data.news);
  applyCopy(data.copy);
  if(!me)return;
  var editor=document.createElement("script");
  editor.src="/haldus.js";
  editor.onload=function(){if(window.mountHaldus)window.mountHaldus(data,me);};
  document.body.appendChild(editor);
});
})();
