"use strict";
import { configDotenv } from "dotenv";
configDotenv();
const config = {
  server: {
    listen: {
      // app listen on
      ip: "0.0.0.0",
      port: process.env.PORT || 3010,
    },
    cors: {
      origin: ["http://localhost:3000"],
    },
    ssl: {
      // ssl/README.md
      cert: "./cert/cert.pem",
      key: "./cert/key.pem",
    },
  },
};
export default config;
