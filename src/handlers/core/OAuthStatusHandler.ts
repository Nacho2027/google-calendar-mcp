import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";

interface OAuthStatusArgs {
  // OAuth credentials to test
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

interface OAuthStatusOutput {
  content: Array<{ type: "text"; text: string }>;
}

export class OAuthStatusHandler extends BaseToolHandler {
  async runTool(
    args: OAuthStatusArgs,
    oauth2Client: OAuth2Client | null = null
  ): Promise<OAuthStatusOutput> {
    try {
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
      
      // Test the credentials by making a simple API call
      const calendar = this.getCalendar(oAuth2Client);
      await calendar.calendarList.list({ maxResults: 1 });
      
      const statusInfo = {
        connected: true,
        message: "Google Calendar is connected and credentials are valid",
        timestamp: new Date().toISOString()
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(statusInfo, null, 2)
        }]
      };
      
    } catch (error) {
      const statusInfo = {
        connected: false,
        message: "Google Calendar OAuth credentials are invalid or expired",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(statusInfo, null, 2)
        }]
      };
    }
  }
}