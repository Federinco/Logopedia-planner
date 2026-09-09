/* =========================================================
   COSTANTI ED IMPOSTAZIONI
========================================================= */

const HOURS_BY_YEAR = { first: 450, second: 475, third: 575 };
const TOTAL_INTERNSHIP_HOURS = Object.values(HOURS_BY_YEAR).reduce((a, b) => a + b, 0); // 1500

const INITIAL_COMPLETED_INTERNSHIP_HOURS = 655;
const DEFAULT_STUDY_HOURS_PER_CFU = 19;

// Data target aggiornata con margine di sicurezza di 1 mese (15 Agosto 2027 invece di Settembre)
const TARGET_END_DATE = new Date(2027, 7, 15);

let WEEKLY_INTERNSHIP_REFERENCE = 20;
let WEEKLY_STUDY_REFERENCE = 20;

const STORAGE_KEY = "logopediaActivities";
const STORAGE_EXAMS_KEY = "logopediaExams";
const STORAGE_EVENTS_KEY = "logopediaEvents";

const MAX_HOURS_PER_DAY = 8;

let activities = [];
let exams = [];
let events = [];

let currentCalendarDate = new Date();

/* =========================================================
   STORAGE
========================================================= */

function loadActivities() {
    try {
        activities = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        exams = JSON.parse(localStorage.getItem(STORAGE_EXAMS_KEY)) || [];
        events = JSON.parse(localStorage.getItem(STORAGE_EVENTS_KEY)) || [];
    } catch {
        activities = [];
        exams = [];
        events = [];
    }
}

function saveActivities() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    localStorage.setItem(STORAGE_EXAMS_KEY, JSON.stringify(exams));
    localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
}

/* =========================================================
   TIROCINIO
========================================================= */

function getCompletedInternshipHours() {
    const logged = activities
        .filter(a => a.type === "internship")
        .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);

    return Math.min(INITIAL_COMPLETED_INTERNSHIP_HOURS + logged, TOTAL_INTERNSHIP_HOURS);
}

function getRemainingInternshipHours() {
    return Math.max(TOTAL_INTERNSHIP_HOURS - getCompletedInternshipHours(), 0);
}

/* =========================================================
   ALGORITMO ADATTIVO SOSTENIBILE
========================================================= */

function calculateLearningFactor() {
    const passedExams = exams.filter(e => e.status === "passed" && e.grade);
    if (passedExams.length === 0) return 1.0;

    let totalPoints = 0;
    let totalCfu = 0;
    passedExams.forEach(e => {
        const cfu = Number(e.cfu) || 1;
        const grade = Number(e.grade) || 18;
        totalPoints += grade * cfu;
        totalCfu += cfu;
    });

    const average = totalPoints / totalCfu;
    if (average >= 28) return 0.88;
    if (average >= 25) return 1.0;
    return 1.15;
}

function isExamApproaching() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const upcomingExams = exams.filter(e => e.status !== "passed" && parseLocalDate(e.date) >= today);
    for (let exam of upcomingExams) {
        const examDate = parseLocalDate(exam.date);
        const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 21) {
            return true;
        }
    }
    return false;
}

