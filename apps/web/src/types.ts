export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  membershipId: string;
  membershipActive: boolean;
};
export type Room = {
  id: string;
  number: string;
  floor: number;
  roomType: string | null;
  status: string;
  occupancyStatus: string;
  notes: string | null;
  version: number;
};
export type Task = {
  id: string;
  room: Room;
  assignedToId: string | null;
  assignedTo: Employee | null;
  cleaningType: string;
  status: string;
  scheduledFor: string;
  completedAt: string | null;
};
export const roomStatuses = [
  "CLEAN",
  "DIRTY",
  "IN_PROGRESS",
  "INSPECTION",
  "MAINTENANCE",
  "OUT_OF_ORDER",
];
export const occupancyStatuses = ["VACANT", "OCCUPIED", "ARRIVAL", "DEPARTURE"];
export const cleaningTypes = [
  "CHECKOUT",
  "STAYOVER",
  "FULL_SERVICE",
  "DEEP_CLEAN",
  "ARRIVAL_TOUCHUP",
];
export const label = (s: string) =>
  s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(
    new Date(),
  );
