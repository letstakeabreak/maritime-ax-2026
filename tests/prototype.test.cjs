const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const prototype = path.join(__dirname, "..", "prototype");

// This exercises the actual scripts and input handlers, not browser layout or APIs.
function loadPrototype(search = "", navigator = {}) {
  const elements = new Map();
  let inputs = [];
  function element() {
    return {
      innerHTML: "", textContent: "", value: "", dataset: {}, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; },
      closest() { return { classList: { toggle() {} } }; },
      focus() { this.focused = true; },
      select() { this.selected = true; },
    };
  }
  const items = element();
  Object.defineProperty(items, "innerHTML", {
    set(html) {
      inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(([tag]) => {
        const input = element();
        input.value = tag.match(/\bvalue="([^"]*)"/)[1];
        input.dataset.i = tag.match(/\bdata-i="([^"]*)"/)[1];
        return input;
      });
    },
  });
  elements.set("#items", items);
  const context = vm.createContext({
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
      },
      querySelectorAll(selector) { return selector === "#items input" ? inputs : []; },
    },
    location: { search }, navigator, structuredClone, URLSearchParams, setTimeout,
  });
  context.window = context;
  for (const file of ["data.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(prototype, file), "utf8"), context, { filename: file });
  }
  return {
    sample(key) { return structuredClone(context.SAMPLES[key]); },
    diagnose(quote) { return context.diagnose(quote); },
    state() { return vm.runInContext("({ quote, result })", context); },
    input(index, value) {
      const input = inputs[index];
      input.value = String(value);
      input.listeners.input({ type: "input", target: input });
      return input;
    },
    text(selector) { return elements.get(selector).textContent; },
    node(selector) { return elements.get(selector); },
    dispatch(selector, type) {
      const target = elements.get(selector);
      return target.listeners[type]({ type, target });
    },
    load(key) { context.load(key); },
  };
}

test("B compares ocean freight plus LSS, without changing the quoted total", () => {
  const app = loadPrototype("?q=highOF");
  const { result } = app.state();
  assert.equal(result.ofr.amount, 4720);
  assert.equal(result.ofr.r, 4720 / 3508);
  assert.equal(result.total, 6864500);
});

test("local fees do not enter the KCCI comparison", () => {
  const app = loadPrototype();
  const quote = app.sample("highOF");
  const original = app.diagnose(quote);
  const thc = quote.items.find((item) => item.code === "THC");
  thc.amount += 100000;
  const changed = app.diagnose(quote);
  assert.equal(changed.ofr.amount, original.ofr.amount);
  assert.equal(changed.ofr.r, original.ofr.r);
  assert.equal(changed.total, original.total + 100000);
});

for (const code of ["BAF", "CAF", "EBS"]) {
  test(`${code} is included in the freight comparison`, () => {
    const app = loadPrototype();
    const quote = app.sample("normal");
    quote.items.push({ code, raw: code, amount: 100, cur: "USD" });
    assert.equal(app.diagnose(quote).ofr.amount, 7700);
  });
}

test("a KRW surcharge is converted to USD for comparison", () => {
  const app = loadPrototype();
  const quote = app.sample("highOF");
  const lss = quote.items.find((item) => item.code === "LSS");
  lss.amount = 120 * quote.fx;
  lss.cur = "KRW";
  const result = app.diagnose(quote);
  assert.equal(result.ofr.amount, 4720);
  assert.equal(result.total, 6864500);
});

test("a surcharge can move a quote above the 110% warning threshold", () => {
  const app = loadPrototype();
  const quote = app.sample("highOF");
  quote.items.find((item) => item.code === "OF").amount = 3840;
  quote.items.find((item) => item.code === "LSS").amount = 0;
  const before = app.diagnose(quote);
  quote.items.find((item) => item.code === "LSS").amount = 50;
  const after = app.diagnose(quote);
  assert.equal(before.ofr.pos.k, "ok");
  assert.equal(after.ofr.pos.k, "warn");
  assert.equal(after.F.length, before.F.length + 1);
});

test("A and C totals and comparison amounts remain unchanged", () => {
  const app = loadPrototype();
  const a = app.diagnose(app.sample("normal"));
  const c = app.diagnose(app.sample("dupMissing"));
  assert.equal(a.total, 11350800);
  assert.equal(a.ofr.amount, 7600);
  assert.equal(c.total, 5417300);
  assert.equal(c.ofr.amount, 3550);
});

