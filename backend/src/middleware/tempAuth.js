const auth = require("./auth");

// Delegated to JWT auth middleware while preserving x-user-id support
module.exports = auth;
