var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { sendResponse, AppError } =require("./helpers/utils");

var indexRouter = require('./routes/index');
const mongoose = require('mongoose');
require('dotenv/config');
var app = express();

var cors = require('cors')

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MONGODB
mongoose.connect(process.env.MONGO_URI, () => {
	console.log('Connected to Database!');
});

app.use('/', indexRouter);

// catch 404 error
app.use((req, res, next) => {
	const err = new AppError(404,"Not Found","Bad Request");
	next(err);
  });

/* Error Handling */
app.use((err, req, res, next) => {
	console.log("ERROR", err);
	  return sendResponse(
		res,
		err.statusCode ? err.statusCode : 500,
		false,
		null,
		{ message: err.message },
		err.isOperational ? err.errorType : "Internal Server Error"
	  );
  });


module.exports = app;
