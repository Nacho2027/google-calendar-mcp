import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { FreeBusyEventHandler } from "./FreeBusyEventHandler.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface CalendarAvailabilityArgs {
  calendars: string[];
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  // Optional: return suggested free slots
  suggestFreeSlots?: boolean;
  // Optional: minimum duration for free slots (in minutes)
  minSlotDuration?: number;
  // OAuth credentials
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

export class CalendarAvailabilityHandler extends BaseToolHandler {
  private freeBusyHandler = new FreeBusyEventHandler();

  async runTool(args: CalendarAvailabilityArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
    // Create OAuth2Client from provided credentials
    const client = new OAuth2Client(
      args.client_id,
      args.client_secret
    );
    
    client.setCredentials({
      access_token: args.access_token,
      refresh_token: args.refresh_token
    });
    
    // Validate required parameters
    if (!args.calendars || args.calendars.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "At least one calendar must be specified"
      );
    }
    
    if (!args.timeMin || !args.timeMax) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "timeMin and timeMax are required"
      );
    }

    // Get the basic free/busy information
    const freeBusyResult = await this.freeBusyHandler.runTool(args, client);
    
    // If suggestFreeSlots is not requested, return the standard free/busy result
    if (!args.suggestFreeSlots) {
      return freeBusyResult;
    }

    // Enhanced functionality: Find and suggest free time slots
    try {
      const freeBusyData = JSON.parse(freeBusyResult.content[0].text);
      const minDuration = args.minSlotDuration || 30; // Default 30 minutes
      
      // Find common free slots across all calendars
      const freeSlots = this.findCommonFreeSlots(
        freeBusyData.calendars,
        args.timeMin,
        args.timeMax,
        minDuration
      );
      
      // Enhance the result with suggested free slots
      const enhancedResult = {
        ...freeBusyData,
        suggestedFreeSlots: freeSlots,
        searchCriteria: {
          minSlotDuration: minDuration,
          timeZone: args.timeZone || "UTC"
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(enhancedResult, null, 2)
        }]
      };
    } catch (error) {
      // If enhancement fails, return the original result
      return freeBusyResult;
    }
  }

  private findCommonFreeSlots(
    calendars: any,
    timeMin: string,
    timeMax: string,
    minDurationMinutes: number
  ): Array<{start: string, end: string, duration: number}> {
    const slots: Array<{start: string, end: string, duration: number}> = [];
    
    // Convert all busy periods to a unified timeline
    const busyPeriods: Array<{start: Date, end: Date}> = [];
    
    for (const calendarId in calendars) {
      const calendar = calendars[calendarId];
      if (calendar.busy) {
        calendar.busy.forEach((period: any) => {
          busyPeriods.push({
            start: new Date(period.start),
            end: new Date(period.end)
          });
        });
      }
    }
    
    // Sort busy periods by start time
    busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Merge overlapping busy periods
    const mergedBusy = this.mergeBusyPeriods(busyPeriods);
    
    // Find free slots between busy periods
    const searchStart = new Date(timeMin);
    const searchEnd = new Date(timeMax);
    let currentTime = searchStart;
    
    for (const busy of mergedBusy) {
      if (busy.start > currentTime) {
        const slotDuration = (busy.start.getTime() - currentTime.getTime()) / (1000 * 60); // in minutes
        if (slotDuration >= minDurationMinutes) {
          slots.push({
            start: currentTime.toISOString(),
            end: busy.start.toISOString(),
            duration: Math.floor(slotDuration)
          });
        }
      }
      currentTime = busy.end > currentTime ? busy.end : currentTime;
    }
    
    // Check for free slot after last busy period
    if (currentTime < searchEnd) {
      const slotDuration = (searchEnd.getTime() - currentTime.getTime()) / (1000 * 60);
      if (slotDuration >= minDurationMinutes) {
        slots.push({
          start: currentTime.toISOString(),
          end: searchEnd.toISOString(),
          duration: Math.floor(slotDuration)
        });
      }
    }
    
    return slots;
  }

  private mergeBusyPeriods(periods: Array<{start: Date, end: Date}>): Array<{start: Date, end: Date}> {
    if (periods.length === 0) return [];
    
    const merged: Array<{start: Date, end: Date}> = [periods[0]];
    
    for (let i = 1; i < periods.length; i++) {
      const last = merged[merged.length - 1];
      const current = periods[i];
      
      if (current.start <= last.end) {
        // Overlapping or adjacent periods - merge them
        last.end = current.end > last.end ? current.end : last.end;
      } else {
        // Non-overlapping period - add it
        merged.push(current);
      }
    }
    
    return merged;
  }
}