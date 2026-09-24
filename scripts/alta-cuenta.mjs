// Da de alta (o de baja) una cuenta del equipo en el panel.
//
// Hace falta porque las fichas staff/{uid} no se pueden escribir desde el
// navegador: firestore.rules no tiene regla de escritura para nadie, a
// propósito. En los emuladores las crea npm run sembrar; en producción no
// había forma de crear la PRIMERA cuenta, y sin ella nadie podía entrar.
//
//   npm run cuenta -- --email mariano@gmail.com --nombre "Mariano" --rol admin
//   npm run cuenta -- --email programador@gmail.com --nombre "Alex" --rol programador
//   npm run cuenta -- --email ex@gmail.com --baja
//   npm run cuenta -- --email mariano@gmail.com --nueva-clave
//
// La contraseña nunca pasa por la terminal ni por quien corre esto: la
// cuenta se crea con una clave al azar que nadie conoce, y el script imprime
// un link para que la persona elija la suya. Así no queda en el historial
// de la terminal, ni en un chat, ni en la cabeza de nadie más.
//
// Conexión y credenciales: ver scripts/admin-sdk.mjs.

import { randomBytes } from "node:crypto";
import { ROLES } from "../functions/src/permisos.js";
import { argumento, bandera, conectar, explicarError, salir } from "./admin-sdk.mjs";

const email = argumento("email")?.trim().toLowerCase();
const nombre = argumento("nombre")?.trim();
const rol = argumento("rol");
const baja = bandera("baja");
const nuevaClave = bandera("nueva-clave");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  salir("Falta un --email válido.\nEj.: npm run cuenta -- --email mariano@gmail.com --nombre Mariano --rol admin");
}
if (!baja && !nuevaClave) {
  if (!nombre) salir("Falta --nombre: es como la cuenta aparece en el panel y en el historial.");
  if (!ROLES.includes(rol)) salir(`--rol tiene que ser uno de: ${ROLES.join(", ")}.`);
}

const accion = baja ? `Dar de BAJA a ${email}` : nuevaClave ? `Nuevo link de contraseña para ${email}` : `Dar de alta a ${email} como ${rol}`;

try {
  const { auth, db, emulador } = await conectar(accion);

  let usuario = await auth.getUserByEmail(email).catch((err) => {
    if (err.code === "auth/user-not-found") return null;
    throw err;
  });

  if ((baja || nuevaClave) && !usuario) salir(`No existe ninguna cuenta con ${email}.`);

  if (baja) {
    // No se borra: la ficha queda para el historial de operaciones. Con
    // activo: false el panel le cierra la sesión en el momento, y revocar
    // los tokens corta también cualquier llamada al servidor en curso.
    await db.collection("staff").doc(usuario.uid).set({ activo: false }, { merge: true });
    await auth.revokeRefreshTokens(usuario.uid);
    console.log(`✓ ${email} dada de baja. Si tenía el panel abierto, se le cerró la sesión.`);
    process.exit(0);
  }

  let creada = false;
  if (!usuario) {
    // Clave al azar que nadie conoce: la cuenta queda con acceso por email
    // y contraseña (quien.js exige ese método), pero la contraseña real la
    // elige la persona con el link de abajo.
    usuario = await auth.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      displayName: nombre,
      emailVerified: false,
    });
    creada = true;
  }

  if (!nuevaClave) {
    // merge: si la ficha ya existía con otros campos, no se pierden.
    await db.collection("staff").doc(usuario.uid).set({ rol, nombre, email, activo: true }, { merge: true });
    if (!creada) await auth.updateUser(usuario.uid, { displayName: nombre });
  }

  console.log(
    creada
      ? `✓ Cuenta creada: ${email} → ${rol}`
      : nuevaClave
        ? `✓ ${email} ya existe; se generó un link nuevo`
        : `✓ ${email} ya existía: ahora es ${rol} y está activa`,
  );

  if (creada || nuevaClave) {
    const link = await auth.generatePasswordResetLink(email);
    console.log(
      `\nMandale este link a ${nombre ?? usuario.displayName ?? email} por un canal privado.` +
        "\nCon él elige su contraseña, y después entra en /admin/login:\n\n" +
        `  ${link}\n\n` +
        "Vence al rato. Si caduca, generá otro con: npm run cuenta -- --email " +
        `${email} --nueva-clave`,
    );
    if (emulador) console.log("\n(Es un link del emulador: solo funciona en esta máquina.)");
  }
  process.exit(0);
} catch (err) {
  salir(`✗ ${explicarError(err)}`);
}
