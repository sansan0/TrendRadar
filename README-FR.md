<div align="center" id="trendradar">

<a href="https://github.com/sansan0/TrendRadar" title="TrendRadar">
  <img src="/_image/banner.webp" alt="Bannière TrendRadar" width="80%">
</a>

🚀 Déploiement en **30 secondes** — Votre assistant intelligent de veille technologique

<a href="https://trendshift.io/repositories/14726" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14726" alt="sansan0%2FTrendRadar | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<a href="https://share.302.ai/mEOUzG" target="_blank" title="Plateforme unique de modèles et d'API IA"><img src="_image/302ai.png" alt="Logo 302.AI" height="50"/></a>
<a href="https://shandianshuo.cn" target="_blank" title="Saisie vocale IA, 4x plus rapide que la frappe ⚡"><img src="_image/shandianshuo.png" alt="Logo FlashSpeak" height="51"/></a>

[![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-v3.3.0-blue.svg)](https://github.com/sansan0/TrendRadar)
[![MCP](https://img.shields.io/badge/MCP-v1.0.2-green.svg)](https://github.com/sansan0/TrendRadar)

[![WeWork](https://img.shields.io/badge/WeWork-Notification-00D4AA?style=flat-square)](https://work.weixin.qq.com/)
[![WeChat](https://img.shields.io/badge/WeChat-Notification-00D4AA?style=flat-square)](https://weixin.qq.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Notification-00D4AA?style=flat-square)](https://telegram.org/)
[![DingTalk](https://img.shields.io/badge/DingTalk-Notification-00D4AA?style=flat-square)](#)
[![Feishu](https://img.shields.io/badge/Feishu-Notification-00D4AA?style=flat-square)](https://www.feishu.cn/)
[![Email](https://img.shields.io/badge/Email-Notification-00D4AA?style=flat-square)](#)
[![ntfy](https://img.shields.io/badge/ntfy-Notification-00D4AA?style=flat-square)](https://github.com/binwiederhier/ntfy)
[![Bark](https://img.shields.io/badge/Bark-Notification-00D4AA?style=flat-square)](https://github.com/Finb/Bark)

[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Automation-2088FF?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/sansan0/TrendRadar)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Deployment-4285F4?style=flat-square&logo=github&logoColor=white)](https://sansan0.github.io/TrendRadar)
[![Docker](https://img.shields.io/badge/Docker-Deployment-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/r/wantcat/trendradar)
[![MCP Support](https://img.shields.io/badge/MCP-AI_Analysis-FF6B6B?style=flat-square&logo=ai&logoColor=white)](https://modelcontextprotocol.io/)

</div>

<div align="center">

**[Français](README-FR.md)** | **[中文](README.md)** | **[English](README-EN.md)**

</div>

> Ce projet vise la légèreté et la facilité de déploiement.

<details>
<summary>⚠️ Cliquez pour déplier : <strong>Voir la documentation la plus récente</strong> (Indispensable pour les utilisateurs qui ont forké)</summary>
<br>

De nombreux nouveaux utilisateurs découvrent GitHub via ce projet, d'où l'ajout de cette note.

**Problème** : Si vous utilisez ce projet via un **Fork**, il se peut que vous consultiez une ancienne version de la documentation.

**Raison** : Lors du fork, la version de la documentation est copiée telle quelle, mais le projet original peut avoir été mis à jour depuis.

**👉 [Cliquez pour voir la documentation officielle la plus récente](https://github.com/sansan0/TrendRadar?tab=readme-ov-file)**

**Comment vérifier ?** Regardez l'adresse du dépôt en haut de la page :
- `github.com/votre_nom_utilisateur/TrendRadar` ← Votre version forké
- `github.com/sansan0/TrendRadar` ← La version officielle la plus récente

</details>

<br>

## 📑 Navigation rapide

<div align="center">

| [🚀 Démarrage rapide](#-démarrage-rapide) | [🤖 Analyse IA](#-analyse-ia) | [⚙️ Guide de configuration](#guide-de-configuration) | [📝 Journal des modifications](#-journal-des-modifications) | [❓ FAQ & Support](#-faq--support) |
|:---:|:---:|:---:|:---:|:---:|
| [🐳 Déploiement Docker](#6-déploiement-docker) | [🔌 Clients MCP](#-clients-mcp) | [📚 Projets liés](#-projets-liés) | [🪄 Sponsors](#-sponsors) | |

</div>

- Merci aux **rapporteurs de bugs**, vos retours rendent ce projet meilleur 😉
- Merci aux **stargazers**, vos étoiles et vos forks sont le meilleur soutien pour l'open source 😍
- Merci aux **followers**, vos interactions rendent le contenu plus significatif 😎

<details>
<summary>👉 Cliquez pour voir les <strong>Remerciements</strong> (Actuellement <strong>🔥73🔥</strong> soutiens)</summary>

### Soutien à l infrastructure

Merci à **GitHub** pour l infrastructure gratuite, qui est la condition préalable majeure au fonctionnement pratique de ce projet avec un **fork en un clic**.

### Support des données

Ce projet utilise l API de [newsnow](https://github.com/ourongxing/newsnow) pour récupérer des données multi-plateformes. Un grand merci à l auteur pour ce service.

Après communication, l auteur a indiqué n avoir aucune inquiétude concernant la pression sur le serveur, mais cela est basé sur sa bonne volonté et sa confiance. Veuillez à tous :
- **Visitez le [projet newsnow](https://github.com/ourongxing/newsnow) et mettez-lui une étoile (star)**
- Lors du déploiement avec Docker, veuillez contrôler la fréquence de manière raisonnable et éviter d être excessivement gourmand.

### Support de la promotion

> Merci aux plateformes et individus suivants pour leurs recommandations (par ordre chronologique)

- [Appinn (小众软件)](https://mp.weixin.qq.com/s/fvutkJ_NPUelSW9OGK39aA) - Plateforme de recommandation de logiciels open source
- [Communauté LinuxDo](https://linux.do/) - Communauté de passionnés de technologie
- [Hebdomadaire de Ruan Yifeng](https://github.com/ruanyf/weekly) - Hebdomadaire technique influent dans le cercle technologique chinois

### Support communautaire

> Merci aux amis **soutiens financiers**. Votre générosité s est transformée en snacks et boissons à côté de mon clavier, accompagnant chaque itération de ce projet.
>
> **L'appréciation d'un yuan** a été suspendue. Si vous souhaitez toujours soutenir l auteur, veuillez visiter l article du [compte officiel](#-faq--support) et cliquer sur "Aimer l auteur" en bas.

| Soutien | Montant (CNY) | Date | Note |
| :-------: | :----------: | :--: | :--: |
| D*5 | 1.8 * 3 | 2025.11.24 | |
| *鬼 | 1 | 2025.11.17 | |
| *超 | 10 | 2025.11.17 | |
| R*w | 10 | 2025.11.17 | Agent au top ! |
| J*o | 1 | 2025.11.17 | Merci pour l open source |
| *晨 | 8.88 | 2025.11.16 | Bon projet |
| *海 | 1 | 2025.11.15 | |
| *德 | 1.99 | 2025.11.15 | |
| *疏 | 8.8 | 2025.11.14 | Super projet |
| M*e | 10 | 2025.11.14 | L open source n est pas facile |
| **柯 | 1 | 2025.11.14 | |
| *云 | 88 | 2025.11.13 | Bon projet |
| *W | 6 | 2025.11.13 | |
| *凯 | 1 | 2025.11.13 | |
| 对*. | 1 | 2025.11.13 | Merci pour TrendRadar |
| s*y | 1 | 2025.11.13 | |
| **翔 | 10 | 2025.11.13 | J aurais aimé le trouver plus tôt |
| *韦 | 9.9 | 2025.11.13 | TrendRadar est génial |
| h*p | 5 | 2025.11.12 | Soutenir l open source chinois |
| c*r | 6 | 2025.11.12 | |
| a*n | 5 | 2025.11.12 | |
| 。*c | 1 | 2025.11.12 | Merci du partage |
| ... | ... | ... | **(Plus de 50+ soutiens)** |

</details>

<br>

## ✨ Fonctionnalités principales

### **Agrégation de l actualité tendance multi-plateformes**

- 知乎 (Zhihu)
- 抖音 (Douyin)
- Recherche populaire sur Bilibili
- 华尔街见闻 (Wallstreetcn)
- 贴吧 (Tieba)
- Recherche populaire Baidu
- 财联社 (Yicai)
- 澎湃新闻 (Thepaper)
- 凤凰网 (Ifeng)
- 今日头条 (Toutiao)
- 微博 (Weibo)

Surveillance par défaut de 11 plateformes grand public, avec possibilité d ajouter des plateformes personnalisées.

> 💡 Pour une configuration détaillée, voir [Guide de configuration - Configuration des plateformes](#1-configuration-des-plateformes)

### **Stratégies de notification intelligentes**

**Trois modes de notification** :

| Mode | Utilisateurs ciblés | Fonctionnalité de notification |
|------|--------------------|----------------------------|
| **Résumé quotidien** (daily) | Managers/Utilisateurs réguliers | Notification de toutes les actualités correspondantes du jour (inclut les actualités précédemment notifiées) |
| **Classements actuels** (current) | Créateurs de contenu | Notification des correspondances des classements actuels (les actualités continuellement classées apparaissent à chaque fois) |
| **Surveillance incrémentale** (incremental) | Traders/Investisseurs | Notification uniquement des nouveaux contenus, zéro duplication |

> 💡 **Guide de sélection rapide :**
> - 🔄 Vous ne voulez pas de nouvelles en double → Utilisez le mode `incremental`
> - 📊 Vous voulez des tendances de classement complètes → Utilisez le mode `current`
> - 📝 Vous avez besoin de rapports de synthèse quotidiens → Utilisez le mode `daily`
>
> Pour une comparaison et une configuration détaillées, voir [Guide de configuration - Détails des modes de notification](#3-détails-des-modes-de-notification)

**Fonctionnalité additionnelle - Contrôle de la fenêtre de temps de notification** (Optionnel) :

- Définissez une plage horaire pour les notifications (ex : 09:00-18:00), les notifications sont envoyées uniquement pendant la période spécifiée.
- Configurez plusieurs notifications dans la fenêtre ou une fois par jour.
- Évitez les notifications en dehors des heures de travail.

> 💡 Cette fonctionnalité est désactivée par défaut, voir [Démarrage rapide](#-démarrage-rapide) pour la configuration.

### **Filtrage précis du contenu**

Définissez des mots-clés personnels (par exemple, IA, BYD, Politique éducative) pour ne recevoir que les actualités pertinentes, en filtrant le bruit.

**Syntaxe de base** (4 types) :
- Mots normaux : Correspondance de base
- Mots requis `+` : Limite le champ d application
- Mots à filtrer `!` : Exclut le bruit
- Limite de comptage `@` : Contrôle le nombre d affichage (nouveauté v3.2.0)

**Fonctionnalités avancées** (nouveauté v3.2.0) :
- 🔢 **Contrôle du tri des mots-clés** : Tri par popularité ou par ordre de configuration
- 📊 **Limite précise du nombre d affichage** : Configuration globale + surcharge individuelle pour un contrôle flexible

**Gestion par groupes** :
- Séparez par des lignes vides, des statistiques indépendantes pour différents sujets.

> 💡 **Configuration de base** : [Configuration des mots-clés - Syntaxe de base](#syntaxe-de-base-des-mots-clés)
>
> 💡 **Configuration avancée** : [Configuration des mots-clés - Paramètres avancés](#paramètres-avancés-des-mots-clés)
>
> 💡 Vous pouvez également ignorer le filtrage et recevoir toutes les actualités tendances (laissez frequency_words.txt vide).

### **Analyse des tendances**

Le suivi en temps réel des changements de popularité des actualités vous aide à comprendre non seulement "ce qui est tendance", mais aussi "comment les tendances évoluent".

- **Suivi chronologique** : Enregistre la durée complète de la première à la dernière apparition.
- **Changements de popularité** : Suit les changements de classement et la fréquence d apparition sur différentes périodes.
- **Nouvelle détection** : Identification en temps réel des sujets émergents, marqués par 🆕.
- **Analyse de continuité** : Distingue les sujets chauds ponctuels des actualités en développement continu.
- **Comparaison multi-plateformes** : La même actualité sur différentes plateformes, montrant les différences d attention médiatique.

> 💡 Référence du format de notification : [Guide de configuration - Référence du format de notification](#5-référence-du-format-de-notification)

### **Algorithme de veille personnalisé**

Ne soyez plus contrôlé par les algorithmes des plateformes, TrendRadar réorganise toutes les recherches tendance :

- **Prioriser les nouvelles les mieux classées** (60%) : Les nouvelles les mieux classées de chaque plateforme apparaissent en premier.
- **Se concentrer sur les sujets persistants** (30%) : Les nouvelles qui apparaissent de manière répétée sont plus importantes.
- **Prendre en compte la qualité du classement** (10%) : Pas seulement la fréquence, mais aussi le classement constant en tête.

> 💡 Guide d ajustement des pondérations : [Guide de configuration - Configuration avancée - Ajustement de la pondération des points chauds](#4-configuration-avancée---ajustement-de-la-pondération-des-points-chauds)

### **Notification multi-canal en temps réel**

Prend en charge **WeWork** (+ solution de notification WeChat), **Feishu**, **DingTalk**, **Telegram**, **Email**, **ntfy** — messages livrés directement sur téléphone et par email.

### **Prise en charge multi-plateforme**
- **GitHub Pages** : Génère automatiquement de superbes rapports web, adaptés PC/mobile.
- **Déploiement Docker** : Prend en charge le fonctionnement conteneurisé multi-architecture.
- **Persistance des données** : Sauvegarde de l histoire au format HTML/TXT.

### **Analyse intelligente par IA (Nouveau v3.0.0)**

Système d analyse conversationnel IA basé sur le protocole MCP (Model Context Protocol), permettant une exploration approfondie des données d actualités avec le langage naturel.

- **Requête conversationnelle** : Posez des questions en langage naturel, comme "Interroger les tendances Zhihu d hier" ou "Analyser les tendances de popularité récentes du Bitcoin".
- **13 outils d analyse** : Requête de base, recherche intelligente, analyse de tendances, aperçus de données, analyse de sentiments, etc.
- **Support multi-clients** : Cherry Studio (config GUI), Claude Desktop, Cursor, Cline, etc.
- **Capacités d analyse approfondie** :
  - Suivi des tendances thématiques (changements de popularité, cycle de vie, détection virale, prévision de tendances).
  - Comparaison de données multi-plateformes (statistiques d activité, co-occurrence de mots-clés).
  - Génération de résumés intelligents, recherche d actualités similaires, recherche de corrélations historiques.

> **💡 Conseil d utilisation** : Les fonctionnalités IA nécessitent un support de données d actualités locales.
> - Le projet inclut des données de test du **1er au 15 novembre 2025** pour une expérience immédiate.
> - Il est recommandé de déployer le projet vous-même pour obtenir des données plus récentes.
>
> Voir [Analyse IA](#-analyse-ia) pour plus de détails.

### **Déploiement sans barrière technique**

Un fork GitHub en un clic pour l utiliser, aucune connaissance en programmation requise.

> Déploiement en 30 secondes : GitHub Pages (navigation web) prend en charge la sauvegarde en un clic sous forme d image pour un partage facile.
>
> Déploiement en 1 minute : WeWork (notification mobile)

**💡 Astuce :** Vous voulez une version web **mise à jour en temps réel** ? Après avoir forké, allez dans les `Settings` de votre dépôt → `Pages` et activez GitHub Pages. [Aperçu de l effet](https://sansan0.github.io/TrendRadar/).

### **Réduire la dépendance aux applications**

Passez de la "captivité de la recommandation algorithmique" à "l obtention active des informations que vous voulez".

**Utilisateurs ciblés :** Investisseurs, créateurs de contenu, professionnels des relations publiques, utilisateurs avertis des actualités.

**Scénarios typiques :** Suivi des investissements boursiers, suivi de la réputation de marque, veille sectorielle, collecte d actualités de style de vie.

| Effet GitHub Pages (Adapté mobile, Push email) | Effet Push Feishu |
|:---:|:---:|
| ![Effet GitHub Pages](_image/github-pages.png) | ![Effet Push Feishu](_image/feishu.jpg) |

<br>

## 📝 Journal des modifications

>**Instructions de mise à jour** :
- **📌 Vérifiez les dernières mises à jour** : **[Journal des modifications du dépôt original](https://github.com/sansan0/TrendRadar?tab=readme-ov-file#-changelog)**
- **Astuce** : NE PAS mettre à jour ce projet via **Sync fork**. Vérifiez le [Journal des modifications] pour comprendre les [Méthodes de mise à jour] et [Fonctionnalités] spécifiques.
- **Mise à jour mineure** : Pour passer de v2.x à v2.y, remplacez `main.py` dans votre dépôt forké par la dernière version.
- **Mise à jour majeure** : Pour passer de v1.x à v2.y, il est recommandé de supprimer le fork existant et de le reforker pour économiser des efforts et éviter les conflits de configuration.

### 2025/11/24 - v3.3.0

**🎉 Ajout du support de notification Bark**

1. **Canal de notification exclusif iOS**
   - Prend en charge la notification Bark (basée sur APNs, plateforme iOS).
   - Gratuit, open source, propre, efficace, sans publicité.
   - Prend en charge le serveur officiel et le serveur auto-hébergé.

2. **Multiples méthodes de déploiement**
   - GitHub Actions : Configurez le `Secret BARK_URL`.
   - Docker : Variable d environnement `BARK_URL`.
   - Local : Fichier de configuration `config/config.yaml`.

> 📖 **Tutoriel de configuration détaillé** : [Démarrage rapide - Notification Bark](#-démarrage-rapide)

**🐛 Correction de bug**
- Correction du problème où `ntfy_server_url` dans `config.yaml` était ignoré ([#345](https://github.com/sansan0/TrendRadar/issues/345)).

**🔧 Instructions de mise à jour** :
- **Utilisateurs GitHub Fork** : Mettez à jour `main.py`, `config/config.yaml`, `.github/workflows/crawler.yml`.

### 2025/11/23 - v3.2.0

**🎯 Nouvelles fonctionnalités de personnalisation avancées**

1. **Configuration de la priorité de tri des mots-clés**
   - Deux stratégies de tri : Priorité à la popularité ou priorité à l ordre de configuration.
   - Pour différents cas d utilisation : Suivi des sujets chauds ou focus personnalisé.

2. **Contrôle précis du nombre d éléments affichés**
   - Configuration globale : Limite unifiée pour tous les mots-clés.
   - Configuration individuelle : Utilisez la syntaxe `@nombre` pour définir des limites spécifiques.
   - Contrôle efficace de la longueur des notifications, met en évidence le contenu clé.

> 📖 **Tutoriel détaillé** : [Configuration des mots-clés - Paramètres avancés](#paramètres-avancés-des-mots-clés)

**🔧 Instructions de mise à jour** :
- **Utilisateurs GitHub Fork** : Mettez à jour `main.py`, `config/config.yaml`.

### 2025/11/18 - mcp-v1.0.2

  **Mise à jour du module MCP :**
  - Correction du problème où la requête d actualités du jour pouvait renvoyer des articles de dates antérieures.

### 2025/11/22 - v3.1.1

- **Correction d un problème de plantage dû à une anomalie de données** : Résolution de l erreur `'float' object has no attribute 'lower'` rencontrée par certains utilisateurs dans l environnement GitHub Actions.
- Ajout d un mécanisme de double protection : Filtre les titres invalides (None, float, chaînes vides) lors de l acquisition des données, avec vérification de type aux points d appel de fonction.
- Amélioration de la stabilité du système pour garantir un fonctionnement normal même lorsque les sources de données renvoient des formats anormaux.

**Instructions de mise à jour** (Utilisateurs GitHub Fork) :
- Mise à jour requise : `main.py`
- Recommandé : Utiliser la méthode de mise à jour de version mineure - copier et remplacer le fichier ci-dessus.

### 2025/11/18 - mcp-v1.0.2

  **Mise à jour du module MCP :**
  - Correction du problème où la requête d actualités du jour pouvait renvoyer des articles de dates antérieures.

<details>
<summary>👉 Cliquez pour déplier : <strong>Mises à jour historiques</strong></summary>

### 2025/11/20 - v3.1.0

- **Ajout du support de notification WeChat personnelle** : L application WeWork peut notifier sur WeChat personnel sans installer l application WeWork.
- Prend en charge deux formats de message : `markdown` (bot de groupe WeWork) et `text` (application WeChat personnelle).
- Ajout de la configuration de la variable d environnement `WEWORK_MSG_TYPE`, prenant en charge GitHub Actions, Docker, docker-compose et d autres méthodes de déploiement.
- Le mode `text` supprime automatiquement la syntaxe Markdown pour une notification en texte brut propre.
- Voir la configuration "Notification WeChat personnelle" dans le Démarrage rapide.

**Instructions de mise à jour** (Utilisateurs GitHub Fork) :
- Mises à jour requises : `main.py`, `config/config.yaml`.
- Mise à jour optionnelle : `.github/workflows/crawler.yml` (si vous utilisez GitHub Actions).
- Recommandé : Utiliser la méthode de mise à jour de version mineure - copier et remplacer les fichiers ci-dessus.

### 2025/11/12 - v3.0.5

- Correction d une erreur logique de configuration du port SSL/TLS d envoi d e-mails.
- Optimisation des fournisseurs de services de messagerie (QQ/163/126) pour utiliser par défaut le port 465 (SSL).
- **Ajout du support des variables d environnement Docker** : Les éléments de configuration de base (`enable_crawler`, `report_mode`, `push_window`, etc.) prennent en charge la surcharge via des variables d environnement, résolvant les problèmes de modification de fichier de configuration pour les utilisateurs de NAS (voir le chapitre [🐳 Déploiement Docker](#-déploiement-docker)).

### 2025/10/26 - mcp-v1.0.1

  **Mise à jour du module MCP :**
  - Correction d une erreur de transmission de paramètre de requête de date.
  - Format de paramètre de temps unifié pour tous les outils.

### 2025/10/31 - v3.0.4

- Résolution de l erreur Feishu due à un contenu de notification trop long, implémentation de la notification par lots.

### 2025/10/23 - v3.0.3

- Étendue de la plage d affichage des messages d erreur ntfy.

### 2025/10/21 - v3.0.2

- Correction du problème d encodage des notifications ntfy.

### 2025/10/20 - v3.0.0

**Mise à jour majeure - Fonctionnalité d analyse IA lancée** 🤖

- **Fonctionnalités principales** :
  - Nouveau serveur d analyse IA basé sur MCP (Model Context Protocol).
  - 13 outils d analyse intelligents : requête de base, recherche intelligente, analyse avancée, gestion de système.
  - Interaction en langage naturel : Interroger et analyser les données d actualités par conversation.
  - Support multi-clients : Claude Desktop, Cherry Studio, Cursor, Cline, etc.

- **Capacités d analyse** :
  - Analyse des tendances thématiques (suivi de popularité, cycle de vie, détection virale, prédiction de tendances).
  - Aperçus de données (comparaison de plateformes, statistiques d activité, co-occurrence de mots-clés).
  - Analyse de sentiments, recherche d actualités similaires, génération de résumés intelligents.
  - Recherche d actualités historiques connexes, recherche multi-modes.

- **Note de mise à jour** :
  - Il s agit d une fonctionnalité d analyse IA indépendante, n affecte pas les fonctionnalités de notification existantes.
  - Utilisation optionnelle, pas besoin de mettre à jour le déploiement existant.

### 2025/10/15 - v2.4.4

- **Mises à jour** :
    - Correction du problème d encodage des notifications ntfy + 1.
    - Correction d un problème de jugement de la fenêtre de temps de notification.

- **Note de mise à jour** :
  - Mise à jour mineure recommandée.

### 2025/10/10 - v2.4.3

> Merci à [nidaye996](https://github.com/sansan0/TrendRadar/issues/98) pour avoir découvert le problème d expérience utilisateur.

- **Mises à jour** :
  - Renommage du "Mode de notification silencieuse" en "Contrôle de la fenêtre de temps de notification", améliorant la compréhension de la fonctionnalité.
  - Clarification de la fenêtre de temps de notification comme fonctionnalité additionnelle optionnelle, pouvant fonctionner avec les trois modes de notification.
  - Amélioration des commentaires et de la documentation, rendant le positionnement de la fonctionnalité plus clair.

- **Note de mise à jour** :
  - Il s agit juste d un refactoring, la mise à jour est optionnelle.

### 2025/10/8 - v2.4.2

- **Mises à jour** :
  - Correction du problème d encodage des notifications ntfy.
  - Correction du problème de fichier de configuration manquant.
  - Optimisation de l effet de notification ntfy.
  - Ajout de la fonctionnalité d exportation d images segmentées de GitHub Pages.

- **Note de mise à jour** :
  - Mise à jour majeure recommandée.

### 2025/10/2 - v2.4.0

**Ajout de la notification ntfy**

- **Fonctionnalités principales** :
  - Prend en charge le service public ntfy.sh et les serveurs auto-hébergés.

- **Cas d utilisation** :
  - Convient aux utilisateurs soucieux de leur vie privée (prend en charge l auto-hébergement).
  - Notification multi-plateforme (iOS, Android, Bureau, Web).
  - Pas d enregistrement de compte nécessaire (serveurs publics).
  - Open source et gratuit (licence MIT).

- **Note de mise à jour** :
  - Mise à jour majeure recommandée.

### 2025/09/26 - v2.3.2

- Correction de la vérification de la configuration des notifications par e-mail qui était omise ([#88](https://github.com/sansan0/TrendRadar/issues/88)).

**Description de la correction** :
- Résolution du problème où le système affichait toujours "Aucun webhook configuré" même avec une configuration de notification par e-mail correcte.

### 2025/09/22 - v2.3.1

- **Ajout de la fonctionnalité de notification par e-mail**, prend en charge l envoi de rapports d actualités tendances par e-mail.
- **Reconnaissance SMTP intelligente** : Détecte automatiquement Gmail, QQ Mail, Outlook, NetEase Mail et plus de 10 fournisseurs de services de messagerie.
- **Format HTML élégant** : Le contenu des e-mails utilise le même format HTML que la version web, bien formaté, adapté aux mobiles.
- **Prise en charge de l envoi par lots** : Prend en charge plusieurs destinataires, séparés par des virgules.
- **SMTP personnalisé** : Peut personnaliser le serveur et le port SMTP.
- Correction du problème de connexion réseau Docker build.

**Notes d utilisation** :
- Cas d utilisation : Convient aux utilisateurs ayant besoin d archivage d e-mails, de partage d équipe, de rapports planifiés.
- E-mails pris en charge : Gmail, QQ Mail, Outlook/Hotmail, 163/126 Mail, Sina Mail, Sohu Mail, etc.

**Note de mise à jour** :
- Cette mise à jour contient de nombreux changements, si vous effectuez une mise à jour, une mise à jour majeure est recommandée.

### 2025/09/17 - v2.2.0

- Ajout de la fonctionnalité de sauvegarde des actualités en un clic sous forme d image, partagez facilement les sujets tendances qui vous intéressent.

**Notes d utilisation** :
- Cas d utilisation : Après avoir activé la fonctionnalité de version web (GitHub Pages).
- Comment utiliser : Ouvrez la page web sur votre téléphone ou PC, cliquez sur le bouton "Enregistrer comme image" en haut.
- Effet réel : Le système crée automatiquement une belle image du rapport d actualités actuel, l enregistre dans votre album photo ou sur le bureau.
- Commodité de partage : Envoyez directement cette image à vos amis, sur les réseaux sociaux, ou à vos groupes de travail, pour que les autres puissent voir les informations importantes que vous avez découvertes.

### 2025/09/13 - v2.1.2

- Résolution de la limite de capacité de notification DingTalk entraînant l échec de la notification d actualités (utilisation de la notification par lots).

### 2025/09/04 - v2.1.1

- Correction du problème d exécution de Docker sur certaines architectures.
- Publication officielle de l image Docker `wantcat/trendradar`, prend en charge plusieurs architectures.
- Optimisation du processus de déploiement Docker, utilisation rapide sans construction locale.

### 2025/08/30 - v2.1.0

**Améliorations principales** :
- **Optimisation de la logique de notification** : Passage de "notifier à chaque exécution" à "notification contrôlable dans une fenêtre de temps".
- **Contrôle de la fenêtre de temps** : Peut définir une plage horaire de notification, éviter les perturbations en dehors des heures de travail.
- **Options de fréquence de notification** : Prend en charge une notification unique ou plusieurs notifications dans la fenêtre de temps.

**Note de mise à jour** :
- Cette fonctionnalité est désactivée par défaut, nécessite une activation manuelle de la fenêtre de temps de notification dans `config.yaml`.
- La mise à jour nécessite la mise à jour simultanée des fichiers `main.py` et `config.yaml`.

### 2025/08/27 - v2.0.4

- Cette version n est pas une correction de bug, mais un rappel important.
- Veuillez conserver les webhooks correctement, ne les rendez pas publics, ne les rendez pas publics, ne les rendez pas publics.
- Si vous avez déployé ce projet sur GitHub via un fork, veuillez placer les webhooks dans GitHub Secret, et non dans `config.yaml`.
- Si vous avez déjà exposé des webhooks ou les avez placés dans `config.yaml`, il est conseillé de les supprimer et de les régénérer.

### 2025/08/06 - v2.0.3

- Optimisation de l effet de la version web de GitHub Pages, pratique pour une utilisation mobile.

### 2025/07/28 - v2.0.2

- Refonte du code.
- Résolution du problème de numéro de version facilement omis pour la modification.

### 2025/07/27 - v2.0.1

**Problèmes corrigés** :

1. Problème d exécution du script shell Docker avec des fins de ligne CRLF.
2. Problème logique où `frequency_words.txt` vide entraînait l envoi d actualités également vides.
  - Après correction, lorsque `frequency_words.txt` est vide, toutes les actualités seront notifiées, mais en raison des limites de taille des messages, veuillez ajuster comme suit :
    - Option 1 : Désactiver la notification mobile, ne choisir que le déploiement GitHub Pages (c est le moyen d obtenir les informations les plus complètes, toutes les tendances de la plateforme seront réorganisées selon votre **algorithme de recherche personnalisé**).
    - Option 2 : Réduire les plateformes de notification, prioriser **WeWork** ou **Telegram**, ces deux notifications ont une fonctionnalité de notification par lots (car la notification par lots affecte l expérience de notification, et seules ces deux plateformes offrent une très petite capacité de notification, nous avons donc dû créer une fonctionnalité de notification par lots, mais cela garantit au moins des informations complètes).
    - Option 3 : Peut être combinée avec l option 2, le mode "current" ou "incremental" peut réduire efficacement le contenu d une notification unique.

### 2025/07/17 - v2.0.0

**Refonte majeure** :
- Refonte de la gestion de la configuration : Toutes les configurations sont maintenant gérées via le fichier `config/config.yaml` (je n ai toujours pas divisé `main.py`, pratique pour copier et mettre à jour).
- Mise à jour du mode d exécution : Prend en charge trois modes - `daily` (résumé quotidien), `current` (classements actuels), `incremental` (surveillance incrémentale).
- Support Docker : Solution de déploiement Docker complète, prend en charge le fonctionnement conteneurisé.

**Description du fichier de configuration** :
- `config/config.yaml` - Fichier de configuration principal (paramètres d application, configuration du crawler, configuration de notification, configuration de plateforme, etc.).
- `config/frequency_words.txt` - Configuration des mots-clés (paramètres de vocabulaire de surveillance).

### 2025/07/09 - v1.4.1

**Nouvelle fonctionnalité** : Ajout de la notification incrémentale (configurez FOCUS_NEW_ONLY en haut de `main.py`), ce commutateur ne s intéresse qu aux nouveaux sujets et non à la chaleur soutenue, n envoie une notification que lorsque du nouveau contenu apparaît.

**Problème corrigé** : Dans certaines circonstances, certaines nouvelles contenant des symboles spéciaux provoquaient des exceptions de formatage occasionnelles.

### 2025/06/23 - v1.3.0

Les messages de notification WeWork et Telegram ont des limites de longueur, j ai adopté la division des messages pour la notification. La documentation de développement se trouve dans [WeWork](https://developer.work.weixin.qq.com/document/path/91770) et [Telegram](https://core.telegram.org/bots/api).

### 2025/06/21 - v1.2.1

Avant cette version, non seulement `main.py` devait être copié et remplacé, mais aussi `crawler.yml`.
https://github.com/sansan0/TrendRadar/blob/master/.github/workflows/crawler.yml

### 2025/06/19 - v1.2.0

> Merci à Claude Research pour avoir organisé diverses API de plateformes, ce qui m aide à adapter rapidement les plateformes (bien que le code soit plus redondant ~).

1. Prend en charge les canaux de notification Telegram, WeWork, DingTalk, prend en charge la configuration multi-canal et la notification simultanée.

### 2025/06/18 - v1.1.0

> **200 étoiles⭐** atteintes, continuons à célébrer avec tout le monde~

1. Mise à jour importante, ajout de la pondération, les nouvelles que vous voyez maintenant sont les plus chaudes et les plus pertinentes, apparaissant en haut.
2. Mise à jour de la documentation d utilisation, car de nombreuses fonctionnalités ont été mises à jour récemment, et la documentation d utilisation précédente était simple (voir le tutoriel de configuration complet de `⚙️ frequency_words.txt` ci-dessous).

### 2025/06/16 - v1.0.0

1. Ajout d un rappel de mise à jour de nouvelle version du projet, activé par défaut. Pour le désactiver, vous pouvez changer `True` en `False` dans `main.py` dans "FEISHU_SHOW_VERSION_UPDATE": True.

### 2025/06/13+14

1. Suppression du code de compatibilité, les étudiants qui avaient forké auparavant, copier directement le code affichera une exception le même jour (sera réparé le lendemain).
2. Ajout de l affichage des nouvelles actualités en bas de Feishu et HTML.

### 2025/06/09

**100 étoiles⭐** atteintes, j écris une petite fonctionnalité pour célébrer. Le fichier `frequency_words.txt` a ajouté une fonctionnalité de **mot requis**, en utilisant le signe +.

1. Syntaxe du mot requis comme suit :
   Tang Monk ou Pig doivent tous deux apparaître dans le titre, pour être inclus dans les actualités notifiées.

```txt
+Tang Monk
+Pig
```

2. La priorité des mots de filtre est plus élevée :
   Si le mot de filtre correspond à Tang Monk récitant des sutras, même si le mot requis contient Tang Monk, il ne sera pas affiché.

```txt
+Tang Monk
!Tang Monk récitant des sutras
```

### 2025/06/02

1. **La page web** et **les messages Feishu** prennent en charge le saut direct vers les actualités détaillées sur mobile.
2. Optimisation de l effet d affichage + 1.

### 2025/05/26

1. Optimisation de l effet d affichage des messages Feishu.

</details>

<br>

## 🚀 Démarrage rapide

> **📖 Rappel** : Les utilisateurs qui ont forké sont invités à consulter d abord **[la documentation officielle la plus récente](https://github.com/sansan0/TrendRadar?tab=readme-ov-file)** pour s assurer que les étapes de configuration sont à jour.

1. **Forkez ce projet** sur votre compte GitHub.

   - Cliquez sur le bouton "Fork" en haut à droite de cette page.

2. **Configurez les GitHub Secrets (Choisissez les plateformes dont vous avez besoin)** :

   Dans votre dépôt forké, allez dans `Settings` > `Secrets and variables` > `Actions` > `New repository secret`.

   **📌 Instructions importantes (Veuillez lire attentivement) :**

   - ✅ **Un nom pour un Secret** : Pour chaque élément de configuration, cliquez une fois sur le bouton "New repository secret" et remplissez une paire "Name" et "Secret".
   - ✅ **Il est normal de ne pas voir la valeur après la sauvegarde** : Pour des raisons de sécurité, après la sauvegarde, vous ne pouvez voir que le nom lors de la modification, mais pas la valeur du Secret.
   - ⚠️ **NE CRÉEZ PAS de noms personnalisés** : Le nom du Secret doit **strictement utiliser** les noms listés ci-dessous (par exemple, `WEWORK_WEBHOOK_URL`, `FEISHU_WEBHOOK_URL`, etc.). Ne modifiez pas ou ne créez pas de nouveaux noms arbitrairement, sinon le système ne les reconnaîtra pas.
   - 💡 **Vous pouvez configurer plusieurs plateformes** : Le système enverra des notifications à toutes les plateformes configurées.

   **Exemple de configuration :**

   <img src="_image/secrets.png" alt="Exemple de configuration des GitHub Secrets"/>

   Comme indiqué ci-dessus, chaque ligne est un élément de configuration :
   - **Nom** : Doit utiliser les noms fixes listés dans les sections développées ci-dessous (par exemple, `WEWORK_WEBHOOK_URL`).
   - **Secret (Valeur)** : Remplissez le contenu réel obtenu de la plateforme correspondante (par exemple, URL Webhook, Token, etc.).

   <br>


   <details>
   <summary> <strong>👉 Cliquez pour déplier : Bot WeWork</strong> (Configuration la plus simple et la plus rapide)</summary>
   <br>

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `WEWORK_WEBHOOK_URL` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse Webhook de votre bot WeWork.

   <br>

   **Étapes de configuration du bot :**

   #### Configuration mobile :
   1. Ouvrez l application WeWork → Entrez dans le groupe de discussion interne cible.
   2. Cliquez sur le bouton "…" en haut à droite → Sélectionnez "Message Push".
   3. Cliquez sur "Ajouter" → Saisissez le nom "TrendRadar".
   4. Copiez l adresse du Webhook, cliquez sur enregistrer, collez le contenu copié dans le Secret GitHub ci-dessus.

   #### Le processus de configuration PC est similaire.
   </details>

   <details>
   <summary> <strong>👉 Cliquez pour déplier : Notification WeChat personnelle</strong> (Basée sur l application WeWork, notification vers WeChat personnel)</summary>
   <br>

   > Cette solution est basée sur le mécanisme de plugin de WeWork. Le style de notification est en texte brut (pas de format Markdown), mais elle peut notifier directement sur WeChat personnel sans installer l application WeWork.

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `WEWORK_WEBHOOK_URL` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse Webhook de votre application WeWork.

   - **Nom** : `WEWORK_MSG_TYPE` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : `text`.

   <br>

   **Étapes de configuration :**

   1. Complétez la configuration du Webhook du bot WeWork ci-dessus.
   2. Ajoutez le Secret `WEWORK_MSG_TYPE` avec la valeur `text`.
   3. Suivez l image ci-dessous pour lier WeChat personnel.
   4. Après la configuration, l application WeWork peut être supprimée du téléphone.

   <img src="_image/wework.png" title="Configuration de la notification WeChat personnelle"/>

   **Notes** :
   - Utilise la même adresse Webhook que le bot WeWork.
   - La différence est le format du message : `text` pour le texte brut, `markdown` pour le texte enrichi (par défaut).
   - Le format texte brut supprimera automatiquement toute syntaxe Markdown (gras, liens, etc.).

   </details>

   <details>
   <summary> <strong>👉 Cliquez pour déplier : Bot Feishu</strong> (Affichage des messages le plus convivial)</summary>
   <br>

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `FEISHU_WEBHOOK_URL` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse Webhook de votre bot Feishu (le lien commence par https://www.feishu.cn/flow/api/trigger-webhook/********).
   <br>

   Deux méthodes sont disponibles, la **méthode 1** est plus simple, la **méthode 2** est plus complexe (mais assure une notification stable).

   La méthode 1 a été découverte et suggérée par **ziventian**, merci à eux. Par défaut, il s agit d une notification personnelle, la notification de groupe peut être configurée via [#97](https://github.com/sansan0/TrendRadar/issues/97).

   **Méthode 1 :**

   > Pour certains utilisateurs, des opérations supplémentaires sont nécessaires pour éviter l erreur "System Error". Il faut rechercher le bot sur mobile et activer l application du bot Feishu (suggestion de la communauté, voir référence).

   1. Ouvrez dans un navigateur PC https://botbuilder.feishu.cn/home/my-command

   2. Cliquez sur "New Bot Command".

   3. Cliquez sur "Select Trigger", faites défiler vers le bas, cliquez sur "Webhook Trigger".

   4. Vous verrez alors "Webhook Address", copiez ce lien dans un bloc-notes local temporairement, continuez avec les étapes suivantes.

   5. Dans "Parameters", insérez le contenu suivant, puis cliquez sur "Done".

   ```json
   {
     "message_type": "text",
     "content": {
       "total_titles": "{{Content}}",
       "timestamp": "{{Content}}",
       "report_type": "{{Content}}",
       "text": "{{Content}}"
     }
   }
   ```

   6. Cliquez sur "Select Action" > "Send via Official Bot".

   7. Remplissez le titre du message "TrendRadar Trending Monitor".

   8. La partie la plus critique, cliquez sur le bouton +, sélectionnez "Webhook Trigger", puis arrangez comme indiqué dans l image.

   ![Exemple de configuration du bot Feishu](_image/image.png)

   9. Après la configuration, placez l adresse Webhook de l étape 4 dans le Secret GitHub `FEISHU_WEBHOOK_URL`.

   <br>

   **Méthode 2 :**

   1. Ouvrez dans un navigateur PC https://botbuilder.feishu.cn/home/my-app

   2. Cliquez sur "New Bot Application".

   3. Après être entré dans l application créée, cliquez sur "Process Design" > "Create Process" > "Select Trigger".

   4. Faites défiler vers le bas, cliquez sur "Webhook Trigger".

   5. Vous verrez alors "Webhook Address", copiez ce lien dans un bloc-notes local temporairement, continuez avec les étapes suivantes.

   6. Dans "Parameters", insérez le contenu suivant, puis cliquez sur "Done".

   ```json
   {
     "message_type": "text",
     "content": {
       "total_titles": "{{Content}}",
       "timestamp": "{{Content}}",
       "report_type": "{{Content}}",
       "text": "{{Content}}"
     }
   }
   ```

   7. Cliquez sur "Select Action" > "Send Feishu Message", cochez "Group Message", puis cliquez sur la zone de saisie ci-dessous, cliquez sur "Groupes que je gère" (si aucun groupe, vous pouvez en créer un dans l application Feishu).

   8. Remplissez le titre du message "TrendRadar Trending Monitor".

   9. La partie la plus critique, cliquez sur le bouton +, sélectionnez "Webhook Trigger", puis arrangez comme indiqué dans l image.

   ![Exemple de configuration du bot Feishu](_image/image.png)

   10. Après la configuration, placez l adresse Webhook de l étape 5 dans le Secret GitHub `FEISHU_WEBHOOK_URL`.

   </details>

   <details>
   <summary> <strong>👉 Cliquez pour déplier : Bot DingTalk</strong></summary>
   <br>

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `DINGTALK_WEBHOOK_URL` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse Webhook de votre bot DingTalk.

   <br>

   **Étapes de configuration du bot :**

   1. **Créer un bot (PC uniquement)** :
      - Ouvrez le client DingTalk sur PC, entrez dans le groupe de discussion cible.
      - Cliquez sur l icône des paramètres du groupe (⚙️) → Faites défiler vers le bas pour trouver "Bot" et cliquez.
      - Sélectionnez "Ajouter un bot" → "Personnalisé".

   2. **Configurer le bot** :
      - Définissez le nom du bot.
      - **Paramètres de sécurité** :
        - **Mots-clés personnalisés** : Définissez "Trending" ou "热点".

   3. **Terminer la configuration** :
      - Cochez l accord sur les conditions d utilisation → Cliquez sur "Terminer".
      - Copiez l URL du Webhook obtenue.
      - Placez l URL dans les GitHub Secrets `DINGTALK_WEBHOOK_URL`.

   **Note** : Le mobile peut uniquement recevoir des messages, pas créer de nouveaux bots.
   </details>

   <details>
   <summary> <strong>👉 Cliquez pour déplier : Bot Telegram</strong></summary>
   <br>

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `TELEGRAM_BOT_TOKEN` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : Votre Token de bot Telegram.

   - **Nom** : `TELEGRAM_CHAT_ID` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : Votre Chat ID Telegram.

   **Note** : Telegram nécessite **deux** Secrets, veuillez cliquer deux fois sur le bouton "New repository secret" pour les ajouter séparément.

   <br>

   **Étapes de configuration du bot :**

   1. **Créer un bot** :
      - Recherchez `@BotFather` dans Telegram (attention à la casse, il a un badge bleu de vérification, affiche ~37849827 utilisateurs mensuels, c est l officiel, méfiez-vous des faux comptes).
      - Envoyez la commande `/newbot` pour créer un nouveau bot.
      - Définissez le nom du bot (doit se terminer par "bot", il est facile de tomber sur des noms en double, alors soyez créatif).
      - Obtenez le Bot Token (format : `123456789:AAHfiqksKZ8WmR2zSjiQ7_v4TMAKdiHm9T0`).

   2. **Obtenir le Chat ID** :

      **Méthode 1 : Via l API officielle**
      - Envoyez d abord un message à votre bot.
      - Visitez : `https://api.telegram.org/bot<Votre Bot Token>/getUpdates`.
      - Dans le JSON retourné, trouvez le nombre dans `"chat":{"id":nombre}`.

      **Méthode 2 : Utilisation d un outil tiers**
      - Recherchez `@userinfobot` et envoyez `/start`.
      - Obtenez votre ID utilisateur comme Chat ID.

   3. **Configurer sur GitHub** :
      - `TELEGRAM_BOT_TOKEN` : Remplissez avec le Bot Token obtenu à l étape 1.
      - `TELEGRAM_CHAT_ID` : Remplissez avec le Chat ID obtenu à l étape 2.
   </details>

   <details>
   <summary> <strong>👉 Cliquez pour déplier : Notification par e-mail</strong> (Prend en charge tous les fournisseurs de messagerie grand public)</summary>
   <br>

   - Remarque : Pour éviter l **abus** des fonctions d envoi d e-mails en masse, l envoi actuel permet à tous les destinataires de voir les adresses e-mail des autres.
   - Si vous n avez jamais configuré l envoi d e-mails comme ci-dessous, il est déconseillé d essayer.

   <br>

   **Configuration du Secret GitHub (⚠️ Le nom doit correspondre exactement) :**
   - **Nom** : `EMAIL_FROM` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse e-mail de l expéditeur.

   - **Nom** : `EMAIL_PASSWORD` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : Le mot de passe de l e-mail ou le code d autorisation.

   - **Nom** : `EMAIL_TO` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
   - **Secret (Valeur)** : L adresse e-mail du destinataire (plusieurs séparées par des virgules, ou peut être la même que `EMAIL_FROM` pour s envoyer à soi-même).

   - **Nom** : `EMAIL_SMTP_SERVER` (Optionnel, veuillez copier et coller ce nom).
   - **Secret (Valeur)** : L adresse du serveur SMTP (laisser vide pour la détection automatique).

   - **Nom** : `EMAIL_SMTP_PORT` (Optionnel, veuillez copier et coller ce nom).
   - **Secret (Valeur)** : Le port SMTP (laisser vide pour la détection automatique).

   **Note** : La notification par e-mail nécessite au moins **3 Secrets obligatoires** (`EMAIL_FROM`, `EMAIL_PASSWORD`, `EMAIL_TO`), les deux derniers sont optionnels.

   <br>

   **Fournisseurs de services de messagerie pris en charge** (configuration SMTP auto-détectée) :

   | Fournisseur | Domaine | Serveur SMTP | Port | Chiffrement |
   |-----------|--------|-------------|------|-----------|
   | **Gmail** | gmail.com | smtp.gmail.com | 587 | TLS |
   | **QQ Mail** | qq.com | smtp.qq.com | 465 | SSL |
   | **Outlook** | outlook.com | smtp-mail.outlook.com | 587 | TLS |
   | **Hotmail** | hotmail.com | smtp-mail.outlook.com | 587 | TLS |
   | **Live** | live.com | smtp-mail.outlook.com | 587 | TLS |
   | **163 Mail** | 163.com | smtp.163.com | 465 | SSL |
   | **126 Mail** | 126.com | smtp.126.com | 465 | SSL |
   | **Sina Mail** | sina.com | smtp.sina.com | 465 | SSL |
   | **Sohu Mail** | sohu.com | smtp.sohu.com | 465 | SSL |
   | **189 Mail** | 189.cn | smtp.189.cn | 465 | SSL |

   > **Auto-détection** : Lorsque vous utilisez les e-mails ci-dessus, il n est pas nécessaire de configurer manuellement `EMAIL_SMTP_SERVER` et `EMAIL_SMTP_PORT`, le système les détecte automatiquement.
   >
   > **Avis de retour** :
   > - Si vous réussissez à tester avec **d autres fournisseurs de messagerie**, veuillez ouvrir un [Issue](https://github.com/sansan0/TrendRadar/issues) pour nous en informer, nous l ajouterons à la liste des supports.
   > - Si les configurations d e-mail ci-dessus sont incorrectes ou inutilisables, veuillez également ouvrir un [Issue](https://github.com/sansan0/TrendRadar/issues) pour nous en informer afin d améliorer le projet.
   >
   > **Remerciements spéciaux** :
   > - Merci à [@DYZYD](https://github.com/DYZYD) pour avoir contribué à la configuration de 189 Mail (189.cn) et avoir effectué les tests d envoi/réception ([#291](https://github.com/sansan0/TrendRadar/issues/291)).

   **Paramètres d e-mail courants :**

   #### QQ Mail :
   1. Connectez-vous à la version web de QQ Mail → Paramètres → Compte.
   2. Activez le service POP3/SMTP.
   3. Générez un code d autorisation (code de 16 lettres).
   4. `EMAIL_PASSWORD` : Remplissez avec le code d autorisation, pas le mot de passe QQ.

   #### Gmail :
   1. Activez la vérification en deux étapes.
   2. Générez un mot de passe spécifique à l application.
   3. `EMAIL_PASSWORD` : Remplissez avec le mot de passe spécifique à l application.

   #### 163/126 Mail :
   1. Connectez-vous à la version web → Paramètres → POP3/SMTP/IMAP.
   2. Activez le service SMTP.
   3. Définissez le code d autorisation du client.
   4. `EMAIL_PASSWORD` : Remplissez avec le code d autorisation.
   <br>

   **Configuration avancée** :
   Si la détection automatique échoue, configurez manuellement le SMTP :
   - `EMAIL_SMTP_SERVER` : Par exemple `smtp.gmail.com`.
   - `EMAIL_SMTP_PORT` : Par exemple `587` (TLS) ou `465` (SSL).
   <br>

   **Plusieurs destinataires (note : séparés par des virgules en anglais)** :
   - EMAIL_TO="user1@example.com,user2@example.com,user3@example.com"

   </details>

   <details>
   <summary>👉 Cliquez pour déplier : <strong>Notification ntfy</strong> (Open source, gratuit, auto-hébergeable)</summary>
   <br>

   **Deux méthodes d utilisation :**

   ### Méthode 1 : Utilisation gratuite (recommandée pour les débutants) 🆓

   **Fonctionnalités** :
   - ✅ Pas d enregistrement de compte, utilisation immédiate.
   - ✅ 250 messages/jour (suffisant pour 90% des utilisateurs).
   - ✅ Le nom du sujet est le "mot de passe" (il faut choisir un nom difficile à deviner).
   - ⚠️ Messages non chiffrés, ne convient pas aux informations sensibles, mais convient à nos informations non sensibles du projet.

   **Démarrage rapide :**

   1. **Téléchargez l application ntfy** :
      - Android : [Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [F-Droid](https://f-droid.org/en/packages/io.heckel.ntfy/)
      - iOS : [App Store](https://apps.apple.com/us/app/ntfy/id1625396347)
      - Bureau : Visitez [ntfy.sh](https://ntfy.sh)

   2. **Abonnez-vous à un sujet** (choisissez un nom difficile à deviner) :
      ```
      Format suggéré : trendradar-{vos initiales}-{nombres aléatoires}
   
      Ne peut pas utiliser le chinois
      
      ✅ Bon exemple : trendradar-zs-8492
      ❌ Mauvais exemple : news, alerts (trop facile à deviner)
      ```

   3. **Configurez le Secret GitHub (⚠️ Le nom doit correspondre exactement)** :
      - **Nom** : `NTFY_TOPIC` (Veuillez copier et coller ce nom, ne pas le taper manuellement).
      - **Secret (Valeur)** : Remplissez le nom de votre sujet abonné.

      - **Nom** : `NTFY_SERVER_URL` (Optionnel, veuillez copier et coller ce nom).
      - **Secret (Valeur)** : Laissez vide (utilise ntfy.sh par défaut).

      - **Nom** : `NTFY_TOKEN` (Optionnel, veuillez copier et coller ce nom).
      - **Secret (Valeur)** : Laissez vide.

      **Note** : ntfy nécessite au moins 1 Secret obligatoire (`NTFY_TOPIC`), les deux derniers sont optionnels.

   4. **Test** :
      ```bash
      curl -d "Test message" ntfy.sh/votre-nom-de-sujet
      ```

   ---


   ### Méthode 2 : Auto-hébergement (Contrôle total de la vie privée) 🔒

   **Utilisateurs ciblés** : Possèdent un serveur, recherchent une confidentialité totale, ont de solides compétences techniques.

   **Avantages** :
   - ✅ Entièrement open source (Apache 2.0 + GPLv2).
   - ✅ Contrôle total des données.
   - ✅ Aucune restriction.
   - ✅ Zéro coût.

   **Déploiement Docker en un clic** :
   ```bash
   docker run -d \
     --name ntfy \
     -p 80:80 \
     -v /var/cache/ntfy:/var/cache/ntfy \
     binwiederhier/ntfy \
     serve --cache-file /var/cache/ntfy/cache.db
   ```

   **Configuration de TrendRadar** :
   ```yaml
   NTFY_SERVER_URL: https://ntfy.yourdomain.com
   NTFY_TOPIC: trendradar-alerts  # L auto-hébergement peut utiliser un nom simple
   NTFY_TOKEN: tk_your_token  # Optionnel : Activer le contrôle d accès
   ```

   **S abonner dans l application** :
   - Cliquez sur "Utiliser un autre serveur".
   - Entrez l adresse de votre serveur.
   - Entrez le nom du sujet.
   - (Optionnel) Entrez les identifiants de connexion.

   ---

   **FAQ :**

   <details>
   <summary><strong>Q1: La version gratuite est-elle suffisante ?</strong></summary>

   250 messages/jour suffisent à la plupart des utilisateurs. Avec des intervalles de 30 minutes, environ 48 notifications/jour, c est largement suffisant.
   </details>

   <details>
   <summary><strong>Q2: Le nom du sujet est-il vraiment sécurisé ?</strong></summary>

   Si vous choisissez un nom aléatoire et suffisamment long (comme `trendradar-zs-8492-news`), le craquage par force brute est presque impossible :
   - ntfy a une limitation de débit stricte (1 requête/seconde).
   - 64 choix de caractères (A-Z, a-z, 0-9, _, -).
   - 10 caractères aléatoires ont 64^10 possibilités (prendrait des années à craquer).
   </details>

   ---

   **Choix recommandé :**

   | Type d utilisateur | Recommandé | Raison |
   |---|-------------|--------|
   | Utilisateurs réguliers | Méthode 1 (Gratuit) | Simple, rapide, suffisant |
   | Utilisateurs techniques | Méthode 2 (Auto-hébergement) | Contrôle total, illimité |
   | Utilisateurs fréquents | Méthode 3 (Payant) | Consulter le site officiel |

   **Liens connexes :**
   - [Documentation officielle ntfy](https://docs.ntfy.sh/)
   - [Tutoriel d auto-hébergement](https://docs.ntfy.sh/install/)
   - [Dépôt GitHub](https://github.com/binwiederhier/ntfy)

   </details>

   > 💡 **Conseil de démarrage rapide pour les débutants** :
   >
   > Pour le premier déploiement, il est suggéré de compléter d abord la configuration des **GitHub Secrets** (choisissez une plateforme de notification), puis de passer à l [Étape 3](#-démarrage-rapide) pour tester le succès de la notification.
   >
   > **Ne modifiez pas temporairement** `config/config.yaml` et `frequency_words.txt`, ajustez ces configurations après que le test de notification ait réussi, si nécessaire.


3. **Test manuel des notifications d actualités** :

   > 💡 **Complétez d abord les étapes 1 et 2, puis testez immédiatement !** Testez avec succès d abord, puis ajustez la configuration (Étape 4) si nécessaire.
   >
   > ⚠️ **IMPORTANT : Entrez dans votre propre projet forké, pas dans ce projet !**

   **Comment trouver votre page Actions** :

   - **Méthode 1** : Ouvrez la page d accueil de votre projet forké, cliquez sur l onglet **Actions** en haut.
   - **Méthode 2** : Accès direct `https://github.com/VotreNomUtilisateur/TrendRadar/actions`.

   **Exemple de comparaison** :
   - ❌ Projet de l auteur : `https://github.com/sansan0/TrendRadar/actions`
   - ✅ Votre projet : `https://github.com/VotreNomUtilisateur/TrendRadar/actions`

   **Étapes de test** :
   1. Entrez dans la page Actions de votre projet.
   2. Trouvez **"Hot News Crawler"** et cliquez.
      - Si vous ne voyez pas ce texte, reportez-vous à [#109](https://github.com/sansan0/TrendRadar/issues/109) pour résoudre le problème.
   3. Cliquez sur le bouton **"Run workflow"** à droite pour exécuter.
   4. Attendez environ 1 minute, les messages seront notifiés sur votre plateforme configurée.

4. **Notes de configuration (Optionnel)** :

    > 💡 La configuration par défaut fonctionne normalement, ajustez la uniquement si vous avez besoin de personnalisation.

    - **Paramètres de notification** : Configurez le mode de notification et les options de notification dans [config/config.yaml](config/config.yaml) → [Détails des modes de notification](#3-détails-des-modes-de-notification).
    - **Paramètres des mots-clés** : Ajoutez vos mots-clés intéressants dans [config/frequency_words.txt](config/frequency_words.txt) → [Tutoriel de configuration des mots-clés](#2-tutoriel-de-configuration-des-mots-clés).
    - **Ajustement de la fréquence de notification** : Dans [.github/workflows/crawler.yml](.github/workflows/crawler.yml), ajustez soigneusement, ne soyez pas gourmand.

    **Note** : Il est suggéré de n ajuster que les éléments de configuration explicitement documentés, les autres options étant principalement destinées aux tests de développement de l auteur.

5. **🎉 Déploiement réussi ! Partagez votre expérience**

   Félicitations pour avoir terminé la configuration de TrendRadar ! Vous pouvez maintenant commencer à suivre les actualités tendances.

   💬 **Rejoignez notre communauté pour partager votre expérience ~**

   - Vous voulez en savoir plus sur les astuces et les techniques avancées ?
   - Besoin d une aide rapide pour les problèmes ?
   - Vous avez de bonnes idées à partager ?

   👉 **Suivez notre compte officiel WeChat「硅基茶水间」** (Salon de thé au silicium), vos "j aime" et vos commentaires sont le moteur d une mise à jour continue !

   Pour les méthodes de communication détaillées, veuillez consulter → [FAQ & Support](#-faq--support)

6. **🤖 Vous voulez une analyse plus intelligente ? Essayez les fonctionnalités améliorées par l IA** (Optionnel)

   La configuration de base répond déjà aux besoins quotidiens, mais si vous voulez :

   - 📊 Laisser l IA analyser automatiquement les sujets tendances et les aperçus de données.
   - 🔍 Rechercher et interroger des actualités en utilisant le langage naturel.
   - 💡 Obtenir des analyses de sentiments, des prévisions de sujets et des analyses approfondies.
   - ⚡ Accéder directement aux données dans les outils d IA comme Claude, Cursor, etc.

   👉 **En savoir plus** : [Analyse IA](#-analyse-ia) — Débloquez les capacités cachées du projet et rendez le suivi des tendances plus efficace !

<br>

<a name="guide-de-configuration"></a>

## ⚙️ Guide de configuration

> **📖 Rappel** : Ce chapitre fournit des explications détaillées sur la configuration. Il est suggéré de compléter d abord la configuration de base du [Démarrage rapide](#-démarrage-rapide), puis de vous référer aux options détaillées ici si nécessaire.

### 1. Configuration des plateformes

<details id="custom-monitoring-platforms">
<summary>👉 Cliquez pour déplier : <strong>Plateformes de surveillance personnalisées</strong></summary>
<br>

Les données d actualités de ce projet proviennent de [newsnow](https://github.com/ourongxing/newsnow). Vous pouvez cliquer sur le [site web](https://newsnow.busiyi.world/), cliquer sur [Plus], pour voir s il y a des plateformes que vous souhaitez.

Pour des ajouts spécifiques, visitez le [code source du projet](https://github.com/ourongxing/newsnow/tree/main/server/sources), basé sur les noms de fichiers, modifiez la configuration `platforms` dans le fichier `config/config.yaml` :

```yaml
platforms:
  - id: "toutiao"
    name: "Toutiao"
  - id: "baidu"
    name: "Recherche populaire Baidu"
  - id: "wallstreetcn-hot"
    name: "Wallstreetcn"
  # Ajouter plus de plateformes...
```
Si vous ne savez pas comment chercher, vous pouvez directement copier la [Configuration de plateforme](https://github.com/sansan0/TrendRadar/issues/95) partiellement organisée.

</details>

### 2. Configuration des mots-clés

Configurez les mots-clés de surveillance dans `frequency_words.txt` avec quatre types de syntaxe et des fonctionnalités de regroupement.

| Type de syntaxe | Symbole | Objectif | Exemple | Logique de correspondance |
|-----------------|---------|----------|---------|-------------------------|
| **Normal**      | Aucun   | Correspondance de base | `Huawei` | Correspondre à n importe lequel |
| **Requis**      | `+`     | Limitation du champ d application | `+téléphone` | Doit inclure les deux |
| **Filtre**      | `!`     | Exclusion du bruit | `!publicité` | Exclure si inclus |
| **Limite de comptage** | `@` | Contrôle du nombre d affichage | `@10` | Max 10 nouvelles (nouveau v3.2.0) |

#### 2.1 Syntaxe de base

<a name="syntaxe-de-base-des-mots-clés"></a>

<details>
<summary>👉 Cliquez pour déplier : <strong>Tutoriel de syntaxe de base</strong></summary>
<br>

##### 1. **Mots-clés normaux** - Correspondance de base
```txt
Huawei
OPPO
Apple
```
**Effet :** Les nouvelles contenant **n importe lequel** de ces mots seront capturées.

##### 2. **Mots requis** `+mot` - Limitation du champ d application
```txt
Huawei
OPPO
+téléphone
```
**Effet :** Doit inclure à la fois le mot normal **et** le mot requis pour être capturé.

##### 3. **Mots de filtre** `!mot` - Exclusion du bruit
```txt
Apple
Huawei
!fruit
!prix
```
**Effet :** Les nouvelles contenant des mots de filtre seront **exclues**, même si elles contiennent des mots-clés.

##### 4. **Limite de comptage** `@nombre` - Contrôle du nombre d affichage (nouveau v3.2.0)
```txt
Tesla
Musk
@5
```
**Effet :** Limite le nombre maximal de nouvelles pour ce groupe de mots-clés.

**Priorité :** `@nombre` > Configuration globale > Illimité

---

#### 🔗 Fonctionnalité de groupe - Importance des lignes vides

**Règle fondamentale :** Utilisez des **lignes vides** pour séparer différents groupes, chaque groupe est compté indépendamment.

##### Exemple de configuration :
```txt
iPhone
Huawei
OPPO
+lancement

Actions_A
Indice_Shanghai
Indice_Shenzhen
+fluctuation
!prédiction

Coupe_du_Monde
Coupe_d Europe
Coupe_dAsie
+match
```

##### Explication des groupes et effets de correspondance :

**Groupe 1 - Lancements de téléphones :**
- Mots-clés : iPhone, Huawei, OPPO
- Requis : lancement
- Effet : Doit inclure le nom de la marque de téléphone et "lancement".

**Exemples de correspondance :**
- ✅ "iPhone 15 officiellement lancé avec son prix" ← Contient "iPhone" + "lancement"
- ✅ "Diffusion en direct du lancement de la série Huawei Mate60" ← Contient "Huawei" + "lancement"
- ✅ "Date de lancement de l OPPO Find X7 confirmée" ← Contient "OPPO" + "lancement"
- ❌ "Les ventes d iPhone atteignent un record" ← Contient "iPhone" mais manque "lancement"

**Groupe 2 - Marché boursier :**
- Mots-clés : Actions_A, Indice_Shanghai, Indice_Shenzhen
- Requis : fluctuation
- Filtre : prédiction
- Effet : Inclut les mots liés aux actions et "fluctuation", mais exclut "prédiction".

**Exemples de correspondance :**
- ✅ "Analyse des fortes fluctuations des actions A aujourd hui" ← Contient "Actions_A" + "fluctuation"
- ✅ "Raisons des fluctuations de l indice de Shanghai expliquées" ← Contient "Indice_Shanghai" + "fluctuation"
- ❌ "Les experts prévoient les tendances des fluctuations des actions A" ← Contient "Actions_A" + "fluctuation" mais contient "prédiction"
- ❌ "Le volume de transactions des actions A atteint un nouveau sommet" ← Contient "Actions_A" mais manque "fluctuation"

**Groupe 3 - Événements de football :**
- Mots-clés : Coupe_du_Monde, Coupe_d Europe, Coupe_dAsie
- Requis : match
- Effet : Doit inclure le nom de la coupe et "match".

**Exemples de correspondance :**
- ✅ "Résultats des matchs de phase de groupes de la Coupe du Monde" ← Contient "Coupe_du_Monde" + "match"
- ✅ "Heure du match final de la Coupe d Europe" ← Contient "Coupe_d Europe" + "match"
- ❌ "Billets pour la Coupe du Monde en vente" ← Contient "Coupe_du_Monde" mais manque "match"

#### 🎯 Conseils de configuration

##### 1. **Stratégie du général au strict**
```txt
# Étape 1 : Commencez par des mots-clés généraux pour les tests
Intelligence Artificielle
IA
ChatGPT

# Étape 2 : Après avoir trouvé des non-correspondances, ajoutez des mots requis
Intelligence Artificielle
IA
ChatGPT
+technologie

# Étape 3 : Après avoir trouvé du bruit, ajoutez des mots de filtre
Intelligence Artificielle
IA
ChatGPT
+technologie
!publicité
!formation
```

##### 2. **Évitez la sur-complexité**
❌ **Non recommandé :** Trop de mots dans un seul groupe
```txt
Huawei
OPPO
Apple
Samsung
vivo
OnePlus
Meizu
+téléphone
+lancement
+ventes
!faux
!réparation
!occasion
```

✅ **Recommandé :** Divisez en groupes précis
```txt
Huawei
OPPO
+nouveau produit

Apple
Samsung
+lancement

téléphone
ventes
+marché
```

</details>

#### 2.2 Paramètres avancés (nouveau v3.2.0)

<a name="paramètres-avancés-des-mots-clés"></a>

<details>
<summary>👉 Cliquez pour déplier : <strong>Tutoriel des paramètres avancés</strong></summary>
<br>

##### Priorité de tri des mots-clés

**Emplacement de la configuration :** `config/config.yaml`

```yaml
report:
  sort_by_position_first: false  # Configuration de la priorité de tri
```

| Valeur | Règle de tri | Cas d utilisation |
|--------|--------------|-------------------|
| `false` (par défaut) | Nombre de nouvelles ↓ → Position de la configuration ↑ | Se concentrer sur les tendances de popularité |
| `true` | Position de la configuration ↑ → Nombre de nouvelles ↓ | Se concentrer sur la priorité personnelle |

**Exemple :** Ordre de configuration A, B, C, nombre de nouvelles A(3), B(10), C(5)
- `false` : B(10) → C(5) → A(3)
- `true` : A(3) → B(10) → C(5)

##### Limite globale du nombre d éléments affichés

```yaml
report:
  max_news_per_keyword: 10  # Max 10 par mot-clé (0=illimité)
```

**Variables d environnement Docker :**
```bash
SORT_BY_POSITION_FIRST=true
MAX_NEWS_PER_KEYWORD=10
```

**Exemple combiné :**
```yaml
# config.yaml
report:
  sort_by_position_first: true   # Priorité à l ordre de configuration
  max_news_per_keyword: 10       # Max 10 par mot-clé par défaut global
```

```txt
# frequency_words.txt
Tesla
Musk
@20              # Focus clé, afficher 20 (priorise le global)

Huawei           # Utiliser la configuration globale, afficher 10

BYD
@5               # Limite à 5
```

**Effet final :** Affichage dans l ordre de configuration : Tesla(20) → Huawei(10) → BYD(5)

</details>

### 3. Détails des modes de notification

<details>
<summary>👉 Cliquez pour déplier : <strong>Comparaison détaillée des trois modes de notification</strong></summary>
<br>

#### Tableau comparatif détaillé

| Mode | Utilisateurs ciblés | Moment de la notification | Contenu affiché | Cas d utilisation typique |
|------|--------------------|-------------------------|-----------------|---------------------------|
| **Résumé quotidien**<br/>`daily` | 📋 Managers/Utilisateurs réguliers | Notification planifiée (par défaut toutes les heures) | Toutes les actualités correspondantes du jour<br/>+ Section des nouvelles actualités | **Exemple** : Vérifier toutes les actualités importantes de la journée à 18h<br/>**Caractéristique** : Voir la tendance complète de la journée, ne manquer aucun sujet brûlant<br/>**Note** : Inclura les actualités précédemment notifiées |
| **Classements actuels**<br/>`current` | 📰 Créateurs de contenu | Notification planifiée (par défaut toutes les heures) | Correspondances des classements actuels<br/>+ Section des nouvelles actualités | **Exemple** : Suivre "quels sujets sont les plus chauds actuellement" toutes les heures<br/>**Caractéristique** : Compréhension en temps réel des changements de classement de popularité actuels<br/>**Note** : Les actualités continuellement classées apparaissent à chaque fois |
| **Surveillance incrémentale**<br/>`incremental` | 📈 Traders/Investisseurs | Notification uniquement lorsqu il y a du nouveau | Nouvelles correspondances de mots de fréquence apparues | **Exemple** : Surveiller "Tesla", ne notifier que lorsqu une nouvelle actualité apparaît<br/>**Caractéristique** : Zéro duplication, ne voir que les nouvelles actualités<br/>**Convient pour** : Surveillance haute fréquence, éviter la perturbation des informations |

#### Exemple d effet de notification réel

Supposons que vous surveillez le mot-clé "Apple", exécutez une fois par heure :

| Heure | Notification en mode quotidien | Notification en mode actuel | Notification en mode incrémental |
|-----|-----------------------------|---------------------------|---------------------------------|
| 10:00 | Actualité A, Actualité B    | Actualité A, Actualité B  | Actualité A, Actualité B        |
| 11:00 | Actualité A, Actualité B, Actualité C | Actualité B, Actualité C, Actualité D | **Uniquement** Actualité C    |
| 12:00 | Actualité A, Actualité B, Actualité C | Actualité C, Actualité D, Actualité E | **Uniquement** Actualité D, Actualité E |

**Explication** :
- `daily` : Affichage cumulatif de toutes les actualités du jour (A, B, C toutes conservées).
- `current` : Affichage des actualités du classement actuel (le classement a changé, Actualité D est apparue, Actualité A a disparu).
- `incremental` : **Ne notifie que les actualités nouvellement apparues** (évite les doublons).

#### Questions fréquentes

> 💡 **Vous avez rencontré ce problème ?** 👉 "Exécuter une fois par heure, les nouvelles générées lors de la première exécution apparaissent toujours lors de l exécution suivante."
> - **Raison** : Vous avez peut-être sélectionné le mode `daily` (Résumé quotidien) ou `current` (Classements actuels).
> - **Solution** : Passez en mode `incremental` (Surveillance incrémentale), pour ne notifier que le nouveau contenu.

#### ⚠️ Avis important sur le mode incrémental

> **Utilisateurs ayant sélectionné le mode `incremental` (Surveillance incrémentale), veuillez noter :**
>
> 📌 **Le mode incrémental ne notifie que lorsqu il y a de nouvelles actualités correspondantes.**
>
> **Si vous n avez pas reçu de notifications depuis longtemps, cela peut être dû à :**
> 1. Aucun nouveau sujet brûlant correspondant à vos mots-clés dans la période actuelle.
> 2. La configuration des mots-clés est trop stricte ou trop large.
> 3. Trop peu de plateformes de surveillance.
>
> **Solutions :**
> - Solution 1 : 👉 [Optimiser la configuration des mots-clés](#2-configuration-des-mots-clés) - Ajuster la précision des mots-clés, ajouter ou modifier les mots-clés de surveillance.
> - Solution 2 : Changer de mode de notification - Passer en mode `current` ou `daily` pour des notifications planifiées.
> - Solution 3 : 👉 [Ajouter plus de plateformes](#1-configuration-des-plateformes) - Ajouter plus de plateformes d actualités pour élargir les sources d information.

</details>

### 4. Configuration avancée - Ajustement de la pondération des points chauds

<details>
<summary>👉 Cliquez pour déplier : <strong>Ajustement de la pondération des points chauds</strong></summary>
<br>

La configuration actuelle par défaut est équilibrée.

#### Deux scénarios principaux

**Type de tendances en temps réel** :
```yaml
weight:
  rank_weight: 0.8    # Principalement basé sur le classement
  frequency_weight: 0.1  # Moins préoccupé par la continuité
  hotness_weight: 0.1
```
**Utilisateurs ciblés** : Créateurs de contenu, spécialistes du marketing, utilisateurs souhaitant comprendre rapidement les sujets chauds actuels.

**Type de sujet approfondi** :
```yaml
weight:
  rank_weight: 0.4    # Accent modéré sur le classement
  frequency_weight: 0.5  # Accent sur la chaleur soutenue au cours de la journée
  hotness_weight: 0.1
```
**Utilisateurs ciblés** : Investisseurs, chercheurs, journalistes, utilisateurs ayant besoin d une analyse approfondie des tendances.

#### Méthode d ajustement
1. **Les trois nombres doivent totaliser 1.0**.
2. **Augmentez ce qui est important** : Augmentez `rank_weight` pour les classements, `frequency_weight` pour la continuité.
3. **Suggérer d ajuster de 0.1 à 0.2 à la fois**, observez les effets.

Idée fondamentale : Les utilisateurs recherchant la rapidité et l actualité augmentent la pondération du classement, les utilisateurs recherchant la profondeur et la stabilité augmentent la pondération de la fréquence.

</details>

### 5. Référence du format de notification

<details>
<summary>👉 Cliquez pour déplier : <strong>Explication du format de notification</strong></summary>
<br>

#### Exemple de notification

📊 Statistiques des mots-clés tendances

🔥 [1/3] IA ChatGPT : 2 éléments

  1. [Baidu Hot] 🆕 Lancement officiel de ChatGPT-5 [**1**] - 09:15 (1 fois)

  2. [Toutiao] Les actions conceptuelles de puces IA montent en flèche [**3**] - [08:30 ~ 10:45] (3 fois)

━━━━━━━━━━━━━━━━━━━

📈 [2/3] BYD Tesla : 2 éléments

  1. [Weibo] 🆕 Les ventes mensuelles de BYD battent un record [**2**] - 10:20 (1 fois)

  2. [Douyin] Promotion de réduction de prix Tesla [**4**] - [07:45 ~ 09:15] (2 fois)

━━━━━━━━━━━━━━━━━━━

📌 [3/3] Actions A Marché boursier : 1 élément

  1. [Wallstreetcn] Examen de mi-journée des actions A [**5**] - [11:30 ~ 12:00] (2 fois)

🆕 Nouvelles actualités tendances (Total 2 éléments)

**Baidu Hot** (1 élément) :
  1. Lancement officiel de ChatGPT-5 [**1**]

**Weibo** (1 élément) :
  1. Les ventes mensuelles de BYD battent un record [**2**]

Mise à jour : 2025-01-15 12:30:15

#### Explication du format des messages

| Élément de format | Exemple | Signification | Description |
|-----------------|---------|--------------|-------------|
| 🔥📈📌          | 🔥 [1/3] IA ChatGPT | Niveau de popularité | 🔥 Élevé (≥10) 📈 Moyen (5-9) 📌 Normal (<5) |
| [Numéro/Total]  | [1/3]   | Position de classement | Classement du groupe actuel parmi tous les correspondances |
| Groupe de mots-clés | IA ChatGPT | Groupe de mots-clés | Groupe de la configuration, le titre doit contenir les mots |
| : N éléments   | : 2 éléments | Nombre de correspondances | Nombre total de nouvelles correspondant à ce groupe |
| [Plateforme]    | [Baidu Hot] | Plateforme source | Nom de la plateforme de la nouvelle |
| 🆕              | 🆕 Lancement officiel de ChatGPT-5 | Marque Nouvelle | Première apparition de la nouvelle dans ce tour |
| [**nombre**]    | [**1**] | Classement élevé | Classement ≤ seuil, affichage en gras rouge |
| [nombre]        | [7]     | Classement normal | Classement > seuil, affichage normal |
| - heure         | - 09:15 | Première heure | Heure à laquelle la nouvelle a été découverte pour la première fois |
| [heure~heure]   | [08:30 ~ 10:45] | Durée | Plage horaire de la première à la dernière apparition |
| (N fois)        | (3 fois) | Fréquence | Nombre total d apparitions pendant la surveillance |
| **Nouvelle Section** | 🆕 **Nouvelles actualités tendances** | Résumé du nouveau sujet | Affiche séparément les nouveaux sujets brûlants apparus |

</details>


### 6. Déploiement Docker

<details>
<summary>👉 Cliquez pour déplier : <strong>Guide complet de déploiement Docker</strong></summary>
<br>

#### Méthode 1 : Expérience rapide (commande unique)

**Systèmes Linux/macOS :**
```bash
# Créez le répertoire de configuration et téléchargez les fichiers de configuration
mkdir -p config output
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
```
Ou **Création manuelle** :
1. Créez un dossier `config` dans le répertoire actuel.
2. Téléchargez les fichiers de configuration :
   - Visitez https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml → Clic droit "Enregistrer sous" → Enregistrer dans `config\config.yaml`.
   - Visitez https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt → Clic droit "Enregistrer sous" → Enregistrer dans `config\frequency_words.txt`.

La structure du répertoire final devrait être :
```
répertoire_actuel/
└── config/
    ├── config.yaml
    └── frequency_words.txt
```

```bash
docker run -d --name trend-radar \
  -v ./config:/app/config:ro \
  -v ./output:/app/output \
  -e FEISHU_WEBHOOK_URL="votre webhook feishu" \
  -e DINGTALK_WEBHOOK_URL="votre webhook dingtalk" \
  -e WEWORK_WEBHOOK_URL="votre webhook wework" \
  -e TELEGRAM_BOT_TOKEN="votre token de bot telegram" \
  -e TELEGRAM_CHAT_ID="votre chat_id telegram" \
  -e EMAIL_FROM="votre e-mail d expéditeur" \
  -e EMAIL_PASSWORD="votre mot de passe ou code d autorisation d e-mail" \
  -e EMAIL_TO="e-mail du destinataire" \
  -e CRON_SCHEDULE="*/30 * * * *" \
  -e RUN_MODE="cron" \
  -e IMMEDIATE_RUN="true" \
  wantcat/trendradar:latest
```

#### Méthode 2 : Utilisation de docker-compose (recommandée)

1. **Créez le répertoire du projet et la configuration** :
   ```bash
   # Créez la structure du répertoire
   mkdir -p trendradar/{config,docker}
   cd trendradar

   # Téléchargez les modèles de fichiers de configuration
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/

   # Téléchargez la configuration docker-compose
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/.env
   wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/docker-compose.yml
   ```

La structure du répertoire final devrait être :
```
répertoire_actuel/
├── config/
│   ├── config.yaml
│   └── frequency_words.txt
└── docker/
    ├── .env
    └── docker-compose.yml
```

2. **Description du fichier de configuration** :
   - `config/config.yaml` - Configuration principale de l application (mode de rapport, paramètres de notification, etc.).
   - `config/frequency_words.txt` - Configuration des mots-clés (définissez vos mots-clés tendance intéressants).
   - `.env` - Configuration des variables d environnement (URL des webhooks et tâches planifiées).

   **⚙️ Mécanisme de surcharge des variables d environnement (v3.0.5+)**

   Si vous rencontrez des problèmes où les **modifications de `config.yaml` ne prennent pas effet** dans les environnements NAS ou Docker, vous pouvez directement surcharger les configurations via des variables d environnement :

   | Variable d environnement | Configuration correspondante | Exemple de valeur | Description |
   |-------------------------|------------------------------|-------------------|-------------|
   | `ENABLE_CRAWLER`        | `crawler.enable_crawler`     | `true` / `false`  | Activer le crawler |
   | `ENABLE_NOTIFICATION`   | `notification.enable_notification` | `true` / `false`  | Activer les notifications |
   | `REPORT_MODE`           | `report.mode`                | `daily` / `incremental` / `current`| Mode de rapport |
   | `PUSH_WINDOW_ENABLED`   | `notification.push_window.enabled` | `true` / `false`  | Commutateur de fenêtre de temps de notification |
   | `PUSH_WINDOW_START`     | `notification.push_window.time_range.start` | `08:00`           | Heure de début de notification |
   | `PUSH_WINDOW_END`       | `notification.push_window.time_range.end` | `22:00`           | Heure de fin de notification |
   | `FEISHU_WEBHOOK_URL`    | `notification.webhooks.feishu_url` | `https://...`     | Webhook Feishu |

   **Priorité de configuration** : Variables d environnement > config.yaml

   **Méthode d utilisation** :
   - Modifiez le fichier `.env`, décommentez et remplissez les configurations nécessaires.
   - Ou ajoutez directement dans l interface de gestion Docker de NAS/Synology via "Variables d environnement".
   - Redémarrez le conteneur pour que les modifications prennent effet : `docker-compose restart`.


3. **Démarrer le service** :
   ```bash
   # Téléchargez la dernière image et démarrez
   docker-compose pull
   docker-compose up -d
   ```

4. **Vérifier l état de fonctionnement** :
   ```bash
   # Afficher les logs
   docker logs -f trend-radar

   # Afficher l état du conteneur
   docker ps | grep trend-radar
   ```

#### Méthode 3 : Construction locale (Option développeur)

Si vous avez besoin de modifications de code personnalisées ou de construire votre propre image :

```bash
# Clonez le projet
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# Modifiez les fichiers de configuration
vim config/config.yaml
vim config/frequency_words.txt

# Utilisez la version de construction docker-compose
cd docker
cp docker-compose-build.yml docker-compose.yml

# Construisez et démarrez
docker-compose build
docker-compose up -d
```

#### Mise à jour de l image

```bash
# Méthode 1 : Mise à jour manuelle
docker pull wantcat/trendradar:latest
docker-compose down
docker-compose up -d

# Méthode 2 : Utilisation de docker-compose pour la mise à jour
docker-compose pull
docker-compose up -d
```

#### Commandes de gestion de service

```bash
# Vérifier l état de fonctionnement
docker exec -it trend-radar python manage.py status

# Exécuter manuellement le crawler une fois
docker exec -it trend-radar python manage.py run

# Afficher les logs en temps réel
docker exec -it trend-radar python manage.py logs

# Afficher la configuration actuelle
docker exec -it trend-radar python manage.py config

# Afficher les fichiers de sortie
docker exec -it trend-radar python manage.py files

# Afficher l aide
docker exec -it trend-radar python manage.py help

# Redémarrer le conteneur
docker restart trend-radar

# Arrêter le conteneur
docker stop trend-radar

# Supprimer le conteneur (conserve les données)
docker rm trend-radar
```

#### Persistance des données

Les rapports et données générés sont enregistrés par défaut dans le répertoire `./output`. Les données persistent même si le conteneur est redémarré ou supprimé.

#### Dépannage

```bash
# Vérifier l état du conteneur
docker inspect trend-radar

# Afficher les logs du conteneur
docker logs --tail 100 trend-radar

# Entrer dans le conteneur pour le débogage
docker exec -it trend-radar /bin/bash

# Vérifier les fichiers de configuration
docker exec -it trend-radar ls -la /app/config/
```

</details>

<br>

## 🤖 Analyse intelligente par IA

TrendRadar v3.0.0 a ajouté la fonctionnalité d analyse IA basée sur le **protocole MCP (Model Context Protocol)**, vous permettant des conversations en langage naturel avec les données d actualités pour une analyse approfondie.


### ⚠️ Avis important avant utilisation


**Critique : Les fonctionnalités IA nécessitent un support de données d actualités locales.**

L analyse IA **ne récupère pas** directement les données en ligne en temps réel, mais analyse les **données d actualités accumulées localement** (stockées dans le dossier `output`).


#### Instructions d utilisation :

1. **Données de test intégrées** : Le répertoire `output` inclut par défaut les données d actualités du **1er au 15 novembre 2025** pour un test rapide de la fonctionnalité IA.

2. **Limites de la requête** :
   - ✅ Interrogez uniquement les données dans la plage de dates disponible (1er-15 nov.).
   - ❌ Impossible d interroger les actualités en temps réel ou les dates futures.

3. **Obtention des dernières données** :
   - Les données de test sont uniquement destinées à une expérience rapide, **il est recommandé de déployer le projet vous-même** pour obtenir des données en temps réel.
   - Suivez le [Démarrage rapide](#-démarrage-rapide) pour déployer et exécuter le projet.
   - Après avoir accumulé des données d actualités pendant au moins 1 jour, vous pouvez interroger les dernières tendances.

---


### 1. Déploiement rapide

Cherry Studio fournit une interface de configuration GUI, un déploiement rapide en 5 minutes, les parties complexes sont installées en un clic.

**Tutoriel de déploiement illustré** : Maintenant mis à jour sur mon compte officiel WeChat (voir [FAQ & Support](#-faq--support)), répondez "mcp" pour l obtenir.

**Tutoriel de déploiement détaillé** : [README-Cherry-Studio.md](README-Cherry-Studio.md)

### 2. Apprendre à converser avec l IA

**Tutoriel de conversation détaillé** : [README-MCP-FAQ.md](README-MCP-FAQ.md)

**Effet de question** :

<details>
<summary>👉 Cliquez pour déplier : <strong>Voir l exemple de conversation IA</strong></summary>
<br>

> 💡 **Conseil** : Il n est en fait pas recommandé de poser plusieurs questions à la fois. Si votre modèle d IA choisi ne peut même pas appeler séquentiellement comme indiqué ci-dessous, il est suggéré de changer de modèle.

<img src="/_image/ai3.png" alt="Effet d utilisation MCP" width="600">

</details>

<br>


## 🔌 Clients MCP

Le service MCP de TrendRadar prend en charge le protocole MCP (Model Context Protocol) standard, peut se connecter à divers clients IA prenant en charge MCP pour une analyse intelligente.

### Clients pris en charge

**Note** :
- Remplacez `/path/to/TrendRadar` par le chemin réel de votre projet.
- Les chemins Windows utilisent des doubles barres obliques inverses : `C:\Users\YourName\TrendRadar`.
- N oubliez pas de redémarrer après la sauvegarde.

<details>
<summary><b>👉 Cliquez pour déplier : Claude Desktop</b></summary>

#### Méthode du fichier de configuration

Modifiez le fichier de configuration MCP de Claude Desktop :

**Windows** :
`%APPDATA%\Claude\claude_desktop_config.json`

**Mac** :
`~/Library/Application Support/Claude/claude_desktop_config.json`

**Contenu de la configuration** :
```json
{
  "mcpServers": {
    "trendradar": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/TrendRadar",
        "run",
        "python",
        "-m",
        "mcp_server.server"
      ],
      "env": {},
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

</details>

<details>
<summary><b>👉 Cliquez pour déplier : Cursor</b></summary>

#### Méthode 1 : Mode HTTP

1. **Démarrez le service HTTP** :
   ```bash
   # Windows
   start-http.bat

   # Mac/Linux
   ./start-http.sh
   ```

2. **Configurez Cursor** :

   **Configuration au niveau du projet** (Recommandé) :
   Créez `.cursor/mcp.json` à la racine du projet :
   ```json
   {
     "mcpServers": {
       "trendradar": {
         "url": "http://localhost:3333/mcp",
         "description": "Analyse de l agrégation des tendances d actualités TrendRadar"
       }
     }
   }
   ```

   **Configuration globale** :
   Créez `~/.cursor/mcp.json` dans le répertoire utilisateur (même contenu).

3. **Étapes d utilisation** :
   - Redémarrez Cursor après avoir enregistré la configuration.
   - Vérifiez les outils connectés dans l interface de discussion "Outils disponibles".
   - Commencez à utiliser : `Rechercher les actualités d aujourd hui sur "IA"`.

#### Méthode 2 : Mode STDIO (Recommandé)

Créez `.cursor/mcp.json` :
```json
{
  "mcpServers": {
    "trendradar": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/TrendRadar",
        "run",
        "python",
        "-m",
        "mcp_server.server"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>👉 Cliquez pour déplier : VSCode (Cline/Continue)</b></summary>

#### Configuration de Cline

Ajoutez dans les paramètres MCP de Cline :

**Mode HTTP** :
```json
{
  "trendradar": {
    "url": "http://localhost:3333/mcp",
    "type": "streamableHttp",
    "autoApprove": [],
    "disabled": false
  }
}
```

**Mode STDIO** (Recommandé) :
```json
{
  "trendradar": {
    "command": "uv",
    "args": [
      "--directory",
      "/path/to/TrendRadar",
      "run",
      "python",
      "-m",
      "mcp_server.server"
    ],
    "type": "stdio",
    "disabled": false
  }
}
```

#### Configuration Continue

Modifiez `~/.continue/config.json` :
```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uv",
          "args": [
            "--directory",
            "/path/to/TrendRadar",
            "run",
            "python",
            "-m",
            "mcp_server.server"
          ]
        }
      }
    ]
  }
}
```

**Exemples d utilisation** :
```
Analyser la tendance de popularité de "Tesla" des 7 derniers jours.
Générer un rapport de synthèse des tendances d aujourd hui.
```

```
