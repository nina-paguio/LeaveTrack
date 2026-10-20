import { describe, expect, it } from "vitest";
import { filterEmployees } from "@/lib/leave/employee-search";

const people = [
  { id: "1", name: "Ana Reyes" },
  { id: "2", name: "José Santos" },
  { id: "3", name: "Maria Santos" },
  { id: "4", name: "Peter Cruz" },
];

describe("filterEmployees", () => {
  it("returns everyone for an empty or blank query", () => {
    expect(filterEmployees(people, "")).toEqual(people);
    expect(filterEmployees(people, "   ")).toEqual(people);
  });

  it("matches part of a name, anywhere in it", () => {
    expect(filterEmployees(people, "santos").map((p) => p.id)).toEqual(["2", "3"]);
    expect(filterEmployees(people, "ria").map((p) => p.id)).toEqual(["3"]);
  });

  it("ignores case and surrounding spaces", () => {
    expect(filterEmployees(people, "  PETER ").map((p) => p.id)).toEqual(["4"]);
  });

  it("ignores accents in both the name and the query", () => {
    expect(filterEmployees(people, "jose").map((p) => p.id)).toEqual(["2"]);
    expect(filterEmployees(people, "josé").map((p) => p.id)).toEqual(["2"]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterEmployees(people, "zzz")).toEqual([]);
  });

  it("keeps the original order and does not change the input", () => {
    const copy = [...people];
    expect(filterEmployees(people, "a").map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(people).toEqual(copy);
  });
});
