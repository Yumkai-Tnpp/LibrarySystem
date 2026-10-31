/* =========================================================
   time-options.js
   ---------------------------------------------------------
   Used by Boardgame.html, Room.html and Status.html.

   The End Time box is a dropdown the user can change.
   After they pick a Start Time, call:
       fillEndTimeOptions('StartTime', 'EndTime', 2);
   and the End Time dropdown is filled with whole hours:
     - starting 1 hour after the Start Time
     - up to "maxHours" after the Start Time (the rule for that item)
     - never later than 20:00 (the library closes at 20:00)
   The longest allowed time is selected by default, so if the user
   does not touch the box it works exactly like before.
   ========================================================= */

window.fillEndTimeOptions = function (startId, endId, maxHours) {
    var start = document.getElementById(startId).value;   // looks like "10:00"
    var endBox = document.getElementById(endId);
    var CLOSING_HOUR = 20;                                 // library closes at 20:00

    // No start time yet -> nothing to choose from
    if (!start) {
        endBox.innerHTML = '<option value="">เลือกเวลาเริ่มก่อน</option>';
        endBox.value = '';
        return;
    }

    var startHour = parseInt(start.split(':')[0], 10);
    var lastHour = Math.min(startHour + maxHours, CLOSING_HOUR);

    // One option for each whole hour, e.g. 11:00 น., 12:00 น.
    var options = '';
    for (var h = startHour + 1; h <= lastHour; h++) {
        var text = String(h).padStart(2, '0') + ':00';
        options += '<option value="' + text + '">' + text + ' น.</option>';
    }
    endBox.innerHTML = options;
    endBox.value = String(lastHour).padStart(2, '0') + ':00';   // default = longest allowed
};
