import { describe, expect, it } from "vitest";
import { parseRoomCSV } from "./csv";
describe("daily operational CSV", () => {
  it("parses operational fields and ignores blank lines", () => {
    expect(
      parseRoomCSV(
        "roomNumber,occupancyStatus,cleaningType\r\n101,DEPARTURE,CHECKOUT\r\n\r\n",
      ),
    ).toEqual([
      {
        roomNumber: "101",
        occupancyStatus: "DEPARTURE",
        cleaningType: "CHECKOUT",
      },
    ]);
  });
  it("supports quoted fields and BOM headers", () => {
    expect(
      parseRoomCSV(
        '\uFEFFroomNumber,occupancyStatus,cleaningType\n"101",VACANT,',
      ),
    ).toEqual([{ roomNumber: "101", occupancyStatus: "VACANT" }]);
  });
  it.each([
    "roomNumber,guestName,cleaningType\n101,Private,CHECKOUT",
    "roomNumber,occupancyStatus,cleaningType\n101,DEPARTURE,CHECKOUT\n101,VACANT,",
    "roomNumber,occupancyStatus,cleaningType\n101,UNKNOWN,",
    'roomNumber,occupancyStatus,cleaningType\n"101,VACANT,',
  ])("refuses private or invalid input", (text) =>
    expect(() => parseRoomCSV(text)).toThrow(),
  );
});
