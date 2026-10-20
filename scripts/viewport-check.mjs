#!/usr/bin/env node
// Measures the mobile layout of the submit-request form and the balance page in real (headless) Chrome
// with mobile emulation. It reports numbers, not opinions: horizontal overflow, tap-target sizes,
// control font sizes (iOS zooms the page on focus below 16px), and desktop-only pieces (sidebar,
// table) showing on a phone. It never submits a form and writes nothing to any database.
//
//   npm run build && npm start        (in one terminal, or `npm run dev`)
//   node scripts/viewport-check.mjs   (BASE_URL=http://localhost:3000 by default)
//   node scripts/viewport-check.mjs --shared   (also the other pages that share the form controls)
//
// Needs Google Chrome (set CHROME_PATH if it is not in the macOS default location) and Node 22
// (built-in WebSocket). Screenshots are saved to tmp/viewport/ (git-ignored).
//
// Limit: this is Chrome's emulation, not an iPhone. It measures layout reliably; it cannot show the
// real iOS focus-zoom or the native date-picker UI. The 16px rule is the known criterion for the zoom.
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The app's session cookie is signed, so the checker signs one with the same SESSION_SECRET
// (export it for this script and for the running server).
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "leavetrack-session";
const EMAIL_BY_ROLE = {
  employee: "ana@example.com",
  manager: "maria@example.com",
  hr_admin: "hana@example.com",
};
function sessionCookieFor(role) {
  if (SESSION_SECRET.length < 32) {
    throw new Error("Set SESSION_SECRET (32+ chars, same value as the running server).");
  }
  const x = Math.floor(Date.now() / 1000) + 3600;
  const body = Buffer.from(JSON.stringify({ e: EMAIL_BY_ROLE[role], r: role, x })).toString(
    "base64url",
  );
  return `${body}.${createHmac("sha256", SESSION_SECRET).update(body).digest("base64url")}`;
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "tmp/viewport";
const WIDTHS = [320, 375, 700, 768, 1024, 1440]; // 700: large phone / landscape, between Tailwind sm (640) and md (768)
// Realistic screen heights: short phones make pages scroll, which is when a fixed bar can cover content.
//   320: iPhone SE (1st gen) 568   375: iPhone SE (2nd/3rd gen) 667   700: a phone in landscape 375
const heightFor = (w) => (w <= 320 ? 568 : w <= 375 ? 667 : w <= 700 ? 375 : 800);
// --text-scale=1.5 simulates a user whose system font size is 150% (the app sizes in rem).
const TEXT_SCALE =
  Number((process.argv.find((a) => a.startsWith("--text-scale=")) ?? "").split("=")[1]) || 1;
const MIN_TAP = 44; // AGENTS.md: tap targets at least 44px
const MIN_FONT = 16; // below this iOS Safari zooms the page when a control is focused
const PHONE_MAX = 767; // Tailwind md breakpoint is 768px

// Safety: this script sets the mock login cookie, so it only ever talks to a local server.
const base = new URL(BASE);
if (!["localhost", "127.0.0.1"].includes(base.hostname)) {
  console.error(`Refusing to run against ${base.hostname}: this script only targets localhost.`);
  process.exit(2);
}

// ----------------------------------------------------------------------------------------------
// Code that runs inside the page (stringified and injected; it must not use anything from this file).

function measure(W, hasShell) {
  const doc = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const label = (el) => {
    const cls =
      typeof el.className === "string"
        ? el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    const text = (el.textContent || el.getAttribute("aria-label") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 24);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };

  // A page is "too wide" if its scrollable width or the layout viewport grows past the intended width.
  const scrollW = doc.scrollWidth;
  const layoutW = doc.clientWidth;
  const overflow = scrollW > W + 1 || layoutW > W + 1;
  const offenders = [];
  if (overflow) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 && r.width > 2)
        offenders.push(`${label(el)} (right edge ${Math.round(r.right)}px)`);
    }
  }

  const phone = W <= 767;
  const interactive = [
    ...document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=option]",
    ),
  ].filter(
    (el) => visible(el) && el.getBoundingClientRect().width > 2, // skips the sr-only skip link
  );
  const smallTargets = phone
    ? interactive
        .map((el) => {
          const wrapped = /^(radio|checkbox)$/.test(el.type) ? el.closest("label") : null;
          return { el, r: (wrapped ?? el).getBoundingClientRect() };
        })
        .filter(({ r }) => Math.min(r.width, r.height) < 44)
        .map(({ el, r }) => `${label(el)} (${Math.round(r.width)}x${Math.round(r.height)})`)
    : [];
  const smallFonts = phone
    ? [
        ...document.querySelectorAll(
          "input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=submit]):not([type=button]), select, textarea",
        ),
      ]
        .filter(visible)
        .map((el) => ({ el, px: parseFloat(getComputedStyle(el).fontSize) }))
        .filter(({ px }) => px < 16)
        .map(({ el, px }) => `${label(el)} (${px}px)`)
    : [];

  const aside = document.querySelector("aside");
  const sidebarVisible = !!aside && visible(aside);
  const bottomNav = [...document.querySelectorAll("nav")].find(
    (n) => getComputedStyle(n).position === "fixed",
  );
  const bottomNavVisible = !!bottomNav && visible(bottomNav);
  const navLinks = aside ? aside.querySelectorAll("nav a").length : 0;
  const tablesVisible = [...document.querySelectorAll("table")].filter(visible).length;
  const layoutProblems = [];
  if (!hasShell) {
    // a page outside the app shell (the sign-in page) has no sidebar or bottom bar to check
  } else if (phone) {
    if (sidebarVisible) layoutProblems.push("desktop sidebar is showing on a phone");
    // a role with a single destination (the manager) has no tab bar by design
    if (!bottomNavVisible && navLinks > 1)
      layoutProblems.push("mobile bottom bar is missing on a phone");
    if (tablesVisible > 0) layoutProblems.push(`${tablesVisible} <table> showing on a phone`);
  } else {
    if (!sidebarVisible) layoutProblems.push("sidebar is missing on a wide screen");
    if (bottomNavVisible) layoutProblems.push("phone bottom bar is showing on a wide screen");
  }

  let coveredBy = 0;
  if (phone && hasShell && bottomNavVisible) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const barTop = bottomNav.getBoundingClientRect().top;
    let lowest = 0;
    for (const el of document.querySelectorAll("main *")) {
      // A modal <dialog> is in the top layer, above the bottom bar: it cannot be hidden by it.
      if (el.closest("dialog")) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2 && visible(el)) lowest = Math.max(lowest, r.bottom);
    }
    coveredBy = Math.round(lowest - barTop);
    window.scrollTo(0, 0);
  }

  const viewportMeta =
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  const bodyText = document.body.innerText;
  return {
    scrollW,
    layoutW,
    overflow,
    offenders: offenders.slice(0, 6),
    smallTargets,
    smallFonts,
    layoutProblems,
    viewportOk: /width=device-width/.test(viewportMeta),
    hasH1: !!document.querySelector("h1"),
    hasMain: !!document.querySelector("main"),
    coveredBy,
    bodyText,
  };
}

