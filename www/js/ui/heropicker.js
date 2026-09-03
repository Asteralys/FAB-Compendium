/**
 * Sélecteur de héros : recherche, filtres rapides (jeune / adulte / talent),
 * filtre par classe, puis un clic sur un héros mène directement au choix de
 * l'illustration — la préférence est mémorisée pour la prochaine fois.
 */

import { qs, qsa } from "../core/dom.js";
import { S, save } from "../core/store.js";
import { openSheet, closeSheet } from "./sheet.js";
import {
  searchHeroes, classList, talentList, talentLabel,
  heroById, initials, heroSubtitle
} from "../data/heroes.js";
import { legendFor, legendThreshold } from "../data/legend.js";
import { icon } from "./icons.js";

const AGES = [["all", "Tous"], ["adult", "Adultes"], ["young", "Jeunes"]];

/** Illustration retenue pour ce héros la dernière fois qu'il a été choisi. */
const heroPref = (id) => S.prefs.artByHero?.[id] || null;
function saveHeroPref(id, url) {
  S.prefs.artByHero = S.prefs.artByHero || {};
  S.prefs.artByHero[id] = url;
  save();
}

/**
 * pickHero({ title, heroId, artUrl }) → Promise<{heroId, artUrl}|null>
 */
export function pickHero({ title = "Choisir un héros", heroId = null, artUrl = null } = {}) {
  return new Promise((resolve) => {
    const state = { query: "", age: "all", talent: null, cls: null, heroId, artUrl };
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

    // Filtres rapides : seulement âge + Pit Fighter (le plus demandé), lisibles
    // sur une ligne. Classes et autres talents vivent dans la liste déroulante
    // ci-dessous — 17 classes en pastilles étaient illisibles.
    const quickChips = [
      ...AGES.map(([v, l]) => `<button class="chip" data-age="${v}" aria-pressed="${state.age === v}">${l}</button>`),
      '<span class="chipsep" aria-hidden="true"></span>',
      `<button class="chip" data-talent="Pit-Fighter" aria-pressed="false">Pit Fighter</button>`
    ].join("");

    const otherTalents = talentList().filter((t) => t !== "Pit-Fighter");
    const filterOptions = [
      `<optgroup label="Classe">${classList().map((c) => `<option value="cls:${c}">${c}</option>`).join("")}</optgroup>`,
      otherTalents.length ? `<optgroup label="Talent">${otherTalents.map((t) => `<option value="tal:${t}">${talentLabel(t)}</option>`).join("")}</optgroup>` : ""
    ].join("");

    const inner = openSheet(
      `<div id="hp-browse">
         <div class="row" style="align-items:center;gap:8px">
           <h3 class="grow">${title}</h3>
           <button class="btn ghost" data-close aria-label="Fermer" style="min-height:36px;min-width:36px;padding:6px">${icon("close", 16)}</button>
         </div>
         <label class="field"><span>Rechercher</span>
           <input id="hp-q" type="search" placeholder="Nom, classe, talent…" autocomplete="off"></label>
         <div class="chiprow" id="hp-quick">${quickChips}</div>
         <label class="field"><span>Classe ou talent</span>
           <select id="hp-cls"><option value="">Toutes les classes et talents</option>${filterOptions}</select>
         </label>
         <div class="heropick" id="hp-grid"></div>
       </div>
       <div id="hp-pick" hidden>
         <div class="row" style="align-items:center;gap:8px">
           <button class="btn ghost" id="hp-back" aria-label="Retour aux héros" style="min-height:36px;min-width:36px;padding:6px">${icon("back", 16)}</button>
           <h3 class="grow" id="hp-pick-title">Illustration</h3>
         </div>
         <div id="hp-pick-body"></div>
         <div class="actions">
           <button class="btn" data-close>Annuler</button>
           <button class="btn primary" id="hp-confirm">Valider ce héros</button>
         </div>
       </div>`,
      { onClose: () => finish(null) }
    );

    const browse = qs("#hp-browse", inner);
    const pickBox = qs("#hp-pick", inner);
    const grid = qs("#hp-grid", inner);
    const clsSelect = qs("#hp-cls", inner);

    function drawGrid() {
      const list = searchHeroes(state.query, {
        age: state.age === "all" ? null : state.age,
        cls: state.cls,
        talent: state.talent
      });
      grid.innerHTML = list.length
        ? list.map(card).join("")
        : `<div class="empty" style="grid-column:1/-1">Aucun héros ne correspond à ces filtres.</div>`;
    }

    function card(h) {
      const art = heroPref(h.id) || h.arts[0]?.url;
      const ll = legendFor(h.name);
      return `<button class="herocard" data-hero="${h.id}" aria-pressed="${h.id === state.heroId}">
        <span class="thumb">
          <span class="mono">${initials(h.name)}</span>
          ${art ? `<img alt="" loading="lazy" src="${art}" onerror="this.remove()">` : ""}
          <span class="hp">${h.life}</span>
          ${h.young ? '<span class="agebadge" title="Jeune héros"></span>' : ""}
          ${ll ? `<span class="ll ${ll.isLegend ? "done" : ""}">${ll.isLegend ? "LL" : ll.points}</span>` : ""}
        </span>
        <span class="cap"><b>${h.name}</b><i>${heroSubtitle(h)}</i></span>
      </button>`;
    }

    /** Un clic sur un héros confirme le choix directement et mène à l'illustration. */
    function openHero(id) {
      const h = heroById(id);
      if (!h) return;
      state.heroId = id;
      const pref = heroPref(id);
      state.artUrl = (pref && h.arts.some((a) => a.url === pref)) ? pref : (h.arts[0]?.url || null);

      // Une seule illustration (ou aucune) : rien à choisir, on valide tout de suite.
      if (h.arts.length < 2) {
        confirmHero();
        return;
      }

      browse.hidden = true;
      pickBox.hidden = false;
      qs("#hp-pick-title", inner).textContent = h.name;
      qs("#hp-pick-body", inner).innerHTML = pickBody(h);
    }

    function pickBody(h) {
      const ll = legendFor(h.name);
      return `
        <div class="pickstage">
          <span class="mono">${initials(h.name)}</span>
          ${state.artUrl ? `<img alt="" src="${state.artUrl}" onerror="this.remove()">` : ""}
          <span class="veil"></span>
          <span class="meta">
            <b>${h.name}</b>
            <span>${heroSubtitle(h)} · ${h.life} PV${ll ? ` · ${ll.isLegend ? "Living Legend" : `LL ${ll.points}`}` : ""}</span>
          </span>
        </div>
        <div class="field"><span>Illustration — ${h.arts.length} tirages</span>
          <div class="artstrip">${h.arts.map((a) => `
            <button data-art="${a.url}" aria-pressed="${a.url === state.artUrl}" title="${a.set}${a.artist ? " · " + a.artist : ""}">
              <span class="artcode">${a.set || "?"}</span>
              <img alt="" loading="lazy" src="${a.url}" onerror="this.remove()">
            </button>`).join("")}</div>
        </div>`;
    }

    function backToGrid() {
      pickBox.hidden = true;
      browse.hidden = false;
    }

    function confirmHero() {
      if (!state.heroId) return;
      if (state.artUrl) saveHeroPref(state.heroId, state.artUrl);
      finish({ heroId: state.heroId, artUrl: state.artUrl });
      closeSheet();
    }

    inner.addEventListener("input", (e) => {
      if (e.target.id === "hp-q") { state.query = e.target.value; drawGrid(); }
    });

    inner.addEventListener("change", (e) => {
      if (e.target.id !== "hp-cls") return;
      const [kind, name] = e.target.value.split(":");
      state.cls = kind === "cls" ? name : null;
      state.talent = kind === "tal" ? name : null;
      // Un seul talent actif à la fois : la pastille Pit Fighter reflète la liste.
      qsa("[data-talent]", inner).forEach((b) => b.setAttribute("aria-pressed", b.dataset.talent === state.talent));
      drawGrid();
    });

    inner.addEventListener("click", (e) => {
      if (e.target.closest("#hp-back")) { backToGrid(); return; }
      if (e.target.closest("#hp-confirm")) { confirmHero(); return; }

      const age = e.target.closest("[data-age]");
      if (age) {
        state.age = age.dataset.age;
        qsa("[data-age]", inner).forEach((b) => b.setAttribute("aria-pressed", b === age));
        drawGrid();
        return;
      }

      const talent = e.target.closest("[data-talent]");
      if (talent) {
        state.talent = state.talent === talent.dataset.talent ? null : talent.dataset.talent;
        state.cls = null;
        qsa("[data-talent]", inner).forEach((b) => b.setAttribute("aria-pressed", b.dataset.talent === state.talent));
        if (clsSelect) clsSelect.value = state.talent ? `tal:${state.talent}` : "";
        drawGrid();
        return;
      }

      const hero = e.target.closest("[data-hero]");
      if (hero) { openHero(hero.dataset.hero); return; }

      const art = e.target.closest("[data-art]");
      if (art) {
        state.artUrl = art.dataset.art;
        qsa("[data-art]", inner).forEach((b) => b.setAttribute("aria-pressed", b === art));
        const stage = qs(".pickstage", inner);
        if (stage) {
          const img = stage.querySelector("img") || document.createElement("img");
          img.alt = "";
          img.src = state.artUrl;
          img.onerror = () => img.remove();
          if (!img.isConnected) stage.insertBefore(img, stage.querySelector(".veil"));
        }
      }
    });

    drawGrid();
  });
}

/** Pastille « points Living Legend » réutilisée hors du sélecteur. */
export function legendPill(heroName) {
  const ll = legendFor(heroName);
  if (!ll) return "";
  if (ll.isLegend) return `<span class="pill gold">Living Legend</span>`;
  const pct = Math.round((ll.points / legendThreshold()) * 100);
  return `<span class="pill gold" title="Course au Living Legend">LL ${ll.points} · ${pct}%</span>`;
}
