const express = require("express");
const router = express.Router();
const { body } = require('express-validator');
const tasks_status_array = ["pending", "working", "review", "done", "archive"];

const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTaskById,
} = require("../controllers/task.controller");

//CREAT
/** 
  * @route POST api/tasks
  * @description Create new task
*/

router.post("/", createTask);

//READ
/**
  * @route GET API/tasks
  * @description Get a list of tasks
  * @parameters : "name", "status", "createdAt", "updatedAt"
  */
router.get("/", getTasks);

//READ
/**
  * @route GET api/tasks/:id
  * @description
  * @allowedUpdates : {
  * "description": string, 
  * "status": string (enum: ["pending", "working", "review", "done", "archive"]), 
  * "assignee": userId type ObjectId}
  */
 router.get("/:id", getTaskById);

//UPDATE
/**
  * @route PUT api/tasks/:id
  * @description
  * @allowedUpdates : {
  * "description": string, 
  * "status": string (enum: ["pending", "working", "review", "done", "archive"]), 
  * "assignee": userId type ObjectId}
  */
router.put(
  "/:id", 

  // Use express-validator
  body('status','status must be filled with one of these options: pending, working, review, done, archive' )
  .isString().custom((value) => tasks_status_array.includes(value)),

  updateTask
);

//DELETE
/**
  * @route DELETE api/tasks/:id
  * @description Delete a task
*/
router.delete("/:id", deleteTask);

module.exports = router;