function recalculateAdaptiveReferences() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const diffTime = TARGET_END_DATE - today;
    const totalRemainingWeeks = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)));

    let blockedDays = 0;
    events.forEach(e => {
        const start = parseLocalDate(e.startDate);
        const end = parseLocalDate(e.endDate);
        if (end && end >= today) {
            const diff = Math.ceil((end - (start > today ? start : today)) / (1000 * 60 * 60 * 24)) + 1;
            blockedDays += Math.max(0, diff);
        }
    });

    const blockedWeeks = blockedDays / 7;
    const effectiveWeeks = Math.max(1, totalRemainingWeeks - blockedWeeks);

    const examNear = isExamApproaching();
    const remainingInternship = getRemainingInternshipHours();

    if (examNear) {
        WEEKLY_INTERNSHIP_REFERENCE = 0;
    } else {
        // Tetto massimo a 38 ore settimanali per sostenibilità
        WEEKLY_INTERNSHIP_REFERENCE = Math.min(38, Math.max(10, Math.round(remainingInternship / effectiveWeeks)));
    }

    const learningFactor = calculateLearningFactor();
    const plannedExams = exams.filter(e => e.status !== "passed");
    
    let pendingCFU = plannedExams.reduce((acc, e) => acc + (Number(e.cfu) || 6), 0);
    if (pendingCFU === 0) pendingCFU = 18;

    const estimatedTotalStudyNeeded = pendingCFU * DEFAULT_STUDY_HOURS_PER_CFU * learningFactor;
    const loggedStudy = activities.filter(a => a.type === "study").reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const remainingStudyNeeded = Math.max(20, estimatedTotalStudyNeeded - loggedStudy);

    WEEKLY_STUDY_REFERENCE = examNear ? 35 : Math.min(35, Math.max(12, Math.round(remainingStudyNeeded / effectiveWeeks)));

    updatePacingStatus(effectiveWeeks);

    const statusEl = document.getElementById("adaptiveStatus");
    if (statusEl) {
        statusEl.textContent = examNear 
            ? `MODALITÀ SESSIONE ATTIVA: Tirocinio sospeso per priorità esami. Target studio: ${WEEKLY_STUDY_REFERENCE}h/settimana.`
            : `Algoritmo calibrato con margine di 1 mese (${Math.round(effectiveWeeks)} settimane utili). Target: ${WEEKLY_INTERNSHIP_REFERENCE}h tirocinio, ${WEEKLY_STUDY_REFERENCE}h studio.`;
    }
}

/* =========================================================
   SEGNALATORE INTEGRATO CON CALCOLO ORE DI RECUPERO
========================================================= */

function updatePacingStatus(effectiveWeeks) {
    const dot = document.getElementById("pacingDot");
    const text = document.getElementById("pacingText");
    if (!dot || !text) return;

    const weeklyDone = getWeeklyHours("internship");
    const diff = weeklyDone - WEEKLY_INTERNSHIP_REFERENCE;

    let statusClass = "status-on-track";
    let statusLabel = "In pari";

    if (WEEKLY_INTERNSHIP_REFERENCE === 0) {
        statusLabel = "Focus Esami";
        statusClass = "status-on-track";
    } else if (diff >= 3) {
        statusLabel = `+${Math.round(diff)}h In anticipo`;
        statusClass = "status-ahead";
    } else if (diff >= -2) {
        statusLabel = "In pari";
        statusClass = "status-on-track";
    } else {
        // Calcolo dell'incremento settimanale spalmato in modo sostenibile
        const missingHours = Math.abs(diff);
        const weeksToSpread = Math.max(1, effectiveWeeks);
        const extraPerWeek = Math.ceil(missingHours / weeksToSpread);

        if (extraPerWeek <= 1) {
            statusLabel = `+1h/sett x recupero`;
        } else {
            statusLabel = `+${extraPerWeek}h/sett x recupero`;
        }
        statusClass = "status-behind";
    }

    dot.setAttribute("class", `center-status-dot ${statusClass}`);
    text.setAttribute("class", `center-status-text ${statusClass}`);
    text.textContent = statusLabel;

    // Centratura dinamica
    const textWidth = statusLabel.length * 5.2; 
    const startX = -(textWidth / 2);
    dot.setAttribute("cx", startX - 8);
    text.setAttribute("x", startX);
}

/* =========================================================
   DATE & UTILS
========================================================= */

function parseLocalDate(dateString) {
    if (!dateString) return null;
    const [y, m, d] = dateString.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function formatDateString(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

function getStartOfWeek(date = new Date()) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diffToMonday);
    return result;
}

function getWeeklyHours(type) {
    const startOfWeek = getStartOfWeek();

    return activities
        .filter(a => a.type === type)
        .filter(a => {
            const date = parseLocalDate(a.date);
            return date && date >= startOfWeek;
        })
        .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
}

/* =========================================================
   ANELLI DI PROGRESSO
========================================================= */

