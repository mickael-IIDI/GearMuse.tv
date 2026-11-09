# Grille de revue éditoriale de la file de validation

Version 2026-11-06. Sert aux revues humaines comme aux revues assistées (agents). Une décision porte sur une vidéo,
à partir de son titre, de sa chaîne, de sa durée, de son année, de sa langue, de sa sous-catégorie et de sa note interne.

## Principe

Publier ce qu'un passionné exigeant aurait plaisir à regarder **et retrouverait utile dans plusieurs années** :
la qualité prime sur la popularité, la valeur durable sur l'actualité. En cas de doute réel, laisser en attente.

## Approuver (A)

| Code | Contenu |
|---|---|
| `A-EXPL` | Explication technique : fonctionnement, ingénierie, mécanique, aérodynamique, analyse d'incident |
| `A-DOC` | Documentaire, histoire, patrimoine, conférence de fond |
| `A-ESSAI` | Essai ou présentation approfondie d'un véhicule précis (pas une simple annonce) |
| `A-ATELIER` | Restauration, réparation, construction, préparation, entretien détaillé (pas à pas instructif) |
| `A-REPORT` | Reportage, visite d'usine ou de chantier, coulisses d'une activité liée aux véhicules |
| `A-PILOTE` | Technique de pilotage, de conduite ou de navigation, sécurité, formation |
| `A-VOYAGE` | Expédition ou voyage dont le véhicule est le cœur, avec une vraie valeur (pas un épisode banal) |
| `A-COURSE` | Course ou compétition marquante, analyse de course, record |

## Rejeter (R)

| Code | Contenu |
|---|---|
| `R-HS` | Hors sujet : pas réellement consacré à un véhicule motorisé ou à sa technique |
| `R-ACTU` | Actualité éphémère : annonce, salon, rumeur, résultat brut, « news » datée |
| `R-PROMO` | Publicité, teaser, contenu promotionnel de marque, annonce d'événement, appel à s'abonner |
| `R-ACHAT` | Équipement, accessoire, cadeau, déballage, guide d'achat d'équipement du pilote |
| `R-VLOG` | Vlog, humeur, questions-réponses, vie de la chaîne, sans contenu véhicule substantiel |
| `R-FAIBLE` | Valeur faible : réaction, compilation, classement racoleur, contenu superficiel ou trop court |
| `R-DOUBLON` | Fragment ou doublon d'une vidéo plus complète (bande-annonce, extrait, partie isolée sans intérêt seule) |

## Laisser en attente (P)

| Code | Cas |
|---|---|
| `P-DOUTE` | Impossible de trancher sur les informations disponibles : à revoir par un humain |
| `P-RESERVE` | Approuvable, mais la chaîne atteint déjà 40 vidéos publiées : gardée en réserve pour préserver la diversité |

## Règles complémentaires

- **Diversité** : au plus 40 vidéos publiées par chaîne au total (déjà publiées comprises) ; au-delà, garder les meilleures et classer les autres `P-RESERVE`.
- **Langues** : une vidéo dans une autre langue que le français ou l'anglais est acceptable si sa valeur est évidente.
- **Recommandations** : une vidéo déjà recommandée sur Hacker News (colonne `reco` > 0) mérite une attention favorable.
- **Périmètre** : l'espace (fusées, capsules, sondes, missions) en fait partie ; les rediffusions de directs de plusieurs heures relèvent de `R-FAIBLE`.
- **Prudence** : ne jamais approuver sur la seule notoriété de la chaîne ; le titre doit indiquer un contenu de valeur.
- **Traçabilité** : chaque décision assistée est enregistrée comme telle (« revue assistée par Claude Code à la demande du propriétaire »), avec son code ; elle est réversible depuis l'administration.
