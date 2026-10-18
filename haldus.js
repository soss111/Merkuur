(function(){
function el(tag, cls, text){
  var node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!=null)node.textContent=text;
  return node;
}
function api(path, opts){
  opts=opts||{};
  return fetch(path,{method:opts.method||"GET",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:opts.body?JSON.stringify(opts.body):undefined}).then(function(res){
    return res.json().catch(function(){return {};}).then(function(data){
      if(!res.ok)throw new Error(data.error||"Viga");
      return data;
    });
  });
}
function upload(file){
  if(!file)return Promise.resolve("");
  if(file.size>4*1024*1024)return Promise.reject(new Error("Pilt on liiga suur (max 4 MB)."));
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onerror=function(){reject(new Error("Pilti ei saanud lugeda."));};
    reader.onload=function(){api("/api/upload",{method:"POST",body:{dataUrl:reader.result}}).then(function(d){resolve(d.url);}).catch(reject);};
    reader.readAsDataURL(file);
  });
}
var kinds={
  services:{add:"Lisa teenus",edit:"Muuda teenust",fresh:"Uus teenus",box:"#teenused .grid",fields:[
    {name:"title",label:"Nimi",required:true,max:160},
    {name:"summary",label:"Kirjeldus",tag:"textarea",max:400},
    {name:"href",label:"Link",max:500,placeholder:"/tootoad või https://"},
    {name:"file",label:"Pilt",type:"file"}
  ]},
  news:{add:"Lisa postitus",edit:"Muuda postitust",fresh:"Uus postitus",box:"#uudised .grid",fields:[
    {name:"title",label:"Pealkiri",required:true,max:180},
    {name:"excerpt",label:"Lühikirjeldus",tag:"textarea",max:400},
    {name:"body",label:"Tekst",tag:"textarea",max:8000},
    {name:"url",label:"Link",max:500,placeholder:"https:// või /post/…"},
    {name:"file",label:"Pilt",type:"file"}
  ]},
  gallery:{add:"Lisa foto",edit:"Muuda fotot",fresh:"Uus foto",box:"#galerii .gallery",fields:[
    {name:"caption",label:"Allkiri",required:true,max:120},
    {name:"file",label:"Pilt",type:"file",required:true}
  ]},
  testimonials:{add:"Lisa tagasiside",edit:"Muuda tagasisidet",fresh:"Uus tagasiside",box:"#tagasiside .quotes",fields:[
    {name:"quote",label:"Tekst",tag:"textarea",required:true,max:800},
    {name:"name",label:"Nimi",required:true,max:120},
    {name:"role",label:"Roll",max:120},
    {name:"org",label:"Kool või organisatsioon",max:160}
  ]},
  roadmap:{add:"Lisa etapp",edit:"Muuda etappi",fresh:"Uus etapp",box:"#teekond .road",fields:[
    {name:"title",label:"Pealkiri",required:true,max:120},
    {name:"detail",label:"Kirjeldus",tag:"textarea",max:400},
    {name:"tag",label:"Märksõna",max:80}
  ]},
  people:{add:"Lisa inimene",edit:"Muuda inimest",fresh:"Uus inimene",box:".people",fields:[
    {name:"name",label:"Nimi",required:true,max:120},
    {name:"role",label:"Roll",max:160},
    {name:"phone",label:"Telefon",max:40,placeholder:"+372 …"},
    {name:"email",label:"E-post",max:160,placeholder:"nimi@merkuur.eu"},
    {name:"file",label:"Foto",type:"file"}
  ]}
};
var pages=[
  ["/", "Avaleht"],
  ["/meeskond", "Meeskond"],
  ["/tootoad", "Töötoad"],
  ["/huviringid", "Huviringid"],
  ["/gümnaasiumi-valikkursus-cnc", "CNC kursus"],
  ["/õpik-arvjuhitavad-seadmed-cnc", "Digiõpik"],
  ["/futureclassroomlab", "Tehnoloogiaklass"],
  ["/mobileworkshops", "Mobiilsed töökojad"],
  ["/bettercareer", "Karjäär"],
  ["/synnipaevad", "Sünnipäevad"],
  ["/teambuilding", "Meeskonnaüritus"],
  ["/blog", "Blogi"],
  ["/meediakajastus", "Meediakajastus"],
  ["/videod", "Videod"],
  ["/toeoetubade-galerii", "Galerii"],
  ["/merkuuri-toeoetubade-kaart", "Tegevuskaart"]
];
var say=function(){};
var dialog, sheet, titleEl, formEl, noteEl;

