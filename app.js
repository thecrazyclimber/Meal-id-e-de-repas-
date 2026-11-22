/* ===== Connexion à Supabase ===== */
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dire = (sel, texte, ok = false) => { $(sel).textContent = texte; $(sel).classList.toggle("ok", ok); };
const echec = res => { if (res.error) { alert(res.error.message); return true; } return false; };

let moi = null;        // { id, identifiant, is_admin, seed_done }
let collection = [];   // recettes de l'utilisateur connecté
let dernier = [];      // ids du dernier planning

const REGIMES = ["tous", "omnivore", "vegetarien", "vegan", "sans gluten"];
const SAISONS = { ete: "Été", hiver: "Hiver", toutes: "Toutes saisons" };
const versEmail = id => id.trim().toLowerCase() + "@repas-app.fr";   // identifiant -> pseudo-email pour Supabase Auth
const versLigne = r => ({ nom: r.nom, saison: r.saison, tags: r.tags, ingredients: r.ingredients });
const etiquettes = r => `<div class="etiquettes"><span class="etiquette">${SAISONS[r.saison]}</span>${r.tags.map(t => `<span class="etiquette">${esc(t)}</span>`).join("")}</div>`;
const filtrer = (liste, saison, regime) => liste.filter(r => (saison === "toutes" || r.saison === saison || r.saison === "toutes") && (regime === "tous" || r.tags.includes(regime)));
function melanger(t) { t = [...t]; for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; }

/* ===== Chargement des données de l'utilisateur ===== */
async function charger() {
  const { data: profil, error } = await db.from("profiles").select("*").maybeSingle();
  if (error || !profil) {   // profil absent ou illisible : on déconnecte et on explique
    await db.auth.signOut();
    dire("#login-message", error ? "Erreur Supabase : " + error.message : "Profil introuvable pour ce compte (voir l'étape de réparation SQL).");
    return;
  }
  moi = profil;
  if (moi.identifiant === "caroline" && !moi.seed_done) {   // première connexion de Caroline : on importe ses recettes d'origine
    if (echec(await db.from("recettes").insert(RECETTES_DE_BASE.map(versLigne)))) return;
    await db.from("profiles").update({ seed_done: true }).eq("id", moi.id);
  }
  collection = (await db.from("recettes").select("*").order("nom")).data || [];
  dernier = (await db.from("dernier_menu").select("recette_ids").maybeSingle()).data?.recette_ids || [];
}

/* ===== Navigation ===== */
function afficherPage() {
  const permises = moi ? ["planning", "collection", "suggestions", "compte", ...(moi.is_admin ? ["admin"] : [])] : ["connexion"];
  let nom = location.hash.slice(1);
  if (!permises.includes(nom)) nom = permises[0];
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("visible", p.id === "page-" + nom));
  document.querySelectorAll("[data-lien]").forEach(a => a.classList.toggle("actif", a.dataset.lien === nom));
  if (nom === "admin") chargerAdmin();
}
window.addEventListener("hashchange", afficherPage);

async function demarrer() {
  const { data: { session } } = await db.auth.getSession();
  moi = null;
  if (session) await charger();
  $("#zone-nav").hidden = !moi;
  $("#lien-admin").hidden = !moi?.is_admin;
  $("#nom-utilisateur").textContent = moi ? moi.identifiant : "";
  if (moi) { afficherCollection(); afficherSuggestions(); afficherPlanning(dernier.map(id => collection.find(r => r.id === id)).filter(Boolean)); }
  afficherPage();
}

/* ===== Connexion / inscription / déconnexion ===== */
const lireIdentifiants = () => ({ id: $("#login-id").value, mdp: $("#login-mdp").value });
$("#btn-connexion").addEventListener("click", async () => {
  const { id, mdp } = lireIdentifiants();
  const { error } = await db.auth.signInWithPassword({ email: versEmail(id), password: mdp });
  if (error) return dire("#login-message", "Identifiant ou mot de passe incorrect.");
  dire("#login-message", ""); location.hash = "#planning"; await demarrer();
});
$("#btn-inscription").addEventListener("click", async () => {
  const { id, mdp } = lireIdentifiants();
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(id.trim())) return dire("#login-message", "Identifiant : 2 à 30 lettres, chiffres, - ou _.");
  const { data, error } = await db.auth.signUp({ email: versEmail(id), password: mdp });
  if (error) return dire("#login-message", error.message);
  if (!data.session) return dire("#login-message", "Compte créé : désactive la confirmation par e-mail dans Supabase (voir instructions).");
  location.hash = "#planning"; await demarrer();
});
$("#btn-deconnexion").addEventListener("click", async () => { await db.auth.signOut(); location.hash = "#connexion"; await demarrer(); });

