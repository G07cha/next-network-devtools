# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo using pnpm workspaces with the following packages:

- `packages/nextjs-plugin/` - Next.js instrumentation plugin for OpenTelemetry tracing
- `packages/web-extension/` - Browser extension built with WXT framework
- `testbeds/api-routes-rest-app/` - Next.js test application with API routes

## Development Commands

### Root Level
- `pnpm linter:check` - Check code formatting and linting with Biome
- `pnpm linter:fix` - Auto-fix formatting and linting issues with Biome

### Next.js Plugin (`packages/nextjs-plugin/`)
- No specific build commands configured
- Uses TypeScript with Node 22 configuration
- Implements OpenTelemetry instrumentation with WebSocket server on port 3300

### Web Extension (`packages/web-extension/`)
- `pnpm dev` - Start development server for Chromium
- `pnpm dev:firefox` - Start development server for Firefox
- `pnpm build` - Build extension for Chromium
- `pnpm build:firefox` - Build extension for Firefox
- `pnpm zip` - Create distribution zip for Chromium
- `pnpm zip:firefox` - Create distribution zip for Firefox
- `pnpm compile` - Type check TypeScript without emitting

### Test Application (`testbeds/api-routes-rest-app/`)
- `pnpm dev` - Start Next.js development server
- `pnpm build` - Build Next.js application
- `pnpm start` - Start production server

## Architecture

### Next.js Plugin
The plugin registers OpenTelemetry instrumentation for Node.js applications and starts a local server on port 3300 to serve spans and metrics. Key components:
- `collector.ts` - Data collection logic
- `interceptor.ts` - Request/response interception
- `server.ts` - WebSocket server implementation
- `types.ts` - TypeScript definitions

### Web Extension
Built with WXT framework using React and TailwindCSS:
- DevTools panel integration for network monitoring
- Background and content scripts for data collection
- Uses modern React 19 and TypeScript

### Code Style
- Uses Biome for formatting and linting
- Tab indentation, double quotes for JavaScript
- Import organization enabled
- Recommended linting rules enforced