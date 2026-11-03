import { searchScore, filterFiles } from "./search.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const attr = esc;
const defaults = {
  q: "",
  view: "all",
  area: "",
  course: "",
  teacher: "",
  year: "",
  stage: "",
  ext: "",
  answer: false,
  exact: false,
  sort: "newest",
  page: 1,
};
const filterKeys = [
  "area",
  "course",
  "teacher",
  "year",
  "stage",
  "ext",
  "answer",
  "exact",
];
const labels = {
  q: "搜索",
  area: "学科",
  course: "课程",
  teacher: "老师",
  year: "年份",
  stage: "类型",
  ext: "格式",
  answer: "含答案 / 解答",
  exact: "隐藏推测归属",
};
const pageSize = 20;
let data,
  byId,
  state = readState(),
  timer,
  toastTimer,
  detailId,
  composing = false;
function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
let saved = readStore("danjuan:saved", []),
  recent = readStore("danjuan:recent", []);
if (!Array.isArray(saved)) saved = [];
if (!Array.isArray(recent)) recent = [];
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function readState() {
  const p = new URLSearchParams(location.search),
    s = { ...defaults };
  for (const k of Object.keys(s)) {
    if (p.has(k)) s[k] = p.get(k);
  }
  s.page = Math.max(1, parseInt(s.page) || 1);
  s.answer = s.answer === true || s.answer === "1";
  s.exact = s.exact === true || s.exact === "1";
  if (!["all", "courses", "saved"].includes(s.view)) s.view = "all";
  if (!["newest", "name"].includes(s.sort)) s.sort = "newest";
  return s;
}
function urlFor() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state))
    if (v !== defaults[k] && v !== "" && v !== false)
      p.set(k, v === true ? "1" : String(v));
  return location.pathname + (p.size ? "?" + p : "");
}
function update(changes, { replace = false, scroll = false } = {}) {
  clearTimeout(timer);
  state = { ...state, page: 1, ...changes };
  render();
  history[replace ? "replaceState" : "pushState"]({}, "", urlFor());
  if (scroll) $("results").scrollIntoView({ behavior: "instant" });
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2200);
}
function prettySize(n) {
  return n >= 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : n >= 1024
      ? Math.round(n / 1024) + " KB"
      : n + " B";
}
function teacherText(f) {
  return f.teacher === "佚名"
    ? "老师未注明"
    : f.teacher === "统考"
      ? "全校统考"
      : f.teacher;
}
function options(id, values, value, placeholder) {
  const select = $(id);
  select.replaceChildren(new Option(placeholder, ""));
  for (const item of values)
    select.add(new Option(item.name ?? item, item.id ?? item));
  if (value && !values.some((v) => (v.id ?? v) === value))
    select.add(new Option(value, value));
  select.value = value;
}
const unique = (items) =>
  [...new Set(items)].sort((a, b) => a.localeCompare(b, "zh-CN"));
