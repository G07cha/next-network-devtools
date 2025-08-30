# API Mock Server

A comprehensive HTTP API mock server that provides flexible response simulation capabilities for testing and development purposes. Built specifically for the Next Network project to enable thorough testing of network monitoring functionality.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the server in development mode
pnpm dev
```

The server will start on `http://localhost:4000` by default.

## API Endpoints

### Universal Mock Endpoint

**All HTTP Methods**: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`  
**Endpoint**: `/api/mock`

Query parameters control the response behavior:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `status` | number | HTTP status code (100-599) | 200 |
| `delay` | number | Response delay in milliseconds | 0 |
| `contentType` | string | Response format: `json`, `xml`, `html`, `text` | `json` |
| `headers` | JSON string | Custom headers as JSON object | `{}` |
| `body` | string | Custom response body content | Generated content |
| `error` | string | Error condition: `timeout`, `connection`, `server`, `client` | None |
| `size` | number | Minimum response body size in bytes | Natural size |

## Usage Examples

### Basic JSON Response

```bash
curl "http://localhost:4000/api/mock?status=200&body={\"success\":true,\"message\":\"Hello World\"}"
```

### Delayed Response with Custom Headers

```bash
curl "http://localhost:4000/api/mock?delay=2000&headers={\"x-custom-header\":\"test-value\"}&status=201"
```

### XML Response

```bash
curl "http://localhost:4000/api/mock?contentType=xml&body=<user><id>123</id><name>John</name></user>"
```

### Error Simulation

```bash
curl "http://localhost:4000/api/mock?error=server&status=500"
```

### Large Payload Testing

```bash
curl "http://localhost:4000/api/mock?size=1024000&contentType=json"
```

### Different HTTP Methods

```bash
# POST request with body
curl -X POST "http://localhost:4000/api/mock?status=201" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":123}'

# PUT request
curl -X PUT "http://localhost:4000/api/mock?status=200"

# DELETE request
curl -X DELETE "http://localhost:4000/api/mock?status=204"
```

## Content Type Examples

### JSON Response (Default)

```bash
curl "http://localhost:4000/api/mock"
```

Returns:

```json
{
  "message": "Mock API response",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "id": 123,
    "name": "Generated data",
    "value": 0.456
  }
}
```

### XML Response

```bash
curl "http://localhost:4000/api/mock?contentType=xml"
```

Returns:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <message>Mock API response</message>
  <timestamp>2024-01-01T12:00:00.000Z</timestamp>
  <status>success</status>
  <data>
    <id>123</id>
    <name>Generated data</name>
    <value>0.456</value>
  </data>
</response>
```

### HTML Response

```bash
curl "http://localhost:4000/api/mock?contentType=html"
```

### Plain Text Response

```bash
curl "http://localhost:4000/api/mock?contentType=text"
```

## Error Conditions

Simulate various network and server conditions:

| Error Type | Status Code | Description |
|------------|-------------|-------------|
| `timeout` | 504 | Gateway timeout simulation |
| `connection` | 502 | Connection failure |
| `server` | 500 | Internal server error |
| `client` | 400 | Bad request error |

Example:

```bash
curl "http://localhost:4000/api/mock?error=timeout"
```