const ACTIONS = {
  // Submit with nothing filled in: client-side validation shows the required-field errors (no network call).
  // Scoped to the form in <main>: the first submit button in the page is the header's "Sign out".
  empty: () => document.querySelector('main form button[type="submit"]').click(),
  // End date before the start date: the date error appears as soon as both are filled.
  reversed: () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("startDate", "2026-12-05");
    set("endDate", "2026-12-01");
  },
  // 3 days against a 0 balance: the non-blocking over-balance warning appears.
  overBalance: () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("startDate", "2026-12-01");
    set("endDate", "2026-12-03");
  },
};

Object.assign(ACTIONS, {
  // Over-balance, everything else filled in, Submit pressed: the confirmation dialog opens (nothing is sent).
  overBalanceConfirm: () => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("startDate", "2026-12-01");
    set("endDate", "2026-12-03");
    set("reason", "Family trip");
    setTimeout(() => document.querySelector('main form button[type="submit"]').click(), 50);
  },
  // The audit employee combobox with its list open (typing a letter opens and narrows it).
  employeeOpen: () => {
    const el = document.getElementById("audit-employee");
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "a");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
  // A long multi-word Filipino-style name in the header.
  longName: () => {
    document.querySelector("header p.ml-auto span").textContent =
      "Maria Cristina Dela Cruz-Montenegro de los Santos y Villanueva-Featherstonehaugh";
  },
  // Worst case: one unbroken 45-character word (no break opportunity).
  longToken: () => {
    document.querySelector("header p.ml-auto span").textContent =
      "Pneumonoultramicroscopicsilicovolcanoconiosis";
  },
});

