/* =========================================================
   toast.js
   ---------------------------------------------------------
   Shows a small green "success" message at the bottom of
   the screen (a "toast"). Every page loads this one file.

   How to use from any page:
       showToast('บันทึกสำเร็จแล้ว!');

   Many pages reload or jump to another page right after
   something succeeds. To keep the toast visible in that
   case, call:
       showToastAfterRedirect('Booked Complete');
   It saves the message first, and the NEXT page shows it
   as soon as it finishes loading.

   The look of the toast (.save-toast) is in decor.css.
   ========================================================= */

(function () {
    var STORAGE_KEY = 'pendingToast';   // name used to save the message between pages
    var toastTimer = null;              // remembers the "hide later" timer

    // Make the toast element once and put it at the end of <body>
    function getToastElement() {
        var el = document.getElementById('appToast');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'appToast';
        el.className = 'save-toast';
        el.innerHTML = '<i class="bi bi-check-circle-fill"></i><span></span>';
        document.body.appendChild(el);
        return el;
    }

    // Show the toast now, hide it again after about 2.5 seconds
    window.showToast = function (message) {
        var el = getToastElement();
        el.querySelector('span').textContent = message;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2500);
    };

    // Save the message, so the page we are about to open can show it
    window.showToastAfterRedirect = function (message) {
        try { sessionStorage.setItem(STORAGE_KEY, message); } catch (e) { /* storage blocked: skip */ }
    };

    // When a page finishes loading, show any message that was saved before
    function showPendingToast() {
        var message = null;
        try {
            message = sessionStorage.getItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* storage blocked: skip */ }
        if (message) showToast(message);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showPendingToast);
    } else {
        showPendingToast();
    }
})();
