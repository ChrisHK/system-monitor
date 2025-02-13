const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { auth, checkGroup } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all groups
router.get('/', groupController.getGroups);

// Create new group (admin group only)
router.post('/', checkGroup(['admin']), groupController.createGroup);

// Update group (admin group only)
router.put('/:id', checkGroup(['admin']), groupController.updateGroup);

// Delete group (admin group only)
router.delete('/:id', checkGroup(['admin']), groupController.deleteGroup);

// Get group permissions
router.get('/:id/permissions', groupController.getGroupPermissions);

// Update group permissions (admin group only)
router.put('/:id/permissions', checkGroup(['admin']), groupController.updateGroupPermissions);

module.exports = router; 