function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  const status = err.status || 500;
  res.status(status).json({
    type: `https://httpstatuses.com/${status}`,
    title: err.title || 'Internal Server Error',
    status,
    detail: err.message || 'An unexpected error occurred',
  });
}

module.exports = errorHandler;
