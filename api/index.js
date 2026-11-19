let app;
let initError = null;

try {
  app = require('../backend/server');
} catch (err) {
  initError = err;
  console.error("FATAL ERROR loading backend/server:", err);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      success: false,
      error: "Backend initialization failed: " + initError.message,
      stack: initError.stack
    });
  }

  try {
    return app(req, res);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Request handling failed: " + err.message,
      stack: err.stack
    });
  }
};
