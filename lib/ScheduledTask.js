"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Helpers = require('./Helpers');

/* =============================================================================
 * 
 * ScheduledTask
 *  
 * ========================================================================== */

module.exports = ScheduledTask;

function ScheduledTask (name, schedule, callback, isAsync)
{
	/** @private */
	this._name = name;
	/**
	 * @member {Schedule}
	 * @private
	 */
	this._schedule = schedule;
	/** @private */
	this._callback = callback;
	/** @protected */
	this._isAsync = isAsync;
	/** @private */
	this._isAttached = false;
	/** @protected */
	this._isScheduleRunning = false;
	/** @protected */
	this._isCallbackExecuting = false;
	/** @protected */
	this._timeout = null;
	/**
	 * @member {Date}
	 * @protected
	 */
	this._nextEvent = null;
	/**
	 * @member {Date}
	 * @protected
	 */
	this._prevEvent = null;
	/** @protected */
	this._runId = 0;
	/** @protected */
	this._errorHandlers = [];
	/** @protected */
	this._unref = false;
	
	this.window = 0;
}

/* -------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------- */

/** @property {string} */
Object.defineProperty(ScheduledTask.prototype, 'name', {
	get: function () { return this._name; }
});

/** @property {Schedule} */
Object.defineProperty(ScheduledTask.prototype, 'schedule', {
	get: function () { return this._schedule; }
});

Object.defineProperty(ScheduledTask.prototype, 'callback', {
	get: function () { return this._callback; }
});

/** @property {boolean} */
Object.defineProperty(ScheduledTask.prototype, 'isAsync', {
	get: function () { return this._isAsync; }
});

/** @property {boolean} */
Object.defineProperty(ScheduledTask.prototype, 'isAttached', {
	get: function () { return this._isAttached; }
});

/** @property {boolean} */
Object.defineProperty(ScheduledTask.prototype, 'isScheduleRunning', {
	get: function () { return this._isScheduleRunning; }
});

/** @property {boolean} */
Object.defineProperty(ScheduledTask.prototype, 'isCallbackExecuting', {
	get: function () { return this._isCallbackExecuting; }
});

/** @property {Date} */
Object.defineProperty(ScheduledTask.prototype, 'nextEvent', {
	get: function () { return this._nextEvent; }
});

/** @property {Date} */
Object.defineProperty(ScheduledTask.prototype, 'prevEvent', {
	get: function () { return this._prevEvent; }
});

/* -------------------------------------------------------------------
 * Public Methods
 * ---------------------------------------------------------------- */

/**
 * @param [lastKnownEvent] {Date}
 */
ScheduledTask.prototype.startSchedule = function (lastKnownEvent)
{
	if (!this.isAttached)
		throw new Error('Cannot start task which is not attached to a Schtick instance.');
	
	if (this.isScheduleRunning)
		return;
	
	var firstEvent = null;
	var window = this.window;
	if (typeof window === 'number' && window > 0 && isDate(lastKnownEvent))
	{
		// check if we actually want to run the first event right away
		var prev = this.schedule.previous();
		lastKnownEvent.setUTCSeconds(lastKnownEvent.getUTCSeconds() + 1); // add a second for good measure
		if (prev > lastKnownEvent && prev > (Date.now() - window))
		{
			firstEvent = prev;
		}
	}
	
	if (!firstEvent)
		firstEvent = this.schedule.next();
	
	if (this.prevEvent)
	{
		while (firstEvent <= this.prevEvent)
		{
			// we don't want to run the same event twice
			firstEvent = this.schedule.next(firstEvent);
		}
	}
	
	this._nextEvent = firstEvent;
	this._isScheduleRunning = true;
	run(this, this._runId);
};

ScheduledTask.prototype.stopSchedule = function ()
{
	if (!this.isScheduleRunning)
		return;
	
	this._runId++;
	this._isScheduleRunning = false;
	if (this._timeout)
		clearTimeout(this._timeout);
};

ScheduledTask.prototype.updateSchedule = function (schedule)
{
	schedule = Helpers.toSchedule(schedule);
	
	var wasRunning = this.isScheduleRunning;
	if (wasRunning)
		this.stopSchedule();
	
	this._schedule = schedule;
	
	if (wasRunning)
		this.startSchedule();
};

ScheduledTask.prototype.ref = function ()
{
	this._unref = false;
	if (this._timeout)
		this._timeout.ref();
};

ScheduledTask.prototype.unref = function ()
{
	this._unref = true;
	if (this._timeout)
		this._timeout.unref();
};

ScheduledTask.prototype.addErrorHandler = function (callback)
{
	this._errorHandlers.push(callback);
};

ScheduledTask.prototype.removeErrorHandler = function (callback)
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
 * @param task {ScheduledTask}
 * @param runId {number}
 */
 function run (task, runId)
{
	if (task._runId !== runId)
		return;
	
	var delay = Math.max(0, task.nextEvent.getTime() - Date.now());
	task._timeout = setTimeout(executeTask, delay, task, runId);
	if (task._unref)
		task._timeout.unref();
}

/**
 * @param task {ScheduledTask}
 * @param runId {number}
 */
function executeTask (task, runId)
{
	if (task._runId !== runId)
		return;
	
	task._timeout = null;

	if (!task._isCallbackExecuting)
	{
		task._isCallbackExecuting = true;
		var eventTime = task.nextEvent;
		task._prevEvent = eventTime;

		var error = null;
		var doneCallback = createDoneCallback(task, runId, eventTime);
		try
		{
			if (task.isAsync)
				task.callback(task, eventTime, doneCallback);
			else
				task.callback(task, eventTime);
		}
		catch (e)
		{
			error = e;
		}
		finally
		{
			if (!task._isAsync || error)
			{
				doneCallback(error);
			}
		}
	}
}

/**
 * @param task {ScheduledTask}
 * @param runId {number}
 * @param eventTime {Date}
 * @return {Function}
 */
function createDoneCallback (task, runId, eventTime)
{
	var called = false;
	return function (error)
	{
		if (called)
		{
			raiseError(task, new Error('Async Schtick task "done" callback called more than once.'));
			return;
		}
		
		called = true;
		
		task._isCallbackExecuting = false;
		if (error)
			raiseError(task, error);
		
		if (task._runId === runId)
		{
			try
			{
				// figure out the next time to run the schedule
				var next = task.schedule.next();
				if (next <= eventTime)
					next = task.schedule.next(eventTime);
				
				task._nextEvent = next;
				run(task, runId);
			}
			catch (ex)
			{
				task._runId++;
				task._isScheduleRunning = false;
				raiseError(task, error);
			}
		}
		
	};
}

/**
 * @param task {ScheduledTask}
 * @param error {Error}
 */
function raiseError (task, error)
{
	for (var i = 0; i < task._errorHandlers.length; i++)
	{
		task._errorHandlers[i](task, error);
	}
}

function isDate (obj)
{
	if (!obj || typeof obj !== 'object')
		return false;

	return obj.constructor && obj.constructor.name === 'Date' && typeof obj.getUTCSeconds === 'function';
}