const EXPECT_TEXT = {
  empty: "This field is required.",
  reversed: "End date cannot be before the start date.",
  overBalance: "for HR override",
  overBalanceConfirm: "Submit anyway",
};

// ----------------------------------------------------------------------------------------------
// A tiny Chrome DevTools Protocol client (no dependencies).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startChrome() {
  const port = 9300 + Math.floor(Math.random() * 90);
  const dir = mkdtempSync(join(tmpdir(), "lt-viewport-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return { proc, dir, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* Chrome is still starting */
    }
    await sleep(250);
  }
  proc.kill();
  throw new Error(`Chrome did not start (CHROME_PATH=${CHROME})`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const w of [...waiters]) {
        if (w.method === msg.method) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(msg.params);
        }
      }
    }
  });
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("DevTools connection failed")), {
      once: true,
    });
  });
  return {
    opened,
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    once: (method, ms = 15000) =>
      new Promise((resolve, reject) => {
        const w = { method, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) {
            waiters.splice(i, 1);
            reject(new Error(`timed out waiting for ${method}`));
          }
        }, ms);
      }),
    close: () => ws.close(),
  };
}

// ----------------------------------------------------------------------------------------------

const SCENARIOS = [
  {
    path: "/leave/new",
    role: "employee",
    name: "submit-form",
    states: ["empty", "reversed", "overBalance", "overBalanceConfirm", "longName", "longToken"],
  },
  { path: "/leave/balance", role: "employee", name: "balance", states: [] },
  { path: "/notifications", role: "employee", name: "notifications", states: [] },
  { path: "/notifications", role: "manager", name: "notifications", states: [] },
];

