import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Exercise the application's actual event handlers with deterministic timers.
// Rendering is covered by browser checks; this harness isolates event ordering.
function harness() {
  const elements = new Map(),
    timers = new Map();
  let sequence = 0;
  function element(id) {
    if (!elements.has(id))
      elements.set(id, {
        value: "",
        hidden: true,
        listeners: {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        setAttribute() {},
        focus() {},
        scrollIntoView() {},
        classList: {
          contains() {
            return false;
          },
        },
      });
    return elements.get(id);
  }
  const context = vm.createContext({
    URLSearchParams,
    console,
    location: { search: "", pathname: "/fudan-exam-paper/" },
    history: { pushState() {}, replaceState() {} },
    localStorage: {
      getItem() {
        return null;
      },
    },
    document: {
      getElementById: element,
      addEventListener() {},
      querySelectorAll() {
        return [];
      },
    },
    window: { addEventListener() {} },
    setTimeout(fn) {
      timers.set(++sequence, fn);
      return sequence;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const source = fs
    .readFileSync(new URL("../assets/app.js", import.meta.url), "utf8")
    .replace(/^import .*?;\s*/s, "")
    .replace(/init\(\);\s*$/, "");
  vm.runInContext(source, context);
  vm.runInContext("render=()=>{}; data={courses:[]}; bind();", context);
  return {
    element,
    timers,
    run: (code) => vm.runInContext(code, context),
    fire(id, type) {
      element(id).listeners[type]({ preventDefault() {} });
    },
    flush() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    state() {
      return JSON.parse(vm.runInContext("JSON.stringify(state)", context));
    },
  };
}
test("重置取消待执行的搜索，不会在 250ms 后恢复旧查询", () => {
  const h = harness();
  h.element("query").value = "ICS";
  h.fire("query", "input");
  assert.equal(h.timers.size, 1);
  h.fire("reset", "click");
  h.flush();
  assert.equal(h.state().q, "");
  assert.equal(h.timers.size, 0);
});
test("中文输入法组词期间不搜索，确认文字后才搜索", () => {
  const h = harness();
  h.fire("query", "compositionstart");
  h.element("query").value = "shufen";
  h.fire("query", "input");
  h.flush();
  assert.equal(h.state().q, "");
  h.element("query").value = "数分";
  h.fire("query", "compositionend");
  h.flush();
  assert.equal(h.state().q, "数分");
});
test("全局搜索清除上一次学科和老师条件", () => {
  const h = harness();
  h.run("state.area='数学';state.teacher='谢锡麟';state.page=3;");
  h.element("query").value = "ICS";
  h.fire("search-form", "submit");
  assert.equal(h.state().q, "ICS");
  assert.equal(h.state().area, "");
  assert.equal(h.state().teacher, "");
  assert.equal(h.state().page, 1);
});
