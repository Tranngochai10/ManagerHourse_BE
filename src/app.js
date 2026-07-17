const express = require("express");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const horseRoutes = require("./routes/horseRoutes");
const jockeyRoutes = require("./routes/jockeyRoutes");

const adminHorseRoutes = require("./routes/adminHorseRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");

const scheduleRoutes = require("./routes/scheduleRoutes");

const tournamentRoutes = require("./routes/tournamentRoutes");
const adminTournamentRoutes = require("./routes/adminTournamentRoutes");

const raceRoutes = require("./routes/raceRoutes");
const adminRaceRoutes = require("./routes/adminRaceRoutes");

const refereeRoutes = require("./routes/refereeRoutes");

const resultRoutes = require("./routes/resultRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const streamRoutes = require("./routes/streamRoutes");
const statsRoutes = require("./routes/statsRoutes");

const app = express();

// Middleware - CORS phải đứng ĐẦU TIÊN trước mọi routes
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
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
app.use("/admin/users", adminUserRoutes);

app.use("/", scheduleRoutes);

app.use("/tournaments", tournamentRoutes);
app.use("/admin/tournaments", adminTournamentRoutes);

app.use("/races", raceRoutes);

// for PATCH /horses/me/:horseId/confirm-race/:raceId
app.use("/horses", raceRoutes);

app.use("/admin/races", adminRaceRoutes);

app.use("/referee", refereeRoutes);

// Result & Ranking routes — resultRoutes đã khai báo prefix đầy đủ bên trong
// (e.g. "/races/:raceId", "/tournaments/:tournId/leaderboard")
app.use("/", resultRoutes);

// Prediction & Betting routes
app.use("/", predictionRoutes);

app.use("/", streamRoutes);

app.use("/", statsRoutes);

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
