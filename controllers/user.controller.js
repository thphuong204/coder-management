const mongoose = require("mongoose");
const User = require("../models/User");
const userController = {};
const { sendResponse, AppError } = require("../helpers/utils");

userController.createUser = async (req, res, next) => {
  try {
    if (!req.body) throw new AppError(400, "No request body", "Bad Request");
    const createdUser = await User.create(req.body);
    const id = createdUser._id;
    const name = createdUser.name;
    const role = createdUser.role.toLowerCase();
    const is_deleted = createdUser.is_deleted;
    const created_at = createdUser.createdAt;
    const updated_at = createdUser.updatedAt;

    sendResponse(
      res,
      200,
      true,
      {id, name, role, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};

userController.getUsers = async (req, res, next) => {
  try {
    const filterKeyArr = ["name", "role"];
    const {...filter} = req.query;

    const keywordArr = Object.keys(filter);
    keywordArr.forEach((keyword) => {
      if (!filterKeyArr.includes(keyword))
        throw new AppError(400, `query ${keyword} is not accepted`, "Bad request");
      if (!filter[keyword]) delete filter[keyword];
    });
    
    const { role: tmpRole , name: tmpName } = filter;
    filter.is_deleted = false; 
    //mongoose support find with case insensitive 
    if (tmpName) filter.name = { $regex: tmpName, $options: 'i' };
    if (tmpRole) filter.role = { $regex: tmpRole, $options: 'i' };

    const page_number = req.query.page || 1;
    const page_size = req.query.limit || 10; 
    //skip number
    let offset = page_size * (page_number - 1);
    const listOfUsers = await User.find(filter).skip(offset).limit(page_size).populate("tasks", "name description status");

    //format the result as defined response at previous stage @Swagger
    const convertedListOfUsers = [];
    listOfUsers.forEach((useObject) => {
      convertedListOfUsers.push(
        {
          id: useObject._id,
          name: useObject.name,
          role: useObject.role,
          tasks: useObject.tasks,
          is_deleted: useObject.is_deleted,
          updated_at: useObject.updatedAt,
          created_at: useObject.createdAt,
        }
      )
    })

    let total = await User.count(filter);
    if (!total) {
      throw new AppError (404,"User Not Found","Bad request")
      return
    }

    let data = {total, page_size, page_number,  items: convertedListOfUsers};
    
    sendResponse(res, 200, true, data, null, "");
  } catch (err) {
    next(err);
  }
};

//Get user by id, including tasks information
userController.getUserById = async (req, res, next) => {
  try {
    if (!req.params.id)
      throw new AppError(400, "User Id Not Found", "Bad Request");
    const { id } = req.params;

    const userById = await User.findById(id).populate("tasks","name description status");
    if (!userById)
      sendResponse(
        res,
        404,
        false,
        null,
        "Not found",
        "Can't find user with this id"
      );

    const name = userById.name;
    const role = userById.role;
    const tasks = userById.tasks;
    const is_deleted = userById.is_deleted;
    const created_at = userById.createdAt;
    const updated_at = userById.updatedAt;

    sendResponse(res, 200, true, {id, name, role, tasks, is_deleted, created_at, updated_at}, null, "");
  } catch (error) {
    next(error);
  }
};

userController.editUser = async (req, res, next) => {
  const editKeyArr = ["role", "name"];
  try {
    if (!req.body || !req.params.id)
      throw new AppError(400, "No request body or no User id", "Bad Request");

    const { id } = req.params;
    const bodyToUpdate = req.body;

    const keywordArray = Object.keys(bodyToUpdate);

    keywordArray.forEach((keyword) => {
      if (!editKeyArr.includes(keyword))
        throw new AppError(400,`Keyword ${keyword} is not accepted. Only 'role' or 'name' are accepted for editting`,"Bad request");
      if (!bodyToUpdate[keyword]) delete bodyToUpdate[keyword];
    });

    const options = { new: true };

    //only edit user not yet deleted
    const idFoundCheck = await User.findById(id)
    if (idFoundCheck.is_deleted) {
      throw new AppError(404,"User is no longer exist","Bad Request")
      return
    }

    const updatedUser = await User.findByIdAndUpdate(id, bodyToUpdate, options);
    if (!updatedUser) throw new AppError(404, "User Not Found", "Bad request");

    const name = updatedUser.name;
    const role = updatedUser.role.toLowerCase();
    const tasks = updatedUser.tasks;
    const is_deleted = updatedUser.is_deleted;
    const created_at = updatedUser.createdAt;
    const updated_at = updatedUser.updatedAt;

    sendResponse(
      res,
      200,
      true,
      { id, name, role, tasks, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};

userController.deleteUser = async (req, res, next) => {
  try {
    if (!req.params.id) throw new AppError(400, "User Id Not Found", "Bad Request");

    const { id } = req.params;
    const options = { new: true };

    //only delete user not yet deleted
    const idFoundCheck = await User.findById(id)
    if (idFoundCheck.is_deleted) {
      throw new AppError(404,"User is no longer exist","Bad Request")
      return
    }

    const deletedUser = await User.findByIdAndUpdate(
      id,
      { is_deleted: true },
      options
    ); 

    const name = deletedUser.name;
    const role = deletedUser.role;
    const is_deleted = deletedUser.is_deleted;
    const created_at = deletedUser.createdAt;
    const updated_at = deletedUser.updatedAt;

    sendResponse(
      res,
      200,
      true,
      { id, name, role, is_deleted, created_at, updated_at},
      null,
      ""
    );
  } catch (err) {
    next(err);
  }
};



module.exports = userController;