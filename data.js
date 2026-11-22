// DONNÉES — modifie librement. Format : r(nom, saison, tags, "ingrédients séparés par des virgules")
// saison : "ete" | "hiver" | "toutes"   —   tags : "omnivore", "vegetarien", "vegan", "sans gluten"
const r = (nom, saison, tags, ing) => ({
  id: nom.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-"),
  nom, saison, tags: tags.split(" ").map(t => t.replace("_", " ")),
  ingredients: ing ? ing.split(",").map(s => s.trim()) : []
});
const V = "vegetarien", O = "omnivore", VG = "vegan vegetarien";

// Tes recettes d'été de l'ancien script Python (collection de départ)
const RECETTES_DE_BASE = [
  r("Lasagne épinards","ete",V,"lasagne, épinards, parmesan, crème fraîche"),
  r("Pizzas","ete",O,"poires, noix, gorgonzola, crème liquide, champignons, poivrons, chorizo, sauce tomate, gruyère, levure de boulanger, farine"),
  r("Gnocchis brocolis","ete",V,"gnocchis, brocolis, épinards surgelés, ricotta"),
  r("Dahl lentilles corail","ete",VG+" sans_gluten","gingembre, concentré de tomates, lait de coco, ail, lentilles corail, carottes, riz"),
  r("Tian","ete",V+" sans_gluten","courgettes, aubergines, poivrons, oignons, herbes de Provence, mozzarella, huile d'olive"),
  r("Wrap","ete",V,"wraps, maïs, haricots rouges, artichauts, oignons frits, steak végé, gruyère, salade, câpres, olives"),
  r("Crumble légumes soleil","ete",V,"courgettes, aubergines, poivrons, oignons, herbes de Provence, parmesan, farine, beurre"),
  r("Falafel","ete",VG,"pois chiches, farine, persil, oignon, épices"),
  r("Cake au thon","ete",O,"farine, thon, gruyère, lait, huile, oeufs"),
  r("Lasagnes courgettes mozzarella champignons","ete",V,"lasagnes, courgettes, champignons, mozzarella, coulis de tomates"),
  r("Risotto courgettes","ete",O,"riz à risotto, bouillon, courgettes, parmesan, chorizo"),
  r("Burger","ete",O,"pains burger, halloumi, bacon, steak végé, tomates, cornichons, salade, ketchup, moutarde, chips"),
  r("Feta sur légumes d'été","ete",V+" sans_gluten","courgettes, aubergines, poivrons, oignons, herbes de Provence, feta"),
  r("Paella","ete",O,""),
  r("Feuilletés épinards","ete",V,"pâtes feuilletées, épinards, feta"),
  r("Steak champignons","ete",V,"poudre d'amandes, chapelure, oeuf, champignons, persil, ail, oignon"),
  r("Légumes, PDT et saucisses au four","ete",O+" sans_gluten","courgettes, aubergine, tomates, poivrons, pommes de terre, saucisses"),
  r("Croque-monsieur","ete",O,"pain de mie, feta, poivrons, ail, courgettes, vache qui rit, caviar d'aubergine, chèvre, tomates, mozzarella, anchois"),
  r("Salade thaï","ete",VG,"gingembre, vinaigre de riz, sucre, citron vert, sauce soja, ail, échalotes, carottes, coriandre, concombre, menthe, cacahuètes"),
  r("Fajitas poulet pané","ete",O,"fajitas, poulet, chapelure, salade, poivrons, oignons frits, steak végé"),
  r("Salade haricots mangue","ete",V+" sans_gluten","haricots verts, mangue, cacahuètes, tomates cerises, burrata, quinoa"),
  r("Cake maïs","ete",V,"semoule, maïs, oeufs, poivrons, farine, gruyère"),
  r("Cake figues noix chèvre","ete",V,"oeufs, farine, lait, chèvre, miel, figues sèches, fromage râpé, noix, levure"),
  r("Poke bowl","ete",O+" sans_gluten","oignons, sésame, coriandre, gingembre, huile de sésame, vinaigre de riz, saumon ou truite, avocats, carottes, concombre, mangue, sauce teriyaki, riz"),
  r("Rouleaux de pommes de terre","ete",V+" sans_gluten","pommes de terre, crème liquide, gruyère, papier cuisson, oignons, salade"),
  r("Bruschettas","ete",O,"pain à bruschetta, sauce tomate, olives, poivrons, oignons, jambon, câpres, mozzarella, gruyère"),
  r("Légumes rôtis, houmous, pitas","ete",V,"chou-fleur, olives, feta, houmous, graines de courge, pitas"),
  r("Quiche tomates chèvre","ete",V,"farine, beurre, chèvre, tomates, oeufs, crème liquide, herbes de Provence"),
  r("Cake aubergines tomates confites","ete",V,"aubergines, tomates confites, feta, oeufs, farine, levure"),
  r("Gâteau courgettes mimolette","ete",V,"courgettes, ciboulette, mimolette râpée, oeufs, farine, levure chimique, lait entier"),
  r("Pâtes","ete",VG,"pâtes")
];

// Catalogue de suggestions (page « Suggestions »)
const SUGGESTIONS = [
  r("Soupe de potiron et châtaignes","hiver",VG+" sans_gluten","potiron, châtaignes, oignon, bouillon de légumes, crème de coco"),
  r("Gratin dauphinois aux poireaux","hiver",V+" sans_gluten","pommes de terre, poireaux, crème liquide, gruyère, ail"),
  r("Pot-au-feu","hiver",O+" sans_gluten","boeuf à bouillir, carottes, poireaux, navets, pommes de terre, céleri, moutarde"),
  r("Curry de pois chiches et épinards","hiver",VG+" sans_gluten","pois chiches, épinards, lait de coco, tomates concassées, curry, riz basmati, oignon"),
  r("Tartiflette","hiver",O+" sans_gluten","pommes de terre, reblochon, lardons, oignons, crème liquide"),
  r("Chili sin carne","hiver",VG+" sans_gluten","haricots rouges, maïs, tomates concassées, poivron, oignon, cumin, riz"),
  r("Velouté de butternut","hiver",VG+" sans_gluten","courge butternut, oignon, bouillon de légumes, lait de coco"),
  r("Gaspacho","ete",VG+" sans_gluten","tomates, concombre, poivron, ail, huile d'olive, vinaigre, pain"),
  r("Salade de quinoa grecque","ete",V+" sans_gluten","quinoa, concombre, tomates, feta, olives, oignon rouge, menthe"),
  r("Pâtes au pesto et tomates cerises","toutes",V,"pâtes, basilic, pignons, parmesan, tomates cerises, huile d'olive"),
  r("Poulet rôti et légumes racines","hiver",O+" sans_gluten","poulet, carottes, panais, pommes de terre, thym, ail"),
  r("Tacos de légumes grillés","ete",VG,"tortillas, courgettes, poivrons, haricots noirs, avocat, citron vert, coriandre"),
  r("Risotto aux champignons","toutes",V+" sans_gluten","riz à risotto, champignons, bouillon, parmesan, échalotes, vin blanc"),
  r("Saumon en papillote","toutes",O+" sans_gluten","saumon, citron, aneth, courgettes, pommes de terre"),
  r("Buddha bowl d'hiver","hiver",VG+" sans_gluten","patate douce, chou kale, pois chiches, quinoa, tahini, citron")
];
