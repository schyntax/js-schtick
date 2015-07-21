"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Helpers = require('./Helpers');
var ScheduledTask = require('./ScheduledTask');
var Uuid = require('node-uuid');

/* =============================================================================
 * 
 * Schtick
 *  
 * ========================================================================== */

module.exports = Schtick;

function Schtick ()
{
	/** @private */
	this._tasks = {};
	/** @private */
	this._isShuttingDown = false;
	/** @private */
	this._errorHandlers = [];
	/** @private */
	this._onTaskError = onTaskError.bind(this);
}

/* -------------------------------------------------------------------
 * Public Methods
 * ---------------------------------------------------------------- */

Object.defineProperty(Schtick.prototype, 'isShuttingDown', {
	get: function () { return this._isShuttingDown; }
});

/**
 * 
 * @param name {string}
 * @param schedule {string|Schedule}
 * @param [options] {{autoRun: boolean, lastKnownEvent: Date, window: number}}
 * @param callback {function(ScheduledTask, Date)}
 * @return {ScheduledTask}
 */
Schtick.prototype.addTask = function (name, schedule, options, callback)
{
	if (arguments.length < 4)
	{
		callback = options;
		options = {};
	}
	
	return this._addTaskImpl(name, schedule, options, callback, false);
};

/**
 * 
 * @param name {string}
 * @param schedule {string|Schedule}
 * @param [options] {{autoRun: boolean, lastKnownEvent: Date, window: number}}
 * @param callback {function(ScheduledTask, Date, function(Error))}
 * @return {ScheduledTask}
 */
Schtick.prototype.addAsyncTask = function (name, schedule, options, callback)
{
	if (arguments.length < 4)
	{
		callback = options;
		options = {};
	}
	
	return this._addTaskImpl(name, schedule, options, callback, true);
};

/**
 * @param name {string}
 * @return {?ScheduledTask}
 */
Schtick.prototype.getTask = function (name)
{
	if (!this._tasks.hasOwnProperty(name))
		return null;
	
	return this._tasks[name];
};

/**
 * @return {ScheduledTask[]}
 */
Schtick.prototype.getAllTasks = function ()
{
	var tasks = [];
	for (var i in this._tasks)
	{
		if (this._tasks.hasOwnProperty(i))
			tasks.push(this._tasks[i]);
	}
	
	return tasks;
};

/**
 * Throws an exception if the task is still running.
 * @param name {string}
 * @return {boolean} True if the task was removed. False if it did not exist.
 */
Schtick.prototype.removeTask = function (name)
{
	if (this.isShuttingDown)
		throw new Error("Cannot remove a task from Schtick after shutdown() has been called.");
	
	var task = this.getTask(name);
	if (!task)
		return false;
	
	if (task.isScheduleRunning)
		throw new Error('Cannot remove task "' + name + '". It is still running.');
	
	task._isAttached = false;
	delete this._tasks[name];
	return true;
};

Schtick.prototype.shutdown = function ()
{
	this._isShuttingDown = true;
	var tasks = this.getAllTasks();
	
	for (var i = 0; i < tasks.length; i++)
	{
		tasks[i]._isAttached = false;
		tasks[i].stopSchedule();
	}
};

Schtick.prototype.addErrorHandler = function (callback)
{
	this._errorHandlers.push(callback);
};

Schtick.prototype.removeErrorHandler = function (callback)
{
	for (var i = 0; i < this._errorHandlers.length; i++)
	{
		if (this._errorHandlers[i] === callback)
		{
			this._errorHandlers.splice(i, 1);
			return;
		}
	}
};

/* -------------------------------------------------------------------
 * Private Methods
 * ---------------------------------------------------------------- */

/**
 * @param name {string}
 * @param schedule {string|Schedule}
 * @param options {{autoRun: boolean, lastKnownEvent: Date, window: number}}
 * @param callback
 * @param isAsync {boolean}
 * @return {ScheduledTask}
 * @private
 */
Schtick.prototype._addTaskImpl = function (name, schedule, options, callback, isAsync)
{
	if (!name)
		name = Uuid.v4();
	
	if (this.isShuttingDown)
		throw new Error('Cannot add a task to Schtick after shutdown() has been called.');
	
	if (this._tasks.hasOwnProperty(name))
		throw new Error('A scheduled task named "' + name + '" already exists.');
	
	schedule = Helpers.toSchedule(schedule);
	
	var task = new ScheduledTask(name, schedule, callback, isAsync);
	task._isAttached = true;
	task.addErrorHandler(this._onTaskError);
	if (typeof options.window === 'number')
		task.window = options.window;
	
	this._tasks[name] = task;
	
	if (options.autoRun !== false)
	{
		task.startSchedule(options.lastKnownEvent);
	}
	
	return task;
};

/**
 * @this {Schtick}
 */
function onTaskError (task, error)
{
	for (var i = 0; i < this._errorHandlers.length; i++)
	{
		this._errorHandlers[i](task, error);
	}
}
