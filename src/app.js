const express = require("express");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const horseRoutes = require("./routes/horseRoutes");
const jockeyRoutes = require("./routes/jockeyRoutes");

const adminHorseRoutes = require("./routes/adminHorseRoutes");

const scheduleRoutes = require("./routes/scheduleRoutes");

const tournamentRoutes = require("./routes/tournamentRoutes");
const adminTournamentRoutes = require("./routes/adminTournamentRoutes");

const raceRoutes = require("./routes/raceRoutes");
const adminRaceRoutes = require("./routes/adminRaceRoutes");

const app = express();

// Middleware - CORS phải đứng ĐẦU TIÊN trước mọi routes
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger docs - tự detect URL theo môi trường (local hoặc production)
app.use("/api-docs", swaggerUi.serve, (req, res, next) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const dynamicSpec = {
    ...swaggerSpec,
    servers: [{ url: `${protocol}://${host}`, description: "Current server" }],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Routes
app.use("/auth", authRoutes);

app.use("/horses", horseRoutes);
app.use("/jockeys", jockeyRoutes);

app.use("/admin/horses", adminHorseRoutes);

app.use("/", scheduleRoutes);

app.use("/tournaments", tournamentRoutes);
app.use("/admin/tournaments", adminTournamentRoutes);

app.use("/races", raceRoutes);

// for PATCH /horses/me/:horseId/confirm-race/:raceId
app.use("/horses", raceRoutes);

app.use("/admin/races", adminRaceRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: "Something went wrong!",
    error: err.message,
  });
});

module.exports = app;