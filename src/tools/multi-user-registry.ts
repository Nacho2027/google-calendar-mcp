import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "../handlers/core/BaseToolHandler.js";

// Import all handlers
import { ListCalendarsHandler } from "../handlers/core/ListCalendarsHandler.js";
import { ListEventsHandler } from "../handlers/core/ListEventsHandler.js";
import { SearchEventsHandler } from "../handlers/core/SearchEventsHandler.js";
import { ListColorsHandler } from "../handlers/core/ListColorsHandler.js";
import { CreateEventHandler } from "../handlers/core/CreateEventHandler.js";
import { UpdateEventHandler } from "../handlers/core/UpdateEventHandler.js";
import { DeleteEventHandler } from "../handlers/core/DeleteEventHandler.js";
import { FreeBusyEventHandler } from "../handlers/core/FreeBusyEventHandler.js";
import { GetCurrentTimeHandler } from "../handlers/core/GetCurrentTimeHandler.js";
import { OAuthStatusHandler } from "../handlers/core/OAuthStatusHandler.js";
import { OAuthSetupHandler } from "../handlers/core/OAuthSetupHandler.js";

// OAuth credentials schema for stateless operation
const OAuthCredentialsSchema = z.object({
  access_token: z.string().describe("Google OAuth access token"),
  refresh_token: z.string().optional().describe("Google OAuth refresh token"),
  client_id: z.string().describe("Google OAuth client ID"),
  client_secret: z.string().describe("Google OAuth client secret")
});

// User context schema that will be added to all tools
const UserContextSchema = z.object({
  _user_id: z.string().optional().describe("User ID from the calling context (automatically populated)"),
  _user_email: z.string().optional().describe("User email from the calling context (automatically populated)")
});

