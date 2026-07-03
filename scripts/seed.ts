import { seedDevices, seedRooms } from "../packages/domain/src";

const rooms = seedRooms();
const devices = seedDevices();

console.log(
  JSON.stringify(
    {
      rooms,
      devices,
      guarantees: {
        roomCount: rooms.length,
        deviceCount: devices.length,
        fans: devices.filter((device) => device.type === "fan").length,
        lights: devices.filter((device) => device.type === "light").length
      }
    },
    null,
    2
  )
);