function renderFilters() {
  options(
    "area",
    unique(data.files.map((f) => f.area)),
    state.area,
    "全部学科",
  );
  const courses = data.courses
    .filter((c) => !state.area || c.area === state.area)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  options(
    "course",
    courses.map((c) => ({ id: c.id, name: c.name })),
    state.course,
    "全部课程",
  );
  const candidates = data.files.filter(
    (f) =>
      (!state.area || f.area === state.area) &&
      (!state.course || f.courseId === state.course),
  );
  options(
    "teacher",
    unique(candidates.map((f) => f.teacher)),
    state.teacher,
    "全部老师 / 统考 / 佚名",
  );
  options(
    "year",
    unique(candidates.flatMap((f) => f.years))
      .sort()
      .reverse(),
    state.year,
    "全部年份",
  );
  options(
    "stage",
    unique(
      candidates.flatMap((f) =>
        f.stage === "期中及期末" ? ["期中", "期末", "期中及期末"] : [f.stage],
      ),
    ),
    state.stage,
    "全部类型",
  );
  options("ext", unique(candidates.map((f) => f.ext)), state.ext, "全部格式");
  $("query").value = state.q;
  $("answer").checked = state.answer;
  $("exact").checked = state.exact;
  $("sort").value = state.sort;
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
    b.setAttribute(
      "aria-current",
      b.dataset.view === state.view ? "page" : "false",
    );
  });
  const count = filterKeys.filter((k) => state[k]).length;
  $("filter-count").textContent = count || "";
  $("chips").innerHTML = ["q", ...filterKeys]
    .filter((k) => state[k])
    .map(
      (k) =>
        `<button data-remove="${k}">${esc(labels[k])}${typeof state[k] === "boolean" ? "" : ": " + esc(k === "course" ? data.courses.find((c) => c.id === state[k])?.name || state[k] : state[k])} <span aria-hidden="true">×</span><span class="sr-only">，移除此条件</span></button>`,
    )
    .join("");
  $("saved-count").textContent = saved.filter((id) => byId.has(id)).length;
}
function tags(f) {
  return `${f.stage !== "未注明" ? `<span class="tag">${esc(f.stage)}</span>` : ""}${f.answer ? '<span class="tag">含答案 / 解答</span>' : ""}${f.recall ? '<span class="tag neutral">考后回忆</span>' : ""}${f.guessed ? '<span class="tag warm">老师为推测</span>' : ""}${f.password ? `<span class="tag warm">密码：${esc(f.password)}</span>` : ""}`;
}
function card(f) {
  const image = ["PNG", "JPG", "JPEG"].includes(f.ext);
  return `<article class="paper-card"><div class="file-icon ${image ? "image" : f.ext !== "PDF" ? "other" : ""}" aria-hidden="true">${esc(f.ext)}</div><div><h3><a href="${attr(f.url)}" data-open="${attr(f.id)}" target="_blank" rel="noopener noreferrer">${esc(f.filename)}</a></h3><div class="paper-meta"><button data-course="${attr(f.courseId)}" aria-label="查看${attr(f.course)}全部文件">${esc(f.course)}</button><span>·</span><span>${esc(teacherText(f))}</span><span>·</span><span>${f.year ? esc(f.years.join(" / ")) : "年份未注明"}</span><span>· ${prettySize(f.size)}</span></div><div class="paper-tags">${tags(f)}</div></div><div class="card-actions-wrap"><div class="card-actions"><button class="save ${saved.includes(f.id) ? "selected" : ""}" data-save="${attr(f.id)}" aria-label="${saved.includes(f.id) ? "取消收藏" : "收藏"}：${attr(f.filename)}" aria-pressed="${saved.includes(f.id)}">${saved.includes(f.id) ? "★" : "☆"}</button><a class="open-file" href="${attr(f.url)}" data-open="${attr(f.id)}" target="_blank" rel="noopener noreferrer">打开文件 ↗</a></div><button class="details-link" data-detail="${attr(f.id)}">查看来源详情</button></div></article>`;
}
function render() {
  if (!data) return;
  renderFilters();
  const files = filterFiles(data.files, state, saved);
  $("results-title").firstChild.textContent =
    state.view === "saved"
      ? "我的收藏 "
      : state.view === "courses"
        ? "课程目录 "
        : state.course
          ? (data.courses.find((c) => c.id === state.course)?.name ||
              "查找结果") + " "
          : state.q
            ? "查找结果 "
            : "全部试卷 ";
  let items = files;
  if (state.view === "courses") {
    const ids = new Set(files.map((f) => f.courseId));
    const rank = new Map();
    files.forEach((f, index) => {
      if (!rank.has(f.courseId)) rank.set(f.courseId, index);
    });
    items = data.courses
      .filter((c) => ids.has(c.id))
      .sort((a, b) =>
        state.sort === "name"
          ? a.name.localeCompare(b.name, "zh-CN")
          : rank.get(a.id) - rank.get(b.id),
      );
  }
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  state.page = Math.min(state.page, pages);
  $("result-count").textContent =
    `${items.length.toLocaleString()} ${state.view === "courses" ? "门课程" : "个文件"}`;
  $("status").textContent =
    state.view === "saved"
      ? "收藏保存在本机浏览器，清除浏览器数据后会移除。"
      : state.view === "courses"
        ? "按课程进入，再按任课老师筛选。"
        : "索引来自原仓库 · 点击前往 GitHub 原文件页 · 图片按张计数";
  const visible = items.slice(
    (state.page - 1) * pageSize,
    state.page * pageSize,
  );
  if (!items.length) {
    $("list").innerHTML =
      `<div class="empty"><span aria-hidden="true">⌕</span><h3>${state.view === "saved" && !saved.length ? "还没有收藏的试卷" : "暂时没有匹配的文件"}</h3><p>${state.view === "saved" && !saved.length ? "点击试卷旁的星标，把之后要复习的文件放在这里。" : "可以试试课程简称、老师姓名，或移除部分筛选。没有年份的文件不会出现在年份筛选结果里。"}</p><button id="empty-reset">${state.view === "saved" && !saved.length ? "去找试卷" : "清空筛选"}</button></div>`;
  } else if (state.view === "courses") {
    $("list").innerHTML =
      `<div class="course-grid">${visible.map((c) => `<button class="course-card" data-course="${attr(c.id)}"><small>${esc(c.area)}</small><h3>${esc(c.name)} ↗</h3><small>${c.count} 个文件 · ${c.teachers.length} 类老师归属</small></button>`).join("")}</div>`;
  } else $("list").innerHTML = visible.map(card).join("");
  $("pagination").innerHTML = items.length
    ? `<button data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>← 上一页</button><span>第 ${state.page} / ${pages} 页</span><button data-page="${state.page + 1}" ${state.page === pages ? "disabled" : ""}>下一页 →</button>`
    : "";
  const matching =
    state.q && !state.course && state.view !== "courses"
      ? data.courses
          .map((c) => ({
            c,
            score: searchScore(
              {
                course: c.name,
                aliases: c.aliases,
                teacher: "",
                teacherAlias: "",
                filename: "",
              },
              state.q,
            ),
          }))
          .filter(
            ({ c, score }) => score && (!state.area || c.area === state.area),
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
      : [];
  $("course-matches").innerHTML = matching
    .map(
      ({ c }) =>
        `<button class="course-suggestion" data-course="${attr(c.id)}">${esc(c.name)} →<small>直接查看课程 · ${c.count} 个文件 · ${c.teachers.length} 类老师归属</small></button>`,
    )
    .join("");
  renderRecent();
}
function renderRecent() {
  const recentFiles = recent
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, 3);
  $("recent").hidden =
    !recentFiles.length ||
    state.view !== "all" ||
    Boolean(state.q || state.course);
  $("recent").innerHTML =
    `<span>最近打开</span>${recentFiles.map((f) => `<a href="${attr(f.url)}" data-open="${attr(f.id)}" target="_blank" rel="noopener noreferrer">${esc(f.filename)}</a>`).join("")}`;
}
function suggestions() {
  const q = $("query").value.trim();
  const matches = q
    ? data.courses
        .map((c) => ({
          c,
          score: searchScore(
            {
              course: c.name,
              aliases: c.aliases,
              teacher: "",
              teacherAlias: "",
              filename: "",
            },
            q,
          ),
        }))
        .filter((x) => x.score)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    : [];
  $("suggestions").innerHTML = matches
    .map(
      ({ c }) =>
        `<button type="button" data-course="${attr(c.id)}"><span>${esc(c.name)}</span><small>${c.count} 个文件</small></button>`,
    )
    .join("");
  $("suggestions").hidden = !matches.length;
  $("query").setAttribute("aria-expanded", String(Boolean(matches.length)));
}
function hideSuggestions() {
  $("suggestions").hidden = true;
  $("query").setAttribute("aria-expanded", "false");
}
function openCourse(id) {
  clearTimeout(timer);
  hideSuggestions();
  update(
    {
      ...defaults,
      course: id,
      area: data.courses.find((c) => c.id === id)?.area || "",
    },
    { scroll: true },
  );
}
function showDetail(id) {
  const f = byId.get(id);
  if (!f) return;
  detailId = id;
  const course = data.courses.find((c) => c.id === f.courseId);
  $("detail-content").innerHTML =
    `<h2>${esc(f.filename)}</h2><div class="paper-tags">${tags(f)}</div><dl><dt>课程</dt><dd>${esc(course.name)} · ${esc(f.area)}</dd><dt>老师归属</dt><dd>${esc(teacherText(f))}${f.guessed ? "（仓库标注为推测，不能视为已确认）" : ""}</dd><dt>年份</dt><dd>${esc(f.years.join(" / ") || "文件名未注明")}</dd><dt>考试类型</dt><dd>${esc(f.stage)}</dd><dt>文件</dt><dd>${esc(f.ext)} · ${prettySize(f.size)}</dd>${f.password ? `<dt>PDF 密码</dt><dd>${esc(f.password)}</dd>` : ""}</dl><p class="detail-path">${esc(f.path)}</p><p class="detail-note">年份、考试类型与答案标记按文件名识别，可能存在遗漏；请以原文件内容为准。文件链接固定到索引对应的提交版本，避免更新后路径发生变化。</p><div class="detail-buttons"><a class="primary" href="${attr(f.url)}" data-open="${attr(f.id)}" target="_blank" rel="noopener noreferrer">到 GitHub 查看 ↗</a><a class="open-file" href="${attr(f.rawUrl)}" data-open="${attr(f.id)}" target="_blank" rel="noopener noreferrer">打开原始文件 ↗</a><button class="open-file" id="copy-link">复制链接</button></div>`;
  $("detail").showModal();
}
function bind() {
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (composing) return;
    clearTimeout(timer);
    hideSuggestions();
    update({ ...defaults, q: $("query").value.trim() }, { scroll: true });
  });
  function onQueryInput() {
    clearTimeout(timer);
    if (composing) return;
    suggestions();
    const q = $("query").value.trim();
    timer = setTimeout(() => {
      update({ ...defaults, q }, { replace: true });
    }, 250);
  }
  $("query").addEventListener("compositionstart", () => {
    composing = true;
    clearTimeout(timer);
    hideSuggestions();
  });
  $("query").addEventListener("compositionend", () => {
    composing = false;
    onQueryInput();
  });
  $("query").addEventListener("input", onQueryInput);
  $("query").addEventListener("keydown", (e) => {
    if (e.isComposing || composing) return;
    if (e.key === "Escape") hideSuggestions();
    if (e.key === "ArrowDown" && !$("suggestions").hidden) {
      e.preventDefault();
      $("suggestions").querySelector("button")?.focus();
    }
  });
  $("suggestions").addEventListener("keydown", (e) => {
    const buttons = [...$("suggestions").querySelectorAll("button")],
      i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (e.key === "ArrowUp" && i === 0) $("query").focus();
      else
        buttons[
          Math.max(
            0,
            Math.min(buttons.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
          )
        ]?.focus();
    }
    if (e.key === "Escape") {
      hideSuggestions();
      $("query").focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-form")) hideSuggestions();
  });
  for (const k of filterKeys)
    $(k).addEventListener("change", () => {
      const changes = {
        [k]: typeof defaults[k] === "boolean" ? $(k).checked : $(k).value,
      };
      if (k === "area")
        Object.assign(changes, {
          course: "",
          teacher: "",
          year: "",
          stage: "",
          ext: "",
        });
      if (k === "course")
        Object.assign(changes, {
          q: "",
          teacher: "",
          year: "",
          stage: "",
          ext: "",
        });
      update(changes);
    });
  $("sort").addEventListener("change", () => update({ sort: $("sort").value }));
  $("reset").addEventListener("click", () =>
    update({ ...defaults, view: state.view }),
  );
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,a");
    if (!b) return;
    if (b.dataset.view) {
      clearTimeout(timer);
      hideSuggestions();
      update({ ...defaults, view: b.dataset.view }, { scroll: true });
    }
    if (b.dataset.query) {
      clearTimeout(timer);
      hideSuggestions();
      update({ ...defaults, q: b.dataset.query }, { scroll: true });
    }
    if (b.dataset.course) openCourse(b.dataset.course);
    if (b.dataset.remove) {
      const k = b.dataset.remove,
        changes = { [k]: defaults[k] };
      if (k === "area") Object.assign(changes, { course: "", teacher: "" });
      if (k === "course") changes.teacher = "";
      update(changes);
    }
    if (b.dataset.page && !b.disabled)
      update({ page: Number(b.dataset.page) }, { scroll: true });
    if (b.dataset.save) {
      const id = b.dataset.save,
        next = saved.includes(id)
          ? saved.filter((x) => x !== id)
          : [...saved, id];
      const persisted = store("danjuan:saved", next);
      saved = next;
      render();
      history.replaceState({}, "", urlFor());
      toast(
        persisted
          ? saved.includes(id)
            ? "已收藏到本机浏览器"
            : "已取消收藏"
          : "本机存储不可用，本次收藏仅在当前页面保留",
      );
    }
    if (b.dataset.detail) showDetail(b.dataset.detail);
    if (b.dataset.open) {
      recent = [
        b.dataset.open,
        ...recent.filter((id) => id !== b.dataset.open),
      ].slice(0, 8);
      store("danjuan:recent", recent);
      setTimeout(renderRecent, 0);
    }
    if (b.id === "empty-reset")
      update({
        ...defaults,
        view: state.view === "saved" && !saved.length ? "all" : state.view,
      });
    if (b.id === "copy-link") {
      try {
        await navigator.clipboard.writeText(byId.get(detailId).url);
        toast("已复制文件链接");
      } catch {
        toast("复制不可用，请使用“到 GitHub 查看”后复制地址");
      }
    }
  });
  $("close-detail").addEventListener("click", () => $("detail").close());
  $("detail").addEventListener("click", (e) => {
    if (e.target === $("detail")) {
      const r = $("detail").getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        $("detail").close();
    }
  });
  function closeFilters() {
    $("filters").classList.remove("open");
    $("open-filters").setAttribute("aria-expanded", "false");
    $("open-filters").focus();
  }
  $("open-filters").setAttribute("aria-expanded", "false");
  $("open-filters").addEventListener("click", () => {
    $("filters").classList.add("open");
    $("open-filters").setAttribute("aria-expanded", "true");
    $("close-filters").focus();
  });
  $("close-filters").addEventListener("click", closeFilters);
  $("apply-filters").addEventListener("click", () => {
    closeFilters();
    $("results").scrollIntoView({ behavior: "instant" });
  });
  $("filters").addEventListener("keydown", (e) => {
    if (!$("filters").classList.contains("open")) return;
    if (e.key === "Escape") closeFilters();
    if (e.key === "Tab") {
      const els = [
        ...$("filters").querySelectorAll("button,input,select"),
      ].filter((el) => el.offsetParent !== null);
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
        e.preventDefault();
        els[0].focus();
      }
    }
  });
  window.addEventListener("popstate", () => {
    clearTimeout(timer);
    hideSuggestions();
    state = readState();
    render();
  });
  window.addEventListener("pageshow", () => {
    if (data) renderRecent();
  });
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(
        "danjuan:scroll:" + location.search,
        String(scrollY),
      );
    } catch {}
  });
}
async function init() {
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("索引读取失败");
    data = await response.json();
    byId = new Map(data.files.map((f) => [f.id, f]));
    document.querySelectorAll("[data-repo-path]").forEach((a) => {
      a.href = "https://github.com/" + data.repository + a.dataset.repoPath;
    });
    $("stats").innerHTML =
      `<span><strong>${data.stats.courses}</strong>门课程</span><span><strong>${data.stats.files.toLocaleString()}</strong>个原始文件</span><span><strong>${data.stats.teachers}</strong>位具名老师</span><span class="stat-end">公开资料，无需登录本站</span>`;
    $("snapshot").textContent =
      `索引快照 ${data.sha.slice(0, 7)} · 构建于 ${new Date(data.generatedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}`;
    bind();
    render();
    history.replaceState({}, "", urlFor());
    if (
      performance.getEntriesByType("navigation")[0]?.type === "back_forward"
    ) {
      try {
        scrollTo(
          0,
          Number(
            sessionStorage.getItem("danjuan:scroll:" + location.search) || 0,
          ),
        );
      } catch {}
    }
  } catch (error) {
    $("status").textContent =
      "资料索引加载失败。请通过本地 HTTP 服务打开网站，或刷新重试。";
    $("stats").textContent = "资料暂不可用";
    $("list").innerHTML =
      '<div class="empty"><h3>暂时无法读取索引</h3><p>可先到原仓库查找，稍后刷新本页重试。</p><a class="open-file" href="https://github.com/Annan-lyn/fudan-exam-paper" target="_blank" rel="noopener noreferrer">查看原仓库 ↗</a></div>';
    console.error(error);
  }
}
init();
