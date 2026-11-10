-- Neutral status for inventory with no current operational snapshot.
ALTER TYPE "RoomStatus" ADD VALUE 'UNKNOWN';
ALTER TYPE "OccupancyStatus" ADD VALUE 'UNKNOWN';
