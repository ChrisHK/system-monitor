const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

router.post('/', listController.createList);
router.post('/:listId/items', listController.addItemToList);

module.exports = router; 