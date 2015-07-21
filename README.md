# schtick

[![npm version](https://badge.fury.io/js/schtick.svg)](http://badge.fury.io/js/schtick)

A scheduled task runner for Node.js built on top of [schyntax](https://github.com/schyntax/js-schyntax).

## Install

```
npm install schtick
```

## Basic Usage

Run a task every minute:

```javascript
var Schtick = require('schtick');

var schtick = new Schtick(); // best practice is to keep a singleton Schtick instance

schtick.addTask('unique task name', 'minutes(*)', function (task, eventTime) {
  console.log(task.name + ' ' + eventTime);
});
```

## Schtick Reference

### Schtick#addTask

`schtick ( name, schedule [, options], callback )`

The constructor can be called with or without the `new` operator. It returns a [ScheduledTask](#scheduledtask-reference) object.

* `name` A unique name for the task. If you don't care about human-readable task names, you can pass in `null` and a UUID will be assigned as the name.
* `schedule` Either a schyntax format string, or an `schyntax` object. See the [schyntax library](https://github.com/schyntax/js-schyntax) for documentation.
* `options` An optional object with some or all of the following properties:
    * `autoStart` (boolean, Default: `true`) If true, `startSchedule()` is automatically called, otherwise the task won't be run until start is explicitly called.
    * `lastKnownEvent` (Date, Default: `new Date()`) The last event time (see the second argument to the callback) when the task is known to have run. Used for [Task Windows](#task-windows).
    * `window` (number, Default: `0`) The period of time (in milliseconds) after an event should have run where it would still be appropriate to run it. See [Task Windows](#task-windows) for more details. 
* `callback` The function which will be called for each event in the schedule. The function is passed two arguments:
    * `task` The ScheduledTask object.
    * `eventTime` The time the callback was intended to be called based on defined schedule. Note: this may not be the actual time the callback was called.

### Schtick#addAsyncTask

Identical to `addTask()` except that the callback function will receive a third argument. This is the `done` argument which is a function. It should be called after an asynchronous task has been completed. Events in the schedule will be skipped until `done` is called.

For example, here's a schedule which is defined to run every second (`sec(*)`), but the callback waits 1.5 seconds before calling `done`. Therefore, every other event will be skipped, and we'll only write to the console once every two seconds.

```js
schtick.addAsyncTask('test', 'sec(*)', function (task, eventTime, done) {
  console.log(task.name + ' ' + eventTime);
  setTimeout(done, 1500);
});
```

You can also pass an error to `done` which will get propagated to the Schtick error handlers.

### Schtick.addErrorHandler

`addErrorHandler ( callback )`

Adds a callback for when scheduled tasks produce an error.

* `callback` A function which accepts two arguments:
    * `task` The `ScheduledTask` which generated the error.
    * `error` The error itself.

```js
schtick.addErrorHandler(function (task, error) {
  console.log(task.name);
  console.log(error);
});
```

### Schtick.shutdown

`shutdown ( )`

Calls `.stopSchedule()` on all tasks. Tasks cannot be added, removed, or restarted after shutdown has been called.

## ScheduledTask Reference

### schtick#startSchedule

`startSchedule ( [lastKnownEvent] )`

Starts the task runner (if it is not already running).

* `lastKnownEvent` (Date) Serves the same purpose as `options.lastKnownEvent` described in the `addTask()` documentation.

### schtick#stopSchedule

`stopSchedule ( )`

Stops the task runner and clears any existing timeout.

### schtick#updateSchedule

`updateSchedule ( schedule )`

Updates the schyntax schedule being used by the task runner.

* `schedule` (Schedule|string) Either a string or a Schyntax Schedule object.

### schtick#unref

`unref( )`

Calls `unref()` on the underlying timer, allowing the program to exit if this task is the only thing in the event loop. Please see node's [`timers#unref`](http://nodejs.org/api/timers.html#timers_unref) for details.

### schtick#ref

`ref( )`

If you had previously called [`schtick#unref`](#schtickunref), you can call `schtick#ref` to request the instance hold the program open. If the instance is already `ref`d then calling `schtick#ref` again will have no effect.

## Task Windows

Task Windows are useful for compensating with interruptions. Imagine you have a task set to run every day at noon, but a deployment or restart causes schtick to be offline from 11:59 to 12:01. You can use a task window to say "if we're offline at noon, but come back before 1pm, run the task immediately after coming online."

In order for this to work, you need to provide schtick with the last `eventTime` when a task ran. You have to keep track of this yourself (a redis/memcache key would be one way).

Example:

```javascript
var options = {
  lastKnownEvent: eventTime,
  window: 60 * 60 * 1000 // one hour window
};

schtick.addTask('some event', 'hours(12)', options, function (task, eventTime) {
  save(eventTime); // store this value in redis/memcache/etc
  // do something
});
```
