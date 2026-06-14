const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllUsers,
  getUserById,
  changeUserRole,
  activateUser,
  deactivateUser,
  deleteUser,
  createUser,
} = require('../controllers/adminUserController');

const router = express.Router();

// All routes require ADMIN authentication
router.use(protect, authorize('ADMIN'));

/**
 * @swagger
 * tags:
 *   name: Admin - Users
 *   description: User management (ADMIN only)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Danh sách tất cả user (filter, search, phân trang)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [OWNER, JOCKEY, SPECTATOR, ADMIN, REFEREE]
 *         description: Filter by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         description: Filter by account status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or fullName (case-insensitive)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page (max 100)
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 totalPages:
 *                   type: integer
 *                   example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       email:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [OWNER, JOCKEY, SPECTATOR, ADMIN, REFEREE]
 *                       phone:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, INACTIVE]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', getAllUsers);

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Admin tạo tài khoản cho OWNER, JOCKEY, REFEREE
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [OWNER, JOCKEY, REFEREE]
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created successfully
 *       400:
 *         description: Invalid input or role
 *       409:
 *         description: Email already exists
 */
router.post('/', createUser);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users/:userId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     summary: Chi tiết user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 email:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [ACTIVE, INACTIVE]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 */
router.get('/:userId', getUserById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/users/:userId/role
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users/{userId}/role:
 *   patch:
 *     summary: Thay đổi role của user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [OWNER, JOCKEY, SPECTATOR, REFEREE]
 *                 example: REFEREE
 *     responses:
 *       200:
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 role:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid role value
 *       403:
 *         description: CANNOT_CHANGE_ADMIN_ROLE
 *       404:
 *         description: User not found
 */
router.patch('/:userId/role', changeUserRole);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/users/:userId/activate
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users/{userId}/activate:
 *   patch:
 *     summary: Kích hoạt tài khoản
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Account is already active
 *       404:
 *         description: User not found
 */
router.patch('/:userId/activate', activateUser);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/users/:userId/deactivate
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users/{userId}/deactivate:
 *   patch:
 *     summary: Vô hiệu hóa tài khoản
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: INACTIVE
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Account is already inactive
 *       403:
 *         description: Cannot deactivate an ADMIN account
 *       404:
 *         description: User not found
 */
router.patch('/:userId/deactivate', deactivateUser);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/users/:userId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Xóa tài khoản (soft delete)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Cannot delete your own account
 *       403:
 *         description: Cannot delete an ADMIN account
 *       404:
 *         description: User not found
 */
router.delete('/:userId', deleteUser);

module.exports = router;
