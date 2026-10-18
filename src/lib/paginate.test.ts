import { describe, expect, it } from "vitest";
import { PAGE_SIZE, paginate } from "@/lib/paginate";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("shows 10 per page by default", () => {
    const p = paginate(rows(25), "1");
    expect(PAGE_SIZE).toBe(10);
    expect(p.items).toEqual(rows(10));
    expect(p).toMatchObject({ page: 1, pageCount: 3, total: 25 });
  });

  it("returns the short last page", () => {
    const p = paginate(rows(25), "3");
    expect(p.items).toEqual([21, 22, 23, 24, 25]);
    expect(p.page).toBe(3);
  });

  it("clamps bad or out-of-range page values to a real page", () => {
    expect(paginate(rows(25), "99").page).toBe(3);
    expect(paginate(rows(25), "0").page).toBe(1);
    expect(paginate(rows(25), "-4").page).toBe(1);
    expect(paginate(rows(25), "abc").page).toBe(1);
    expect(paginate(rows(25), undefined).page).toBe(1);
    expect(paginate(rows(25), ["2", "3"]).page).toBe(1);
  });

  it("an empty list is one empty page", () => {
    expect(paginate([], "1")).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });

  it("exactly 10 rows is one page", () => {
    expect(paginate(rows(10), "1").pageCount).toBe(1);
    expect(paginate(rows(11), "2").items).toEqual([11]);
  });
});
