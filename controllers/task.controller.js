const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const taskController = {};
const { sendResponse, AppError } = require("../helpers/utils");
const { validationResult } = require('express-validator');

taskController.createTask = async (req, res, next) => {
  try {
    if (!req.body) throw new AppError(400, "No request body", "Bad Request");

    //Express validation, check information before creating a new document
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.status(400).json({ errors: errors.array() });
			return;
		}

    const createdTask = await Task.create(req.body);
    const id = createdTask._id;
    const name = createdTask.name;
    const description = createdTask.description;
    const status = createdTask.status;

    const assigneeId  = createdTask?.assignee?._id || "";
    const assigneeName  = createdTask?.assignee?.name || "";
    const assigneeRole  = createdTask?.assignee?.role || "";
    let assignee = {}
    if (assigneeId) {
        assignee = {
        id: assigneeId,
        name: assigneeName,
        role: assigneeRole,
      }
    }

    const is_deleted = createdTask.is_deleted;
    const created_at = createdTask.createdAt;
    const updated_at = createdTask.updatedAt;

    sendResponse(
      res,
      200,
      true,
      {id, name, description, status, assignee, is_deleted, created_at, updated_at},
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

    const listOfTasks = await Task.find(filter).skip(offset).limit(page_size).populate("assignee","name role");
    
    //format the result as defined response at previous stage @Swagger
    const convertedListOfTasks = [];
    listOfTasks.forEach((taskObject) => {

      const assigneeId  = taskObject?.assignee?._id || "";
      const assigneeName  = taskObject?.assignee?.name || "";
      const assigneeRole  = taskObject?.assignee?.role || "";

      let assignee = {}
      if (assigneeId) {
         assignee = {
          id: assigneeId,
          name: assigneeName,
          role: assigneeRole,
        }
      }
      
      convertedListOfTasks.push(
        {
          id: taskObject._id,
          name: taskObject.name,
          description: taskObject.description,
          status: taskObject.status,
          assignee: assignee,
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
  const editKeyArr = ["status", "assignee", "removeAssignee"]
  try{
    if (!req.body || !req.params.id)
      throw new AppError(400, "No Request Body / No Task Id", "Bad Request");

    //Express validation, check information before creating a new document
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.status(400).json({ errors: errors.array() });
			return;
		}

    const { id } = req.params;
    const bodyToUpdate = req.body;

    const keywordArray = Object.keys(bodyToUpdate);

    keywordArray.forEach((keyword) => {
      if (!editKeyArr.includes(keyword)) throw new AppError(400, `Keyword ${keyword} is not accepted.`, "Bad Request")
      if(!bodyToUpdate[keyword]) delete bodyToUpdate[keyword]
    })
    const { status: tmpStatus, assignee: tmpAssigneeId , removeAssignee: tmpRemoveAssignee} = bodyToUpdate;
    
    let updatedTask = await Task.findById(id);

    let name = updatedTask.name;
    let description = updatedTask.description;
    let status = updatedTask.status;
    let assigneeId = updatedTask.assignee?.toString();
    let is_deleted = updatedTask.is_deleted;
    let created_at = updatedTask.createdAt;
    let updated_at = updatedTask.updatedAt;

    if (!updatedTask || (updatedTask.is_deleted.toString() === "true")) {
      throw new AppError(404, `Task Not Found`, "Bad Request");
      return
    }
    
    //For input together tmpAssigneeId and tmpRemoveAssignee => throw error
    if ( tmpAssigneeId && (tmpRemoveAssignee === "yes")) {
      throw new AppError(400,"You can't assign and unassign at the same time","Bad Request")
      return
    }

    //For status change requirement
    if (status === "done" && tmpStatus !== "archive") {
      throw new AppError(400,"Can only change status of 'done' task to 'archive'","Bad Request")
      return
    }

     //For status change requirement
     if (status === tmpStatus) {
      throw new AppError(400,"You can't update the same status as current status'","Bad Request")
      return
    }

    /* For assignee requirement: 
    if assignee from query is null 
    and assignee in task that we just find is also null, 
    then we can't unassign it
    */
    if (!assigneeId && (tmpRemoveAssignee === "yes")) {
      throw new AppError(400,"This task hasn't been assigned to any one, so you can't unassign it","Bad Request")
      return
    }

    /* For re-assign requirement: 
    if assignee===tmpAssigneeId, 
    inform that this task has been assigned to the same user
    */
    if (assigneeId && tmpAssigneeId && assigneeId === tmpAssigneeId) {
      throw new AppError(400,"This task has been already assigned to required assignee, pls check again","Bad Request")
      return
    }

    let assignee = {}

    // Newly assign the task to only 1 user
    if (!assigneeId && tmpAssigneeId) {
      let assigneeUser = await User.find({_id: tmpAssigneeId, is_deleted: false})
      updatedTask = await Task.find({_id: id, is_deleted: false})

      if (!assigneeUser.length) { 
        throw new AppError(404,"User Not Exist To Be Assigned", "Bad Request")
        return 
      }

      if (!updatedTask.length) { 
        throw new AppError(404,"Task Not Exist", "Bad Request")
        return 
      }

      assigneeUser = await User.findById(tmpAssigneeId)
      updatedTask = await Task.findById(id)

      if (tmpStatus) {
        updatedTask.status = tmpStatus 
      } else {
        updatedTask.status = status
      }
      
      updatedTask.assignee = tmpAssigneeId;
      updatedTask = await updatedTask.save()
      updatedTask = await Task.findById(id).populate("assignee", "name role")
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;

      assigneeId  = updatedTask?.assignee?._id || "";
      const assigneeName  = updatedTask?.assignee?.name || "";
      const assigneeRole  = updatedTask?.assignee?.role || "";

      if (assigneeId) {
         assignee = {
          id: assigneeId,
          name: assigneeName,
          role: assigneeRole,
        }
      }

      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;

      assigneeUser.tasks.push(updatedTask._id);
      assigneeUser = await assigneeUser.save();
    }

    //Change assignee of 1 task
    if (assigneeId && tmpAssigneeId && (assigneeId !== tmpAssigneeId)) {
      let newAssigneeUser = await User.findById(tmpAssigneeId)
      let oldAssigneeUser = await User.findById(assigneeId)

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
      
      updatedTask.assignee = tmpAssigneeId;
      updatedTask = await updatedTask.save()
      updatedTask = await Task.findById(id).populate("assignee", "name role")
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;

      assigneeId  = updatedTask?.assignee?._id || "";
      const assigneeName  = updatedTask?.assignee?.name || "";
      const assigneeRole  = updatedTask?.assignee?.role || "";

      if (assigneeId) {
         assignee = {
          id: assigneeId,
          name: assigneeName,
          role: assigneeRole,
        }
      }

      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;

      //save id of task in user
      newAssigneeUser.tasks.push(updatedTask._id);
      newAssigneeUser = await newAssigneeUser.save();
      
    }

    //Unassign task
    if (assigneeId && (tmpRemoveAssignee === "yes")) {

      let oldAssigneeUser = await User.findById(assigneeId)
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

      updatedTask.assignee = null;
      updatedTask = await updatedTask.save()

      //update variables to use in sendResponse
      name = updatedTask.name;
      description = updatedTask.description;
      status = updatedTask.status;
      is_deleted = updatedTask.is_deleted;
      created_at = updatedTask.createdAt;
      updated_at = updatedTask.updatedAt;
    }

    sendResponse(
      res,
      200,
      true,
      { id, name, description, status, assignee, is_deleted, created_at, updated_at },
      null,
      ""
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
    if (idFoundCheck.is_deleted.toString() === "true") {
      throw new AppError(404,"Task is no longer exist","Bad Request")
      return
    }

    const assigneeId = idFoundCheck?.assignee;

    //remove  deleted task id from user
    if (assigneeId) {
      let assigneeUser = await User.findById(assigneeId)
      const removedTasks = []
        assigneeUser.tasks.map((task) => {
          if (task.toString() !== id) {
            removedTasks.push(task)
          }
        })
        assigneeUser.tasks = removedTasks;
        assigneeUser = await assigneeUser.save();
    }
    

    const deletedTask = await Task.findByIdAndUpdate(
      id,
      { is_deleted: true,
        assignee: null
      },
      options
    );
    
    const name = deletedTask?.name;
    const description = deletedTask?.description;
    const status = deletedTask?.status;
    const assignee = deletedTask?.assignee || {};
    const is_deleted = deletedTask?.is_deleted;
    const created_at = deletedTask?.createdAt;
    const updated_at = deletedTask?.updatedAt;
    
    

    sendResponse(
      res,
      200,
      true,
      {id, name, description, status, assignee, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};

//Get task by id, with
taskController.getTaskById = async (req, res, next) => {
  try {
    if (!req.params.id) throw new AppError(400, "Task Id Not Found", "Bad Request");

    const { id } = req.params;
    const taskById = await Task.findById(id).populate("assignee","name role");
    
    if (!taskById || (taskById.is_deleted.toString() === "true")) {
      throw new AppError(400, "Task Not Found", "Bad Request")
    }

      let name = taskById.name;
      let description = taskById.description;
      let status = taskById.status;

      let assignee = {}
      const assigneeId  = taskById?.assignee?._id || "";
      const assigneeName  = taskById?.assignee?.name || "";
      const assigneeRole  = taskById?.assignee?.role || "";
      if (assigneeId) {
          assignee = {
          id: assigneeId,
          name: assigneeName,
          role: assigneeRole,
        }
      }

      let is_deleted = taskById.is_deleted;
      let created_at = taskById.createdAt;
      let updated_at = taskById.updatedAt;
      
      sendResponse(
        res,
        200,
        true,
        { id, name, description, status, assignee, is_deleted, created_at, updated_at },
        null,
        ""
      );

  } catch (err) {
    next(err);
  }
}

module.exports = taskController;