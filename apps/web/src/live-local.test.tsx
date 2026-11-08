// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, it, expect } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App";
afterEach(cleanup);
const enabled = !!process.env.LOCAL_UI_FIXTURE_FILE;
describe.skipIf(!enabled)(
  "React dashboard against the actual disposable local API",
  () => {
    it("logs in, saves a room, assigns and verifies cleaning, and reads real reports", async () => {
      const f = JSON.parse(
        readFileSync(process.env.LOCAL_UI_FIXTURE_FILE!, "utf8"),
      );
      render(<App />);
      const email = await screen.findByLabelText("Email");
      fireEvent.change(email, { target: { value: f.email } });
      fireEvent.change(screen.getByLabelText("Property code"), {
        target: { value: f.code },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: f.password },
      });
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await screen.findByText(
        "Fictional UI Test Hotel",
        {},
        { timeout: 15000 },
      );
      fireEvent.click(screen.getByRole("button", { name: "Rooms" }));
      const status = await screen.findByRole("combobox", { name: "Room 901 status" });
      fireEvent.change(status, { target: { value: "CLEAN" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText("✓ Saved successfully");
      fireEvent.click(screen.getByRole("button", { name: "Housekeeping" }));
      const assigned = await screen.findByRole("combobox", { name: "Assign room 901" });
      await waitFor(() =>
        expect(
          within(assigned).getByText("Fictional Housekeeper"),
        ).toBeTruthy(),
      );
      fireEvent.change(assigned, { target: { value: f.cleanerId } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
            .disabled,
        ).toBe(true),
      );
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: "Start" }) as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      await screen.findByRole("button", { name: "Complete" });
      fireEvent.click(screen.getByRole("button", { name: "Complete" }));
      await screen.findByRole("button", { name: "Verify clean" });
      fireEvent.click(screen.getByRole("button", { name: "Verify clean" }));
      await screen.findByText("Verified");
      fireEvent.click(screen.getByRole("button", { name: "Reports" }));
      await screen.findByText("Employee cleaning totals");
      await waitFor(() =>
        expect(screen.getByText("1 completed · 1 verified")).toBeTruthy(),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Monthly report" }));
      await screen.findByText(/Monthly employee cleaning totals/);
      await waitFor(() =>
        expect(screen.getByText("Fictional Housekeeper")).toBeTruthy(),
      );
      expect(screen.getByText("Verified", { selector: "small" }).closest("article")?.querySelector("strong")?.textContent).toBe("1");
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      await screen.findByRole("button", { name: "Sign in" });
    }, 30000);
  },
);
