const express = require("express");
const router = express.Router();

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
router.put("/:id", updateTask);

//DELETE
/**
  * @route DELETE api/tasks/:id
  * @description Delete a task
*/
router.delete("/:id", deleteTask);

module.exports = router;