# lib/supabase

Les trois clients Supabase de l'application (cahier des charges, section 9) :

- `client.ts` : client **navigateur** (clé publique). À utiliser uniquement dans les composants client.
- `server.ts` : client **serveur** avec la session de l'utilisateur (cookies via `@supabase/ssr`). Composants serveur, Server Actions, route handlers. Soumis à la RLS.
- `admin.ts` : client **administrateur** (clé secrète `SUPABASE_SERVICE_ROLE_KEY`). Contourne la RLS. Réservé aux tâches planifiées (`/api/cron/*`) et aux webhooks de paiement. Protégé par `import "server-only"` : ne jamais l'importer côté client ni dans une page qui sert un utilisateur.
