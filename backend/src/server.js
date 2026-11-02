require("dotenv").config();
const app = require("./app");

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on port ${port}`));

if (process.env.RUN_WORKER !== "false") {
  require("./workers/emailWorker").startEmailWorker();
  console.log("Email worker started");
}