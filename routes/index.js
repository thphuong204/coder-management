var express = require('express');
var router = express.Router();
const { body } = require('express-validator');


const users_role_array = ["manager", "employee"];
const tasks_status_array = ["pending", "working", "review", "done", "archive"];

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

const userAPI = require('./users.api');
router.use(
  '/users', 

  // Use express-validator
  body('name','name must be at least 2 characters long').isString().isLength({ min: 2 }),
  body('role','role must be filled with one of these options: manager, employee')
  .isString().custom((value) => users_role_array.includes(value)),

  userAPI
);

const taskAPI = require('./tasks.api');
router.use(
  '/tasks', 
  
  // Use express-validator
  body('name','name must be string').isString(),
  body('description','description must be string').isString(),
  body('status','status must be filled with one of these options: pending, working, review, done,archive' )
  .isString().custom((value) => tasks_status_array.includes(value)),
  
  taskAPI)

module.exports = router;
