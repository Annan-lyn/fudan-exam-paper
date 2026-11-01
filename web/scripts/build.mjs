import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { root } from "./build-data.mjs";
fs.mkdirSync(path.join(root, "dist/assets"), { recursive: true });
fs.mkdirSync(path.join(root, "dist/data"), { recursive: true });
const version = createHash("sha256")
  .update(
    ["styles.css", "app.js", "search.mjs"]
      .map((n) => fs.readFileSync(path.join(root, "assets", n), "utf8"))
      .join(""),
  )
  .digest("hex")
  .slice(0, 12);
fs.writeFileSync(
  path.join(root, "dist/index.html"),
  fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .replace("./assets/styles.css", `./assets/styles.css?v=${version}`)
    .replace("./assets/app.js", `./assets/app.js?v=${version}`),
);
for (const name of ["styles.css", "app.js", "search.mjs"])
  fs.copyFileSync(
    path.join(root, "assets", name),
    path.join(root, "dist/assets", name),
  );
const appPath = path.join(root, "dist/assets/app.js");
fs.writeFileSync(
  appPath,
  fs
    .readFileSync(appPath, "utf8")
    .replace("./search.mjs", `./search.mjs?v=${version}`),
);
fs.copyFileSync(
  path.join(root, "data/catalog.json"),
  path.join(root, "dist/data/catalog.json"),
);
console.log(
  "静态网站已生成到 dist/，不依赖外部字体、图片或浏览器 GitHub API。",
);
