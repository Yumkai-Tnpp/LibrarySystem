/* =========================================================
   booked-details.js
   ---------------------------------------------------------
   Used by Book.html, Boardgame.html and Room.html.

   When an item is already booked, its button says "Booked".
   Clicking it calls:
       openBookedDetails('book' | 'boardgame' | 'room', itemId, itemName)
   and a tidy pop-up shows who booked it, when, and gives the
   same Extend / Return buttons that the Status page has.

   It needs two things from the page:
     1. window.__sb      -> the Supabase client (set in each page)
     2. toast.js         -> for the success message
   The look of the pop-up (.bd-...) is in decor.css.
   ========================================================= */

(function () {
    // Settings for each type of item (same rules as Status.html)
    var TYPES = {
        book:      { status: 'กำลังใช้งาน', icon: 'bi-book-fill',      color: '#F4BC13', hasTime: false, limitMin: 0   },
        boardgame: { status: 'กำลังเล่น',   icon: 'bi-dice-5-fill',    color: '#3B6540', hasTime: true,  limitMin: 180 },
        room:      { status: 'กำลังใช้งาน', icon: 'bi-door-open-fill', color: '#1257A5', hasTime: true,  limitMin: 240 }
    };

    var current = null;      // the booking currently shown in the pop-up
    var currentType = null;  // 'book', 'boardgame' or 'room'
    var confirmAction = null; // what to do when the user presses OK in the confirm pop-up

    // ---------- small helpers ----------
    // Make text safe before putting it into HTML
    function esc(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    // Dates in the database look like 31-12-2026 (day-month-year)
    function parseDMY(s) {
        if (!s) return null;
        var p = s.split('-').map(Number);
        return new Date(p[2], p[1] - 1, p[0]);
    }
    function toDMY(d) {
        return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
    }
    // Turn "10:00" into minutes (600) and back
    function toMinutes(t) { var p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
    function fromMinutes(m) {
        return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }
    // Try common column names to find the member's name (shows nothing if there is none)
    function memberName(m) {
        if (!m) return '';
        var full = m.Name || m.MemberName || m.FullName || m.name || '';
        if (!full && (m.FirstName || m.LastName)) full = ((m.FirstName || '') + ' ' + (m.LastName || '')).trim();
        return full;
    }
    function showError(message) {
        if (window.showPopupAlert) showPopupAlert(message); else alert(message);
    }

    // ---------- build the two pop-ups once, when the page loads ----------
    function buildModals() {
        if (document.getElementById('bdModal')) return;
        var wrap = document.createElement('div');
        wrap.innerHTML =
            // Pop-up 1: booking details
            '<div class="modal fade" id="bdModal" tabindex="-1" aria-hidden="true">' +
            '  <div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
            '    <div class="modal-header border-0 pb-0">' +
            '      <h5 class="modal-title fw-bold">Reservation Details</h5>' +
            '      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
            '    </div>' +
            '    <div class="modal-body">' +
            '      <div class="bd-head"><div class="bd-icon" id="bdIcon"><i class="bi"></i></div><div class="bd-title" id="bdItemName"></div></div>' +
            '      <div class="bd-list" id="bdList"></div>' +
            '      <div class="bd-overdue d-none" id="bdOverdue"><i class="bi bi-exclamation-triangle-fill me-1"></i>เลยกำหนดคืนของ</div>' +
            '    </div>' +
            '    <div class="modal-footer border-0 bd-actions">' +
            '      <button type="button" class="btn bd-btn bd-btn-extend" id="bdExtendBtn"><i class="bi bi-clock-history me-1"></i>Extend</button>' +
            '      <button type="button" class="btn bd-btn bd-btn-return" id="bdReturnBtn"><i class="bi bi-box-arrow-in-left me-1"></i>Return</button>' +
            '    </div>' +
            '  </div></div>' +
            '</div>' +
            // Pop-up 2: "are you sure?" (used for both Extend and Return)
            '<div class="modal fade" id="bdConfirmModal" tabindex="-1" aria-hidden="true">' +
            '  <div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content">' +
            '    <div class="modal-header border-0 pb-0">' +
            '      <h5 class="modal-title fw-bold" id="bdConfirmTitle"></h5>' +
            '      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
            '    </div>' +
            '    <div class="modal-body text-center text-muted" id="bdConfirmText"></div>' +
            '    <div class="modal-footer border-0 justify-content-center pb-4">' +
            '      <button type="button" class="btn bd-btn" id="bdConfirmOk">OK</button>' +
            '    </div>' +
            '  </div></div>' +
            '</div>';
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

        // Buttons inside the details pop-up
        document.getElementById('bdExtendBtn').addEventListener('click', function () {
            askConfirm('Confirm Extend',
                currentType === 'book' ? 'ต้องการยืมต่ออีก 7 วัน ใช่หรือไม่? (ต่อได้ 1 ครั้ง)' : 'ต้องการขยายเวลาอีก 1 ชั่วโมง ใช่หรือไม่? (ต่อได้ 1 ครั้ง)',
                'var(--c-button1)', doExtend);
        });
        document.getElementById('bdReturnBtn').addEventListener('click', function () {
            askConfirm('Comfirm Return', 'คุณต้องการคืนรายการนี้ใช่หรือไม่?', 'var(--c-warning)', doReturn);
        });
        document.getElementById('bdConfirmOk').addEventListener('click', function () {
            if (confirmAction) confirmAction();
        });
    }

    // Close the details pop-up, then open the "are you sure?" pop-up
    function askConfirm(title, text, color, onOk) {
        confirmAction = onOk;
        document.getElementById('bdConfirmTitle').textContent = title;
        document.getElementById('bdConfirmTitle').style.color = color;
        document.getElementById('bdConfirmText').textContent = text;
        document.getElementById('bdConfirmOk').style.background = color;
        var details = document.getElementById('bdModal');
        details.addEventListener('hidden.bs.modal', function openConfirm() {
            details.removeEventListener('hidden.bs.modal', openConfirm);
            bootstrap.Modal.getOrCreateInstance(document.getElementById('bdConfirmModal')).show();
        });
        bootstrap.Modal.getOrCreateInstance(details).hide();
    }

    // ---------- Extend (same rules as the Status page) ----------
    async function doExtend() {
        var update, message;
        if (currentType === 'book') {
            var d = parseDMY(current.DueDate);
            d.setDate(d.getDate() + 7);                       // add 7 days
            update = { DueDate: toDMY(d) };
            message = 'Extended! You can keep the book until ' + update.DueDate;
        } else {
            update = { EndTime: fromMinutes(toMinutes(current.EndTime) + 60) };  // add 1 hour
            message = 'Extended! New end time is ' + update.EndTime + ' น.';
        }
        var res = await window.__sb.from('booking').update(update).eq('BookingID', current.BookingID);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('bdConfirmModal')).hide();
        if (res.error) { showError('Sorry, something went wrong. Please try again.'); return; }
        showToastAfterRedirect(message);
        window.location.reload();
    }

    // ---------- Return ----------
    async function doReturn() {
        var res = await window.__sb.from('booking').update({ Status: 'คืนแล้ว' }).eq('BookingID', current.BookingID);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('bdConfirmModal')).hide();
        if (res.error) { showError('Sorry, something went wrong. Please try again.'); return; }
        showToastAfterRedirect('Returned successfully');
        window.location.reload();
    }

    // One tidy row: label on the left, value on the right
    function row(label, value) {
        return '<div class="bd-row"><div class="bd-label">' + label + '</div><div class="bd-value">' + esc(value) + '</div></div>';
    }

    // ---------- the function the pages call ----------
    window.openBookedDetails = async function (type, itemId, itemName) {
        var cfg = TYPES[type];
        var sb = window.__sb;
        buildModals();

        // 1) find the active booking for this item
        var res = await sb.from('booking').select('*').eq('BookID', itemId).eq('Status', cfg.status)
                          .order('BookingID', { ascending: false }).limit(1);
        var booking = res.data && res.data[0];
        if (!booking) { showError('Booking details were not found. Please refresh the page.'); return; }
        current = booking;
        currentType = type;

        // 2) find who booked it
        var memRes = await sb.from('member').select('*').eq('MemberID', booking.MemberID).limit(1);
        var name = memberName(memRes.data && memRes.data[0]);

        // 3) fill in the pop-up
        document.getElementById('bdIcon').style.background = cfg.color;
        document.getElementById('bdIcon').querySelector('i').className = 'bi ' + cfg.icon;
        document.getElementById('bdItemName').textContent = itemName;

        var html = '';
        if (name) html += row('Name', name);
        html += row('Member ID', booking.MemberID);
        if (cfg.hasTime) {
            html += row('Date', booking.BookingDate);
            html += row('Time', booking.StartTime + ' - ' + booking.EndTime + ' น.');
        } else {
            html += row('Borrowed', booking.BookingDate);
            html += row('Due date', booking.DueDate);
        }
        document.getElementById('bdList').innerHTML = html;

        // 4) work out if it is overdue and if it can still be extended (once only)
        var now = new Date(), overdue = false, canExtend = false;
        if (type === 'book') {
            var borrowed = parseDMY(booking.BookingDate), due = parseDMY(booking.DueDate);
            canExtend = borrowed && due ? Math.round((due - borrowed) / 86400000) <= 7 : true;
            overdue = due ? due < parseDMY(toDMY(now)) : false;
        } else {
            var diff = toMinutes(booking.EndTime) - toMinutes(booking.StartTime);
            canExtend = diff <= cfg.limitMin - 60;
            var endAt = parseDMY(booking.BookingDate);
            if (endAt) {
                var em = toMinutes(booking.EndTime);
                endAt.setHours(Math.floor(em / 60), em % 60, 0, 0);
                overdue = endAt < now;
            }
        }
        document.getElementById('bdOverdue').classList.toggle('d-none', !overdue);
        var extendBtn = document.getElementById('bdExtendBtn');
        extendBtn.classList.toggle('d-none', overdue);   // overdue items cannot be extended
        extendBtn.disabled = !canExtend;                 // already extended once

        bootstrap.Modal.getOrCreateInstance(document.getElementById('bdModal')).show();
    };
})();
