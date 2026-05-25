const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = err.errors?.map((e) => e.message).join(', ') || 'Validation failed';
  } else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 503;
    message = 'Database error';
  } else if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found';
  } else if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate value';
  }

  if (statusCode >= 500) {
    console.error(`[${req.method}] ${req.originalUrl}`, err);
    if (process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.warn(`[${req.method}] ${req.originalUrl} → ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
