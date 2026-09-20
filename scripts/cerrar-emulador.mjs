// Cierra los emuladores de Firebase POR PUERTO, sin tocar otros procesos
// java o node de la máquina.
//
// En Windows, `firebase emulators:exec` a veces deja el java de Firestore
// escuchando después de terminar, y el siguiente arranque falla con "port
// taken".
//
//   node scripts/cerrar-emulador.mjs

import { execSync } from "node:child_process";

const PUERTOS = [8519, 8520, 8521, 8522, 8523];

const pidsEnPuerto = (puerto) => {
  try {
    const salida = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
    return [
      ...new Set(
        salida
          .split("\n")
          .filter((l) => l.includes("LISTENING") && new RegExp(`[:.]${puerto}\\s`).test(l))
          .map((l) => l.trim().split(/\s+/).pop())
          .filter((pid) => pid && pid !== "0"),
      ),
    ];
  } catch {
    return [];
  }
};

let cerrados = 0;
for (const puerto of PUERTOS) {
  for (const pid of pidsEnPuerto(puerto)) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`puerto ${puerto}: cerrado el proceso ${pid}`);
      cerrados++;
    } catch {
      console.warn(`puerto ${puerto}: no se pudo cerrar el proceso ${pid}`);
    }
  }
}
console.log(cerrados ? `${cerrados} proceso(s) cerrado(s).` : "No había emuladores escuchando.");
