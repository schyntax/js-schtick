# schtick

A scheduled task runner for Node.js built on top of [sch](https://github.com/bretcope/sch).

## Install

```
npm install schtick
```

## Basic Usage

Run a task every minute:

```javascript
var schtick = require('schtick');

var s = schtick('minutes(0-59)', function (intendedDate) {
  console.log(intendedDate);
});

// can be stopped later by calling s.stop() and resumed again using s.start()
```

## Schtick Object

### constructor

`schtick ( schedule [, options] [, task] )`

The constructor can be called with or without the `new` operator. It returns a `Schtick` object.

* `schedule` Either a sch format string, or an `sch` object. See the [sch library](https://github.com/bretcope/sch) for documentation.
* `options` An optional object with some or all of the following properties:
    * `autoStart` (boolean, Default: `true`) If true, `start()` is automatically called, otherwise the task won't be run until start is explicitly called.
    * `lastTick` (Date, Default: `new Date()`) The last Date when the task is known to have run. Used for [Task Windows](#task-windows).
    * `window` (number, Default: `0`) The period of time (in milliseconds) after an event should have run where it would still be appropriate to run it. See [Task Windows](#task-windows) for more details. 
* `task` An optional function which will automatically be attached to the tick event. `schtick#on('tick', task)`

### schtick#ref

`ref()`

If you had previously called [`schtick#unref`](#schtickunref), you can call `schtick#ref` to request the instance hold the program open. If the instance is already `ref`d then calling `schtick#ref` again will have no effect.

### schtick#start

`start ( [lastTick] )`

Starts the task runner (if it is not already running).

* `lastTick` (Date) Serves the same purpose as `options.lastTick` described in the constructor documentation.

### schtick#stop

`stop ( )`

Stops the task runner and clears any existing timeout.

### schtick#unref

`unref()`

Calls `unref()` on the underlying timer, allowing the program to exit if this task is the only thing in the event loop. Please see node's [`timers#unref`](http://nodejs.org/api/timers.html#timers_unref) for details.

### Events

* `tick` Emitted every time a task should run. The function receives one argument which is a Date object representing the exact time (according to the schedule) which the task should have run at. 

### Properties

* `isRunning` (boolean) True if the task runner is active, otherwise false.
* `schedule` (sch object) The sch object. See the [sch documentation](https://github.com/bretcope/sch)

## Task Windows

Task Windows are useful for compensating with interruptions. Imagine you have a task set to run every day at noon, but a deployment or restart causes schtick to be offline from 11:59 to 12:01. You can use a task window to say "if we're offline at noon, but come back before 1pm, run the task immediately after coming online."

In order for this to work, you need to provide schtick with the last time a task ran. You have to keep track of this yourself (a redis/memcache key would be one way), and it would be best to use the last time argument provided to the tick event callback/task function.

Example:

```javascript
// in this example, "last" is a Date object representing the last time the task actually ran
var options = {
  lastTick: last,
  window: 60 * 60 * 1000 // one hour window
};
schtick('hours(12)', options, function (intendedDate) {
  last = intendedDate; // store this value in redis/memcache/etc
  // do something
});

```
