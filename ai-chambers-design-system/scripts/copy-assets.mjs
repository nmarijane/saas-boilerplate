import fs from "node:fs";
fs.mkdirSync("dist/assets", { recursive: true });
fs.copyFileSync(
  "assets/logo-dark-original.png",
  "dist/assets/logo-dark-original.png",
);
