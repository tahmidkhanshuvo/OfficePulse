const commands = [
  { name: "status", description: "Show all-room OfficePulse status." },
  { name: "room", description: "Show one room status." },
  { name: "usage", description: "Show current and period usage." },
  { name: "alerts", description: "Show active alerts." },
  { name: "closing", description: "Show closing checklist." },
  { name: "ask", description: "Ask the OfficePulse assistant." }
];

console.log(JSON.stringify({ commands, readyToRegister: Boolean(Bun.env.DISCORD_BOT_TOKEN) }, null, 2));
