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
  function stamp(node, bucket, original){
    counts[bucket]=(counts[bucket]||0)+1;
    if(!node.getAttribute("data-original"))node.setAttribute("data-original",original);
    node.setAttribute("data-copy",bucket+":"+counts[bucket]);
  }
  document.querySelectorAll("main .kicker, main h1, main h2, main h3, main .prose p, main .lead").forEach(function(node){
    if(node.closest(".people, form, nav"))return;
    if(node.querySelector("*"))return;
    stamp(node, prefix+node.tagName.toLowerCase(), node.textContent.trim());
  });
  document.querySelectorAll("main .cta a.btn, main .hero-more a, main a.mile-more, main .proj a").forEach(function(node){
    if(node.closest("form, nav, header"))return;
    if(!node.hasAttribute("data-original-href"))node.setAttribute("data-original-href",node.getAttribute("href")||"");
    stamp(node, prefix+(node.classList.contains("btn")?"a":"link"), node.textContent.trim());
  });
  document.querySelectorAll("main img").forEach(function(node){
    if(node.closest(".card, .gallery, .people, .person, header, footer, form, nav, a"))return;
    if(!node.getAttribute("src"))return;
    stamp(node, prefix+"img", node.getAttribute("src"));
  });
}
function applyHref(node, href){
  if(!href)return;
  var safe="";
  if(href.charAt(0)==="#"&&/^#[A-Za-z0-9-]+$/.test(href))safe=href;
  else if(href.charAt(0)==="/"&&href.charAt(1)!=="/"&&href.indexOf("..")===-1)safe=href;
  else if(/^mailto:[^\s]+$/i.test(href))safe=href;
  else if(/^tel:\+?[0-9]{5,20}$/.test(href))safe=href;
  else safe=safeSrc(href);
  if(!safe)return;
  node.setAttribute("href",safe);
}
function applyBlocks(order){
  if(!order)return;
  var main=document.querySelector("main");
  if(!main)return;
  var blocks=[];
  for(var i=0;i<main.children.length;i++){
    var child=main.children[i];
    if(child.tagName==="SECTION"&&child.id)blocks.push(child);
  }
  var by={};
  blocks.forEach(function(node){by[node.id]=node;});
  var placed={};
  String(order).split(",").forEach(function(id){
    if(!by[id]||placed[id])return;
    main.appendChild(by[id]);
    placed[id]=1;
  });
  blocks.forEach(function(node){if(!placed[node.id])main.appendChild(node);});
}
function applyCopy(copy){
  markCopy();
  if(!copy)return;
  document.querySelectorAll("[data-copy]").forEach(function(node){
    var key=node.getAttribute("data-copy");
    var value=copy[key];
    if(node.tagName==="IMG"){
      if(typeof value==="string"&&value){var src=safeSrc(value);if(src)node.src=src;}
      return;
    }
    if(typeof value==="string"&&value&&!node.querySelector("*"))node.textContent=value;
    if(node.tagName==="A")applyHref(node,copy[key+":href"]);
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
  applyBlocks(data.copy&&data.copy[pagePrefix()+"order"]);
  applyCopy(data.copy);
  if(!me)return;
  var editor=document.createElement("script");
  editor.src="/haldus.js";
  editor.onload=function(){if(window.mountHaldus)window.mountHaldus(data,me);};
  document.body.appendChild(editor);
});
})();
