// Firestore "lite" para la tienda: alcanza para leer el catálogo de una y
// pesa bastante menos que el SDK completo, que trae tiempo real, caché
// offline y reintentos que acá no hacen falta.

import { connectFirestoreEmulator, getFirestore } from "firebase/firestore/lite";
import { app, EMULADOR, usandoEmuladores } from "./app";

export const dbPublico = getFirestore(app);

if (usandoEmuladores) connectFirestoreEmulator(dbPublico, EMULADOR.host, EMULADOR.firestore);
