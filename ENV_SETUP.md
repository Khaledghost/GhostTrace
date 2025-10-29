# Environment Setup

Create a `.env` file in the root directory with the following configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/threat_detection

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Threat Detection Settings
ANOMALY_THRESHOLD=0.7
MAX_FAILED_ATTEMPTS=5
```

## Configuration Details

### PORT
Default: `3000`
The port on which the server will listen for incoming connections.

### NODE_ENV
Options: `development`, `production`
Sets the environment mode. Affects error messages and logging.

### MONGODB_URI
Default: `mongodb://localhost:27017/threat_detection`
The MongoDB connection string. Can be local or cloud instance (MongoDB Atlas, etc.)

For MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/threat_detection
```

### JWT_SECRET
A secret key used for JWT token generation. **IMPORTANT**: Change this to a strong, random string in production.

To generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### ALLOWED_ORIGINS
Comma-separated list of allowed origins for CORS. Use `*` for development only (not recommended for production).

### ANOMALY_THRESHOLD
Default: `0.7`
Threshold for anomaly detection (0.0 to 1.0). Lower values mean more sensitive detection.

### MAX_FAILED_ATTEMPTS
Default: `5`
Maximum number of failed attempts before triggering additional security measures.

## Production Recommendations

1. **JWT_SECRET**: Use a strong, randomly generated secret
2. **MONGODB_URI**: Use connection pooling and authentication
3. **CORS**: Specify exact allowed origins instead of using wildcards
4. **NODE_ENV**: Set to `production`
5. **SSL/TLS**: Use HTTPS in production
6. **Monitoring**: Set up logging and monitoring tools
7. **Backup**: Regular MongoDB backups


