const Race = require('../models/Race');

// POST /admin/races/:raceId/stream/start — ADMIN
exports.startStream = async (req, res) => {
  try {
    const { raceId } = req.params;
    const race = await Race.findById(raceId);

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    if (race.isLive) {
      return res.status(400).json({ message: 'Stream/Race has already started' });
    }

    // Mock values instead of calling Mux API
    const playbackId = 'mock_playback_' + raceId;
    const streamKey = 'mock_key_' + raceId;

    // Update Race model
    race.streamKey = streamKey;
    race.playbackId = playbackId;
    race.liveStreamId = 'mock_live_id_' + raceId;
    race.isLive = true;
    race.status = 'ONGOING';
    await race.save();

    res.status(200).json({
      message: 'Simulated race started successfully',
      raceId: race._id,
      streamKey,
      playbackId,
      isLive: race.isLive,
      status: race.status,
      rtmpIngestUrl: 'rtmps://global-live.mux.com/app',
      streamUrl: 'simulated',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to start simulation',
      error: error.message
    });
  }
};

// POST /admin/races/:raceId/stream/stop — ADMIN
exports.stopStream = async (req, res) => {
  try {
    const { raceId } = req.params;
    const race = await Race.findById(raceId);

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    if (!race.isLive) {
      return res.status(400).json({ message: 'Stream/Race is not active' });
    }

    // Update database status
    race.isLive = false;
    race.status = 'COMPLETED';
    await race.save();

    res.status(200).json({
      message: 'Simulated race stopped successfully',
      raceId: race._id,
      isLive: race.isLive,
      status: race.status,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to stop simulation',
      error: error.message
    });
  }
};

// GET /races/:raceId/stream — SPECTATOR
exports.getStream = async (req, res) => {
  try {
    const { raceId } = req.params;
    const race = await Race.findById(raceId);

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    if (!race.isLive) {
      return res.status(400).json({ message: 'Race has not started yet or has ended' });
    }

    res.status(200).json({
      raceId: race._id,
      playbackId: race.playbackId || 'simulated',
      streamUrl: 'simulated',
      isLive: race.isLive,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to retrieve simulation state',
      error: error.message
    });
  }
};
