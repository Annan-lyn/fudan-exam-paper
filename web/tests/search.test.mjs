import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildData, parseFile, root } from "../scripts/build-data.mjs";
import { searchScore, filterFiles } from "../assets/search.mjs";
const tree = JSON.parse(
  fs.readFileSync(path.join(root, "data/tree.json"), "utf8"),
);
const data = buildData(tree);
test("完整快照只索引真实文件，每个文件有唯一标识和固定版本链接", () => {
  assert.equal(
    data.files.length,
    tree.tree.filter(
      (e) =>
        e.type === "blob" &&
        e.path.split("/").length >= 3 &&
        !["web", ".github"].includes(e.path.split("/")[0]) &&
        !e.path.split("/").some((p) => p.startsWith(".")),
    ).length,
  );
  assert.equal(new Set(data.files.map((f) => f.id)).size, data.files.length);
  for (const f of data.files) {
    assert.ok(
      f.url.startsWith(
        `https://github.com/${data.repository}/blob/${data.sha}/`,
      ),
    );
    assert.equal(
      decodeURIComponent(new URL(f.url).pathname.split("/").slice(5).join("/")),
      f.path,
    );
  }
  assert.throws(() => buildData({ ...tree, truncated: true }));
  assert.equal(
    parseFile({ path: "web/assets/app.js", type: "blob" }, tree.sha),
    null,
  );
});
test("ICS 只匹配对应课程，不会误命中 physics 或 ethics", () => {
  const hits = data.files.filter((f) => searchScore(f, "ICS"));
  assert.ok(hits.length > 0);
  assert.ok(hits.every((f) => /计算机系统基础/.test(f.course)));
  assert.equal(
    searchScore(
      {
        course: "其他课程",
        aliases: [],
        teacher: "",
        filename: "physics ethics.pdf",
      },
      "ICS",
    ),
    0,
  );
});
test("常见简称及老师姓名能命中真实课程和试卷", () => {
  for (const [query, name] of [
    ["数分", "数学分析"],
    ["线代", "线性代数"],
    ["高数", "高等数学"],
  ]) {
    const hits = data.files.filter((f) => searchScore(f, query));
    assert.ok(hits.length > 0);
    assert.ok(hits.some((f) => f.course.includes(name)));
  }
  const sample = data.files.find((f) => f.teacher === "王全瑞");
  assert.ok(sample);
  assert.ok(searchScore(sample, "王全瑞"));
  assert.ok(searchScore(sample, "wqr"));
});
test("保留推测归属、密码、答案及未知年份", () => {
  const f = parseFile(
    {
      path: "数学-线性代数/fh_冯辉/[猜]线代_2022_Final_答案_密码abc123.pdf",
      type: "blob",
      size: 800,
    },
    tree.sha,
  );
  assert.equal(f.teacher, "冯辉");
  assert.equal(f.guessed, true);
  assert.equal(f.password, "abc123");
  assert.equal(f.answer, true);
  assert.equal(f.stage, "期末");
  assert.deepEqual(f.years, ["2022"]);
  const unknown = parseFile(
    { path: "其他-测试/佚名/期末卷.pdf", type: "blob" },
    tree.sha,
  );
  assert.equal(unknown.year, "");
  assert.equal(unknown.teacher, "佚名");
  const short = parseFile(
    { path: "数学-数学分析/统考/23秋期中.pdf", type: "blob" },
    tree.sha,
  );
  assert.equal(short.year, "2023");
});
test("组合筛选及收藏仅返回符合条件的文件", () => {
  const sample = data.files.find((f) => f.ext === "PDF" && f.year && f.answer);
  const state = {
    q: "",
    course: sample.courseId,
    teacher: sample.teacher,
    year: sample.year,
    ext: "PDF",
    answer: true,
  };
  const result = filterFiles(data.files, state);
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (f) =>
        f.courseId === sample.courseId &&
        f.teacher === sample.teacher &&
        f.years.includes(sample.year) &&
        f.answer &&
        f.ext === "PDF",
    ),
  );
  assert.deepEqual(
    filterFiles(data.files, { view: "saved" }, [sample.id]).map((f) => f.id),
    [sample.id],
  );
  assert.ok(filterFiles(data.files, { exact: true }).every((f) => !f.guessed));
});
test("课程计数与索引一致，未知年份不伪造", () => {
  assert.equal(
    data.courses.reduce((n, c) => n + c.count, 0),
    data.files.length,
  );
  for (const c of data.courses)
    assert.equal(c.count, data.files.filter((f) => f.courseId === c.id).length);
  assert.ok(data.files.some((f) => f.year === ""));
  assert.ok(
    filterFiles(data.files, { year: "2022" }).every((f) =>
      f.years.includes("2022"),
    ),
  );
});

test("哈希文件名和 PDF 密码里的数字不当作年份", () => {
  for (const filename of [
    "d44f1913f1f8588f4baf811991434dc.jpg",
    "大物B下期中 密码2022midterm.pdf",
  ]) {
    const f = parseFile(
      { path: "数学-测试/佚名/" + filename, type: "blob" },
      tree.sha,
    );
    assert.deepEqual(f.years, []);
  }
});

test("期中与期末筛选均保留合并试卷", () => {
  const f = data.files.find((f) => f.stage === "期中及期末");
  assert.ok(f);
  for (const stage of ["期中", "期末"])
    assert.ok(filterFiles(data.files, { stage }).some((x) => x.id === f.id));
});

test("Fork 快照使用自身仓库的提交链接，拒绝不完整或重复索引", () => {
  const fork = buildData({ ...tree, repository: "example/fudan-exam-paper" });
  assert.ok(
    fork.files.every((f) =>
      f.url.startsWith("https://github.com/example/fudan-exam-paper/blob/"),
    ),
  );
  assert.throws(() => buildData({ ...tree, sha: "main" }));
  assert.throws(() => buildData({ ...tree, tree: [] }));
  const entry = tree.tree.find(
    (e) => e.type === "blob" && e.path.split("/").length >= 3,
  );
  assert.throws(() => buildData({ ...tree, tree: [entry, entry] }));
  const f = parseFile(
    { path: "数学-测试/佚名/试卷_密码answer2022.pdf", type: "blob" },
    tree.sha,
  );
  assert.equal(f.answer, false);
  assert.deepEqual(f.years, []);
});
