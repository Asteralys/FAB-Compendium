# FaB Compendium

Compagnon mobile pour **Flesh and Blood** : compteur de vie à deux tapis avec
l'illustration du héros, historique des dégâts, decks, plans de side par
matchup, winrate et calendrier de tournois.

Direction artistique reprise du site officiel : fond braise `#120600`, parchemin
`#F9E6C5`, or `#DAB45F`, sang `#91160D`.

---

## Démarrer en local

```bash
npm start
```

→ <http://localhost:5173>. Aucune dépendance n'est nécessaire pour développer :
le serveur est un script Node de 40 lignes et l'application est en HTML, CSS et
modules ES natifs.

## Structure

```
www/                      l'application (c'est aussi le webDir de Capacitor)
├─ index.html             coquille : en-tête, conteneur de vue, barre d'onglets
├─ manifest.webmanifest   installation sur l'écran d'accueil
├─ sw.js                  cache hors-ligne (réseau d'abord, cache en secours)
├─ data/heroes.json       instantané des 149 héros
├─ data/cards.json        index des 4 760 cartes jouables (deckbuilding)
├─ data/living-legend.json classement Living Legend officiel
├─ data/banned.json       cartes bannies, suspendues, restreintes (tous formats)
├─ icons/                 icônes générées
├─ css/
│  ├─ tokens.css          palette, typographie, peaux « Ombre » et « Vélin »
│  ├─ base.css            reset, coquille, navigation
│  ├─ components.css      boutons, panneaux, pastilles, feuilles, formulaires
│  ├─ duel.css            écran de duel, sélecteur de héros
│  └─ views.css           decks, stats, tournois, actus
└─ js/
   ├─ main.js             amorçage, onglets, rendu
   ├─ core/dom.js         gabarits balisés, échappement, toast, vibration
   ├─ core/store.js       état persisté + abonnement au redessin
   ├─ data/slim.js        base officielle → index héros, cartes, banlist
   ├─ data/heroes.js      chargement, recherche, mise à jour
   ├─ data/cards.js       recherche de cartes, lecture d'une decklist collée
   ├─ data/rules.js       règles de format officielles, zones de la decklist
   ├─ data/banned.js      chargement des cartes bannies/suspendues/restreintes
   ├─ data/ll-parse.js    lecture de la page Living Legend
   ├─ data/legend.js      points LL par héros
   ├─ ui/                 sheet, icons, components, heropicker, settings
   └─ views/              duel, decks, stats, tournaments, news

tools/
├─ dev-server.mjs         serveur statique de développement
├─ build-heroes.mjs       régénère www/data/heroes.json
├─ build-cards.mjs        régénère www/data/cards.json
├─ build-ll.mjs           régénère www/data/living-legend.json
├─ build-banned.mjs       régénère www/data/banned.json
├─ make-icon.mjs          génère icônes et écran de lancement (PNG sans dépendance)
└─ bundle-artifact.mjs    build mono-fichier pour la prévisualisation partageable
```

## Données

| Source | Contenu | Régénération |
| --- | --- | --- |
| [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards) | 149 héros (68 adultes, 81 jeunes) : PV, intellect, classe, talents, légalité, 757 illustrations | `npm run heroes` |
| idem | 4 760 cartes jouables : nom, pitch, coût, force, défense, types, illustration | `npm run cards` |
| [fabtcg.com/living-legend](https://fabtcg.com/living-legend/) | Points Living Legend par héros, liste des héros déjà LL, armes signature | `npm run ll` |
| idem | Cartes bannies, suspendues et restreintes, tous formats (CC, Blitz, Commoner, Living Legend, Silver Age, UPF) | `npm run banned` |

```bash
npm run data       # les quatre d'un coup
```

**Mise à jour depuis l'application.** L'onglet *Actus → Vérifier* compare la liste
des sets publiés (108 Ko) à l'instantané local ; si un set est sorti, elle
télécharge la base complète, la retaille sur le téléphone et la met en cache —
les nouveaux héros, jeunes comme adultes, arrivent sans republier l'app.

Le classement Living Legend se relit tout seul au lancement. La page officielle
n'envoie pas d'en-tête CORS : un navigateur ne peut pas la lire, l'APK si
(`CapacitorHttp` passe par la couche native). Dans le navigateur, l'instantané
livré reste affiché et le workflow **Rafraîchir les données** le régénère chaque
mardi matin, au lendemain du contrôle LL hebdomadaire de LSS.

## Installer sur le téléphone

### Le plus simple — PWA

Il faut d'abord que `www/` soit hébergé quelque part de réel (un aperçu
Claude ne suffit pas : il bloque les illustrations). Le plus rapide est
GitHub Pages, déjà configuré :

