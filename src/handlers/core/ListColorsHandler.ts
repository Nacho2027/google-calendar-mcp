import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from "googleapis";

interface ListColorsArgs {
  access_token: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
}

export class ListColorsHandler extends BaseToolHandler {
    async runTool(args: ListColorsArgs, oauth2Client: OAuth2Client | null = null): Promise<CallToolResult> {
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
        
        const colors = await this.listColors(oAuth2Client);
        return {
            content: [{
                type: "text",
                text: `Available event colors:\n${this.formatColorList(colors)}`,
            }],
        };
    }

    private async listColors(client: OAuth2Client): Promise<calendar_v3.Schema$Colors> {
        try {
            const calendar = this.getCalendar(client);
            const response = await calendar.colors.get();
            if (!response.data) throw new Error('Failed to retrieve colors');
            return response.data;
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }

    /**
     * Formats the color information into a user-friendly string.
     */
    private formatColorList(colors: calendar_v3.Schema$Colors): string {
        const eventColors = colors.event || {};
        return Object.entries(eventColors)
            .map(([id, colorInfo]) => `Color ID: ${id} - ${colorInfo.background} (background) / ${colorInfo.foreground} (foreground)`)
            .join("\n");
    }
}
