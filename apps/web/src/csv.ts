// Operational fields only. Guest names, reservations, and PMS credentials are never imported.
export function parseRoomCSV(input: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(value.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift()?.map((x) => x.replace(/^\uFEFF/, ""));
  if (headers?.join(",") !== "roomNumber,occupancyStatus,cleaningType")
    throw new Error("Use columns: roomNumber,occupancyStatus,cleaningType");
  if (!records.length || records.length > 200)
    throw new Error("CSV must contain 1–200 rooms");
  if (new Set(records.map((r) => r[0])).size !== records.length)
    throw new Error("Duplicate room numbers");
  return records.map((r) => {
    if (
      r.length !== 3 ||
      !r[0] ||
      !["VACANT", "OCCUPIED", "ARRIVAL", "DEPARTURE"].includes(r[1]) ||
      (r[2] &&
        ![
          "CHECKOUT",
          "STAYOVER",
          "FULL_SERVICE",
          "DEEP_CLEAN",
          "ARRIVAL_TOUCHUP",
        ].includes(r[2]))
    )
      throw new Error("Invalid operational room row");
    return {
      roomNumber: r[0],
      occupancyStatus: r[1],
      ...(r[2] ? { cleaningType: r[2] } : {}),
    };
  });
}
