import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const repository = "Annan-lyn/fudan-exam-paper";
const aliases = [
  [/数学分析/, ["数分", "math analysis"]],
  [/线性代数/, ["线代", "linear algebra"]],
  [/高等数学/, ["高数", "calculus"]],
  [/计算机系统基础/, ["ICS", "计基"]],
  [/面向对象程序设计/, ["OOP", "面向对象"]],
  [/程序设计/, ["程设"]],
  [/数据结构/, ["DS", "data structures"]],
  [/大学物理/, ["大物"]],
  [/概率论/, ["概率", "probability"]],
  [/离散数学/, ["离散"]],
  [/马克思主义基本原理/, ["马原"]],
  [/军事理论/, ["军理"]],
  [/数据库/, ["DB", "database"]],
  [/操作系统/, ["OS"]],
  [/人工智能/, ["AI"]],
];
export function parseFile(entry, sha, sourceRepository = repository) {
  const parts = entry.path.split("/");
  if (
    entry.type !== "blob" ||
    parts.length < 3 ||
    ["web", ".github"].includes(parts[0]) ||
    parts.some((p) => p.startsWith("."))
  )
    return null;
  const folder = parts[0],
    divider = folder.indexOf("-");
  const area = divider < 0 ? "其他" : folder.slice(0, divider);
  const course = divider < 0 ? folder : folder.slice(divider + 1);
  const teacherFolder = parts[1];
  const teacher = teacherFolder.includes("_")
    ? teacherFolder.slice(teacherFolder.indexOf("_") + 1)
    : teacherFolder;
  const filename = parts.at(-1),
    ext = filename.includes(".")
      ? filename.split(".").pop().toUpperCase()
      : "FILE";
  const metadataName = filename.replace(/密码[：:_\s]*[^\s.（）()]+/gi, "");
  const isHash = /^[a-f0-9]{16,}\.[a-z]+$/i.test(filename);
  let years = isHash
    ? []
    : [
        ...metadataName.matchAll(/(?<![a-z0-9])(?:19|20)\d{2}(?![a-z0-9])/gi),
      ].map((m) => m[0]);
  if (!years.length && !isHash) {
    const short = metadataName.match(
      /(?:^|[^\d])([0-2]\d)(?=[春秋年]|[-_～~][0-2]\d(?:\D|$))/,
    );
    if (short) years = [String(2000 + Number(short[1]))];
  }
  let stage = /期中|半期|midterm/i.test(metadataName)
    ? "期中"
    : /期末|final/i.test(metadataName)
      ? "期末"
      : /阶段/.test(metadataName)
        ? "阶段考"
        : "未注明";
  if (
    /期中|半期|midterm/i.test(metadataName) &&
    /期末|final/i.test(metadataName)
  )
    stage = "期中及期末";
  const password =
    filename.match(/密码[：:_\s]*([^\s.（）()]+)(?=\.|$|[（）()])/i)?.[1] || "";
  const answer = /答案|解答|讲评|solution|answer/i.test(metadataName);
  const recall = /回忆/.test(filename);
  const guessed = /\[猜\]|【猜】/.test(entry.path);
  const encoded = entry.path.split("/").map(encodeURIComponent).join("/");
  return {
    id: entry.path,
    path: entry.path,
    filename,
    course,
    courseId: folder,
    area,
    teacher,
    teacherAlias: teacherFolder.split("_")[0],
    aliases: aliases.filter(([re]) => re.test(course)).flatMap(([, v]) => v),
    ext,
    years,
    year: years[0] || "",
    stage,
    password,
    answer,
    recall,
    guessed,
    size: entry.size || 0,
    url: `https://github.com/${sourceRepository}/blob/${sha}/${encoded}`,
    rawUrl: `https://raw.githubusercontent.com/${sourceRepository}/${sha}/${encoded}`,
  };
}
export function buildData(tree) {
  if (tree.truncated || !tree.sha || !Array.isArray(tree.tree))
    throw new Error("需要完整的 Git tree，不能使用截断的索引。");
  const sourceRepository = tree.repository || repository;
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(sourceRepository) ||
    !/^[a-f0-9]{40}$/.test(tree.sha)
  )
    throw new Error("仓库名或提交 SHA 无效");
  const files = tree.tree
    .map((e) => parseFile(e, tree.sha, sourceRepository))
    .filter(Boolean);
  if (!files.length || new Set(files.map((f) => f.id)).size !== files.length)
    throw new Error("索引为空或含重复路径");
  const map = new Map();
  for (const f of files) {
    if (!map.has(f.courseId))
      map.set(f.courseId, {
        id: f.courseId,
        name: f.course,
        area: f.area,
        aliases: f.aliases,
        count: 0,
        teachers: new Set(),
      });
    const c = map.get(f.courseId);
    c.count++;
    c.teachers.add(f.teacher);
  }
  const courses = [...map.values()].map((c) => ({
    ...c,
    teachers: [...c.teachers],
  }));
  return {
    repository: sourceRepository,
    sha: tree.sha,
    generatedAt: new Date().toISOString(),
    files,
    courses,
    stats: {
      files: files.length,
      courses: courses.length,
      teachers: new Set(
        files
          .map((f) => f.teacher)
          .filter((t) => !["统考", "佚名"].includes(t)),
      ).size,
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const input = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, "data/tree.json");
  const data = buildData(JSON.parse(fs.readFileSync(input, "utf8")));
  fs.writeFileSync(path.join(root, "data/catalog.json"), JSON.stringify(data));
  console.log(
    `已索引 ${data.stats.courses} 门课程、${data.stats.files} 个文件，快照 ${data.sha.slice(0, 7)}`,
  );
}