/* ===== Mon compte ===== */
$("#btn-changer-mdp").addEventListener("click", async () => {
  const verif = await db.auth.signInWithPassword({ email: versEmail(moi.identifiant), password: $("#mdp-actuel").value });
  if (verif.error) return dire("#compte-message", "Mot de passe actuel incorrect.");
  const { error } = await db.auth.updateUser({ password: $("#mdp-nouveau").value });
  if (error) return dire("#compte-message", error.message);
  dire("#compte-message", "Mot de passe modifié.", true);
  $("#mdp-actuel").value = $("#mdp-nouveau").value = "";
});

/* ===== Planning ===== */
async function genererPlanning() {
  const n = Math.max(1, parseInt($("#nb-repas").value) || 1);
  const pool = filtrer(collection, $("#plan-saison").value, $("#plan-regime").value);
  let candidats = pool.filter(r => !dernier.includes(r.id));   // évite les repas du dernier planning
  let msg = "";
  if (candidats.length < n) { candidats = pool; msg = "Peu de recettes disponibles : des repas du dernier planning peuvent revenir. "; }
  if (pool.length < n) msg += `Seulement ${pool.length} recette(s) correspondent aux filtres.`;
  const choix = melanger(candidats).slice(0, n);
  dernier = choix.map(r => r.id);
  await db.from("dernier_menu").upsert({ user_id: moi.id, recette_ids: dernier });
  $("#plan-message").textContent = msg;
  afficherPlanning(choix);
}
function afficherPlanning(choix) {
  $("#bloc-resultat").hidden = $("#bloc-courses").hidden = choix.length === 0;
  $("#liste-repas").innerHTML = choix.map((r, i) => `<li><span><strong>Repas ${i + 1} : ${esc(r.nom)}</strong></span>${etiquettes(r)}</li>`).join("");
  const vus = new Map();
  choix.forEach(r => r.ingredients.forEach(ing => { const k = ing.toLowerCase(); if (!vus.has(k)) vus.set(k, ing); }));
  $("#liste-courses").innerHTML = [...vus.values()].map(ing => `<li><label><input type="checkbox"><span>${esc(ing)}</span></label></li>`).join("") || '<li class="vide">Aucun ingrédient renseigné.</li>';
}
$("#btn-generer").addEventListener("click", genererPlanning);
$("#btn-copier").addEventListener("click", () => navigator.clipboard?.writeText([...document.querySelectorAll("#liste-courses span")].map(s => "- " + s.textContent).join("\n")));

