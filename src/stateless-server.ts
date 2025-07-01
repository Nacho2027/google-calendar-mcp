import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import stateless tool registry
import { StatelessToolRegistry } from './tools/stateless-registry.js';

// Import transport handlers
import { StdioTransportHandler } from './transports/stdio.js';
import { HttpTransportHandler, HttpTransportConfig } from './transports/http.js';
import { SSETransportHandler } from './transport/sse-transport.js';

// Import config
import { ServerConfig } from './config/TransportConfig.js';

export class StatelessGoogleCalendarMcpServer {
  private server: McpServer;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new McpServer({
      name: "google-calendar-stateless",
      version: "2.0.0"
    });
  }

  async initialize(): Promise<void> {
    console.log('🎯 Starting Google Calendar Stateless MCP Server...');
    
    // 1. Set up Stateless Tool Definitions (no OAuth initialization required)
    console.log('📋 Registering stateless tools...');
    this.registerStatelessTools();

    // 2. Set up Graceful Shutdown
    this.setupGracefulShutdown();
    console.log('✅ Initialization complete!');
  }

  private registerStatelessTools(): void {
    try {
      console.log('🔧 About to call StatelessToolRegistry.registerAll...');
      StatelessToolRegistry.registerAll(this.server);
      console.log('✅ StatelessToolRegistry.registerAll completed');
    } catch (error) {
      console.error('❌ Error in registerStatelessTools:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    // Start based on transport type
    switch (this.config.transport.type) {
      case 'stdio':
        const stdioHandler = new StdioTransportHandler(this.server);
        await stdioHandler.connect();
        break;
      case 'http':
        const httpConfig = this.config.transport as HttpTransportConfig;
        const httpHandler = new HttpTransportHandler(this.server, httpConfig);
        await httpHandler.connect();
        break;
      case 'sse':
        const sseHandler = new SSETransportHandler(this.server, {
          port: this.config.transport.port,
          host: this.config.transport.host
        });
        await sseHandler.start();
        break;
      default:
        throw new Error(`Unknown transport type: ${this.config.transport.type}`);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = () => {
      process.stderr.write('\nReceived shutdown signal, shutting down gracefully...\n');
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }
}