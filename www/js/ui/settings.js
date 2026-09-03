/** Réglages, sauvegarde et restauration des données. */

import { qs, toast } from "../core/dom.js";
import { S, commit, replaceAll, backup, restoreBackup, deckById } from "../core/store.js";
import { openSheet, closeSheet, confirmSheet } from "./sheet.js";
import { heroesVersion, allHeroes, resetHeroes, heroById } from "../data/heroes.js";
import { allCards, cardsVersion, resetCards } from "../data/cards.js";
import { legendDate, resetLegend } from "../data/legend.js";

export function applySkin() {
  document.documentElement.dataset.skin = S.prefs.skin === "vellum" ? "vellum" : "ombre";
}

export function openSettings() {
  const inner = openSheet(`<h3>Réglages</h3>

    <label class="field"><span>Apparence</span>
      <select id="se-skin">
        <option value="ombre" ${S.prefs.skin !== "vellum" ? "selected" : ""}>Ombre — sombre</option>
        <option value="vellum" ${S.prefs.skin === "vellum" ? "selected" : ""}>Vélin — clair</option>
      </select>
    </label>

    <label class="switch"><input type="checkbox" id="se-face" ${S.prefs.faceToFace ? "checked" : ""}>
      <span>Panneau adverse retourné (face à face)</span></label>

    <label class="switch"><input type="checkbox" id="se-awake" ${S.prefs.keepAwake ? "checked" : ""}>
      <span>Garder l'écran allumé pendant un duel</span></label>

    <label class="field"><span>Alerte de ronde (minutes)</span>
      <input id="se-round" type="number" min="5" max="120" value="${S.prefs.roundLimit || 40}"></label>

    <hr class="rule">

    <div class="small muted">${S.decks.length} decks · ${S.matches.length} matchs · ${S.tournaments.length} tournois</div>
    <div class="small faint">${allHeroes().length} héros (${heroesVersion()}) · ${allCards().length} cartes (${cardsVersion()}) · classement LL du ${legendDate()}</div>

    <button class="btn" id="se-export">Exporter mes données</button>
    <button class="btn" id="se-export-stats">Exporter mes statistiques (CSV — Metafy, FaBrary…)</button>
    <label class="field"><span>Importer une sauvegarde</span>
      <textarea id="se-import" placeholder="Colle ici le contenu d'un export…"></textarea></label>
    <button class="btn" id="se-do-import">Importer</button>
    ${backup() ? `<button class="btn" id="se-restore">Restaurer la copie de secours
      (${backup().decks.length} decks · ${backup().matches.length} matchs)</button>` : ""}

    <hr class="rule">
    <button class="btn danger" id="se-heroes">Réinitialiser les bases de données</button>
    <button class="btn danger" id="se-wipe">Effacer toutes mes données</button>

    <div class="actions"><button class="btn" data-close>Fermer</button></div>`);

  qs("#se-skin", inner).addEventListener("change", (e) => {
    S.prefs.skin = e.target.value;
    applySkin();
    commit();
  });
  qs("#se-face", inner).addEventListener("change", (e) => { S.prefs.faceToFace = e.target.checked; commit(); });
  qs("#se-awake", inner).addEventListener("change", (e) => { S.prefs.keepAwake = e.target.checked; commit(); });
  qs("#se-round", inner).addEventListener("change", (e) => {
    S.prefs.roundLimit = Math.min(120, Math.max(5, Number(e.target.value) || 40));
    commit();
  });

  qs("#se-export", inner).addEventListener("click", async () => {
    const payload = JSON.stringify({
      app: "fab-compendium",
      exportedAt: new Date().toISOString(),
      decks: S.decks, matches: S.matches, tournaments: S.tournaments, prefs: S.prefs
    });
    try {
      if (navigator.share) { await navigator.share({ title: "Sauvegarde FaB Compendium", text: payload }); return; }
      await navigator.clipboard.writeText(payload);
      toast("Sauvegarde copiée dans le presse-papiers");
    } catch {
      qs("#se-import", inner).value = payload;
      toast("Copie automatique refusée — le texte est dans le champ ci-dessous");
    }
  });

  qs("#se-export-stats", inner).addEventListener("click", async () => {
    if (!S.matches.length) { toast("Aucun match enregistré à exporter."); return; }
    const csv = statsCSV();
    try {
      if (navigator.share) {
        const file = new File([csv], "fab-compendium-stats.csv", { type: "text/csv" });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title: "Statistiques FaB Compendium", files: [file] }); return; }
        await navigator.share({ title: "Statistiques FaB Compendium", text: csv });
        return;
      }
      await navigator.clipboard.writeText(csv);
      toast("Statistiques copiées (CSV) dans le presse-papiers");
    } catch {
      qs("#se-import", inner).value = csv;
      toast("Copie automatique refusée — le CSV est dans le champ ci-dessous");
    }
  });

  qs("#se-do-import", inner).addEventListener("click", () => {
    try {
      const data = JSON.parse(qs("#se-import", inner).value);
      if (!data || typeof data !== "object") throw new Error("format");
      replaceAll({
        decks: data.decks || [],
        matches: data.matches || [],
        tournaments: data.tournaments || [],
        prefs: { ...S.prefs, ...(data.prefs || {}) }
      });
      applySkin();
      closeSheet();
      toast("Sauvegarde importée");
    } catch {
      toast("Ce texte n'est pas une sauvegarde valide");
    }
  });

  qs("#se-restore", inner)?.addEventListener("click", () => {
    if (restoreBackup()) {
      closeSheet();
      toast("Copie de secours restaurée");
    } else toast("Aucune copie de secours disponible");
  });

  qs("#se-heroes", inner).addEventListener("click", async () => {
    closeSheet();
    if (await confirmSheet("Réinitialiser les bases ?", "Héros, cartes et classement Living Legend repartent de l'instantané livré à l'installation. Tes decks et matchs ne bougent pas.", "Réinitialiser")) {
      await Promise.all([resetHeroes(), resetCards(), resetLegend()]);
      toast("Bases de données réinitialisées");
      commit();
    }
  });

  qs("#se-wipe", inner).addEventListener("click", async () => {
    closeSheet();
    if (await confirmSheet("Tout effacer ?", "Decks, matchs et tournois seront définitivement perdus. Pense à exporter avant.", "Tout effacer")) {
      replaceAll({});
      applySkin();
      toast("Données effacées");
    }
  });
}

/**
 * Export CSV de l'historique des matchs — pensé pour être recollé dans un
 * suivi Metafy ou FaBrary : une ligne par match, aucune donnée de la base
 * officielle (héros, points Living Legend), seulement ce que le joueur a saisi.
 */
function statsCSV() {
  const rows = [[
    "Date", "Format", "Événement", "Mon héros", "Mon deck",
    "Héros adverse", "Deck adverse", "Résultat", "PV restants (moi)", "PV restants (adverse)", "Durée (s)"
  ]];

  S.matches.forEach((m) => {
    const deck = deckById(m.deckId);
    const myHero = heroById(m.heroId || deck?.heroId);
    rows.push([
      m.date || "",
      m.format || deck?.format || "",
      m.event || "",
      myHero?.name || "",
      deck?.name || "",
      heroById(m.oppHeroId)?.name || "",
      m.oppDeck || "",
      m.result === "W" ? "Victoire" : "Défaite",
      m.lifeP1 ?? "",
      m.lifeP2 ?? "",
      m.duration ?? ""
    ]);
  });

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