1. pousser le projet sur GitHub ;
2. **Settings → Pages → Source : GitHub Actions** (une seule fois) ;
3. le workflow **Pages (PWA)** se déclenche à chaque push et publie
   `https://<compte>.github.io/<dépôt>/` ;
4. ouvrir ce lien dans le navigateur du téléphone, puis *Partager → Sur
   l'écran d'accueil*. Icône, plein écran, illustrations et fonctionnement
   hors-ligne inclus.

### En APK — sans rien installer sur ta machine

Le dépôt contient un workflow GitHub Actions qui compile l'APK dans le cloud.

1. pousser le projet sur GitHub ;
2. onglet **Actions → APK Android → Run workflow** ;
3. télécharger `fab-compendium-debug-apk` en bas de l'exécution ;
4. copier l'APK sur le téléphone et l'installer (autoriser les sources inconnues).

### En APK — en local

Nécessite **JDK 21** et le **SDK Android** (Android Studio). Aucun des deux n'est
installé sur cette machine pour le moment.

```bash
npm install
npx cap add android
npx @capacitor/assets generate --android
npm run android:apk        # APK dans android/app/build/outputs/apk/debug/
```

Pour publier sur le Play Store il faudra en plus une clé de signature et
`./gradlew bundleRelease`.

## Prévisualisation mono-fichier

```bash
npm run bundle             # → dist/fab-compendium.html
```

Le script réassemble les modules dans un seul fichier HTML. Utile pour partager
un lien ; les illustrations distantes peuvent être bloquées selon l'hébergeur,
l'app retombe alors sur le monogramme doré du héros.

## Ce que fait l'application

| Écran | Contenu |
| --- | --- |
| **Duel** | Deux tapis pleine largeur avec l'illustration choisie, panneau adverse retourné à 180° pour le face-à-face, tap à gauche pour retirer / à droite pour ajouter, appui long pour enchaîner. Coups groupés 1,6 s avant d'entrer au journal. Chrono de ronde, plan de side du matchup, annulation, écran maintenu allumé. Un héros adulte ne peut pas être opposé à un héros jeune : message clair, mise en place bloquée. |
| **Sélecteur de héros** | Recherche, filtres rapides *Tous / Adultes / Jeunes* puis par talent (**Pit Fighter**, Elemental, Shadow, Light…) et par classe. Points Living Legend affichés sur chaque vignette. Un tap sur un héros confirme directement et ouvre l'écran d'illustration ; l'illustration retenue est mémorisée par héros pour la prochaine fois. |
| **Decks** | Bibliothèque, héros et illustration, format, notes, winrate, matchups, plans de side. **Decklist** en trois zones — Équipement, Main Deck, Sideboard — avec les règles officielles de taille et de copies par format (Classic Constructed, Living Legend, Blitz, Silver Age) et des messages d'erreur explicites. Recherche de cartes limitée par défaut à Générique + la classe du héros (option pour tout voir). Import d'un export FaBrary / Talishar avec reconnaissance des sections (*Weapons*, *Equipment*, *Sideboard*…), boutons +/− sur chaque carte, aperçu au tap — consultable hors connexion. |
| **Stats** | Winrate global, série en cours, sélection d'un deck précis avec graphique de winrate par héros affronté (adultes et jeunes séparés), par héros adverse, journal des matchs, saisie manuelle, filtres 30 / 90 jours. |
| **Tournois** | À venir et passés, date, type, lieu, format, deck prévu, classement, décompte. |
| **Actus** | Course au Living Legend (points, progression vers 1000, héros déjà LL), liste des cartes bannies / suspendues / restreintes par format, ressources officielles LSS, Talishar, FaBrary, entretien des bases de données. |

Réglages : peau **Ombre** ou **Vélin**, face-à-face, écran allumé, alerte de
ronde, export / import JSON, export CSV des statistiques (Metafy, FaBrary…),
copie de secours automatique restaurable.

## Vie privée

Tout est stocké dans le `localStorage` de l'appareil. Aucun compte, aucun
serveur, aucune télémétrie. Les seules requêtes sortantes sont les illustrations
de cartes et la mise à jour de la base de héros, toutes deux déclenchées par
l'usage.

---

Application non officielle, sans lien avec Legend Story Studios.
Illustrations et noms de cartes © Legend Story Studios.
