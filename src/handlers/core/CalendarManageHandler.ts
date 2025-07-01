import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { ListCalendarsHandler } from "./ListCalendarsHandler.js";
import { ListEventsHandler } from "./ListEventsHandler.js";
import { SearchEventsHandler } from "./SearchEventsHandler.js";
import { ListColorsHandler } from "./ListColorsHandler.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

type ManageOperation = "list-calendars" | "list-events" | "search-events" | "list-colors";

interface BaseManageArgs {
  operation: ManageOperation;
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

interface ListCalendarsArgs extends BaseManageArgs {
  operation: "list-calendars";
}

interface ListEventsArgs extends BaseManageArgs {
  operation: "list-events";
  calendarId?: string | string[];
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
}

interface SearchEventsArgs extends BaseManageArgs {
  operation: "search-events";
  query: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
}

interface ListColorsArgs extends BaseManageArgs {
  operation: "list-colors";
}

type CalendarManageArgs = ListCalendarsArgs | ListEventsArgs | SearchEventsArgs | ListColorsArgs;

export class CalendarManageHandler extends BaseToolHandler {
  private listCalendarsHandler = new ListCalendarsHandler();
  private listEventsHandler = new ListEventsHandler();
  private searchEventsHandler = new SearchEventsHandler();
  private listColorsHandler = new ListColorsHandler();

  async runTool(args: CalendarManageArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
    // Create OAuth2Client from provided credentials
    const client = new OAuth2Client(
      args.client_id,
      args.client_secret
    );
    
    client.setCredentials({
      access_token: args.access_token,
      refresh_token: args.refresh_token
    });
    
    // Route to appropriate handler based on operation
    switch (args.operation) {
      case "list-calendars":
        return await this.listCalendarsHandler.runTool(args, client);
      
      case "list-events": {
        const listArgs = args as ListEventsArgs;
        // Default to primary calendar if not specified
        const calendarId = listArgs.calendarId || "primary";
        return await this.listEventsHandler.runTool({
          ...listArgs,
          calendarId
        }, client);
      }
      
      case "search-events": {
        const searchArgs = args as SearchEventsArgs;
        // Default to primary calendar if not specified
        const calendarId = searchArgs.calendarId || "primary";
        
        // Validate required query parameter
        if (!searchArgs.query) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Query parameter is required for search-events operation"
          );
        }
        
        return await this.searchEventsHandler.runTool({
          ...searchArgs,
          calendarId,
          // Provide defaults for required time parameters if not specified
          timeMin: searchArgs.timeMin || new Date().toISOString(),
          timeMax: searchArgs.timeMax || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }, client);
      }
      
      case "list-colors":
        return await this.listColorsHandler.runTool(args, client);
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown operation: ${(args as any).operation}. Valid operations are: list-calendars, list-events, search-events, list-colors`
        );
    }
  }
}