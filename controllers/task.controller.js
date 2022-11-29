const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const taskController = {};
const { sendResponse, AppError } = require("../helpers/utils");

taskController.createTask = async (req, res, next) => {
  try {
    if (!req.body) throw new AppError(400, "No request body", "Bad Request");
    const createdTask = await Task.create(req.body);
    const id = createdTask._id;
    const name = createdTask.name;
    const description = createdTask.description;
    const status = createdTask.status;
    const assignee_id = createdTask.assignee;
    const is_deleted = createdTask.is_deleted;
    const created_at = createdTask.createdAt;
    const updated_at = createdTask.updatedAt;

    sendResponse(
      res,
      200,
      true,
      {id, name, description, status, assignee_id, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};

taskController.getTasks = async (req, res, next) => {
  try {
    const filterKeyArr = ["name", "status", "createdAt", "updatedAt"];
    const { ...filter } = req.query;
    
    const keywordArr = Object.keys(filter);
    keywordArr.forEach((keyword) => {
      if (!filterKeyArr.includes(keyword))
        throw new AppError(400, `query ${keyword} is not accepted`, "Bad request");
      if (!filter[keyword]) delete filter[keyword];
    });

    const {name: tmpName, status: tmpStatus } = filter;
    filter.is_deleted = false;
    //mongoose support find with case insensitive 
    if (tmpName) filter.name = { $regex: tmpName, $options: 'i' };
    if(tmpStatus) filter.status = { $regex: tmpStatus, $options: 'i' };

    const page_number = req.query.page || 1;
    const page_size = req.query.limit || 10;
    //skip number
    let offset = page_size * (page_number - 1);

    const listOfTasks = await Task.find(filter).skip(offset).limit(page_size).populate("assignee");
    
    //format the result as defined response at previous stage @Swagger
    const convertedListOfTasks = [];
    listOfTasks.forEach((taskObject) => {
      convertedListOfTasks.push(
        {
          id: taskObject._id,
          name: taskObject.name,
          description: taskObject.description,
          status: taskObject.status,
          is_deleted: taskObject.is_deleted,
          updated_at: taskObject.updatedAt,
          created_at: taskObject.createdAt,
        }
      )
    })

    let total = await Task.count(filter);
    if (!total) {
      throw new AppError (404,"Task Not Found","Bad request")
      return
    }

    let data = {total, page_size, page_number,  items: convertedListOfTasks };

    sendResponse(res, 200, true, data, null, "");
  } catch (err) {
    next(err);
  }
};

//Updating task (including: status, assign task to user, unassign task)
taskController.updateTask = async (req, res, next) => {
  const editKeyArr = ["status", "assignee_id"]
  try{
    if (!req.body || !req.params.id)
      throw new AppError(400, "No Request Body / No Task Id", "Bad Request");

    const { id } = req.params;
    const bodyToUpdate = req.body;

    const keywordArray = Object.keys(bodyToUpdate);

    keywordArray.forEach((keyword) => {
      if (!editKeyArr.includes(keyword)) throw new AppError(400, `Keyword ${keyword} is not accepted.`, "Bad Request")
      if(!bodyToUpdate[keyword]) delete bodyToUpdate[keyword]
    })
    const { status: tmpStatus, assignee_id: tmpAssignee } = bodyToUpdate;
    
    let updatedTask = await Task.findById(id);
    let name = updatedTask.name;
    let description = updatedTask.description;
    let status = updatedTask.status;
    let assignee_id = updatedTask.assignee?.toString();
    let is_deleted = updatedTask.is_deleted;
    let created_at = updatedTask.createdAt;
    let updated_at = updatedTask.updatedAt;

    if (!updatedTask) {
      throw new AppError(404, `Task Not Found`, "Bad Request");
      return
    }
    
    //For status change requirement
    if (status === "done" && tmpStatus !== "archive") {
      throw new AppError(400,"Can only change status of 'done' task to 'archive'","Bad Request")
      return
    }

    /* For assignee requirement: 
    if assignee from query is null 
    and assignee in task that we just find is also null, 
    then we can't unassign it
    */
    if (!assignee_id && !tmpAssignee) {
      throw new AppError(400,"This task hasn't been assigned to any one, so you can't unassign it","Bad Request")
      return
    }

    /* For re-assign requirement: 
    if assignee_id===tmpAssignee, 
    inform that this task has been assigned to the same user
    */
    if (assignee_id && tmpAssignee && assignee_id === tmpAssignee) {
      throw new AppError(400,"This task has been already assigned to required assignee, pls check again","Bad Request")
      return
    }

    // Newly assign the task to only 1 user
    if (!assignee_id && tmpAssignee) {
      let assigneeUser = await User.findById(tmpAssignee)
      if (!assigneeUser) { 
        throw new AppError(404,"User Not Exist", "Bad Request")
        return 
      }
      if (tmpStatus) {
        updatedTask.status = tmpStatus 
      } else {
        updatedTask.status = status
      }

      updatedTask.assignee = tmpAssignee;
      updatedTask = await updatedTask.save()
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;
      assignee_id = updatedTask.assignee;
      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;

      assigneeUser.tasks.push(updatedTask._id);
      assigneeUser = await assigneeUser.save();
    }

    //Change assignee of 1 task
    if (assignee_id && tmpAssignee && (assignee_id !== tmpAssignee)) {
      let newAssigneeUser = await User.findById(tmpAssignee)
      let oldAssigneeUser = await User.findById(assignee_id)

      //if new assignee user is already deleted then throw error
      if (!newAssigneeUser || newAssigneeUser.is_deleted) { 
        throw new AppError(404,"User Not Exist", "Bad Request")
        return 
      }

      //remove task Id from oldAssigneeUser
      const removedTasks = []
      oldAssigneeUser.tasks.map((task) => {
        if (task.toString() !== id) {
          removedTasks.push(task)
        }
      })
      oldAssigneeUser.tasks = removedTasks;
      oldAssigneeUser = await oldAssigneeUser.save();

      //save updated information for task
      if (tmpStatus) {
        updatedTask.status = tmpStatus 
      } else {
        updatedTask.status = status
      }

      updatedTask.assignee = tmpAssignee;
      updatedTask = await updatedTask.save()
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;
      assignee_id = updatedTask.assignee;
      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;

      //save id of task in user
      newAssigneeUser.tasks.push(updatedTask._id);
      newAssigneeUser = await newAssigneeUser.save();
      
    }

    //Unassign task
    if (assignee_id && !tmpAssignee) {
      let oldAssigneeUser = await User.findById(assignee_id)
      if (!oldAssigneeUser) {
        throw new AppError(404,"User Not Exist", "Bad Request")
        return
      }

      //remove task Id from oldAssigneeUser
      const removedTasks = []
      oldAssigneeUser.tasks.map((task) => {
        if (task.toString() !== id) {
          removedTasks.push(task)
        }
      })
      oldAssigneeUser.tasks = removedTasks;
      oldAssigneeUser = await oldAssigneeUser.save();

      //save updated information for task
      if (tmpStatus) {
        updatedTask.status = tmpStatus 
      } else {
        updatedTask.status = status
      }

      updatedTask.assignee = tmpAssignee;
      updatedTask = await updatedTask.save()

      //update variables to use in sendResponse
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;
      assignee_id = updatedTask.assignee;
      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;
    }

    sendResponse(
      res,
      200,
      true,
      { id, name, description, status, assignee_id, is_deleted, created_at, updated_at },
      null,
      "Update Task Status success"
    );
  
  } catch (err) {
    next(err);
  }
};

taskController.deleteTask = async (req, res, next) => {
  try {
    if (!req.params.id) throw new AppError(400, "Task Id Not Fount", "Bad Request");

    const { id } = req.params;
    const options = { new: true };

    //only delete task not yet deleted
    const idFoundCheck = await Task.findById(id)
    if (idFoundCheck.is_deleted.toString()) {
      throw new AppError(404,"Task is no longer exist","Bad Request")
      return
    }

    const deletedTask = await Task.findByIdAndUpdate(
      id,
      { is_deleted: true },
      options
    );
    
    const name = deletedTask.name;
    const description = deletedTask.description;
    const status = deletedTask.status;
    const assignee_id = deletedTask.assignee;
    const is_deleted = deletedTask.is_deleted;
    const created_at = deletedTask.createdAt;
    const updated_at = deletedTask.updatedAt;
    
    //remove  deleted task id from user
    const assigneeUser = await User.findById(assignee_id)
    const removedTasks = []
      assigneeUser.tasks.map((task) => {
        if (task.toString() !== id) {
          removedTasks.push(task)
        }
      })
      assigneeUser.tasks = removedTasks;
      assigneeUser = await assigneeUser.save();

    sendResponse(
      res,
      200,
      true,
      {id, name, description, status, assignee_id, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};

module.exports = taskController;