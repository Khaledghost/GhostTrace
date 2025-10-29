const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const threatDetectionRoutes = require('./routes/threatDetection');
const behavioralTrackingRoutes = require('./routes/behavioralTracking');
const loggerRoutes = require('./routes/logger');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const RequestLogger = require('./middleware/requestLogger');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "http://localhost:3000"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(RequestLogger.middleware());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
connectDB();

// Routes
app.use('/api/threats', threatDetectionRoutes);
app.use('/api/behavior', behavioralTrackingRoutes);
app.use('/api/logger', loggerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Threat Detection Service is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Threat Detection Server running on port ${PORT}`);
});

module.exports = app;


