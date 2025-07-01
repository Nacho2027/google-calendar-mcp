import express, { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from 'http';
import cors from 'cors';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userContext?: {
        userId: string;
        userEmail?: string;
      };
    }
  }
}

export interface SSETransportConfig {
  port?: number;
  host?: string;
  corsOrigins?: string[];
}

export class SSETransportHandler {
  private app: express.Application;
  private server: McpServer;
  private httpServer: any;
  private config: SSETransportConfig;
  private transports: { [sessionId: string]: SSEServerTransport } = {};

  constructor(server: McpServer, config: SSETransportConfig = {}) {
    this.server = server;
    this.config = {
      port: config.port || parseInt(process.env.PORT || '8085'),
      host: config.host || process.env.HOST || '0.0.0.0',
      corsOrigins: config.corsOrigins || (process.env.CORS_ORIGINS?.split(',') || ['*'])
    };
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        if (this.config.corsOrigins?.includes('*') || 
            this.config.corsOrigins?.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      
      // Extract user context from headers (ContextForge style)
      const userId = req.headers['x-user-id'] as string;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (userId) {
        req.userId = userId;
        req.userEmail = userEmail;
        req.userContext = { userId, userEmail };
        console.log(`Request from user: ${userId} (${userEmail || 'no email'})`);
      }
      
      next();
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Express error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
      });
    });
  }

  private setupRoutes(): void {
    try {
      console.log('Setting up Express routes...');
      
      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json({ 
          status: 'healthy',
          service: 'google-calendar-mcp-multi',
          version: '2.0.0',
          transport: 'sse'
        });
      });
      console.log('✓ Health route registered');

      // SSE endpoint for establishing the stream - Following JavaScript MCP SDK pattern
      this.app.get('/sse', async (req: Request, res: Response) => {
        console.log('Received GET request to /sse (establishing SSE stream)');
        
        try {
          // Create a new SSE transport for the client
          // The endpoint for POST messages is '/messages'
          const transport = new SSEServerTransport('/messages', res);
          
          // Store the transport by session ID
          const sessionId = transport.sessionId;
          this.transports[sessionId] = transport;
          
          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            console.log(`SSE transport closed for session ${sessionId}`);
            delete this.transports[sessionId];
          };
          
          // Connect the transport to the MCP server - THIS IS THE KEY STEP WE WERE MISSING!
          await this.server.connect(transport);
          
          console.log(`Established SSE stream with session ID: ${sessionId}`);
        } catch (error) {
          console.error('Error establishing SSE stream:', error);
          if (!res.headersSent) {
            res.status(500).send('Error establishing SSE stream');
          }
        }
      });
      console.log('✓ SSE route registered');

      // Messages endpoint for receiving client JSON-RPC requests - Following JavaScript MCP SDK pattern
      // PRESERVES CREDENTIAL INJECTION: User context flows through middleware via x-user-id/x-user-email headers
      this.app.post('/messages', async (req: Request, res: Response) => {
        console.log('Messages endpoint hit');
        
        // Extract session ID from URL query parameter
        const sessionId = req.query.sessionId as string;
        if (!sessionId) {
          console.error('Missing sessionId parameter');
          return res.status(400).send('Missing sessionId parameter');
        }
        
        const transport = this.transports[sessionId];
        if (!transport) {
          console.error(`Session not found: ${sessionId}`);
          return res.status(404).send('Session not found');
        }
        
        try {
          // Handle the POST message with the transport - LET THE SDK HANDLE EVERYTHING!
          // Credential injection happens automatically via ContextForge + our middleware
          await transport.handlePostMessage(req, res, req.body);
        } catch (error) {
          console.error('Error handling request:', error);
          if (!res.headersSent) {
            res.status(500).send('Error handling request');
          }
        }
      });
      console.log('✓ Messages route registered');

    // OAuth callback endpoint for user authentication (preserved from original)
    this.app.post('/oauth/callback', async (req: Request, res: Response) => {
      try {
        const { code, state } = req.body;
        const userId = req.userId || state;
        
        if (!userId) {
          return res.status(400).json({ 
            error: 'User ID is required for OAuth callback' 
          });
        }
        
        if (!code) {
          return res.status(400).json({ 
            error: 'Authorization code is required' 
          });
        }
        
        console.log(`OAuth callback received for user ${userId}`);
        
        res.json({ 
          success: true,
          message: 'OAuth callback received',
          userId 
        });
      } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ 
          error: 'OAuth callback processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Tools discovery endpoint (simplified - the MCP SDK handles tool registration)
    this.app.get('/tools', async (req: Request, res: Response) => {
      try {
        // Return basic tools info - the actual tool discovery is handled by the MCP SDK
        const tools = [
          { name: "calendar-oauth-setup", description: "Setup OAuth connection for Google Calendar access" },
          { name: "calendar-oauth-status", description: "Check if Google Calendar OAuth is connected for a user" },
          { name: "list-calendars", description: "List all available calendars for the authenticated user" },
          { name: "list-events", description: "List events from one or more calendars" },
          { name: "create-event", description: "Create a new calendar event" },
          { name: "update-event", description: "Update an existing calendar event" },
          { name: "delete-event", description: "Delete a calendar event" },
          { name: "find-events", description: "Search for events across calendars" }
        ];
        
        res.json(tools);
      } catch (error) {
        console.error('Error listing tools:', error);
        res.status(500).json({ 
          error: 'Failed to list tools',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get OAuth URL endpoint (preserved from original)
    this.app.get('/oauth/url', async (req: Request, res: Response) => {
      try {
        const userId = req.userId || req.query._user_id;
        
        if (!userId) {
          return res.status(400).json({ 
            error: 'User ID is required to generate OAuth URL' 
          });
        }
        
        res.json({ 
          oauth_url: `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&scope=https://www.googleapis.com/auth/calendar&response_type=code&access_type=offline&prompt=consent&state=${userId}`,
          message: 'Please visit this URL to authorize Google Calendar access'
        });
      } catch (error) {
        console.error('OAuth URL generation error:', error);
        res.status(500).json({ 
          error: 'Failed to generate OAuth URL',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

      // 404 handler
      this.app.use((req: Request, res: Response) => {
        res.status(404).json({ 
          error: 'Not found',
          path: req.path 
        });
      });
      
      console.log('✅ All routes setup completed successfully');
      
    } catch (error) {
      console.error('❌ CRITICAL: Route setup failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = createServer(this.app);
        
        this.httpServer.listen(this.config.port, this.config.host, () => {
          console.log(`SSE transport listening on http://${this.config.host}:${this.config.port}`);
          console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
          console.log(`SSE endpoint: http://${this.config.host}:${this.config.port}/sse`);
          resolve();
        });
        
        this.httpServer.on('error', (error: Error) => {
          console.error('HTTP server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active transports to properly clean up resources
      for (const sessionId in this.transports) {
        try {
          console.log(`Closing transport for session ${sessionId}`);
          this.transports[sessionId].close();
          delete this.transports[sessionId];
        } catch (error) {
          console.error(`Error closing transport for session ${sessionId}:`, error);
        }
      }
      
      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('SSE transport stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}