const Mux = require('@mux/mux-node');
const Race = require('../models/Race');

const muxClient = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// POST /admin/races/:raceId/stream/start — ADMIN
exports.startStream = async (req, res) => {
  try {
    const { raceId } = req.params;
    const race = await Race.findById(raceId);

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    if (race.isLive) {
      return res.status(400).json({ message: 'Stream has already started' });
    }

    // Create live stream on Mux
    const liveStream = await muxClient.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
    });

    const playbackId = liveStream.playback_ids[0].id;
    const streamKey = liveStream.stream_key;

    // Update Race model
    race.streamKey = streamKey;
    race.playbackId = playbackId;
    race.liveStreamId = liveStream.id;
    race.isLive = true;
    race.status = 'ONGOING';
    await race.save();

    res.status(200).json({
      message: 'Stream started successfully',
      raceId: race._id,
      streamKey,
      playbackId,
      isLive: race.isLive,
      status: race.status,
      rtmpIngestUrl: 'rtmp://global-live.mux.com:5222/app',
      streamUrl: `https://stream.mux.com/${playbackId}.m3u8`,
    });
  } catch (error) {
    const statusCode = error.status || error.statusCode || 500;
    let errorDetail = error.message;
    try {
      const jsonStart = error.message.indexOf('{');
      if (jsonStart !== -1) {
        errorDetail = JSON.parse(error.message.substring(jsonStart));
      }
    } catch (e) {
      // Keep original message if parsing fails
    }
    res.status(statusCode).json({
      message: 'Mux API Error',
      error: errorDetail
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
      return res.status(400).json({ message: 'Stream is not active' });
    }

    // Complete the live stream on Mux if we have a liveStreamId
    if (race.liveStreamId) {
      try {
        await muxClient.video.liveStreams.complete(race.liveStreamId);
      } catch (muxError) {
        console.error('Failed to complete live stream on Mux:', muxError.message);
      }
    }

    // Update database status
    race.isLive = false;
    race.status = 'COMPLETED';
    await race.save();

    res.status(200).json({
      message: 'Stream stopped successfully',
      raceId: race._id,
      isLive: race.isLive,
      status: race.status,
    });
  } catch (error) {
    const statusCode = error.status || error.statusCode || 500;
    let errorDetail = error.message;
    try {
      const jsonStart = error.message.indexOf('{');
      if (jsonStart !== -1) {
        errorDetail = JSON.parse(error.message.substring(jsonStart));
      }
    } catch (e) {
      // Keep original message
    }
    res.status(statusCode).json({
      message: 'Mux API Error',
      error: errorDetail
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

    if (!race.isLive || !race.playbackId) {
      return res.status(400).json({ message: 'Stream has not started yet or has ended' });
    }

    res.status(200).json({
      raceId: race._id,
      playbackId: race.playbackId,
      streamUrl: `https://stream.mux.com/${race.playbackId}.m3u8`,
      isLive: race.isLive,
    });
  } catch (error) {
    const statusCode = error.status || error.statusCode || 500;
    let errorDetail = error.message;
    try {
      const jsonStart = error.message.indexOf('{');
      if (jsonStart !== -1) {
        errorDetail = JSON.parse(error.message.substring(jsonStart));
      }
    } catch (e) {
      // Keep original message
    }
    res.status(statusCode).json({
      message: 'Mux API Error',
      error: errorDetail
    });
  }
};
