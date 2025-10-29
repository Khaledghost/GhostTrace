# Behavioural DNA Based Threat Detection System

A comprehensive Node.js/Express backend system for detecting threats based on user behavioral patterns (Behavioral DNA). The system analyzes user activities, builds behavioral profiles, and identifies anomalies that may indicate security threats.

## Features

- **Behavioral Profiling**: Automatically builds unique behavioral profiles for each user based on:
  - Login patterns (time, frequency, duration)
  - Access patterns (endpoints, resources)
  - Geographic patterns (location, IP)
  - Device patterns (device type, browser, OS)
  - Resource usage patterns (CPU, memory, network)

- **Threat Detection**: Real-time analysis of activities to detect:
  - Suspicious login attempts
  - Unusual locations
  - Device mismatches
  - Access anomalies
  - Resource abuse
  - Behavioral deviations

- **Risk Scoring**: Automated risk score calculation (0-100) with threat levels:
  - Low (0-24)
  - Medium (25-49)
  - High (50-79)
  - Critical (80-100)

- **Event Management**: Track and manage threat events with status updates and resolution tracking

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (local or cloud instance)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd graduation
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dna
DB_USER=postgres
DB_PASS=hoho
DB_SYNC=true
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000
ANOMALY_THRESHOLD=0.7
MAX_FAILED_ATTEMPTS=5
```

4. Start PostgreSQL (if using local instance):
```bash
# Windows
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# Mac/Linux
sudo service postgresql start
```

5. Run the application:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## Web UI

The application includes a **modern web dashboard** with the following features:

- **Dashboard View**: Overview of behavioral profiles and threat statistics
- **Activity Tracking**: Track user activities and detect threats in real-time
- **Request Logger**: View all API requests with detailed information including:
  - Request method, path, and status codes
  - Response times and sizes
  - IP addresses and user agents
  - Filter by method, path, or status code

Access the UI at: `http://localhost:3000`

## API Endpoints

### Threat Detection

#### Analyze Activity for Threats
```http
POST /api/threats/analyze
Content-Type: application/json

{
  "accountId": "acc-123",
  "userId": "user-456",
  "activityType": "login",
  "timestamp": "2024-01-15T10:30:00Z",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "deviceInfo": {
    "deviceId": "dev-789",
    "deviceType": "desktop",
    "browser": "Chrome",
    "os": "Windows"
  },
  "location": {
    "country": "US",
    "city": "New York",
    "coordinates": {
      "lat": 40.7128,
      "lon": -74.0060
    }
  },
  "endpoint": "/api/dashboard",
  "resourceUsage": {
    "cpu": 15.5,
    "memory": 1024,
    "networkBytes": 512
  }
}
```

#### Get Threat Events
```http
GET /api/threats/events/:userId?status=pending&severity=high&limit=50
```

#### Get Risk Score
```http
GET /api/threats/risk/:userId?accountId=acc-123
```

#### Get Behavioral Profile
```http
GET /api/threats/profile/:userId?accountId=acc-123
```

#### Update Threat Event Status
```http
PATCH /api/threats/events/:eventId
Content-Type: application/json

{
  "status": "resolved",
  "resolutionNotes": "False positive - user traveling"
}
```

#### Get Threat Statistics
```http
GET /api/threats/stats/:userId
```

### Behavioral Tracking

#### Track Account Activity
```http
POST /api/behavior/track
Content-Type: application/json

{
  "accountId": "acc-123",
  "userId": "user-456",
  "activityType": "login",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "deviceInfo": {
    "deviceId": "dev-789",
    "deviceType": "desktop"
  },
  "location": {
    "country": "US",
    "city": "New York"
  },
  "endpoint": "/api/data",
  "status": "success",
  "responseTime": 150
}
```

#### Get Activity History
```http
GET /api/behavior/history/:userId?accountId=acc-123&startDate=2024-01-01&limit=50
```

#### Get Activity Statistics
```http
GET /api/behavior/stats/:userId?accountId=acc-123
```

### Health Check
```http
GET /health
```

## Architecture

```
/
├── config/
│   ├── database.js          # PostgreSQL/Sequelize connection
│   └── default.json         # Default configuration
├── public/
│   ├── index.html          # Web UI dashboard
│   ├── styles.css          # Dashboard styles
│   └── app.js              # Dashboard JavaScript
├── models/
│   ├── BehavioralProfile.js # User behavioral patterns (Sequelize)
│   ├── ThreatEvent.js       # Detected threats (Sequelize)
│   └── AccountActivity.js   # Activity tracking (Sequelize)
├── routes/
│   ├── threatDetection.js   # Threat detection endpoints
│   ├── behavioralTracking.js # Activity tracking endpoints
│   └── logger.js            # Request logging endpoints
├── services/
│   └── threatDetectionService.js # Core threat detection logic
├── middleware/
│   ├── errorHandler.js      # Error handling
│   └── requestLogger.js     # Request logging middleware
├── server.js                # Main application
└── package.json
```

## How It Works

### 1. Behavioral Profile Creation
When a user's first activity is detected, the system creates a behavioral profile that includes:
- Login patterns and typical hours
- Commonly accessed endpoints
- Geographic locations
- Known devices
- Typical resource usage

### 2. Continuous Learning
With each activity, the profile is updated to reflect:
- New access patterns
- Additional devices
- Broader geographic range
- Evolving resource usage patterns

### 3. Threat Detection
Activities are analyzed against the profile for:
- **Location anomalies**: Access from unknown locations
- **Device mismatches**: Access from unrecognized devices
- **Time anomalies**: Activity at unusual times
- **Access pattern anomalies**: Unexpected endpoint access
- **Resource abuse**: Unusual CPU/memory/network usage

### 4. Risk Scoring
Each anomaly contributes to a risk score:
- Location anomaly: +10 points
- Device mismatch: +8 points
- Time anomaly: +5 points
- Resource abuse: +15 points
- Multiple anomalies: +10 points

The final risk score determines the threat level.

## Configuration

Key configuration values in `config/default.json`:

- `anomalyThreshold`: Minimum deviation to flag (default: 0.7)
- `suspiciousBehaviorWindow`: Time window for suspicious behavior (ms)
- `maxFailedAttempts`: Maximum failed attempts before blocking
- `behavioralWeights`: Weights for different behavioral aspects

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Schema validation for all inputs

## Database Schema

The application uses **PostgreSQL** with **Sequelize ORM**:

### BehavioralProfile
Stores unique behavioral DNA for each user-account pair (JSONB columns for complex data).

### ThreatEvent
Records detected security threats with metadata and resolution status.

### AccountActivity
Logs all user activities for analysis and auditing.

## Request Logging

The system includes a built-in request logger that tracks:
- Request method, path, and status codes
- Response times and sizes
- IP addresses and user agents
- Request/response data

Logs are available via the API at `/api/logger/logs` and visible in the web UI.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Start MongoDB (if local)
mongod

# Run tests (if available)
npm test
```

## Future Enhancements

- Machine learning-based anomaly detection
- Real-time alerting via webhooks
- Admin dashboard UI
- Advanced analytics and reporting
- Integration with SIEM systems
- Geo-fencing capabilities
- Device fingerprinting
- Session replay for investigation

## License

MIT

## Support

For issues and questions, please contact the development team.


