import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from 'googleapis';
import { formatEventWithDetails } from "../utils.js";
import { createTimeObject } from "../utils/datetime.js";

interface CreateEventArgs {
  calendarId: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  attendees?: Array<{ email: string }>;
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: "email" | "popup"; minutes: number }>;
  };
  recurrence?: string[];
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

export class CreateEventHandler extends BaseToolHandler {
    async runTool(args: CreateEventArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
        // Create OAuth2Client from provided tokens (stateless)
        const oAuth2Client = new OAuth2Client(
            args.client_id,
            args.client_secret
        );
        
        // Set credentials from provided tokens
        oAuth2Client.setCredentials({
            access_token: args.access_token,
            refresh_token: args.refresh_token
        });
        
        const event = await this.createEvent(oAuth2Client, args);
        
        const eventDetails = formatEventWithDetails(event, args.calendarId);
        const text = `Event created successfully!\n\n${eventDetails}`;
        
        return {
            content: [{
                type: "text",
                text: text
            }]
        };
    }

    private async createEvent(
        client: OAuth2Client,
        args: CreateEventArgs
    ): Promise<calendar_v3.Schema$Event> {
        try {
            const calendar = this.getCalendar(client);
            
            // Use provided timezone or calendar's default timezone
            const timezone = args.timeZone || await this.getCalendarTimezone(client, args.calendarId);
            
            const requestBody: calendar_v3.Schema$Event = {
                summary: args.summary,
                description: args.description,
                start: createTimeObject(args.start, timezone),
                end: createTimeObject(args.end, timezone),
                attendees: args.attendees,
                location: args.location,
                colorId: args.colorId,
                reminders: args.reminders,
                recurrence: args.recurrence,
            };
            const response = await calendar.events.insert({
                calendarId: args.calendarId,
                requestBody: requestBody,
            });
            if (!response.data) throw new Error('Failed to create event, no data returned');
            return response.data;
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
