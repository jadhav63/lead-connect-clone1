// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HotelStaffDirectory, RoomInventoryPreview } from "./HotelSetup";

const { mockAPI } = vi.hoisted(() => ({ mockAPI: vi.fn() }));
vi.mock("./api", () => ({ api: mockAPI }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("manager hotel setup", () => {
  it("saves a fictional employee without email and confirms the save", async () => {
    const entry = { id: "11111111-1111-4111-8111-111111111111", name: "Fictional Housekeeper", phone: null, email: null, department: "Housekeeping", jobRole: null, employmentStatus: "PENDING_REVIEW", appAccessEnabled: false };
    mockAPI.mockImplementation((path: string, method?: string) => Promise.resolve(
      path === "/staff-directory" && method === "POST" ? entry : path === "/staff-directory" ? [entry] : {},
    ));
    render(<HotelStaffDirectory />);
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Fictional Housekeeper" } });
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "Housekeeping" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to directory" }));
    expect((await screen.findByRole("status")).textContent).toContain("Saved successfully");
    expect(mockAPI).toHaveBeenCalledWith("/staff-directory", "POST", expect.objectContaining({ name: "Fictional Housekeeper", email: null }));
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("previews a fictional room CSV without exposing an apply action when approval is unavailable", async () => {
    const types = ["AC1", "AC2", "AC2", "AC3", ...Array(5).fill("RM1"), ...Array(42).fill("RM2"), ...Array(8).fill("RM3"), "SU1"];
    const csv = ["property_code,room_number,room_type,floor,initial_cleaning_status,initial_occupancy_status", ...types.map((type, i) => `58835,${100 + i},${type},1,CLEAN,VACANT`)].join("\n");
    mockAPI.mockResolvedValue({ total: 60, toCreate: 60, alreadyPresent: 0, conflicts: [], unexpectedExisting: [], missingInitialStatus: [], approvedInventoryMatch: false, canApply: false, databaseModified: false });
    render(<RoomInventoryPreview />);
    const input = screen.getByLabelText("Room inventory CSV") as HTMLInputElement;
    const file = { name: "fictional.csv", size: csv.length, text: async () => csv } as File;
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    fireEvent.change(input);
    expect((await screen.findByRole("status")).textContent).toContain("60 validated rooms");
    expect(screen.getByText(/Import is unavailable until the production-only approval/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply approved inventory" })).toBeNull();
    expect(mockAPI).toHaveBeenCalledWith("/room-inventory/preview", "POST", expect.objectContaining({ propertyCode: "58835", rooms: expect.any(Array) }));
  });
});
