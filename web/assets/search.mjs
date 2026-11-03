export const normalize = (s) =>
  String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_—–-]+/g, " ")
    .trim();
const hasTerm = (value, term) =>
  /^[a-z0-9]+$/.test(term)
    ? new RegExp(`(^|[^a-z0-9])${term}($|[^a-z0-9])`, "i").test(value)
    : value.includes(term);
export function searchScore(file, query) {
  const q = normalize(query);
  if (!q) return 1;
  const exact = [file.course, ...file.aliases].some((a) => normalize(a) === q);
  if (exact) return 100;
  const text = normalize(
    [
      file.course,
      file.teacher,
      file.teacherAlias,
      file.filename,
      ...file.aliases,
    ].join(" "),
  );
  const terms = q.split(" ");
  if (!terms.every((t) => hasTerm(text, t))) return 0;
  return normalize(file.course).includes(q)
    ? 80
    : normalize(file.teacher) === q
      ? 70
      : 10;
}
export function filterFiles(files, state, saved = []) {
  return files
    .filter(
      (f) =>
        (!state.q || searchScore(f, state.q)) &&
        (!state.course || f.courseId === state.course) &&
        (!state.area || f.area === state.area) &&
        (!state.teacher || f.teacher === state.teacher) &&
        (!state.year || f.years.includes(state.year)) &&
        (!state.stage ||
          f.stage === state.stage ||
          (["期中", "期末"].includes(state.stage) &&
            f.stage === "期中及期末")) &&
        (!state.ext || f.ext === state.ext) &&
        (!state.answer || f.answer) &&
        (!state.exact || !f.guessed) &&
        (state.view !== "saved" || saved.includes(f.id)),
    )
    .sort((a, b) =>
      state.sort === "name"
        ? a.filename.localeCompare(b.filename, "zh-CN")
        : searchScore(b, state.q) - searchScore(a, state.q) ||
          Number(b.year || 0) - Number(a.year || 0) ||
          a.filename.localeCompare(b.filename, "zh-CN"),
    );
}
