var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

const userAPI = require('./users.api');
router.use('/users',userAPI);

const taskAPI = require('./tasks.api');
router.use('/tasks', taskAPI)

module.exports = router;