for (const key of ["constructor", "toString", "__proto__", "unknown"]) {
  test(`query q=${key} safely falls back to sample A`, () => {
    const app = loadPrototype(`?q=${key}`);
    const { quote, result } = app.state();
    assert.equal(quote.forwarder, app.sample("normal").forwarder);
    assert.equal(result.total, 11350800);
  });
}

for (const [value, expected] of [[-1, 0], [10000000000, 1000000000]]) {
  test(`input ${value} visibly matches the clamped value ${expected}`, () => {
    const app = loadPrototype();
    const input = app.input(1, value); // Sample A's KRW THC line.
    const { quote, result } = app.state();
    assert.equal(Number(input.value), expected);
    assert.equal(quote.items[1].amount, expected);
    assert.equal(result.total, 11350800 - 210000 + expected);
    assert.ok(app.text("#total").includes(Math.round(result.total).toLocaleString("ko-KR")));
  });
}

for (const [key, count] of [["normal", 0], ["highOF", 1], ["dupMissing", 5]]) {
  test(`${key} reports ${count} questions in the summary, excluding informational notices`, () => {
    const app = loadPrototype(`?q=${key}`);
    assert.equal(app.state().result.F.filter((finding) => finding.lv !== "info").length, count);
    const summary = app.node("#summary-title").innerHTML.replace(/<[^>]+>/g, "");
    assert.ok(count ? summary.includes(`${count}가지`) : summary.includes("확인할 항목이 없어요"));
  });
}

