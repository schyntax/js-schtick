"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var EventEmitter = require('events').EventEmitter;
var sch = require('sch');
var Util = require('util');

/* =============================================================================
 * 
 * Schtick Class
 *  
 * ========================================================================== */

Util.inherits(Schtick, EventEmitter);
module.exports = Schtick;

/**
 * @param format {string|Schedule}
 * @param [options] {object}
 * @param [task] {function}
 * @returns {Schtick}
 * @constructor
 */
function Schtick (format, options, task)
{
	if (!(this instanceof Schtick))
		return new Schtick(format, options, task);

	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	Object.defineProperty(this, '__timeout', { value: null, writable: true });
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	/** @member {Schedule} */
	this.schedule = null;

	/** @member {{window: number, ideal: boolean, autoStart: boolean, lastTick: ?Date}} */
	this.options = { window: 0, ideal: false, autoStart: true, lastTick: null };
	
	/** @member {Date} */
	this.lastTick = null;
	
	/** @member {boolean} */
	Object.defineProperty(this, 'isRunning', {
		get: function () { return this.__timeout !== null; }
	});

	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */

	EventEmitter.call(this);
	
	if (typeof format === 'string')
	{
		this.schedule = sch(format);
	}
	else if (isSchedule(format))
	{
		this.schedule = format;
	}
	else
	{
		throw new Error('format argument must be a string or a Schedule object from sch.');
	}
	
	if (typeof options === 'function')
	{
		task = options;
		options = null;
	}
	
	if (options && typeof options === 'object')
	{
		for (var i in this.options)
		{
			if (options.hasOwnProperty(i))
				this.options[i] = options[i];
		}
	}
	
	if (typeof task === 'function')
		this.on('tick', task);
	
	this.lastTick = this.options.lastTick;
	
	if (this.options.autoStart)
		this.start();
}

/* -------------------------------------------------------------------
 * Public Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Schtick.prototype.ref = function ()
{
  if (this.__timeout)
    this.__timeout.ref();
};

/**
 * @param [lastKnownEvent] {Date}
 */
Schtick.prototype.start = function (lastKnownEvent)
{
	if (this.isRunning)
		return;
	
	if (lastKnownEvent instanceof Date)
		this.lastTick = lastKnownEvent;
	
	var now = new Date();
	var event = this.schedule.next(now);
	
	if (this.lastTick && this.options.window > 0)
	{
		var prev = this.schedule.previous(now);
		if (prev > (now - this.options.window) && prev > this.lastTick)
		{
			event = prev;
		}
	}
	
	if (!event)
		return event;
	
	// set timeout for next event
	this.__timeout = setTimeout(runTask.bind(this, event), Math.max(0, event - Date.now()));
};

Schtick.prototype.stop = function ()
{
	clearTimeout(this.__timeout);
	this.__timeout = null;
};

Schtick.prototype.unref = function ()
{
  if (this.__timeout)
    this.__timeout.unref();
};

/* -------------------------------------------------------------------
 * Private Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

function isSchedule (obj)
{
	if (!obj || typeof obj !== 'object')
		return false;
	
	return obj.constructor && obj.constructor.name === 'Schedule' &&
		typeof obj.next === 'function' && typeof obj.previous === 'function';
}

/**
 * @this {Schtick}
 */
function runTask (intendedTime)
{
	this.lastTick = this.options.ideal ? intendedTime : new Date();
	this.__timeout = null;
	this.start();
	
	this.emit('tick', intendedTime);
}