// Re-export the original tool schemas but with user context added
export const MultiUserToolSchemas = {
  'list-calendars': z.intersection(
    z.intersection(
      z.object({}),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'list-events': z.intersection(
    z.intersection(
      z.object({
        calendarId: z.string().describe(
          "ID of the calendar(s) to list events from. Accepts either a single calendar ID string or an array of calendar IDs (passed as JSON string like '[\"cal1\", \"cal2\"]')"
        ),
        timeMin: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Start time boundary. Preferred: '2024-01-01T00:00:00' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T00:00:00Z' or '2024-01-01T00:00:00-08:00'.")
          .optional(),
        timeMax: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("End time boundary. Preferred: '2024-01-01T23:59:59' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T23:59:59Z' or '2024-01-01T23:59:59-08:00'.")
          .optional(),
        timeZone: z.string().optional().describe(
          "Timezone as IANA Time Zone Database name (e.g., America/Los_Angeles). Takes priority over calendar's default timezone. Only used for timezone-naive datetime strings."
        )
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'search-events': z.intersection(
    z.intersection(
      z.object({
        calendarId: z.string().describe("ID of the calendar (use 'primary' for the main calendar)"),
        query: z.string().describe(
          "Free text search query (searches summary, description, location, attendees, etc.)"
        ),
        timeMin: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Start time boundary. Preferred: '2024-01-01T00:00:00' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T00:00:00Z' or '2024-01-01T00:00:00-08:00'."),
        timeMax: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("End time boundary. Preferred: '2024-01-01T23:59:59' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T23:59:59Z' or '2024-01-01T23:59:59-08:00'."),
        timeZone: z.string().optional().describe(
          "Timezone as IANA Time Zone Database name (e.g., America/Los_Angeles). Takes priority over calendar's default timezone. Only used for timezone-naive datetime strings."
        )
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'list-colors': z.intersection(
    z.intersection(
      z.object({}),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'create-event': z.intersection(
    z.intersection(
      z.object({
        calendarId: z.string().describe("ID of the calendar (use 'primary' for the main calendar)"),
        summary: z.string().describe("Title of the event"),
        description: z.string().optional().describe("Description/notes for the event"),
        start: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Event start time: '2024-01-01T10:00:00'"),
        end: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Event end time: '2024-01-01T11:00:00'"),
        timeZone: z.string().optional().describe(
          "Timezone as IANA Time Zone Database name (e.g., America/Los_Angeles). Takes priority over calendar's default timezone. Only used for timezone-naive datetime strings."
        ),
        location: z.string().optional().describe("Location of the event"),
        attendees: z.array(z.object({
          email: z.string().email().describe("Email address of the attendee")
        })).optional().describe("List of attendee email addresses"),
        colorId: z.string().optional().describe(
          "Color ID for the event (use list-colors to see available IDs)"
        ),
        reminders: z.object({
          useDefault: z.boolean().describe("Whether to use the default reminders"),
          overrides: z.array(z.object({
            method: z.enum(["email", "popup"]).default("popup").describe("Reminder method"),
            minutes: z.number().describe("Minutes before the event to trigger the reminder")
          }).partial({ method: true })).optional().describe("Custom reminders")
        }).describe("Reminder settings for the event").optional(),
        recurrence: z.array(z.string()).optional().describe(
          "Recurrence rules in RFC5545 format (e.g., [\"RRULE:FREQ=WEEKLY;COUNT=5\"])"
        )
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'update-event': z.intersection(
    z.intersection(
      z.object({
        calendarId: z.string().describe("ID of the calendar (use 'primary' for the main calendar)"),
        eventId: z.string().describe("ID of the event to update"),
        summary: z.string().optional().describe("Updated title of the event"),
        description: z.string().optional().describe("Updated description/notes"),
        start: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Updated start time: '2024-01-01T10:00:00'")
          .optional(),
        end: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Updated end time: '2024-01-01T11:00:00'")
          .optional(),
        timeZone: z.string().optional().describe("Updated timezone as IANA Time Zone Database name. If not provided, uses the calendar's default timezone."),
        location: z.string().optional().describe("Updated location"),
        attendees: z.array(z.object({
          email: z.string().email().describe("Email address of the attendee")
        })).optional().describe("Updated attendee list"),
        colorId: z.string().optional().describe("Updated color ID"),
        reminders: z.object({
          useDefault: z.boolean().describe("Whether to use the default reminders"),
          overrides: z.array(z.object({
            method: z.enum(["email", "popup"]).default("popup").describe("Reminder method"),
            minutes: z.number().describe("Minutes before the event to trigger the reminder")
          }).partial({ method: true })).optional().describe("Custom reminders")
        }).describe("Reminder settings for the event").optional(),
        recurrence: z.array(z.string()).optional().describe("Updated recurrence rules"),
        sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe(
          "Whether to send update notifications"
        ),
        modificationScope: z.enum(["thisAndFollowing", "all", "thisEventOnly"]).optional().describe(
          "Scope for recurring event modifications"
        ),
        originalStartTime: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Original start time in the ISO 8601 format '2024-01-01T10:00:00'")
          .optional(),
        futureStartDate: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Start date for future instances in the ISO 8601 format '2024-01-01T10:00:00'")
          .optional()
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'delete-event': z.intersection(
    z.intersection(
      z.object({
        calendarId: z.string().describe("ID of the calendar (use 'primary' for the main calendar)"),
        eventId: z.string().describe("ID of the event to delete"),
        sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe(
          "Whether to send cancellation notifications"
        )
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'get-freebusy': z.intersection(
    z.intersection(
      z.object({
        calendars: z.array(z.object({
          id: z.string().describe("ID of the calendar (use 'primary' for the main calendar)")
        })).describe(
          "List of calendars and/or groups to query for free/busy information"
        ),
        timeMin: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("Start time boundary. Preferred: '2024-01-01T00:00:00' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T00:00:00Z' or '2024-01-01T00:00:00-08:00'."),
        timeMax: z.string()
          .refine((val) => {
            const withTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(val);
            const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
            return withTimezone || withoutTimezone;
          }, "Must be ISO 8601 format: '2026-01-01T00:00:00'")
          .describe("End time boundary. Preferred: '2024-01-01T23:59:59' (uses timeZone parameter or calendar timezone). Also accepts: '2024-01-01T23:59:59Z' or '2024-01-01T23:59:59-08:00'."),
        timeZone: z.string().optional().describe("Timezone for the query"),
        groupExpansionMax: z.number().int().max(100).optional().describe(
          "Maximum number of calendars to expand per group (max 100)"
        ),
        calendarExpansionMax: z.number().int().max(50).optional().describe(
          "Maximum number of calendars to expand (max 50)"
        )
      }),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'get-current-time': z.intersection(
    z.object({
      timeZone: z.string().optional().describe(
        "Optional IANA timezone (e.g., 'America/Los_Angeles', 'Europe/London', 'UTC'). If not provided, returns UTC time and system timezone for reference."
      )
    }),
    UserContextSchema
  ),
  
  'calendar-oauth-status': z.intersection(
    z.intersection(
      z.object({}),
      UserContextSchema
    ),
    OAuthCredentialsSchema
  ),
  
  'calendar-oauth-setup': z.intersection(
    z.intersection(
      z.object({
        code: z.string().describe("Authorization code from Google OAuth callback"),
        state: z.string().optional().describe("State parameter from OAuth callback for CSRF protection"),
        client_id: z.string().describe("Google OAuth client ID"),
        client_secret: z.string().describe("Google OAuth client secret"),
        redirect_uri: z.string().describe("Google OAuth redirect URI")
      }),
      UserContextSchema
    ),
    z.object({})
  )
} as const;

// Generate TypeScript types from schemas
export type MultiUserToolInputs = {
  [K in keyof typeof MultiUserToolSchemas]: z.infer<typeof MultiUserToolSchemas[K]>
};

interface ToolDefinition {
  name: keyof typeof MultiUserToolSchemas;
  description: string;
  schema: z.ZodType<any>;
  handler: new () => BaseToolHandler;
}

export class MultiUserToolRegistry {
  
  private static extractSchemaShape(schema: z.ZodType<any>): any {
    const schemaAny = schema as any;
    
    // Handle ZodEffects (schemas with .refine())
    if (schemaAny._def && schemaAny._def.typeName === 'ZodEffects') {
      return this.extractSchemaShape(schemaAny._def.schema);
    }
    
    // Handle ZodIntersection
    if (schemaAny._def && schemaAny._def.typeName === 'ZodIntersection') {
      const left = this.extractSchemaShape(schemaAny._def.left);
      const right = this.extractSchemaShape(schemaAny._def.right);
      return { ...left, ...right };
    }
    
    // Handle regular ZodObject
    if ('shape' in schemaAny) {
      return schemaAny.shape;
    }
    
    // Handle other nested structures
    if (schemaAny._def && schemaAny._def.schema) {
      return this.extractSchemaShape(schemaAny._def.schema);
    }
    
    // Fallback to the original approach
    return schemaAny._def?.schema?.shape || schemaAny.shape;
  }

  private static tools: ToolDefinition[] = [
    {
      name: "list-calendars",
      description: "List all available calendars for the authenticated user",
      schema: MultiUserToolSchemas['list-calendars'],
      handler: ListCalendarsHandler
    },
    {
      name: "list-events",
      description: "List events from one or more calendars for the authenticated user",
      schema: MultiUserToolSchemas['list-events'],
      handler: ListEventsHandler
    },
    {
      name: "search-events",
      description: "Search for events in a calendar by text query for the authenticated user",
      schema: MultiUserToolSchemas['search-events'],
      handler: SearchEventsHandler
    },
    {
      name: "list-colors",
      description: "List available color IDs and their meanings for calendar events",
      schema: MultiUserToolSchemas['list-colors'],
      handler: ListColorsHandler
    },
    {
      name: "create-event",
      description: "Create a new calendar event for the authenticated user",
      schema: MultiUserToolSchemas['create-event'],
      handler: CreateEventHandler
    },
    {
      name: "update-event",
      description: "Update an existing calendar event for the authenticated user",
      schema: MultiUserToolSchemas['update-event'],
      handler: UpdateEventHandler
    },
    {
      name: "delete-event",
      description: "Delete a calendar event for the authenticated user",
      schema: MultiUserToolSchemas['delete-event'],
      handler: DeleteEventHandler
    },
    {
      name: "get-freebusy",
      description: "Query free/busy information for calendars of the authenticated user",
      schema: MultiUserToolSchemas['get-freebusy'],
      handler: FreeBusyEventHandler
    },
    {
      name: "get-current-time",
      description: "Get current system time and timezone information",
      schema: MultiUserToolSchemas['get-current-time'],
      handler: GetCurrentTimeHandler
    },
    {
      name: "calendar-oauth-status",
      description: "Check if Google Calendar OAuth is connected for the authenticated user",
      schema: MultiUserToolSchemas['calendar-oauth-status'],
      handler: OAuthStatusHandler
    },
    {
      name: "calendar-oauth-setup",
      description: "Complete Google Calendar OAuth setup with authorization code",
      schema: MultiUserToolSchemas['calendar-oauth-setup'],
      handler: OAuthSetupHandler
    }
  ];

  static async registerAll(
    server: McpServer, 
    executeWithHandler: (
      handler: any, 
      args: any,
      userId?: string
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>
  ) {
    
    for (const tool of this.tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: this.extractSchemaShape(tool.schema)
        },
        async (args: any) => {
          // Extract user context from special parameters
          const userId = args._user_id;
          const userEmail = args._user_email;
          
          if (!userId) {
            throw new Error('User context (_user_id) is required for all operations');
          }
          
          // Remove user context from args before validation
          const cleanArgs = { ...args };
          delete cleanArgs._user_id;
          delete cleanArgs._user_email;
          
          // Validate input using our Zod schema (without user context fields)
          const baseSchema = tool.schema._def.left || tool.schema; // Get base schema without intersection
          const validatedArgs = baseSchema.parse(cleanArgs);
          
          // Create handler instance and execute with user context
          const handler = new tool.handler();
          return executeWithHandler(handler, validatedArgs, userId);
        }
      );
    }
  }
  
  static getToolsWithSchemas() {
    return this.tools.map(tool => {
      const jsonSchema = zodToJsonSchema(tool.schema);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: jsonSchema
      };
    });
  }
}