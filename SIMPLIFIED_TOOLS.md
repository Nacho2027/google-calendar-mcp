# Google Calendar MCP - Simplified Tools (v3.0)

## Overview
This version reduces the number of Google Calendar tools from 10 to 4, following AI tool design best practices to minimize cognitive load on AI assistants while maintaining full functionality.

## The 4 Simplified Tools

### 1. `calendar-manage`
**Purpose**: Read and search calendar information  
**Operations**: 
- `list-calendars` - List all accessible calendars
- `list-events` - List events from calendars  
- `search-events` - Search events by text query
- `list-colors` - List available calendar/event colors

**Example**:
```json
{
  "tool": "calendar-manage",
  "operation": "search-events",
  "query": "team meeting",
  "calendarId": "primary",
  "timeMin": "2024-01-01T00:00:00Z",
  "timeMax": "2024-01-31T23:59:59Z"
}
```

### 2. `calendar-modify`
**Purpose**: Create, update, or delete calendar events  
**Operations**:
- `create` - Create a new event
- `update` - Update an existing event
- `delete` - Delete an event

**Example**:
```json
{
  "tool": "calendar-modify",
  "operation": "create",
  "calendarId": "primary",
  "summary": "Team Standup",
  "startDateTime": "2024-01-15T10:00:00Z",
  "endDateTime": "2024-01-15T10:30:00Z",
  "description": "Daily team sync"
}
```

### 3. `calendar-availability`
**Purpose**: Check free/busy times and find available slots  
**Features**:
- Basic free/busy checking
- Enhanced mode with suggested free slots
- Configurable minimum slot duration

**Example**:
```json
{
  "tool": "calendar-availability",
  "calendars": ["primary", "team@company.com"],
  "timeMin": "2024-01-15T00:00:00Z",
  "timeMax": "2024-01-16T00:00:00Z",
  "suggestFreeSlots": true,
  "minSlotDuration": 30
}
```

### 4. `calendar-connect`
**Purpose**: Verify Google Calendar connection and OAuth status  
**Use Cases**:
- Check if credentials are valid
- Verify calendar access permissions
- Debug connection issues

## Migration from v2.0

### Tool Mapping
- `list-calendars` → `calendar-manage` with `operation: "list-calendars"`
- `list-events` → `calendar-manage` with `operation: "list-events"`
- `search-events` → `calendar-manage` with `operation: "search-events"`
- `list-colors` → `calendar-manage` with `operation: "list-colors"`
- `create-event` → `calendar-modify` with `operation: "create"`
- `update-event` → `calendar-modify` with `operation: "update"`
- `delete-event` → `calendar-modify` with `operation: "delete"`
- `get-freebusy` → `calendar-availability`
- `calendar-oauth-status` → `calendar-connect`
- `get-current-time` → **Removed** (AI assistants already know the time)

## Benefits of Simplification

1. **Reduced Cognitive Load**: 60% fewer tools for AI to consider
2. **Clearer Intent**: Tool names directly map to user intentions
3. **Flexible Operations**: Parameter-based operations within each tool
4. **Better Discoverability**: Grouped by functionality rather than individual actions
5. **Maintains Full Functionality**: All v2.0 capabilities preserved

## Best Practices for AI Assistants

When using these simplified tools:
1. Start with `calendar-connect` to verify access
2. Use `calendar-manage` for all read operations
3. Use `calendar-modify` for all write operations
4. Use `calendar-availability` specifically for scheduling tasks

This design follows Anthropic's guidance to "start simple" and prioritize clarity in AI agent design.