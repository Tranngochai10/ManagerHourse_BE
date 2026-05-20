const express = require('express');
const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/authRoutes');
const horseRoutes = require('./routes/horseRoutes');
const adminHorseRoutes = require('./routes/adminHorseRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const adminTournamentRoutes = require('./routes/adminTournamentRoutes');
const raceRoutes = require('./routes/raceRoutes');
const adminRaceRoutes = require('./routes/adminRaceRoutes');

const app = express();

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/horses', horseRoutes);
app.use('/admin/horses', adminHorseRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/admin/tournaments', adminTournamentRoutes);
app.use('/races', raceRoutes);
app.use('/horses', raceRoutes);         // for PATCH /horses/me/:horseId/confirm-race/:raceId
app.use('/admin/races', adminRaceRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware (optional, simple one)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

module.exports = app;
