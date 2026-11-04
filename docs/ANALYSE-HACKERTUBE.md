# Analyse fonctionnelle de HackerTube

Audit réalisé le 4 novembre 2026 à partir des pages publiques du site (code source de la page servie,
appels à son API JSON pour comprendre le modèle de données, 4 captures en largeur mobile) et de l'article
<https://karpathy.bearblog.dev/hacker-tube/>. Aucun contenu, logo ni code n'a été copié.

## Ce qui fait HackerTube

| Domaine | Constat | Notre transposition |
|---|---|---|
| Mise en page | Barre fixe (menu, logo, recherche centrée, « ? », thème) ; menu latéral 240 px repliable en rail de 72 px ; tiroir sur mobile ; pas de pied de page | Identique dans l'esprit ; menu enrichi des univers (auto, moto, aviation, bateaux, autres) et liens légaux en bas du menu |
| Recherche | À la validation, `/search/<q>`, sémantique (embeddings), liste de résultats avec résumé, conserve les filtres, touche `/` | Recherche plein texte pondérée + synonymes FR/EN + correction orthographique + autocomplétion ; liste avec résumé ; filtres conservés ; touche `/` |
| Cartes | Image au milieu de la vidéo (`hq2.jpg`), durée, titre 2 lignes, chaîne, vues · date, bouton « plus tard » au survol | Miniature **officielle** (voir CONFORMITE.md), durée, titre, chaîne, vues · date, univers, badges (sélection, pépite, note interne, langue), favori + plus tard |
| Filtres | Date (année, 2020s, 2010s, 2000s), type, durée (<4, 4-20, 20-60, >60 min), pépites (<100 k vues), « evergreen » ; tris : pertinence, récemment recommandé, date, ancienneté, vues, ratio de likes, plus recommandé | Tous repris et étendus (format, technologie, langue, qualité), combinables, dans l'URL |
| Taxonomie | 16 domaines, 150 catégories avec compteurs | 5 univers, 91 sous-catégories, 24 thèmes transversaux, 10 formats, 6 technologies, marques et modèles |
| Page vidéo | Lecteur en façade puis `youtube-nocookie`, ligne « N recommandeurs HN sur M mois », résumé IA, « pourquoi HN l'aime », commentaires HN avec position, 20 vidéos liées | Même structure : façade + lecteur officiel, justification factuelle, preuves (stories et commentaires HN avec liens), détail de la note, vidéos similaires et « autour du même modèle » |
| Personnalisation | Sans compte, localStorage (likes, dislikes, plus tard, 200 vues), flux mixé serveur avec raisons (« classique HN », « pépite », « exploration »…) | Sans compte, localStorage (favoris, plus tard, historique 300, masqués, préférences) ; moteur serveur avec raisons explicites ; démarrage à froid mixte |
| Playlists | « Start here » / « Deep dives », mosaïque 2×2, ordre délibéré, notes de curation | Idem (« Pour commencer » / « Pour aller plus loin »), playlists intelligentes à règles + éditoriales, notes de curation |
| Sélection | ≥ 3 personnes distinctes sur ≥ 3 mois ; classement par nombre de mois de recommandation ; ~7 000 vidéos sur 100 000+ | Critère « recommandations indépendantes » + « répétition dans le temps », plus 9 autres critères pondérés ; seuils réglables ; file de validation |
| Paramètres | Une option (images au milieu des vidéos) | Thème, langue, univers et formats favoris, durée préférée, historique, chargement du lecteur, export/import, réinitialisation |

## Mécanismes essentiels retenus

1. **La qualité vient des recommandations indépendantes et répétées**, pas de la popularité.
2. **Tout est explicable** : chaque vidéo dit pourquoi elle est là.
3. **Aucune friction** : pas de compte, données locales, lecteur chargé au clic.
4. **Navigation par filtres riches** dans l'URL, partageable.
5. **Densité et sobriété** : grille de cartes, peu de décor, l'accent coloré réservé aux interactions.

## Différenciation

Identité « ignition » (ambre sur graphite, typographie Space Grotesk / Inter), thème sombre par défaut,
périmètre thématique véhicules, sources multiples (pas seulement Hacker News), marques et modèles,
notation multicritère transparente, back-office de curation complet.
