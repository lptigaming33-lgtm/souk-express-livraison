# SOUK EXPRESS — Agadir, Morocco (Progressive Web App)

Application web progressive (**PWA Android & Mobile-First**) complète et déployable pour **SOUK EXPRESS**, service de livraison par flotte de **4 motos à Agadir, Maroc** (Devise : **MAD**, Paiement **Cash à la livraison - COD**, Français **LTR** + Arabe **RTL**).

---

## 1. Sécurité — données de démonstration

Les comptes de démonstration utilisent des identifiants fictifs et un mot de passe commun. **Ne les utilisez jamais en production.** Le seed automatique et le changement de rôle de démonstration sont désactivés en production.

Pour activer les données fictives en local uniquement, définissez `SEED_DEMO_DATA=true` dans `.env` avant de lancer l'application. N'activez jamais cette option sur un hébergement public. Pour une première mise en production, créez un compte administrateur sécurisé via une procédure de provisioning dédiée et créez vos vrais commerces et livreurs; ne réutilisez aucun compte de démonstration. Les mots de passe sont stockés avec un hash scrypt salé; les anciennes empreintes HMAC ne sont pas compatibles et doivent être réinitialisées si vous avez déjà créé des comptes avec une version antérieure.

## 2. Installation & Lancement Local (Étape par Étape pour Débutant)

### Prérequis
- **Node.js 22.18+** installé sur votre ordinateur (requis aussi pour les tests).
- Une base de données **PostgreSQL** locale ou un projet gratuit sur **Supabase** (`https://supabase.com`).

### Étapes exactes
1. **Copier le fichier d'environnement** :
   ```bash
   cp .env.example .env
   ```
   Remplacez `DATABASE_URL` dans `.env` par l'URL PostgreSQL de votre base locale ou Supabase, et définissez dans `AUTH_SECRET` une valeur aléatoire forte d'au moins 32 caractères.

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Créer les tables dans PostgreSQL** (seule méthode supportée) :
   ```bash
   npm run db:migrate
   ```
   Cette commande applique `supabase/migrations/*.sql` dans l'ordre (tables, contraintes CHECK, RLS, durcissement). **N'utilisez pas `drizzle-kit push`** : il ignore les contraintes CHECK et les politiques RLS.

4. **Créer le premier compte administrateur réel** (uniquement après création des tables). Définissez `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 caractères minimum), `ADMIN_NAME` et `ADMIN_PHONE` dans votre environnement, puis exécutez `npm run create-admin`. Le script refuse de créer un nouvel administrateur si un compte admin existe déjà. N'utilisez pas de compte de démonstration en production.
   Pour chaque vrai livreur : définissez `DRIVER_EMAIL`, `DRIVER_PASSWORD` (12+), `DRIVER_NAME`, `DRIVER_PHONE`, `DRIVER_CODE` (ex. `MOTO-01`), `DRIVER_PLATE`, puis `npm run create-driver`. Les zones de livraison se créent ensuite depuis le tableau de bord Admin, et les commerçants s'inscrivent puis sont approuvés par l'Admin.

5. **Lancer les tests automatisés (Auth, Permissions, Totaux MAD, Statuts, COD)** :
   ```bash
   npm test
   ```
   Les tests exécutent le vrai code de `src/lib/business-logic.ts`. Le test de base de données ne tourne que si `TEST_DATABASE_URL` pointe vers une base de test déjà migrée (jamais votre base de production).
   ```bash
   npm run typecheck && npm run lint && npm run build
   ```

6. **Pour charger des données fictives en local (facultatif)**, définissez `SEED_DEMO_DATA=true` dans `.env`, puis lancez :
   ```bash
   npm run dev
   ```
   Ouvrez `http://localhost:3000`. Les données de démonstration ne sont jamais créées automatiquement en production.

---

## 3. Déploiement Gratuit (Budget 0 MAD)

