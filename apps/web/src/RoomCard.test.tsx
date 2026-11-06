// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { RoomCard } from "./App";
afterEach(cleanup);
const room = {
  id: "fixture-room",
  number: "101",
  floor: 1,
  roomType: "Two Queen",
  status: "DIRTY",
  occupancyStatus: "DEPARTURE",
  notes: "Keep this note",
  version: 3,
};
describe("room save workflow", () => {
  it("sends edits only after Save and shows success after the request succeeds", async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(<RoomCard room={room} editable onSave={save} />);
    fireEvent.change(screen.getByLabelText("Room 101 status"), {
      target: { value: "CLEAN" },
    });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Saved"),
    );
    expect(save).toHaveBeenCalledWith({
      version: 3,
      status: "CLEAN",
      occupancyStatus: "DEPARTURE",
      notes: "Keep this note",
    });
  });
  it("never claims success on a failed save", async () => {
    render(
      <RoomCard
        room={room}
        editable
        onSave={vi.fn().mockResolvedValue(false)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Room 101 status"), {
      target: { value: "CLEAN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Save changes",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("provides a read-only card for staff without room-edit permission", () => {
    render(<RoomCard room={room} editable={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Keep this note")).toBeTruthy();
  });
});
