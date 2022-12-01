const express = require("express");
const router = express.Router();
const { body } = require('express-validator');
const users_role_array = ["manager", "employee"];

const {
  createUser,
  getUsers,
  getUserById,
  editUser,
  deleteUser
} = require("../controllers/user.controller");

//Create
/** 
 * @route POST api/users
 * @description Create new user
 * @access private, assigner
 */

router.post('/', createUser);

//Read: Get all users
/**
 * @route GET api/users
 * @description Get a list of users
 * @access public
 * @allowedQueries: name
 */
router.get('/', getUsers)

//Get a single user by Id
/**
 * @route GET api/users/:id
 * @description Get user by id
 * @access public
 */

router.get('/:id', getUserById)

//Update: Edit a user info
/**
 * @route PUT api/users/:id
 * @description Edit a user
 * @access private, assigner
 * @allowedEdits : {"role": String enum ["manager", "employee"], 
 *                  "name": String}
 */
 router.put(
  '/:id', 

  // Use express-validator
  body('role','role must be filled with one of these options: manager, employee')
  .isString().custom((value) => users_role_array.includes(value)),

  editUser
  )

//Delete a user by Id
/**
 * @route DELETE api/users/:id
 * @description Delete a user
 * @access private, assigner
 * 
 */
router.delete('/:id', deleteUser)

module.exports = router;