1. **Base de données (Supabase Free Tier — 0 MAD)** :
   - Créez un compte gratuit sur [supabase.com](https://supabase.com) et créez un nouveau projet (ex: `souk-express-agadir`).
   - Allez dans **Project Settings → Database → Connection string (URI)** et copiez l'URL de connexion PostgreSQL.
   - Dans **Project Settings → Database → SSL Configuration**, téléchargez le certificat CA et placez son contenu dans la variable `DATABASE_CA_CERT`.
   - Depuis votre ordinateur, avec `DATABASE_URL` (et `DATABASE_CA_CERT`) définis, lancez `npm run db:migrate` (applique `0001` puis `0002`). Vous pouvez aussi coller ces deux fichiers, dans l'ordre, dans le **SQL Editor**.

2. **Hébergement Web & HTTPS (Vercel Hobby Tier — 0 MAD)** :
   - Poussez ce code sur un dépôt GitHub privé.
   - Connectez votre compte GitHub sur [vercel.com](https://vercel.com) et importez le projet.
   - Dans **Environment Variables** sur Vercel, ajoutez :
     - `DATABASE_URL` = votre URL PostgreSQL Supabase
     - `DATABASE_CA_CERT` = certificat CA Supabase (PEM)
     - `AUTH_SECRET` = une clé aléatoire forte d'au moins 32 caractères
     - `SEED_DEMO_DATA` = `false` (ne jamais activer les données de démonstration en production)
   - Cliquez sur **Deploy**. Vercel fournit automatiquement une URL **HTTPS sécurisée** (`https://souk-express.vercel.app`) indispensable pour l'installation PWA Android.

---

## 4. Domaine, HTTPS, Installation PWA sur Android & Sauvegardes

### Installer la PWA sur un téléphone Android
1. Ouvrez l'URL HTTPS de votre application dans **Google Chrome** sur Android.
2. Appuyez sur le bouton **« Installer l'App Android »** en haut de l'écran ou sur le menu **⋮ (3 points)** de Chrome en haut à droite.
3. Appuyez sur **« Installer l'application »** ou **« Ajouter à l'écran d'accueil »**.
4. L'application **SOUK EXPRESS** s'installe avec son icône orange et noire et s'ouvre en plein écran comme une application native.
5. **Sécurité du cache PWA** : Le Service Worker (`public/sw.js`) exclut strictement toutes les routes `/api/*`, `/admin`, `/driver` et `/partner`. Aucune donnée privée ni commande n'est stockée dans un cache partagé.
6. **Note sur les notifications Push** : Les notifications push navigateur ne sont pas activées par défaut tant que vous n'avez pas configuré de clés VAPID. En phase de lancement à 0 MAD, utilisez les liens directs WhatsApp intégrés.

### Sauvegardes (Backups) à 0 MAD
- **Export CSV quotidien** : Connectez-vous en tant qu'**Admin** et cliquez sur **« Exporter CSV Commandes »** chaque soir pour conserver une archive complète sur votre ordinateur ou Google Drive.
- **Dump PostgreSQL** :
  ```bash
  pg_dump "$DATABASE_URL" > backup_souk_express_$(date +%F).sql
  ```

---

## 5. Checklist des Fonctionnalités, Tâches Futures & Coûts

### Fonctionnalités implémentées (à vérifier dans votre environnement de déploiement)
- [x] **4 Rôles sécurisés** : Client, Livreur Moto (Flotte de 4 motos à Agadir), Commerçant Partenaire, Administrateur.
- [x] **Bilingue Français (LTR) + Arabe (RTL)** avec vocabulaire adapté au Maroc et aux quartiers d'Agadir (Talborjt, Souk El Had, Hay Dakhla, Hay Salam, Founty, Hay Mohammadi, Tilila, Anza).
- [x] **Calcul serveur strict en MAD** : Le serveur recalcule toujours les prix depuis PostgreSQL, applique les frais de livraison du quartier, les codes promo et la commission Souk Express.
- [x] **Snapshots immuables** : `order_items` sauvegarde le nom FR/AR et le prix unitaire en MAD au moment de l'achat pour que les changements de prix futurs ne modifient jamais les anciennes commandes.
- [x] **Anti-doublon (Idempotence)** : Clé d'idempotence unique empêchant les doubles validations de panier.
- [x] **Cycle de commande complet** : `pending` → `accepted` → `preparing` → `assigned` → `picked_up` → `on_the_way` → `delivered` (+ `rejected` / `cancelled`).
- [x] **Console Livreur Moto** : Statut En ligne/Hors ligne, affichage exclusif des commandes assignées, itinéraires Google Maps en 1 clic (Retrait & Livraison), encaissement Cash COD et suivi des gains.
- [x] **Portail Partenaire** : Approbation obligatoire par l'Admin, gestion des produits/prix/ruptures de stock, acceptation/refus des commandes.
- [x] **Dashboard Admin** : Assignation manuelle aux 4 livreurs, réconciliation du Cash COD, configuration des frais par quartier d'Agadir, gestion des commissions, carte fidélité 10 tampons et export CSV.

### Tâches Optionnelles pour la Phase 2 (Post-Lancement)
- [ ] Intégration du paiement par carte bancaire marocaine (CMI / Payzone) une fois le volume de commandes stabilisé.
- [ ] Configuration de clés VAPID pour notifications push Web en arrière-plan.
- [ ] Suivi GPS temps réel automatisé (remplaçant les liens Google Maps gratuits actuels).

### Coûts Attendus au Lancement
- **Hébergement App (Vercel Hobby)** : **0 MAD / mois**
- **Base de données PostgreSQL (Supabase Free Tier)** : **0 MAD / mois**
- **Cartographie & Navigation (Liens Google Maps Standard)** : **0 MAD / mois**
- **Support Client & Notifications (Liens WhatsApp Direct)** : **0 MAD / mois**
- **Nom de domaine `.ma` ou `.com` (Optionnel)** : ~120 à 200 MAD / an (gratuit si vous utilisez le sous-domaine `.vercel.app` au démarrage).
