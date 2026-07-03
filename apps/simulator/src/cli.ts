import { seedDevices } from "../../../packages/domain/src";

const scenario = Bun.argv[2] ?? "normal-day";
const devices = seedDevices();

console.log(
  JSON.stringify(
    {
      scenario,
      events: devices.slice(0, 5).map((device) => ({
        deviceId: device.id,
        status: scenario === "all-off" ? "off" : "on",
        powerWatts: scenario === "all-off" ? 0 : device.ratedWatts,
        observedAt: new Date().toISOString()
      }))
    },
    null,
    2
  )
);
