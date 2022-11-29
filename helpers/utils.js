const utilsHelper = {};
utilsHelper.sendResponse = (res, status, success, data, errors, message) => {
    const response = {};
    if (data?.total) response.total = data.total;
    if (data?.total) response.page_size = data.page_size;
    if (data?.total) response.page_number = data.page_number;
    if (data?.total) response.items = data.items;
    
    if (data?.id) response.id = data.id;
    if (data?.name) response.name = data.name;
    if (data?.role) response.role = data.role;
    if (data?.description) response.description = data.description;
    if (data?.status) response.status = data.status;
    if (data?.assignee_id) response.assignee_id = data.assignee_id;
    if (data?.is_deleted === true || data?.is_deleted === false) response.is_deleted = data.is_deleted;
    if (data?.updated_at) response.updated_at = data.updated_at;
    if (data?.created_at) response.created_at = data.created_at;

    if (errors) response.errors = errors;
    if (message) response.message = message;
    return res.status(status).json(response);
  };

  class AppError extends Error {
    constructor(statusCode, message, errorType) {
      super(message);
      this.statusCode = statusCode;
      this.errorType = errorType;
      this.isOperational = true;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  utilsHelper.AppError = AppError;
  module.exports = utilsHelper;