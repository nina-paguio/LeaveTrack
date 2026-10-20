/** Lower-case, trim and strip accents so "jose" finds "José". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").trim();
}

/**
 * The employees whose name contains the typed text, in their original order. An empty (or blank)
 * query returns everyone. Only narrows what the picker shows: the report is still read on the server
 * for the one employee id that is chosen.
 */
export function filterEmployees<T extends { name: string }>(employees: T[], query: string): T[] {
  const needle = normalize(query);
  if (!needle) return employees;
  return employees.filter((e) => normalize(e.name).includes(needle));
}
