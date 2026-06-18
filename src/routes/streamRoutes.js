const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { startStream, stopStream, getStream } = require('../controllers/streamController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Streams
 *   description: Race live streaming endpoints
 */

/**
 * @swagger
 * /admin/races/{raceId}/stream/start:
 *   post:
 *     summary: Start a Mux live stream for a race (ADMIN only)
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID to start streaming
 *     responses:
 *       200:
 *         description: Stream started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 streamKey:
 *                   type: string
 *                 playbackId:
 *                   type: string
 *                 isLive:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 rtmpIngestUrl:
 *                   type: string
 *                 streamUrl:
 *                   type: string
 *       400:
 *         description: Stream already started or validation error
 *       404:
 *         description: Race not found
 */
router.post('/admin/races/:raceId/stream/start', protect, authorize('ADMIN'), startStream);

/**
 * @swagger
 * /admin/races/{raceId}/stream/stop:
 *   post:
 *     summary: Stop a Mux live stream for a race (ADMIN only)
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID to stop streaming
 *     responses:
 *       200:
 *         description: Stream stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 isLive:
 *                   type: boolean
 *                 status:
 *                   type: string
 *       400:
 *         description: Stream is not active
 *       404:
 *         description: Race not found
 */
router.post('/admin/races/:raceId/stream/stop', protect, authorize('ADMIN'), stopStream);

/**
 * @swagger
 * /races/{raceId}/stream:
 *   get:
 *     summary: Get HLS streaming URL for a race (All roles)
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID to get HLS stream URL
 *     responses:
 *       200:
 *         description: Live stream HLS URL details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 playbackId:
 *                   type: string
 *                 streamUrl:
 *                   type: string
 *                 isLive:
 *                   type: boolean
 *       400:
 *         description: Stream has not started yet or has ended
 *       404:
 *         description: Race not found
 */
router.get('/races/:raceId/stream', protect, getStream);

module.exports = router;