function updateArc(progressElement, outlineElement, dotElement, current, maximum) {
    const percentage = maximum > 0 ? Math.max(0, Math.min(current / maximum, 1)) : 0;
    const totalLength = progressElement.getTotalLength();
    const visibleLength = totalLength * percentage;

    const dasharray = percentage >= 1 ? `${totalLength} 0` : `${visibleLength} ${totalLength - visibleLength}`;

    progressElement.style.strokeDasharray = dasharray;
    progressElement.style.strokeDashoffset = "0";

    outlineElement.style.strokeDasharray = dasharray;
    outlineElement.style.strokeDashoffset = "0";

    if (dotElement) {
        const tip = progressElement.getPointAtLength(visibleLength);
        dotElement.setAttribute("cx", tip.x);
        dotElement.setAttribute("cy", tip.y);
    }
}

/* =========================================================
   CALENDARIO INTERATTIVO
========================================================= */

function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const label = document.getElementById("calendarMonthLabel");
    if (!grid || !label) return;

    grid.innerHTML = "";
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    label.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        grid.appendChild(emptyCell);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = formatDateString(year, month, day);
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";
        if (dateStr === todayStr) dayCell.classList.add("today");

        const dayNum = document.createElement("span");
        dayNum.className = "day-number";
        dayNum.textContent = day;
        dayCell.appendChild(dayNum);

        const dotsContainer = document.createElement("div");
        dotsContainer.className = "day-dots";

        if (activities.some(a => a.date === dateStr && a.type === "internship")) {
            const d = document.createElement("div"); d.className = "dot-indicator dot-internship"; dotsContainer.appendChild(d);
        }
        if (activities.some(a => a.date === dateStr && a.type === "study")) {
            const d = document.createElement("div"); d.className = "dot-indicator dot-study"; dotsContainer.appendChild(d);
        }
        if (exams.some(e => e.date === dateStr)) {
            const d = document.createElement("div"); d.className = "dot-indicator dot-exam"; dotsContainer.appendChild(d);
        }
        if (events.some(ev => dateStr >= ev.startDate && dateStr <= ev.endDate)) {
            const d = document.createElement("div"); d.className = "dot-indicator dot-event"; dotsContainer.appendChild(d);
        }

        dayCell.appendChild(dotsContainer);

        dayCell.addEventListener("click", () => {
            document.getElementById("activityDate").value = dateStr;
            els.activityModal.classList.remove("hidden");
        });

        grid.appendChild(dayCell);
    }
}

/* =========================================================
   HOME & INTERFACCIA
========================================================= */

const els = {};

function initElements() {
    els.remainingHours = document.getElementById("remainingHours");
    els.internshipProgress = document.getElementById("internshipProgress");
    els.internshipOutline = document.getElementById("internshipOutline");
    els.weeklyInternshipProgress = document.getElementById("weeklyInternshipProgress");
    els.weeklyInternshipOutline = document.getElementById("weeklyInternshipOutline");
    els.weeklyStudyProgress = document.getElementById("weeklyStudyProgress");
    els.weeklyStudyOutline = document.getElementById("weeklyStudyOutline");
    els.internshipDot = document.getElementById("internshipDot");
    els.weeklyInternshipDot = document.getElementById("weeklyInternshipDot");
    els.weeklyStudyDot = document.getElementById("weeklyStudyDot");
    els.activitiesList = document.getElementById("activitiesList");
    els.activityModal = document.getElementById("activityModal");
    els.addActivityButton = document.getElementById("addActivityButton");
    els.closeModal = document.getElementById("closeModal");
    els.saveActivityButton = document.getElementById("saveActivity");
    els.activityDate = document.getElementById("activityDate");
    els.activityHours = document.getElementById("activityHours");
}

function updateHome() {
    recalculateAdaptiveReferences();

    const completed = getCompletedInternshipHours();
    const remaining = getRemainingInternshipHours();
    const weeklyInternship = getWeeklyHours("internship");
    const weeklyStudy = getWeeklyHours("study");

    els.remainingHours.textContent = Math.round(remaining);

    updateArc(els.internshipProgress, els.internshipOutline, els.internshipDot, completed, TOTAL_INTERNSHIP_HOURS);
    updateArc(els.weeklyInternshipProgress, els.weeklyInternshipOutline, els.weeklyInternshipDot, weeklyInternship, WEEKLY_INTERNSHIP_REFERENCE);
    updateArc(els.weeklyStudyProgress, els.weeklyStudyOutline, els.weeklyStudyDot, weeklyStudy, WEEKLY_STUDY_REFERENCE);
}

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
    document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("active", btn.dataset.page === pageId));
    if (pageId === "calendarViewPage") renderCalendar();
}

