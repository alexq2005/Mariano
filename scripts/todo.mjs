// Levanta TODO para probar, con un solo comando:
//
//   npm run todo
//
// los emuladores (Firestore, Auth y Functions), los simulados de Mercado
// Pago y ARCA, los datos de ejemplo y la tienda con el panel. Es lo que
// arranca solo en GitHub Codespaces (.devcontainer/devcontainer.json).
// Ctrl+C lo apaga todo.

import { spawn } from "node:child_process";

const enWindows = process.platform === "win32";
const hijos = [];
const correr = (comando, args) => {
  const hijo = spawn(comando, args, { stdio: "inherit", shell: enWindows });
  hijos.push(hijo);
  return hijo;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const apagar = () => {
  for (const h of hijos) h.kill();
  process.exit(0);
};
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);

correr("node", ["scripts/emuladores.mjs"]);

// Listo cuando las funciones contestan (la primera vez tarda: baja el
// emulador de Firestore).
const FN = "http://127.0.0.1:8522/demo-aurora/us-central1/tienda";
process.stdout.write("\nEsperando a los emuladores");
for (let i = 0; ; i++) {
  try {
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { accion: "hola" } }) });
    if ((await r.json()).error) break;
  } catch {
    /* todavía no */
  }
  if (i > 300) {
    console.error("\nLos emuladores no arrancaron en 10 minutos. Mirá los mensajes de arriba.");
    apagar();
  }
  await esperar(2000);
}

await new Promise((listo) => correr("node", ["scripts/sembrar-emulador.mjs"]).on("exit", listo));
correr("npx", ["vite"]);

const enCodespaces = process.env.CODESPACES === "true";
setTimeout(() => {
  console.log(`
────────────────────────────────────────────────────────────
  Listo. ${enCodespaces ? "Abrí la pestaña «Puertos» y tocá el globo del 8518 (Tienda y panel)." : "Abrí http://localhost:8518"}
  Panel: /admin — admin@aurora.test o programador@aurora.test, clave aurora123
  Mercado Pago simulado: /__mp/__simular · ARCA simulado: /__arca/__simular
  Para apagar: Ctrl+C
────────────────────────────────────────────────────────────`);
}, 3000);
