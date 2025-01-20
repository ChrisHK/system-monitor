const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all groups
router.get('/', groupController.getGroups);

// Create new group (admin only)
router.post('/', checkRole(['admin']), groupController.createGroup);

// Update group (admin only)
router.put('/:id', checkRole(['admin']), groupController.updateGroup);

// Delete group (admin only)
router.delete('/:id', checkRole(['admin']), groupController.deleteGroup);

// Get group permissions
router.get('/:id/permissions', groupController.getGroupPermissions);

// Update group permissions (admin only)
router.put('/:id/permissions', checkRole(['admin']), groupController.updateGroupPermissions);

module.exports = router; 