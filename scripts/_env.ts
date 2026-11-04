import { config } from "dotenv";
// Charge .env.local puis .env (sans écraser les variables déjà définies).
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
