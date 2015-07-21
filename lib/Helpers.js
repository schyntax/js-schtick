"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var schyntax = require('schyntax');

/* =============================================================================
 * 
 * Helpers
 *  
 * ========================================================================== */

var Helpers = {};
module.exports = Helpers;

/**
 * @param schedule {string|Schedule}
 * @return {Schedule}
 */
Helpers.toSchedule = function (schedule)
{
	if (typeof schedule === 'string')
		return schyntax(schedule);
	
	if (Helpers.isSchedule(schedule))
		return schedule;
	
	throw new Error('schedule argument must be a string or a Schedule object from schyntax.');
};

Helpers.isSchedule = function isSchedule (obj)
{
	if (!obj || typeof obj !== 'object')
		return false;

	return obj.constructor && obj.constructor.name === 'Schedule' &&
		typeof obj.next === 'function' && typeof obj.previous === 'function' &&
		typeof obj.originalText === 'string';
};
