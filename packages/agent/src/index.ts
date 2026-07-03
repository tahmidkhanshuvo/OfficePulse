export interface AgentToolDefinition {
  name: string;
  access: "read" | "protected";
  description: string;
}

export const readOnlyAgentTools: AgentToolDefinition[] = [
  { name: "get_office_snapshot", access: "read", description: "Read current rooms, devices, power, occupancy, and alerts." },
  { name: "get_room_status", access: "read", description: "Read one room with devices, occupancy, runtime, power, and alerts." },
  { name: "get_usage_summary", access: "read", description: "Read current watts, period kWh, cost, waste, and savings." },
  { name: "list_active_alerts", access: "read", description: "List active alerts filtered by severity, type, or room." },
  { name: "get_closing_checklist", access: "read", description: "Read outstanding devices, rooms, alerts, and pending shutdowns." },
  { name: "get_system_health", access: "read", description: "Read backend component health and freshness." }
];

export const protectedAgentTools: AgentToolDefinition[] = [
  { name: "propose_device_command", access: "protected", description: "Propose turning one device on or off." },
  { name: "propose_device_timer", access: "protected", description: "Propose an off countdown for one device." },
  { name: "propose_room_shutdown", access: "protected", description: "Propose switching off all controllable room devices." },
  { name: "propose_office_shutdown", access: "protected", description: "Propose switching off all office devices." },
  { name: "propose_emergency_shutdown", access: "protected", description: "Propose immediate protected office shutdown." },
  { name: "propose_alert_acknowledgement", access: "protected", description: "Propose acknowledging an alert." }
];

export const agentTools = [...readOnlyAgentTools, ...protectedAgentTools];