/* =========================================================
   MODALE ATTIVITÀ
========================================================= */

let selectedType = "internship";

function resetModalForm() {
    els.activityDate.value = "";
    els.activityHours.value = "";
}

function handleSaveActivity() {
    const date = els.activityDate.value;
    const hours = Number(els.activityHours.value);

    if (!date) { alert("Inserisci una data."); return; }
    if (!hours || hours <= 0) { alert("Inserisci un numero di ore valido."); return; }

    if (selectedType === "internship") {
        if (hours > MAX_HOURS_PER_DAY) {
            alert(`Il tirocinio non può superare ${MAX_HOURS_PER_DAY} ore nello stesso giorno.`);
            return;
        }
        if (hours > getRemainingInternshipHours()) {
            alert("Le ore inserite superano il totale di tirocinio ancora da svolgere.");
            return;
        }
    }

    activities.push({ id: Date.now(), type: selectedType, date, hours });
    saveActivities();

    els.activityModal.classList.add("hidden");
    resetModalForm();

    updateHome();
    renderActivities();
    renderCalendar();
}

/* =========================================================
   RENDERING LIBRETTO
========================================================= */

function updateLibrettoStats() {
    const passed = exams.filter(e => e.status === "passed");
    let totalCfu = 0;
    let weightedSum = 0;

    passed.forEach(e => {
        const cfu = Number(e.cfu) || 0;
        const grade = Number(e.grade) || 0;
        totalCfu += cfu;
        weightedSum += (grade * cfu);
    });

    const avg = totalCfu > 0 ? (weightedSum / totalCfu).toFixed(2) : "--";
    
    const avgEl = document.getElementById("weightedAverage");
    const cfuEl = document.getElementById("totalCFU");

    if (avgEl) avgEl.textContent = avg;
    if (cfuEl) cfuEl.textContent = totalCfu;
}

function renderActivities() {
    const list = els.activitiesList;
    list.innerHTML = "";

    if (activities.length === 0) {
        list.innerHTML = `<div class="activity-card-info">Nessuna attività registrata</div>`;
    } else {
        const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
        list.innerHTML = sorted.map(activity => `
            <div class="activity-card">
                <div class="activity-card-title">${activity.type === "internship" ? "Tirocinio" : "Studio"}</div>
                <div class="activity-card-info">${activity.date} · ${activity.hours} h</div>
                <button class="delete-activity" data-id="${activity.id}" data-kind="activity">Elimina</button>
            </div>
        `).join("");
    }

    const examsList = document.getElementById("examsList");
    if (examsList) {
        if (exams.length === 0) {
            examsList.innerHTML = `<div class="activity-card-info">Nessun esame a libretto</div>`;
        } else {
            examsList.innerHTML = exams.map(e => `
                <div class="activity-card">
                    <div class="activity-card-title">${e.title} (${e.cfu || 0} CFU)</div>
                    <div class="activity-card-info">Data: ${e.date} · Stato: ${e.status === "passed" ? `Superato con ${e.grade}` : "In programma"}</div>
                    <button class="delete-activity" data-id="${e.id}" data-kind="exam">Elimina</button>
                </div>
            `).join("");
        }
    }

    const eventsList = document.getElementById("eventsList");
    if (eventsList) {
        if (events.length === 0) {
            eventsList.innerHTML = `<div class="activity-card-info">Nessun rientro o vacanza inserita</div>`;
        } else {
            eventsList.innerHTML = events.map(ev => `
                <div class="activity-card">
                    <div class="activity-card-title">${ev.type === "home" ? "Rientro a Casa" : "Vacanza"}</div>
                    <div class="activity-card-info">Dal ${ev.startDate} al ${ev.endDate}</div>
                    <button class="delete-activity" data-id="${ev.id}" data-kind="event">Elimina</button>
                </div>
            `).join("");
        }
    }

    updateLibrettoStats();

    document.querySelectorAll(".delete-activity").forEach(button => {
        button.addEventListener("click", function () {
            const id = Number(this.dataset.id);
            const kind = this.dataset.kind;

            if (kind === "activity") activities = activities.filter(a => a.id !== id);
            if (kind === "exam") exams = exams.filter(e => e.id !== id);
            if (kind === "event") events = events.filter(e => e.id !== id);

            saveActivities();
            updateHome();
            renderActivities();
            renderCalendar();
        });
    });
}

