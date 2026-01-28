"use strict";

const $ = id => document.getElementById(id);

let state = { filter:"all", sub:"all" };
let renderTimer = null;

const TYPE_LABEL = {
  dev: "Devoir",
  te: "Test",
  autre: "Autre",
  annonce: "Annonce",
  annule: "Annulé"
};

const today = new Date();
today.setHours(0,0,0,0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate()+1);

function parseDate(str){
  const s = str.replace(/\.+$/,"");
  const [d,m,y] = s.split(".");
  return new Date(`20${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
}

function parseTime(str){
  const [h,m] = str.split(":");
  return parseInt(h)*60 + parseInt(m);
}

function load(){
  fetch("dev.json",{cache:"no-store"})
    .then(r=>r.json())
    .then(d=>{
      const items = d.items.map(i=>{
        const dateObj = parseDate(i.date);
        const subject = i.sub || "";
        const title = i.title || i.sub || "";
        const info = i.info || i.title || "";
        const typeKey = normalizeType(i.type);
        return {
          ...i,
          sub: subject,
          title,
          info,
          typeKey,
          dateObj,
          timeMin: parseTime(i.due),
          isToday: isSameDay(dateObj, today),
          isTomorrow: isSameDay(dateObj, tomorrow)
        };
      });
      populateSubFilter(items);
      render(items);
    });
}

function render(items){
  const list = $("list");
  list.classList.add("is-fading");
  if(renderTimer){
    clearTimeout(renderTimer);
  }

  renderTimer = setTimeout(()=>{
    list.innerHTML = "";

    const viewItems = items
      .filter(i=>i.dateObj >= today)
      .filter(i=>{
        if(state.filter === "all"){
          return true;
        }
        if(state.filter === "autre"){
          return i.typeKey === "autre" || i.typeKey === "annonce";
        }
        return i.typeKey === state.filter;
      })
      .filter(i=>state.sub==="all"||i.sub===state.sub)
      .sort((a,b)=>(a.dateObj-b.dateObj)||a.timeMin-b.timeMin);

    $("summary").textContent = summaryText(viewItems.length, state.filter);

    if(viewItems.length === 0){
      const emptyHtml = emptyStateHtml(state.filter);
      if(emptyHtml){
        list.innerHTML = emptyHtml;
        requestAnimationFrame(()=>list.classList.remove("is-fading"));
        return;
      }
      requestAnimationFrame(()=>list.classList.remove("is-fading"));
      return;
    }

    let lastDate = "";

    viewItems.forEach((i,idx)=>{
      if(i.date !== lastDate){
        list.insertAdjacentHTML("beforeend",`
          <div class="daySep">${i.date}</div>
        `);
        lastDate = i.date;
      }

      const tone = toneFor(i);
      const label = TYPE_LABEL[i.typeKey] || "Élément";
    const allowPulse = i.typeKey !== "annule" && i.typeKey !== "annonce";
    const todayClass = i.isToday && allowPulse ? " entry--today" : "";
    const tomorrowClass = !i.isToday && i.isTomorrow && allowPulse ? " entry--tomorrow" : "";
      const isAnnule = i.typeKey === "annule";
      const isNoClick = i["no-click"] === true || i.noClick === true;
      const disabledClass = (isAnnule || isNoClick) ? " entry--disabled" : "";
      const annuleClass = isAnnule ? " entry--annule" : "";
      const infoLine = i.typeKey === "annule"
        ? ""
        : `<p class="entry__text">${i.info || ""}</p>`;

      list.insertAdjacentHTML("beforeend",`
        <article class="entry entry--${tone}${todayClass}${tomorrowClass}${disabledClass}${annuleClass}" data-index="${idx}">
          <div class="entry__time">
            <div class="entry__due">${i.due}</div>
            ${i.duration ? `<div class="entry__duration">${i.duration}</div>` : ""}
          </div>
          <div>
            <h3 class="entry__title">${i.title}</h3>
            ${infoLine}
            <div class="entry__meta">
              <span class="badge badge--${i.typeKey}">${label}</span>
            </div>
          </div>
        </article>
      `);
    });

    list.querySelectorAll(".entry").forEach(el=>{
      el.addEventListener("click",()=>{
        const idx = parseInt(el.dataset.index,10);
        const item = viewItems[idx];
        const noClick = item.typeKey === "annule" || item["no-click"] === true || item.noClick === true;
        if(noClick){
          return;
        }
        openModal(item);
      });
    });

    requestAnimationFrame(()=>list.classList.remove("is-fading"));
  }, 160);
}

function toneFor(item){
  if(item.color){
    return item.color;
  }
  if(item.typeKey === "te"){
    return "red";
  }
  if(item.typeKey === "annonce"){
    return "yellow";
  }
  if(item.typeKey === "annule"){
    return "neutral";
  }
  if(item.typeKey === "autre"){
    return "neutral";
  }
  return "blue";
}

function normalizeType(type){
  if(!type){
    return "autre";
  }
  const t = String(type).trim().toLowerCase();
  if(t === "te" || t === "test"){
    return "te";
  }
  if(t === "dev" || t === "devoir"){
    return "dev";
  }
  if(t === "autre"){
    return "autre";
  }
  if(t === "annonce"){
    return "annonce";
  }
  if(t === "annulé" || t === "annule" || t === "annulation" || t === "annulee" || t === "annulée"){
    return "annule";
  }
  return "autre";
}

function isSameDay(a,b){
  return a.getFullYear()===b.getFullYear()
    && a.getMonth()===b.getMonth()
    && a.getDate()===b.getDate();
}

function summaryText(count, filter){
  if(filter === "all"){
    return "Tous les résultats";
  }
  if(filter === "autre"){
    return "Autres résultats";
  }
  const forms = {
    dev: ["devoir", "devoirs"],
    te: ["test", "tests"],
    annonce: ["annonce", "annonces"],
    annule: ["annulé", "annulés"]
  };
  const [singular, plural] = forms[filter] || ["résultat", "résultats"];
  const label = count <= 1 ? singular : plural;
  return `${count} ${label}`;
}

function emptyStateHtml(filter){
  const card = (title, text)=>`
    <article class="emptyState" aria-disabled="true">
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `;

  if(filter === "dev"){
    return card("Aucun devoir !", "Félicitations ! Une belle journée vous attend.");
  }
  if(filter === "te"){
    return card("Aucun test !", "Rien à préparer pour l’instant.");
  }
  if(filter === "annule"){
    return card("Tous les cours sont maintenus.", "Aucune annulation prévue.");
  }
  if(filter === "autre"){
    return card("Aucun événement.", "Aucune information complémentaire.");
  }
  return "";
}

function populateSubFilter(items){
  const select = $("subFilter");
  if(!select){
    return;
  }
  const subs = Array.from(new Set(items.map(i=>i.sub).filter(Boolean)))
    .sort((a,b)=>a.localeCompare(b,"fr-CH"));

  const current = state.sub;
  select.innerHTML = `
    <option value="all">Toutes les matières</option>
    ${subs.map(s=>`<option value="${s}">${s}</option>`).join("")}
  `;

  state.sub = subs.includes(current) ? current : "all";
  select.value = state.sub;
}

function openModal(item){
  const modal = $("modal");
  const label = TYPE_LABEL[item.typeKey] || "Élément";
  const subjectPrefix = item.sub ? `${item.sub} · ` : "";

  $("modalSub").textContent = `${subjectPrefix}${label}`;
  $("modalTitle").textContent = item.title;
  $("modalMeta").textContent = `${item.date} · ${item.due}`;
  $("modalText").textContent = item.text;

  const badge = $("modalBadge");
  badge.className = `badge badge--${item.typeKey}`;
  badge.textContent = label;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  if(toTop){
    toTop.classList.remove("is-visible");
  }
}

function closeModal(){
  const modal = $("modal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  if(toTop){
    updateToTopVisibility();
  }
}

document.querySelectorAll(".chip").forEach(b=>{
  b.onclick=()=>{state.filter=b.dataset.filter;document.querySelectorAll(".chip").forEach(x=>x.classList.remove("is-on"));b.classList.add("is-on");load();}
});

const subFilter = $("subFilter");
if(subFilter){
  subFilter.onchange = e=>{
    state.sub = e.target.value;
    load();
  };
}

document.addEventListener("click",e=>{
  const target = e.target;
  if(target instanceof HTMLElement && target.dataset.close === "true"){
    closeModal();
  }
});

document.addEventListener("keydown",e=>{
  if(e.key === "Escape"){
    closeModal();
  }
});

load();

const toTop = $("toTop");
const updateToTopVisibility = ()=>{
  if(document.body.classList.contains("modal-open")){
    toTop.classList.remove("is-visible");
    return;
  }
  if(window.scrollY > 420){
    toTop.classList.add("is-visible");
  }else{
    toTop.classList.remove("is-visible");
  }
};
if(toTop){
  window.addEventListener("scroll", updateToTopVisibility, { passive:true });
  updateToTopVisibility();
  toTop.addEventListener("click",()=>{
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}
