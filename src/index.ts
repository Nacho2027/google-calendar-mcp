import { fileURLToPath } from "url";
import { StatelessGoogleCalendarMcpServer } from './stateless-server.js';
import { parseArgs } from './config/TransportConfig.js';
import { readFileSync } from "fs";
import { join, dirname } from "path";

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

// --- Main Application Logic --- 
async function main() {
  try {
    // Parse command line arguments
    const config = parseArgs(process.argv.slice(2));
    
    console.log('🚀 Starting Google Calendar Stateless MCP Server initialization...');
    console.log('✅ OAuth Token Injection Architecture - credentials passed per request');
    
    // Create and initialize the stateless server (no OAuth during startup)
    const server = new StatelessGoogleCalendarMcpServer(config);
    await server.initialize();
    
    // Start the server with the appropriate transport
    console.log('🌐 Starting transport...');
    await server.start();

  } catch (error: unknown) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}


// OAuth Token Injection Architecture - no standalone auth server needed

function showHelp(): void {
  process.stdout.write(`
Google Calendar Stateless MCP Server v${VERSION}

Usage:
  npx @cocal/google-calendar-mcp [command]

Commands:
  start    Start the stateless MCP server (default)
  version  Show version information
  help     Show this help message

Examples:
  npx @cocal/google-calendar-mcp start
  npx @cocal/google-calendar-mcp version
  npx @cocal/google-calendar-mcp

OAuth Token Injection Architecture:
  This server receives OAuth credentials as parameters to each tool call.
  No local OAuth setup or file-based credentials required.
`);
}

function showVersion(): void {
  process.stdout.write(`Google Calendar MCP Server v${VERSION}\n`);
}

// --- Exports & Execution Guard --- 
// Export main for testing or potential programmatic use
export { main };

// Parse CLI arguments
function parseCliArgs(): { command: string | undefined } {
  const args = process.argv.slice(2);
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle special version/help flags as commands
    if (arg === '--version' || arg === '-v' || arg === '--help' || arg === '-h') {
      command = arg;
      continue;
    }
    
    // Skip transport options and their values
    if (arg === '--transport' || arg === '--port' || arg === '--host') {
      i++; // Skip the next argument (the value)
      continue;
    }
    
    // Skip other flags
    if (arg === '--debug') {
      continue;
    }
    
    // Check for command (first non-option argument)
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
  }

  return { command };
}

// CLI logic here (run always)
const { command } = parseCliArgs();

switch (command) {
  case "start":
  case void 0:
    main().catch((error) => {
      process.stderr.write(`Failed to start server: ${error}\n`);
      process.exit(1);
    });
    break;
  case "version":
  case "--version":
  case "-v":
    showVersion();
    break;
  case "help":
  case "--help":
  case "-h":
    showHelp();
    break;
  default:
    process.stderr.write(`Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
}