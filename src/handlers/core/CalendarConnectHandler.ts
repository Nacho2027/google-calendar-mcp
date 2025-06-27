import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { google } from 'googleapis';

interface CalendarConnectArgs {
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

export class CalendarConnectHandler extends BaseToolHandler {
  async runTool(args: CalendarConnectArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
    try {
      // Create OAuth2Client from provided tokens
      const oAuth2Client = new OAuth2Client(
        args.client_id,
        args.client_secret
      );
      
      // Set credentials from provided tokens
      oAuth2Client.setCredentials({
        access_token: args.access_token,
        refresh_token: args.refresh_token
      });
      
      // Try to get token info to verify the connection
      const tokenInfo = await oAuth2Client.getTokenInfo(args.access_token);
      
      // Try to access calendar API to verify permissions
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
      
      // Attempt to list calendars (minimal request to verify access)
      const calendarList = await calendar.calendarList.list({
        maxResults: 1,
        fields: 'items(id)'
      });
      
      const status = {
        connected: true,
        tokenValid: true,
        scopes: tokenInfo.scopes || [],
        email: tokenInfo.email || 'unknown',
        expiryDate: tokenInfo.expiry_date,
        hasCalendarAccess: !!calendarList.data.items,
        message: "Successfully connected to Google Calendar"
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
      
    } catch (error: any) {
      let errorDetails = {
        connected: false,
        tokenValid: false,
        error: error.message || 'Unknown error',
        errorCode: error.code || 'UNKNOWN',
        suggestion: this.getErrorSuggestion(error)
      };
      
      // Check if it's a token expiry issue
      if (error.message?.includes('invalid_grant') || error.code === 401) {
        errorDetails.error = 'OAuth token has expired or been revoked';
        errorDetails.suggestion = 'Request a new access token using the refresh token';
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(errorDetails, null, 2)
        }]
      };
    }
  }
  
  private getErrorSuggestion(error: any): string {
    if (error.message?.includes('invalid_grant')) {
      return 'The OAuth token has expired or been revoked. Please re-authenticate.';
    }
    if (error.code === 403) {
      return 'Permission denied. Ensure the token has the necessary Google Calendar scopes.';
    }
    if (error.code === 401) {
      return 'Authentication failed. The access token may be invalid or expired.';
    }
    if (error.message?.includes('network')) {
      return 'Network error. Check your internet connection and try again.';
    }
    return 'Verify your OAuth credentials and ensure they have proper Google Calendar permissions.';
  }
}