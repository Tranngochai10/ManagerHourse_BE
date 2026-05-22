const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createHorse,
  getMyHorses,
  getHorseById,
  updateHorse,
  deleteHorse,
  registerHorseForRace,
} = require("../controllers/horseController");
const {
  sendInvitation,
  getHorseJockeys,
  confirmJockey,
} = require("../controllers/jockeyController");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Horses
 *   description: Horse management for owners
 */

/**
 * @swagger
 * /horses:
 *   post:
 *     summary: Register a new horse
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - breed
 *               - age
 *               - weight
 *               - color
 *               - gender
 *               - origin
 *               - healthCertUrl
 *             properties:
 *               name:
 *                 type: string
 *               breed:
 *                 type: string
 *               age:
 *                 type: number
 *               weight:
 *                 type: number
 *               color:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE]
 *               origin:
 *                 type: string
 *               healthCertUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created horse
 *       400:
 *         description: Validation error
 */
router.post("/", authorize("OWNER"), createHorse);

/**
 * @swagger
 * /horses/me:
 *   get:
 *     summary: Get all horses owned by current user
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of horses
 */
router.get("/me", authorize("OWNER"), getMyHorses);

/**
 * @swagger
 * /horses/{horseId}:
 *   get:
 *     summary: Get a specific horse
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Horse details
 *       404:
 *         description: Horse not found
 */
router.get("/:horseId", authorize("OWNER", "ADMIN", "REFEREE"), getHorseById);

/**
 * @swagger
 * /horses/{horseId}:
 *   put:
 *     summary: Update a horse
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               breed:
 *                 type: string
 *               age:
 *                 type: number
 *               weight:
 *                 type: number
 *               color:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE]
 *               origin:
 *                 type: string
 *               healthCertUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated horse
 */
router.put("/:horseId", authorize("OWNER"), updateHorse);

/**
 * @swagger
 * /horses/{horseId}:
 *   delete:
 *     summary: Delete a horse
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       400:
 *         description: Cannot delete horse registered for race
 */
router.delete("/:horseId", authorize("OWNER"), deleteHorse);

/**
 * @swagger
 * /horses/{horseId}/register-race:
 *   post:
 *     summary: Register a horse for a race
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - raceId
 *             properties:
 *               raceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully registered
 *       409:
 *         description: Already registered
 */
router.post(
  "/:horseId/register-race",
  authorize("OWNER"),
  registerHorseForRace,
);

/**
 * @swagger
 * /horses/{horseId}/invitations:
 *   post:
 *     summary: Send invitation to jockey
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jockeyId
 *               - raceId
 *             properties:
 *               jockeyId:
 *                 type: string
 *               raceId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       409:
 *         description: Jockey already invited
 */
router.post("/:horseId/invitations", authorize("OWNER"), sendInvitation);

/**
 * @swagger
 * /horses/{horseId}/jockeys:
 *   get:
 *     summary: Get jockeys for a horse
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of jockeys
 */
router.get("/:horseId/jockeys", authorize("OWNER"), getHorseJockeys);

/**
 * @swagger
 * /horses/{horseId}/jockeys/{jockeyId}/confirm:
 *   patch:
 *     summary: Confirm jockey for race
 *     tags: [Horses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jockeyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - raceId
 *             properties:
 *               raceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Jockey confirmed successfully
 */
router.patch(
  "/:horseId/jockeys/:jockeyId/confirm",
  authorize("OWNER"),
  confirmJockey,
);

module.exports = router;