/* ===== Collection ===== */
function afficherCollection() {
  $("#nb-collection").textContent = collection.length;
  $("#liste-collection").innerHTML = collection.map(r =>
    `<li><div><strong>${esc(r.nom)}</strong>${etiquettes(r)}<span class="doux">${esc(r.ingredients.join(", "))}</span></div>
     <div class="actions"><button class="secondaire" data-modif="${esc(r.id)}">Modifier</button>
     <button class="danger" data-suppr="${esc(r.id)}">Supprimer</button></div></li>`).join("")
    || '<li class="vide">Ta collection est vide. Ajoute une recette ou pioche dans les suggestions.</li>';
}
async function ajouterRecette(r) {
  const res = await db.from("recettes").insert(versLigne(r)).select().single();
  if (echec(res)) return false;
  collection.push(res.data); collection.sort((a, b) => a.nom.localeCompare(b.nom));
  afficherCollection(); afficherSuggestions();
  return true;
}
$("#liste-collection").addEventListener("click", async e => {
  if (e.target.dataset.modif) return commencerEdition(e.target.dataset.modif);
  const id = e.target.dataset.suppr; if (!id) return;
  if (echec(await db.from("recettes").delete().eq("id", id))) return;
  collection = collection.filter(r => r.id !== id); afficherCollection(); afficherSuggestions();
});
/* --- Formulaire d'ajout / de modification --- */
const TAGS_FORM = ["omnivore", "vegetarien", "vegan", "sans gluten"];
let enEdition = null;   // id de la recette en cours de modification (null = ajout)
const construireTags = () => $("#nouv-tags").innerHTML = TAGS_FORM.map(t => `<label><input type="checkbox" value="${t}">${t}</label>`).join("");
function lireFormulaire() {
  const tags = [...document.querySelectorAll("#nouv-tags input:checked")].map(i => i.value);
  if (tags.includes("vegan") && !tags.includes("vegetarien")) tags.push("vegetarien");   // vegan implique végétarien
  return { nom: $("#nouv-nom").value.trim(), saison: $("#nouv-saison").value, tags,
           ingredients: $("#nouv-ingredients").value.split(",").map(s => s.trim()).filter(Boolean) };
}
function remplirFormulaire(r) {
  $("#nouv-nom").value = r ? r.nom : ""; $("#nouv-saison").value = r ? r.saison : "ete";
  $("#nouv-ingredients").value = r ? r.ingredients.join(", ") : "";
  document.querySelectorAll("#nouv-tags input").forEach(i => i.checked = !!r && r.tags.includes(i.value));
  $("#titre-formulaire").textContent = r ? "Modifier la recette" : "Ajouter une recette";
  $("#btn-ajouter").textContent = r ? "Enregistrer les modifications" : "Ajouter";
  $("#btn-annuler-edition").hidden = !r;
}
function commencerEdition(id) {
  const r = collection.find(c => c.id === id); if (!r) return;
  enEdition = id; remplirFormulaire(r);
  $("#bloc-formulaire").scrollIntoView({ behavior: "smooth" }); $("#nouv-nom").focus();
}
function finirEdition() { enEdition = null; remplirFormulaire(null); }
$("#btn-annuler-edition").addEventListener("click", finirEdition);
$("#btn-ajouter").addEventListener("click", async () => {
  const f = lireFormulaire(); if (!f.nom) return $("#nouv-nom").focus();
  if (enEdition) {
    const res = await db.from("recettes").update(f).eq("id", enEdition).select().single();
    if (echec(res)) return;
    collection = collection.map(r => r.id === enEdition ? res.data : r).sort((a, b) => a.nom.localeCompare(b.nom));
    afficherCollection(); afficherSuggestions();
  } else if (!(await ajouterRecette(f))) return;
  finirEdition();
});
$("#btn-export").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(collection.map(versLigne), null, 2)], { type: "application/json" }));
  a.download = "ma-collection-repas.json"; a.click();
});
$("#fichier-import").addEventListener("change", async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(data)) throw 0;
    if (echec(await db.from("recettes").insert(data.map(versLigne)))) return;
    await charger(); afficherCollection(); afficherSuggestions();
  } catch { alert("Fichier invalide."); }
});

/* ===== Suggestions ===== */
function afficherSuggestions() {
  const liste = filtrer(SUGGESTIONS, $("#sugg-saison").value, $("#sugg-regime").value);
  $("#grille-suggestions").innerHTML = liste.map(r => {
    const deja = collection.some(c => c.nom === r.nom);
    return `<article class="carte"><strong>${esc(r.nom)}</strong>${etiquettes(r)}<span class="doux">${esc(r.ingredients.join(", "))}</span>
      <button data-ajout="${esc(r.id)}" ${deja ? "disabled" : ""}>${deja ? "Déjà dans ma collection" : "Ajouter à ma collection"}</button></article>`;
  }).join("") || '<p class="vide">Aucune suggestion pour ces filtres.</p>';
}
$("#grille-suggestions").addEventListener("click", e => { const r = SUGGESTIONS.find(s => s.id === e.target.dataset.ajout); if (r) ajouterRecette(r); });
["#sugg-saison", "#sugg-regime"].forEach(s => $(s).addEventListener("change", afficherSuggestions));

/* ===== Admin ===== */
async function chargerAdmin() {
  const { data, error } = await db.rpc("liste_utilisateurs");
  if (error) return dire("#admin-message", error.message);
  dire("#admin-message", "");
  $("#liste-utilisateurs").innerHTML = data.map(u =>
    `<li><div><strong>${esc(u.identifiant)}</strong> ${u.is_admin ? '<span class="etiquette">admin</span>' : ""}
     <span class="doux">${u.nb_recettes} recette(s) · créé le ${new Date(u.created_at).toLocaleDateString("fr-FR")}</span></div>
     ${u.id === moi.id ? "" : `<button class="danger" data-user="${u.id}" data-nom="${esc(u.identifiant)}">Supprimer le compte</button>`}</li>`).join("");
}
$("#liste-utilisateurs").addEventListener("click", async e => {
  const id = e.target.dataset.user; if (!id) return;
  if (!confirm(`Supprimer définitivement le compte « ${e.target.dataset.nom} » et toutes ses données ?`)) return;
  if (echec(await db.rpc("supprimer_utilisateur", { cible: id }))) return;
  chargerAdmin();
});

/* ===== Démarrage ===== */
["#plan-regime", "#sugg-regime"].forEach(s => $(s).innerHTML = REGIMES.map(r => `<option value="${r}">${r[0].toUpperCase() + r.slice(1)}</option>`).join(""));
construireTags();
demarrer();
