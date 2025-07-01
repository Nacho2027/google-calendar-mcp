import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import simplified handlers  
import { CalendarManageHandler } from "../handlers/core/CalendarManageHandler.js";
import { CalendarModifyHandler } from "../handlers/core/CalendarModifyHandler.js";
import { CalendarAvailabilityHandler } from "../handlers/core/CalendarAvailabilityHandler.js";
import { CalendarConnectHandler } from "../handlers/core/CalendarConnectHandler.js";

// OAuth credentials schema - used by all tools
const OAuthCredentialsSchema = z.object({
  access_token: z.string().optional().describe("Google OAuth access token"),
  refresh_token: z.string().optional().describe("Google OAuth refresh token"),
  client_id: z.string().optional().describe("Google OAuth client ID"),
  client_secret: z.string().optional().describe("Google OAuth client secret")
});

// Define simplified tool schemas with OAuth credentials
export const StatelessToolSchemas = {
  'calendar-manage': z.object({
    operation: z.enum(["list-calendars", "list-events", "search-events", "list-colors"])
      .describe("The read operation to perform"),
    
    // Optional parameters for list-events and search-events
    calendarId: z.union([z.string(), z.array(z.string())])
      .optional()
      .describe("Calendar ID(s) to query. Defaults to 'primary'. Can be a single ID or array of IDs."),
    
    // For search-events operation
    query: z.string()
      .optional()
      .describe("Search query (required for search-events operation)"),
    
    // Time range parameters
    timeMin: z.string()
      .optional()
      .describe("Start time boundary (ISO 8601 format)"),
    timeMax: z.string()
      .optional()
      .describe("End time boundary (ISO 8601 format)"),
    timeZone: z.string()
      .optional()
      .describe("IANA timezone (e.g., America/Los_Angeles)")
  }).merge(OAuthCredentialsSchema),
  
  'calendar-modify': z.object({
    operation: z.enum(["create", "update", "delete"])
      .describe("The modification operation to perform"),
    calendarId: z.string()
      .describe("ID of the calendar (use 'primary' for main calendar)"),
    
    // For update and delete operations
    eventId: z.string()
      .optional()
      .describe("Event ID (required for update/delete operations)"),
    
    // Event data fields
    summary: z.string()
      .optional()
      .describe("Event title (required for create, optional for update)"),
    description: z.string()
      .optional()
      .describe("Event description"),
    location: z.string()
      .optional()
      .describe("Event location"),
    startDateTime: z.string()
      .optional()
      .describe("Start date/time (ISO 8601, required for create)"),
    endDateTime: z.string()
      .optional()
      .describe("End date/time (ISO 8601, required for create)"),
    timeZone: z.string()
      .optional()
      .describe("IANA timezone"),
    attendees: z.array(z.string())
      .optional()
      .describe("Email addresses of attendees"),
    colorId: z.string()
      .optional()
      .describe("Event color ID")
  }).merge(OAuthCredentialsSchema),

  'calendar-availability': z.object({
    calendars: z.array(z.string())
      .describe("Calendar IDs to check for availability"),
    timeMin: z.string()
      .describe("Start of availability check period (ISO 8601)"),
    timeMax: z.string()
      .describe("End of availability check period (ISO 8601)"),
    timeZone: z.string()
      .optional()
      .describe("IANA timezone"),
    suggestFreeSlots: z.boolean()
      .optional()
      .describe("Whether to suggest free time slots"),
    minSlotDuration: z.number()
      .optional()
      .describe("Minimum duration for free slots in minutes (default: 30)")
  }).merge(OAuthCredentialsSchema),

  'calendar-connect': z.object({}).merge(OAuthCredentialsSchema)
};

export class StatelessToolRegistry {
  static registerAll(server: McpServer): void {
    console.log('🔧 Registering stateless tools...');
    
    // Tool descriptions for better clarity
    const toolDescriptions: Record<string, string> = {
      'calendar-manage': 'Read and search calendar information (calendars, events, colors)',
      'calendar-modify': 'Create, update, or delete calendar events',
      'calendar-availability': 'Check free/busy times and find available slots',
      'calendar-connect': 'Verify Google Calendar connection and OAuth status'
    };

    // Create combined schema shapes using the .shape property (Zod merged schemas)
    const inputSchemas = {
      'calendar-manage': StatelessToolSchemas['calendar-manage'].shape,
      'calendar-modify': StatelessToolSchemas['calendar-modify'].shape,
      'calendar-availability': StatelessToolSchemas['calendar-availability'].shape,
      'calendar-connect': StatelessToolSchemas['calendar-connect'].shape
    };

    // Register each tool individually
    Object.entries(StatelessToolSchemas).forEach(([name, schema]) => {
      console.log(`🔧 Registering tool: ${name}`);
      
      server.registerTool(
        name,
        {
          description: toolDescriptions[name] || `Google Calendar tool: ${name}`,
          inputSchema: inputSchemas[name as keyof typeof inputSchemas]
        },
        async (args: any) => {
          try {
            // Validate arguments
            const validatedArgs = schema.parse(args);
            
            // Route to the appropriate handler
            switch (name) {
              case 'calendar-manage':
                return await new CalendarManageHandler().runTool(validatedArgs);
              case 'calendar-modify':
                return await new CalendarModifyHandler().runTool(validatedArgs);
              case 'calendar-availability':
                return await new CalendarAvailabilityHandler().runTool(validatedArgs);
              case 'calendar-connect':
                return await new CalendarConnectHandler().runTool(validatedArgs);
              default:
                throw new Error(`Unknown tool: ${name}`);
            }
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
                }
              ],
              isError: true
            };
          }
        }
      );
      console.log(`✅ Tool ${name} registered successfully`);
    });
    console.log(`🎯 All ${Object.keys(StatelessToolSchemas).length} tools registered!`);
  }
}