function refresh(){
  try{sessionStorage.setItem("haldus-scroll",String(window.scrollY));}catch(e){}
  location.reload();
}
function openDialog(heading){
  titleEl.textContent=heading;
  formEl.replaceChildren();
  noteEl.textContent="";
  dialog.hidden=false;
  var first=formEl.querySelector("input,textarea");
  if(first)first.focus();
}
function closeDialog(){dialog.hidden=true;}
function addField(spec, value){
  var label=el("label",null,spec.label);
  var input;
  if(spec.type==="file"){
    input=el("input");
    input.type="file";
    input.accept="image/jpeg,image/png,image/webp,image/gif";
  }else if(spec.tag==="textarea"){
    input=el("textarea");
    input.rows=spec.max>500?8:4;
  }else{
    input=el("input");
    input.type=spec.type||"text";
  }
  input.name=spec.name;
  if(spec.max)input.maxLength=spec.max;
  if(spec.placeholder)input.placeholder=spec.placeholder;
  if(spec.required)input.required=true;
  if(value!=null&&spec.type!=="file")input.value=value;
  label.appendChild(input);
  formEl.appendChild(label);
  return input;
}
function actions(onSave){
  var row=el("div","eform-actions");
  var save=el("button","btn","Salvesta");
  save.type="submit";
  var cancel=el("button","btn ghost","Katkesta");
  cancel.type="button";
  cancel.addEventListener("click",closeDialog);
  row.append(save,cancel);
  formEl.appendChild(row);
  formEl.onsubmit=function(e){
    e.preventDefault();
    noteEl.textContent="";
    Promise.resolve().then(onSave).then(refresh).catch(function(err){noteEl.textContent=err.message;});
  };
}
function itemById(data, kind, id){
  var list=data[kind]||[];
  for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  return null;
}
function openItem(data, kind, item){
  var meta=kinds[kind];
  openDialog(item?meta.edit:meta.fresh);
  meta.fields.forEach(function(spec){
    addField(spec, item?item[spec.name]||"":"");
  });
  if(item){
    var existingFile=formEl.querySelector("input[type=file]");
    if(existingFile)existingFile.required=false;
  }
  if(item&&(kind==="news"||kind==="gallery"||kind==="services"||kind==="people")){
    formEl.appendChild(el("p","ekeep","Praegune pilt jääb alles, kui uut ei vali."));
  }
  actions(function(){
    var body={};
    meta.fields.forEach(function(spec){
      if(spec.type==="file")return;
      var input=formEl.querySelector("[name="+spec.name+"]");
      body[spec.name]=input?input.value:"";
    });
    var file=formEl.querySelector("input[type=file]");
    return upload(file&&file.files[0]).then(function(url){
      if(url)body.image=url;
      else if(kind==="gallery"&&!item)throw new Error("Lisa pilt.");
      var path="/api/content/"+kind+(item?"/"+item.id:"");
      return api(path,{method:item?"PUT":"POST",body:body});
    });
  });
}
function fieldName(key){
  return formEl.querySelector("[name='"+key+"']");
}
function openCopy(nodes){
  openDialog("Muuda teksti");
  var images=[];
  nodes.forEach(function(node){
    var key=node.getAttribute("data-copy");
    if(node.tagName==="IMG"){
      images.push(node);
      var alt=(node.getAttribute("alt")||"Pilt").replace(/\s+/g," ").slice(0,42);
      addField({name:key,label:"Pilt — "+alt,type:"file"});
      var restore=el("label","echeck","Taasta algne pilt");
      var box=el("input");
      box.type="checkbox";
      box.name=key+"-reset";
      restore.appendChild(box);
      formEl.appendChild(restore);
      return;
    }
    var sample=node.textContent.trim().replace(/\s+/g," ").slice(0,42);
    var name=node.classList.contains("btn")?"Nupp":(node.classList.contains("note")?"Märkus":(node.tagName==="LI"?"Rida":(node.closest(".topic")?"Teema":(node.classList.contains("kicker")?"Silt":(node.tagName==="A"?"Link":(/^H[1-3]$/.test(node.tagName)?"Pealkiri":"Tekst"))))));
    if(!(node.tagName==="A"&&node.querySelector("*")))addField({name:key,label:name+" — "+sample,tag:node.textContent.length>140?"textarea":"input",max:4000},node.textContent.trim());
    if(node.tagName==="A")addField({name:key+":href",label:"Aadress — "+sample,max:500},node.getAttribute("href")||"");
  });
  formEl.appendChild(el("p","ekeep","Tühi tekstiväli taastab algse teksti. Uus pilt asendab praeguse. Arvud ja lingiga laused jäävad oma kohale."));
  actions(function(){
    var copy={};
    var uploads=images.map(function(node){
      var key=node.getAttribute("data-copy");
      var reset=fieldName(key+"-reset");
      if(reset&&reset.checked){copy[key]="";return Promise.resolve();}
      var input=fieldName(key);
      var file=input&&input.files&&input.files[0];
      if(!file)return Promise.resolve();
      return upload(file).then(function(url){if(url)copy[key]=url;});
    });
    return Promise.all(uploads).then(function(){
      nodes.forEach(function(node){
        if(node.tagName==="IMG")return;
        var key=node.getAttribute("data-copy");
        var input=fieldName(key);
        if(input){
          var value=input.value.trim();
          copy[key]=value===(node.getAttribute("data-original")||"")?"":value;
        }
        if(node.tagName==="A"){
          var hrefInput=fieldName(key+":href");
          if(hrefInput){
            var href=hrefInput.value.trim();
            copy[key+":href"]=href===(node.getAttribute("data-original-href")||"")?"":href;
          }
        }
      });
      return api("/api/copy",{method:"PUT",body:{copy:copy}});
    });
  });
}
function openStats(data){
  var stats=data.stats||{};
  openDialog("Muuda arve");
  [
    ["since","Algusaasta"],["workshops","Töötubade arv"],["youth","Noorte arv"],
    ["mobiles","Mobiilsete töökodade arv"],["solutions","Õppelahenduste arv"],["asOf","Seis"]
  ].forEach(function(pair){addField({name:pair[0],label:pair[1],required:true,max:40},stats[pair[0]]||"");});
  actions(function(){
    var body={};
    formEl.querySelectorAll("input").forEach(function(input){body[input.name]=input.value;});
    return api("/api/stats",{method:"PUT",body:body});
  });
}
function openAddress(data){
  openDialog("Muuda aadressi");
  addField({name:"address",label:"Aadress",max:240,placeholder:"Tänav, linn"},data.address||"");
  actions(function(){
    return api("/api/address",{method:"PUT",body:{address:formEl.querySelector("[name=address]").value}});
  });
}
function openAdmins(emails){
  openDialog("Haldurid");
  var list=el("div","eadmins");
  emails.forEach(function(email){
    var row=el("div","eadmin");
    row.appendChild(el("b",null,email));
    var remove=el("button","ebtn danger","Eemalda");
    remove.type="button";
    remove.addEventListener("click",function(){
      api("/api/admins",{method:"DELETE",body:{email:email}}).then(refresh).catch(function(err){noteEl.textContent=err.message;});
    });
    row.appendChild(remove);
    list.appendChild(row);
  });
  formEl.appendChild(list);
  addField({name:"email",label:"Uus haldur",type:"email",required:true,max:160,placeholder:"nimi@gmail.com"});
  actions(function(){
    return api("/api/admins",{method:"POST",body:{email:formEl.querySelector("[name=email]").value}});
  });
}
function button(text, cls, fn){
  var btn=el("button",cls||"ebtn",text);
  btn.type="button";
  btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();fn();});
  return btn;
}
function host(group){
  if(group.tagName==="FOOTER")return group.querySelector(".legal")||group;
  return group.querySelector(":scope > .wrap")||group;
}
function toolbar(group){
  var home=host(group);
  var box=home.querySelector(".eadd");
  if(box)return box;
  box=el("div","eadd");
  if(group.classList.contains("hero")){
    group.querySelector(".hero-panel").appendChild(box);
    return box;
  }
  var leads=home.querySelectorAll(":scope > .lead");
  if(leads.length){
    leads[leads.length-1].insertAdjacentElement("afterend",box);
    return box;
  }
  var grid=home.querySelector(":scope > .people, :scope > .grid, :scope > .gallery, :scope > .road, :scope > .quotes, :scope > .prose");
  if(grid){home.insertBefore(box,grid);return box;}
  home.appendChild(box);
  return box;
}
function mountTools(data){
  Object.keys(kinds).forEach(function(kind){
    var meta=kinds[kind];
    var box=document.querySelector(meta.box);
    if(!box)return;
    var items=[].filter.call(box.children,function(child){return child.getAttribute&&child.getAttribute("data-kind")===kind;});
    var group=box.closest("section")||box.closest("main")||box;
    toolbar(group).appendChild(button(meta.add,"btn",function(){openItem(data,kind,null);}));
    items.forEach(function(node,index){
      var item=itemById(data,kind,node.getAttribute("data-item"));
      if(!item)return;
      node.classList.add("eitem");
      var tools=el("menu","etools");
      var up=button("Üles","ebtn",function(){api("/api/content/"+kind+"/"+item.id+"/move",{method:"POST",body:{direction:"up"}}).then(refresh).catch(function(err){say(err.message);});});
      var down=button("Alla","ebtn",function(){api("/api/content/"+kind+"/"+item.id+"/move",{method:"POST",body:{direction:"down"}}).then(refresh).catch(function(err){say(err.message);});});
      if(index===0)up.disabled=true;
      if(index===items.length-1)down.disabled=true;
      tools.append(up,down,button("Muuda","ebtn",function(){openItem(data,kind,item);}),button("Kustuta","ebtn danger",function(){
        if(!confirm("Kustutan selle?"))return;
        api("/api/content/"+kind+"/"+item.id,{method:"DELETE"}).then(refresh).catch(function(err){say(err.message);});
      }));
      node.appendChild(tools);
    });
  });
  var seen=[];
  document.querySelectorAll("[data-copy]").forEach(function(node){
    var group=node.closest("section")||node.closest(".hero")||node.closest("footer")||node.closest("main");
    if(!group||seen.indexOf(group)!==-1)return;
    seen.push(group);
    var nodes=[].filter.call(group.querySelectorAll("[data-copy]"),function(item){
      if(item.closest("section")===group||item.closest("main")===group)return true;
      return !item.closest("section")&&(group.classList.contains("hero")||group.tagName==="FOOTER");
    });
    if(!nodes.length)return;
    toolbar(group).appendChild(button("Muuda teksti","btn ghost",function(){openCopy(nodes);}));
  });
  mountMoves();
  var dock=document.querySelector(".hero-dock .wrap")||document.querySelector(".hero-dock");
  if(dock)dock.appendChild(button("Muuda arve","btn ghost",function(){openStats(data);}));
  var slot=document.getElementById("address-slot");
  if(slot&&slot.parentNode)slot.parentNode.appendChild(button("Muuda aadressi","btn ghost",function(){openAddress(data);}));
}
function pageOrderKey(){
  var path=location.pathname.replace(/\/index\.html$/,"").replace(/\/$/,"")||"/";
  if(path==="/")return "home:order";
  var slug=path.slice(1).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9/]+/g,"-").replace(/\//g,":");
  if(slug.length>36)slug=slug.slice(0,36);
  return slug+":order";
}
function pageBlocks(){
  var main=document.querySelector("main");
  var blocks=[];
  if(!main)return blocks;
  for(var i=0;i<main.children.length;i++){
    var child=main.children[i];
    if(child.classList.contains("hero")||(child.tagName==="SECTION"&&child.id))blocks.push(child);
  }
  return blocks;
}
function shiftBlock(block, delta){
  var blocks=pageBlocks();
  var index=-1;
  for(var i=0;i<blocks.length;i++)if(blocks[i]===block)index=i;
  var next=index+delta;
  if(index<0||next<0||next>=blocks.length)return;
  var order=blocks.map(function(node){return node.id;});
  var swap=order[index];
  order[index]=order[next];
  order[next]=swap;
  var body={};
  body[pageOrderKey()]=order.join(",");
  api("/api/copy",{method:"PUT",body:{copy:body}}).then(refresh).catch(function(err){say(err.message);});
}
function mountMoves(){
  var blocks=pageBlocks();
  if(blocks.length<2)return;
  blocks.forEach(function(block, index){
    var bar=toolbar(block);
    var up=button("Plokk üles","btn ghost",function(){shiftBlock(block,-1);});
    var down=button("Plokk alla","btn ghost",function(){shiftBlock(block,1);});
    if(index===0)up.disabled=true;
    if(index===blocks.length-1)down.disabled=true;
    bar.insertBefore(down, bar.firstChild);
    bar.insertBefore(up, bar.firstChild);
  });
}
function mountHaldus(data, me){
  document.body.classList.add("haldus");
  var style=el("style");
  style.textContent=[
    ".haldus-bar{position:sticky;top:0;z-index:70;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#12343a;color:#fff;padding:8px 16px}",
    ".haldus-bar b{font-family:Outfit,system-ui,sans-serif;font-weight:650}",
    ".haldus-bar .btn,.haldus-bar .ebtn,.haldus-bar select{margin:0}",
    ".haldus-bar select{background:#fff;color:#17211d;border:0;border-radius:999px;min-height:44px;padding:8px 12px;font:650 .92rem Outfit,system-ui,sans-serif}",
    ".haldus-bar .note{color:#d7fff4;font-weight:650}",
    "body.haldus header{top:var(--hbar,64px)}",
    "body.haldus .card:hover{transform:none}",
    ".eadd{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}",
    ".eadd .btn:disabled{opacity:.4;cursor:default}",
    ".eadd .btn{margin:0}",
    ".etools{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:8px 12px 12px}",
    ".ebtn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 12px;border-radius:999px;border:1.5px solid var(--line);background:#fff;color:var(--ink);font:650 .92rem Outfit,system-ui,sans-serif;cursor:pointer}",
    ".ebtn.danger{background:#9d1c12;border-color:#9d1c12;color:#fff}",
    ".ebtn:disabled{opacity:.4;cursor:default}",
    ".edialog{position:fixed;inset:0;z-index:80;background:rgba(18,52,58,.45);display:flex;align-items:flex-end;justify-content:center;padding:12px}",
    ".edialog[hidden]{display:none !important}",
    ".esheet{background:#fff;color:var(--ink);width:min(640px,100%);max-height:min(88vh,900px);overflow:auto;border-radius:20px;padding:18px 16px 20px}",
    ".esheet h2{margin:0 0 12px}",
    ".esheet label{display:grid;gap:6px;margin-top:12px;font:650 .78rem Outfit,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}",
    ".esheet input,.esheet textarea{font:500 1rem 'Source Sans 3',system-ui,sans-serif;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:#f4f7f4;color:var(--ink);width:100%;min-height:48px}",
    ".esheet label.echeck{display:flex;align-items:center;gap:10px;text-transform:none;letter-spacing:0;font:600 1rem 'Source Sans 3',system-ui,sans-serif;color:var(--ink)}",
    ".esheet label.echeck input{width:22px;height:22px;min-height:22px;padding:0;flex:none}",
    ".esheet textarea{min-height:110px;resize:vertical}",
    ".eform-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}",
    ".eform-actions .btn{margin:0}",
    ".ekeep,.esheet .note{color:var(--muted);margin:10px 0 0}",
    ".eadmin{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)}",
    "@media(min-width:720px){.edialog{align-items:center}}"
  ].join("");
  document.head.appendChild(style);
  var bar=el("div","haldus-bar");
  bar.appendChild(el("b",null,"Muudad lehte"));
  var here=(location.pathname.replace(/\/$/,"")||"/");
  var select=el("select");
  select.setAttribute("aria-label","Alamleht");
  var known=false;
  pages.forEach(function(pair){
    var opt=el("option",null,pair[1]);
    opt.value=pair[0]+"?haldus=1";
    if(pair[0]===here){opt.selected=true;known=true;}
    select.appendChild(opt);
  });
  if(!known){
    var current=el("option",null,"See leht");
    current.value=here+"?haldus=1";
    current.selected=true;
    select.appendChild(current);
  }
  select.addEventListener("change",function(){location.href=select.value;});
  bar.appendChild(select);
  if(me&&me.database)bar.appendChild(el("span","note",me.database));
  var status=el("span","note","");
  say=function(text){status.textContent=text||"";};
  var view=el("a","ebtn","Avalik vaade");
  view.href=here==="/"?"/":here;
  bar.append(view,button("Haldurid","ebtn",function(){openAdmins(me.allowedEmails||[]);}),button("Logi välja","ebtn",function(){
    api("/api/auth/logout",{method:"POST",body:{}}).then(function(){location.href="/admin";}).catch(function(err){say(err.message);});
  }),status);
  var skip=document.querySelector(".skip");
  if(skip&&skip.parentNode)skip.insertAdjacentElement("afterend",bar);
  else document.body.insertBefore(bar,document.body.firstChild);
  function syncBar(){document.documentElement.style.setProperty("--hbar",bar.offsetHeight+"px");}
  syncBar();
  addEventListener("resize",syncBar);
  dialog=el("div","edialog");
  dialog.hidden=true;
  dialog.setAttribute("role","dialog");
  dialog.setAttribute("aria-modal","true");
  sheet=el("div","esheet");
  titleEl=el("h2",null,"Muuda");
  formEl=el("form");
  noteEl=el("p","note","");
  sheet.append(titleEl,formEl,noteEl);
  dialog.appendChild(sheet);
  dialog.addEventListener("click",function(e){if(e.target===dialog)closeDialog();});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!dialog.hidden)closeDialog();});
  document.body.appendChild(dialog);
  mountTools(data);
  try{
    var y=sessionStorage.getItem("haldus-scroll");
    if(y){sessionStorage.removeItem("haldus-scroll");scrollTo(0,Number(y)||0);}
  }catch(e){}
  syncBar();
}
window.mountHaldus=mountHaldus;
})();