test("C presents its five actionable questions in order and keeps validity in the memo", () => {
  const app = loadPrototype("?q=dupMissing");
  const keys = [...app.node("#findings").innerHTML.matchAll(/data-finding="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["dup-DOC", "dup-HANDLING", "filing-AMS", "fee-THC", "free-time"]);
  const validity = app.state().result.F.find((finding) => finding.key === "validity");
  assert.equal(validity.lv, "info");
  assert.ok(app.node("#memo").value.includes(validity.ask));
});

test("similar fee names ask for clarification without asserting duplicate billing", () => {
  const app = loadPrototype("?q=dupMissing");
  const findings = app.state().result.F.filter((finding) => finding.key.startsWith("dup-"));
  assert.equal(findings.length, 2);
  for (const finding of findings) {
    assert.match(finding.title, /\?$/);
    assert.match(finding.basis.flat().join(" "), /서로 다른 업무일 수/);
    assert.doesNotMatch([finding.title, finding.detail, finding.ask].join(" "), /중복 청구|이중 청구|부당 청구/);
  }
});

test("editing a freight amount synchronizes the comparison, total, questions and unedited memo", () => {
  const app = loadPrototype("?q=highOF");
  assert.match(app.node("#memo").value, /\$4,720/);
  app.input(0, 5000);
  assert.equal(app.state().result.ofr.amount, 5120);
  assert.equal(app.state().result.total, 7416500);
  assert.match(app.node("#gauge").innerHTML, /\$5,120/);
  assert.match(app.node("#memo").value, /\$5,120/);
  assert.doesNotMatch(app.node("#memo").value, /\$4,720/);

  app.input(0, 3500);
  assert.equal(app.state().result.F.length, 0);
  assert.doesNotMatch(app.node("#findings").innerHTML, /data-finding="freight"/);
  assert.doesNotMatch(app.node("#memo").value, /\$5,120|운임지수\(KCCI/);
  assert.match(app.node("#memo").value, /확인 항목이 없어요/);
});

for (const value of [0, ""]) {
  test(`ocean freight ${JSON.stringify(value)} removes the comparison and requests the missing amount`, () => {
    const app = loadPrototype("?q=highOF");
    app.input(0, value);
    const { quote, result } = app.state();
    assert.equal(quote.items[0].amount, 0);
    assert.equal(result.ofr, null);
    assert.equal(result.total, 516500);
    assert.ok(result.F.some((finding) => finding.key === "of-zero"));
    const summary = app.node("#summary-title").innerHTML.replace(/<[^>]+>/g, "");
    assert.match(summary, /해상운임 금액을 먼저 확인해 주세요/);
    assert.doesNotMatch(summary, /확인할 항목이 없어요/);
    assert.doesNotMatch(app.node("#gauge").innerHTML, /\$4,720|NaN|Infinity/);
    assert.match(app.node("#memo").value, /해상운임 금액을 다시/);
    assert.doesNotMatch(app.node("#memo").value, /\$4,720/);
  });
}

test("custom memo text survives recalculation until the user explicitly resets it", () => {
  const app = loadPrototype("?q=highOF");
  const memo = app.node("#memo");
  memo.value = "담당자님, 직접 적은 질문입니다.\n추가 조건도 알려 주세요.";
  const custom = memo.value;
  app.dispatch("#memo", "input");
  app.input(0, 5000);
  assert.equal(memo.value, custom);
  assert.equal(app.node("#memo-stale").hidden, false);

  app.dispatch("#reset-memo", "click");
  assert.notEqual(memo.value, custom);
  assert.match(memo.value, /\$5,120/);
  assert.equal(app.node("#memo-stale").hidden, true);
  app.input(0, 4600);
  assert.match(memo.value, /\$4,720/);
});

test("changing samples resets edited amounts and memo text to the selected quote", () => {
  const app = loadPrototype("?q=highOF");
  app.input(0, 5000);
  app.node("#memo").value = "My custom memo";
  app.dispatch("#memo", "input");
  app.load("dupMissing");
  assert.equal(app.state().result.total, 5417300);
  assert.doesNotMatch(app.node("#memo").value, /My custom memo|\$5,120/);
  assert.equal(app.node("#memo-stale").hidden, true);
  app.load("highOF");
  assert.equal(app.state().result.total, 6864500);
  assert.equal(app.state().quote.items[0].amount, 4600);
  assert.match(app.node("#memo").value, /\$4,720/);
});

test("copy sends the exact currently edited memo to the clipboard", async () => {
  const copied = [];
  const app = loadPrototype("?q=highOF", { clipboard: { async writeText(text) { copied.push(text); } } });
  const custom = "담당자님,\n\n금액과 조건을 확인 부탁드립니다.\n  공백도 유지해 주세요.  ";
  app.node("#memo").value = custom;
  app.dispatch("#memo", "input");
  await app.dispatch("#copy", "click");
  assert.deepEqual(copied, [custom]);
  assert.match(app.text("#copy-status"), /복사했어요/);
  assert.notEqual(app.node("#memo").selected, true);
});

for (const [name, navigator] of [
  ["denied", { clipboard: { async writeText() { throw new Error("Permission denied"); } } }],
  ["unavailable", {}],
]) {
  test(`clipboard ${name} selects the exact memo for manual copying`, async () => {
    const app = loadPrototype("?q=dupMissing", navigator);
    const custom = "직접 고친 질문\n\n한 줄 더";
    app.node("#memo").value = custom;
    app.dispatch("#memo", "input");
    await app.dispatch("#copy", "click");
    assert.equal(app.node("#memo").value, custom);
    assert.equal(app.node("#memo").focused, true);
    assert.equal(app.node("#memo").selected, true);
    assert.match(app.text("#copy-status"), /직접 복사/);
    assert.doesNotMatch(app.text("#copy-status"), /복사했어요/);
  });
}

test("AI reading stays disabled and sends nothing until the external AI consent is checked", async () => {
  const html = fs.readFileSync(path.join(prototype, "index.html"), "utf8");
  assert.match(html, /<input id="extract-consent" type="checkbox" required>/);
  assert.match(html, /id="extract-run" class="primary" disabled/);
  const app = loadPrototype();
  const run = app.node("#extract-run"), consent = app.node("#extract-consent");
  assert.equal(run.disabled, true);
  await run.listeners.click();
  // fetch가 불렸다면 연결 실패 문구가 남는다. 동의 안내가 남아야 전송 전에 멈춘 것이다.
  assert.match(app.text("#extract-status"), /동의해야/);
  consent.checked = true;
  app.dispatch("#extract-consent", "change");
  assert.equal(run.disabled, false);
  consent.checked = false;
  app.dispatch("#extract-consent", "change");
  assert.equal(run.disabled, true);
});
