import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { BaseToolHandler } from "./BaseToolHandler.js";

interface OAuthSetupInput {
  code: string;
  state?: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

interface OAuthSetupOutput {
  content: Array<{ type: "text"; text: string }>;
}

export class OAuthSetupHandler extends BaseToolHandler {
  async runTool(
    args: OAuthSetupInput,
    oauth2Client: OAuth2Client | null = null
  ): Promise<OAuthSetupOutput> {
    try {
      // Create OAuth2Client with provided credentials (stateless)
      const oAuth2Client = new OAuth2Client(
        args.client_id,
        args.client_secret,
        args.redirect_uri
      );

      // Exchange authorization code for tokens
      const { tokens } = await oAuth2Client.getToken(args.code);
      
      // Set credentials on the client for verification
      oAuth2Client.setCredentials(tokens);

      // Verify the token by getting user info
      const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
      const userInfo = await oauth2.userinfo.get();

      const setupResult = {
        success: true,
        connected: true,
        email: userInfo.data.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        message: "Google Calendar OAuth setup completed successfully",
        timestamp: new Date().toISOString()
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(setupResult, null, 2)
        }]
      };

    } catch (error) {
      const errorResult = {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error during OAuth setup",
        timestamp: new Date().toISOString()
      };

      return {
        content: [{
          type: "text", 
          text: JSON.stringify(errorResult, null, 2)
        }]
      };
    }
  }
}