/* =========================================================
   INIZIALIZZAZIONE & EVENTI
========================================================= */

function bindEvents() {
    document.querySelectorAll(".nav-button").forEach(button => {
        button.addEventListener("click", () => showPage(button.dataset.page));
    });

    els.addActivityButton.addEventListener("click", () => els.activityModal.classList.remove("hidden"));
    els.closeModal.addEventListener("click", () => els.activityModal.classList.add("hidden"));

    document.querySelectorAll(".type-button").forEach(button => {
        button.addEventListener("click", function () {
            selectedType = this.dataset.type;
            document.querySelectorAll(".type-button").forEach(b => b.classList.remove("selected"));
            this.classList.add("selected");
        });
    });

    els.saveActivityButton.addEventListener("click", handleSaveActivity);

    document.getElementById("prevMonthBtn").addEventListener("click", () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById("nextMonthBtn").addEventListener("click", () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    const addExamBtn = document.getElementById("addExamButton");
    const examModal = document.getElementById("examModal");
    const closeExamModal = document.getElementById("closeExamModal");
    const saveExamBtn = document.getElementById("saveExam");
    const examStatusSelect = document.getElementById("examStatus");
    const gradeContainer = document.getElementById("gradeContainer");

    if (examStatusSelect) {
        examStatusSelect.addEventListener("change", function() {
            gradeContainer.style.display = this.value === "passed" ? "block" : "none";
        });
    }

    if (addExamBtn) addExamBtn.addEventListener("click", () => examModal.classList.remove("hidden"));
    if (closeExamModal) closeExamModal.addEventListener("click", () => examModal.classList.add("hidden"));
    if (saveExamBtn) {
        saveExamBtn.addEventListener("click", () => {
            const title = document.getElementById("examTitle").value;
            const cfu = Number(document.getElementById("examCFU").value);
            const date = document.getElementById("examDate").value;
            const status = document.getElementById("examStatus").value;
            const grade = Number(document.getElementById("examGrade").value);

            if (!title || !date || !cfu) {
                alert("Compila materia, CFU e data.");
                return;
            }

            exams.push({ id: Date.now(), title, cfu, date, status, grade: status === "passed" ? grade : null });
            saveActivities();
            examModal.classList.add("hidden");
            updateHome();
            renderActivities();
            renderCalendar();
        });
    }

    let selectedEventType = "home";
    const addEventBtn = document.getElementById("addEventButton");
    const eventModal = document.getElementById("eventModal");
    const closeEventModal = document.getElementById("closeEventModal");
    const saveEventBtn = document.getElementById("saveEvent");

    if (addEventBtn) addEventBtn.addEventListener("click", () => eventModal.classList.remove("hidden"));
    if (closeEventModal) closeEventModal.addEventListener("click", () => eventModal.classList.add("hidden"));

    document.querySelectorAll(".event-type-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            selectedEventType = this.dataset.eventtype;
            document.querySelectorAll(".event-type-btn").forEach(b => b.classList.remove("selected"));
            this.classList.add("selected");
        });
    });

    if (saveEventBtn) {
        saveEventBtn.addEventListener("click", () => {
            const startDate = document.getElementById("eventStartDate").value;
            const endDate = document.getElementById("eventEndDate").value;

            if (!startDate || !endDate) {
                alert("Inserisci data inizio e data fine.");
                return;
            }

            events.push({ id: Date.now(), type: selectedEventType, startDate, endDate });
            saveActivities();
            eventModal.classList.add("hidden");
            updateHome();
            renderActivities();
            renderCalendar();
        });
    }
}

function init() {
    initElements();
    loadActivities();
    bindEvents();
    updateHome();
    renderActivities();
    renderCalendar();
}

document.addEventListener("DOMContentLoaded", init);