import { initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

// El Admin SDK NO evalúa las reglas de firestore.rules: acá adentro se
// puede todo. Por eso cada acción valida quién la pide y con qué datos,
// antes de tocar nada.
initializeApp();

export const db = getFirestore();
export { FieldPath, FieldValue };
