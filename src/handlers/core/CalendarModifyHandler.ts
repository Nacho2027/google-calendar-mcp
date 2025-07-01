import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { CreateEventHandler } from "./CreateEventHandler.js";
import { UpdateEventHandler } from "./UpdateEventHandler.js";
import { DeleteEventHandler } from "./DeleteEventHandler.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

type ModifyOperation = "create" | "update" | "delete";

interface BaseModifyArgs {
  operation: ModifyOperation;
  calendarId: string;
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

interface CreateEventArgs extends BaseModifyArgs {
  operation: "create";
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
  colorId?: string;
}

interface UpdateEventArgs extends BaseModifyArgs {
  operation: "update";
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendees?: string[];
  colorId?: string;
}

interface DeleteEventArgs extends BaseModifyArgs {
  operation: "delete";
  eventId: string;
}

type CalendarModifyArgs = CreateEventArgs | UpdateEventArgs | DeleteEventArgs;

export class CalendarModifyHandler extends BaseToolHandler {
  private createEventHandler = new CreateEventHandler();
  private updateEventHandler = new UpdateEventHandler();
  private deleteEventHandler = new DeleteEventHandler();

  async runTool(args: CalendarModifyArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
    // Create OAuth2Client from provided credentials
    const client = new OAuth2Client(
      args.client_id,
      args.client_secret
    );
    
    client.setCredentials({
      access_token: args.access_token,
      refresh_token: args.refresh_token
    });
    
    // Validate calendarId is provided
    if (!args.calendarId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "calendarId is required for all modification operations"
      );
    }

    // Route to appropriate handler based on operation
    switch (args.operation) {
      case "create": {
        const createArgs = args as CreateEventArgs;
        
        // Validate required fields for create
        if (!createArgs.summary) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "summary is required for creating an event"
          );
        }
        if (!createArgs.startDateTime || !createArgs.endDateTime) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "startDateTime and endDateTime are required for creating an event"
          );
        }
        
        // Map CalendarModifyHandler args to CreateEventHandler args
        const mappedCreateArgs = {
          ...createArgs,
          start: createArgs.startDateTime,
          end: createArgs.endDateTime
        };
        
        return await this.createEventHandler.runTool(mappedCreateArgs, client);
      }
      
      case "update": {
        const updateArgs = args as UpdateEventArgs;
        
        // Validate eventId is provided
        if (!updateArgs.eventId) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "eventId is required for updating an event"
          );
        }
        
        // At least one field should be provided for update
        const updateFields = ['summary', 'description', 'location', 'startDateTime', 
                            'endDateTime', 'timeZone', 'attendees', 'colorId'];
        const hasUpdateField = updateFields.some(field => updateArgs[field as keyof UpdateEventArgs] !== undefined);
        
        if (!hasUpdateField) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "At least one field to update must be provided"
          );
        }
        
        // Map CalendarModifyHandler args to UpdateEventHandler args
        const mappedUpdateArgs = {
          ...updateArgs,
          start: updateArgs.startDateTime,
          end: updateArgs.endDateTime
        };
        
        return await this.updateEventHandler.runTool(mappedUpdateArgs, client);
      }
      
      case "delete": {
        const deleteArgs = args as DeleteEventArgs;
        
        // Validate eventId is provided
        if (!deleteArgs.eventId) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "eventId is required for deleting an event"
          );
        }
        
        return await this.deleteEventHandler.runTool(deleteArgs, client);
      }
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown operation: ${(args as any).operation}. Valid operations are: create, update, delete`
        );
    }
  }
}