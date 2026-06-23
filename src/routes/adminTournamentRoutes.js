const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createTournament,
  updateTournament,
  deleteTournament,
  getTournamentRegistrations,
  updateTournamentRegistration,
  generateHeats,
} = require('../controllers/adminTournamentController');

const router = express.Router();

// All admin tournament routes require authentication + ADMIN role
router.use(protect, authorize('ADMIN'));

/**
 * @swagger
 * tags:
 *   name: Admin - Tournaments
 *   description: Tournament management (ADMIN only)
 */

/**
 * @swagger
 * /admin/tournaments:
 *   post:
 *     summary: Create a new tournament
 *     tags: [Admin - Tournaments]
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
 *               - startDate
 *               - endDate
 *               - venue
 *               - prizePool
 *               - maxHorses
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Giải Đua Ngựa Mùa Xuân 2025"
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-07"
 *               venue:
 *                 type: string
 *                 example: "Trường đua Phú Thọ"
 *               prizePool:
 *                 type: number
 *                 example: 500000000
 *               currency:
 *                 type: string
 *                 example: "VND"
 *               maxHorses:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       201:
 *         description: Tournament created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tournamentId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: DRAFT
 *                 createdAt:
 *                   type: string
 *       400:
 *         description: INVALID_DATE_RANGE
 *       409:
 *         description: NAME_ALREADY_EXISTS
 */
router.post('/', createTournament);

/**
 * @swagger
 * /admin/tournaments/{tournId}:
 *   put:
 *     summary: Update a tournament
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournId
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
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               venue:
 *                 type: string
 *               prizePool:
 *                 type: number
 *               currency:
 *                 type: string
 *               maxHorses:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Updated tournament
 *       400:
 *         description: INVALID_DATE_RANGE or validation error
 *       404:
 *         description: Tournament not found
 *       409:
 *         description: NAME_ALREADY_EXISTS
 */
router.put('/:tournId', updateTournament);

/**
 * @swagger
 * /admin/tournaments/{tournId}:
 *   delete:
 *     summary: Delete a tournament (only if not started)
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament deleted
 *       400:
 *         description: Cannot delete started/completed tournament
 *       404:
 *         description: Tournament not found
 */
router.delete('/:tournId', deleteTournament);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/registrations:
 *   get:
 *     summary: Lấy danh sách đăng ký của một tournament
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Lọc theo trạng thái đăng ký
 *     responses:
 *       200:
 *         description: Danh sách đăng ký
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 tournament:
 *                   type: object
 *                 registrations:
 *                   type: array
 *       404:
 *         description: Tournament not found
 */
router.get('/:tournamentId/registrations', getTournamentRegistrations);

/**
 * @swagger
 * /admin/tournaments/registrations/{registrationId}:
 *   patch:
 *     summary: Duyệt hoặc từ chối đăng ký tournament của ngựa
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: string
 *         description: TournamentRegistration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 example: APPROVED
 *               rejectionReason:
 *                 type: string
 *                 description: Lý do từ chối (chỉ cần khi status=REJECTED)
 *                 example: "Ngựa không đáp ứng yêu cầu trọng lượng"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: status không hợp lệ hoặc đã xử lý xong
 *       404:
 *         description: Registration not found
 */
router.patch('/registrations/:registrationId', updateTournamentRegistration);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/generate-heats:
 *   post:
 *     summary: Tự động tạo các heat từ danh sách ngựa đã APPROVED
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               horsesPerHeat:
 *                 type: integer
 *                 default: 8
 *                 description: Số ngựa tối đa mỗi heat
 *                 example: 8
 *               distanceMeters:
 *                 type: integer
 *                 default: 1200
 *                 description: Cự ly chạy (mét)
 *                 example: 1200
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: "Thời điểm bắt đầu heat đầu tiên (mặc định là startDate của tournament)"
 *                 example: "2025-03-01T08:00:00Z"
 *     responses:
 *       201:
 *         description: Tạo heat thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 heatsCreated:
 *                   type: integer
 *                 races:
 *                   type: array
 *       400:
 *         description: Không đủ ngựa hoặc tournament chưa sẵn sàng
 *       404:
 *         description: Tournament not found
 */
router.post('/:tournamentId/generate-heats', generateHeats);

module.exports = router;