// --shared: the other pages that use the same controls (controlClass). A change to the shared control
// size must not break their layout. Regression only: they are not part of TASK-016's acceptance criteria.
if (process.argv.includes("--shared")) {
  SCENARIOS.push(
    { path: "/login", role: null, name: "login", states: [], shell: false },
    { path: "/team/requests", role: "manager", name: "team-queue", states: [] },
    { path: "/audit", role: "hr_admin", name: "audit", states: ["employeeOpen"] },
    { path: "/admin/policies", role: "hr_admin", name: "policies", states: [] },
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { proc, dir, wsUrl } = await startChrome();
  const cdp = connect(wsUrl);
  await cdp.opened;
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  const results = [];
  const evalIn = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? "page script failed");
    return r.result.value;
  };

  try {
    for (const sc of SCENARIOS) {
      for (const W of WIDTHS) {
        const phone = W <= PHONE_MAX;
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: W,
          height: heightFor(W),
          deviceScaleFactor: 2,
          mobile: phone,
          screenWidth: W,
          screenHeight: heightFor(W),
        });
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: phone });
        await cdp.send("Network.clearBrowserCookies");
        if (sc.role) {
          const cookie = await cdp.send("Network.setCookie", {
            name: COOKIE_NAME,
            value: sessionCookieFor(sc.role),
            url: BASE,
            path: "/",
          });
          if (!cookie.success) throw new Error(`Chrome refused the session cookie for ${BASE}`);
        }

        for (const state of [null, ...(W === 320 || W === 375 ? sc.states : [])]) {
          const loaded = cdp.once("Page.loadEventFired");
          await cdp.send("Page.navigate", { url: `${BASE}${sc.path}` });
          await loaded;
          await sleep(900); // hydration
          const landed = await evalIn("location.pathname");
          if (landed !== sc.path) {
            const held = (await cdp.send("Network.getCookies", { urls: [BASE] })).cookies.map(
              (c) => `${c.name}=${c.value}`,
            );
            throw new Error(
              `asked for ${sc.path} as ${sc.role} at ${W}px but landed on ${landed}; cookies Chrome holds for ${BASE}: [${held.join(", ")}]`,
            );
          }
          if (TEXT_SCALE !== 1) {
            await evalIn(`document.documentElement.style.fontSize = "${TEXT_SCALE * 100}%"`);
            await sleep(200);
          }
          if (state) {
            await evalIn(`(${ACTIONS[state].toString()})()`);
            await sleep(400);
          }
          const m = await evalIn(`(${measure.toString()})(${W}, ${sc.shell !== false})`);

          const problems = [];
          if (m.coveredBy > 1)
            problems.push(
              `CONTENT HIDDEN under the fixed bottom bar by ${m.coveredBy}px when scrolled to the end`,
            );
          if (m.overflow)
            problems.push(
              `HORIZONTAL SCROLL: page is ${m.scrollW}px wide (layout ${m.layoutW}px) in a ${W}px viewport; widest: ${m.offenders.join("; ") || "n/a"}`,
            );
          if (m.smallTargets.length)
            problems.push(
              `TAP TARGET < ${MIN_TAP}px: ${m.smallTargets.slice(0, 5).join("; ")}${m.smallTargets.length > 5 ? ` (+${m.smallTargets.length - 5} more)` : ""}`,
            );
          if (m.smallFonts.length)
            problems.push(
              `FONT < ${MIN_FONT}px (iOS focus-zoom): ${m.smallFonts.slice(0, 4).join("; ")}${m.smallFonts.length > 4 ? ` (+${m.smallFonts.length - 4} more)` : ""}`,
            );
          for (const p of m.layoutProblems) problems.push(`LAYOUT: ${p}`);
          if (!m.viewportOk) problems.push("no <meta name=viewport content=width=device-width>");
          if (!m.hasH1 || !m.hasMain) problems.push("page is missing its <h1> or <main>");
          if (state && EXPECT_TEXT[state] && !m.bodyText.includes(EXPECT_TEXT[state]))
            problems.push(`STATE "${state}": expected text "${EXPECT_TEXT[state]}" is not visible`);

          const shot = await cdp.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
          });
          const file = `${OUT}/${sc.name}-${sc.role ?? "out"}-${W}${state ? "-" + state : ""}${TEXT_SCALE !== 1 ? "-x" + TEXT_SCALE : ""}.png`;
          writeFileSync(file, Buffer.from(shot.data, "base64"));

          results.push({ ...sc, W, state, problems, file });
        }
      }
    }
  } finally {
    cdp.close();
    proc.kill();
    await sleep(300);
    rmSync(dir, { recursive: true, force: true });
  }

  // Report
  let failing = 0;
  for (const sc of SCENARIOS) {
    console.log(`\n${sc.path}  (${sc.role ?? "signed out"})`);
    for (const r of results.filter((x) => x.name === sc.name && x.role === sc.role)) {
      const ok = r.problems.length === 0;
      if (!ok) failing++;
      console.log(
        `  ${ok ? "PASS" : "FAIL"}  ${String(r.W).padStart(4)}px${r.state ? `  [${r.state}]` : ""}`,
      );
      for (const p of r.problems) console.log(`          - ${p}`);
    }
  }
  console.log(
    `\n${results.length} checks (text scale ${TEXT_SCALE}), ${failing} failing. Screenshots: ${OUT}/`,
  );
  process.exit(failing ? 1 : 0);
}

main().catch((err) => {
  console.error("viewport-check failed:", err.message);
  process.exit(2);
});
