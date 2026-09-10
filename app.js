/* =========================================================
   LOGOPEDIA PLANNER
   MOTORE UNICO DELL'APPLICAZIONE
========================================================= */


/* =========================================================
   PARAMETRI DEL PERCORSO
========================================================= */

/*
 * ATTENZIONE:
 *
 * I valori annuali vengono mantenuti esattamente come definiti:
 *
 * 1° anno = 450 h
 * 2° anno = 475 h
 * 3° anno = 575 h
 *
 * Il totale globale utilizzato dall'indicatore è 1550 h.
 *
 * Ore già completate:
 * 450 + 205 = 655? NO.
 *
 * Il valore definitivo richiesto è 645 h.
 */

const HOURS_BY_YEAR = {
    first: 450,
    second: 475,
    third: 575
};

const TOTAL_INTERNSHIP_HOURS = 1550;

const INITIAL_COMPLETED_INTERNSHIP_HOURS = 645;


/* =========================================================
   LIMITI TIROCINIO
========================================================= */

const MAX_INTERNSHIP_HOURS_PER_DAY = 8;
const NORMAL_INTERNSHIP_HOURS_PER_DAY = 6;
const MAX_INTERNSHIP_HOURS_PER_WEEK = 38;


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "logopediaActivities";
const STORAGE_EXAMS_KEY = "logopediaExams";
const STORAGE_EVENTS_KEY = "logopediaEvents";
const STORAGE_SETTINGS_KEY = "logopediaSettings";
const STORAGE_PACING_KEY = "logopediaPacing";


/* =========================================================
   DEFAULT
========================================================= */

const DEFAULT_SETTINGS = {
    finalExamDate: "2027-09-30",
    finalExamBufferDays: 21
};


/* =========================================================
   DATI
========================================================= */

let activities = [];
let exams = [];
let events = [];

let settings = {
    ...DEFAULT_SETTINGS
};

let pacing = {
    weekStart: "",
    balance: 0
};

let currentCalendarDate = new Date();

let selectedActivityType = "internship";
let selectedEventType = "home";

let editingExamId = null;


/* =========================================================
   RIFERIMENTI DOM
========================================================= */

const els = {};


/* =========================================================
   UTILITY
========================================================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function parseLocalDate(dateString) {

    if (!dateString) {
        return null;
    }

    const parts = dateString.split("-").map(Number);

    if (parts.length !== 3) {
        return null;
    }

    const [year, month, day] = parts;

    if (!year || !month || !day) {
        return null;
    }

    return new Date(
        year,
        month - 1,
        day
    );
}


function dateToString(date) {

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatItalianDate(dateString) {

    const date = parseLocalDate(dateString);

    if (!date) {
        return "--";
    }

    return date.toLocaleDateString(
        "it-IT",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


function formatItalianDateLong(dateString) {

    const date = parseLocalDate(dateString);

    if (!date) {
        return "--";
    }

    return date.toLocaleDateString(
        "it-IT",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


function daysBetween(start, end) {

    const ms =
        1000 *
        60 *
        60 *
        24;

    return Math.ceil(
        (
            end - start
        ) / ms
    );
}


function getToday() {

    const today = new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    return today;
}


function getStartOfWeek(date = new Date()) {

    const result = new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    const day = result.getDay();

    const diff =
        day === 0
            ? -6
            : 1 - day;

    result.setDate(
        result.getDate() + diff
    );

    return result;
}


function getEndOfWeek(date = new Date()) {

    const result =
        getStartOfWeek(date);

    result.setDate(
        result.getDate() + 6
    );

    return result;
}


function getDaysInRange(start, end) {

    if (!start || !end || end < start) {
        return 0;
    }

    return (
        Math.floor(
            (
                end - start
            ) /
            (1000 * 60 * 60 * 24)
        ) + 1
    );
}


/* =========================================================
   STORAGE
========================================================= */

function loadData() {

    try {

        activities =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                )
            ) || [];

        exams =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_EXAMS_KEY
                )
            ) || [];

        events =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_EVENTS_KEY
                )
            ) || [];

        const storedSettings =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_SETTINGS_KEY
                )
            );

        if (storedSettings) {

            settings = {
                ...DEFAULT_SETTINGS,
                ...storedSettings
            };
        }

        const storedPacing =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_PACING_KEY
                )
            );

        if (storedPacing) {

            pacing = {
                ...pacing,
                ...storedPacing
            };
        }

    } catch (error) {

        console.error(
            "Errore caricamento dati:",
            error
        );

        activities = [];
        exams = [];
        events = [];

        settings = {
            ...DEFAULT_SETTINGS
        };

        pacing = {
            weekStart: "",
            balance: 0
        };
    }
}


function saveData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(activities)
    );

    localStorage.setItem(
        STORAGE_EXAMS_KEY,
        JSON.stringify(exams)
    );

    localStorage.setItem(
        STORAGE_EVENTS_KEY,
        JSON.stringify(events)
    );

    localStorage.setItem(
        STORAGE_SETTINGS_KEY,
        JSON.stringify(settings)
    );

    localStorage.setItem(
        STORAGE_PACING_KEY,
        JSON.stringify(pacing)
    );
}


/* =========================================================
   TIROCINIO
========================================================= */

function getLoggedInternshipHours() {

    return activities
        .filter(
            activity =>
                activity.type === "internship"
        )
        .reduce(
            (sum, activity) =>
                sum +
                Number(activity.hours || 0),
            0
        );
}


function getCompletedInternshipHours() {

    return Math.min(
        INITIAL_COMPLETED_INTERNSHIP_HOURS +
        getLoggedInternshipHours(),
        TOTAL_INTERNSHIP_HOURS
    );
}


function getRemainingInternshipHours() {

    return Math.max(
        TOTAL_INTERNSHIP_HOURS -
        getCompletedInternshipHours(),
        0
    );
}


/* =========================================================
   ATTIVITÀ SETTIMANALI
========================================================= */

function getHoursForRange(
    type,
    start,
    end
) {

    return activities
        .filter(
            activity =>
                activity.type === type
        )
        .filter(activity => {

            const date =
                parseLocalDate(
                    activity.date
                );

            return (
                date &&
                date >= start &&
                date <= end
            );
        })
        .reduce(
            (sum, activity) =>
                sum +
                Number(activity.hours || 0),
            0
        );
}


function getWeeklyHours(type) {

    const start =
        getStartOfWeek();

    const end =
        getEndOfWeek();

    return getHoursForRange(
        type,
        start,
        end
    );
}


function getHoursForDay(
    type,
    dateString
) {

    return activities
        .filter(
            activity =>
                activity.type === type &&
                activity.date === dateString
        )
        .reduce(
            (sum, activity) =>
                sum +
                Number(activity.hours || 0),
            0
        );
}


/* =========================================================
   EVENTI CHE BLOCCANO IL TIROCINIO
========================================================= */

function isDateBlocked(date) {

    return events.some(event => {

        const start =
            parseLocalDate(
                event.startDate
            );

        const end =
            parseLocalDate(
                event.endDate
            );

        return (
            start &&
            end &&
            date >= start &&
            date <= end
        );
    });
}


function isDateStringBlocked(dateString) {

    const date =
        parseLocalDate(dateString);

    return date
        ? isDateBlocked(date)
        : false;
}


/* =========================================================
   ESAMI
========================================================= */

function getUpcomingExams() {

    const today =
        getToday();

    return exams
        .filter(exam => {

            if (
                exam.status === "passed"
            ) {
                return false;
            }

            const date =
                parseLocalDate(
                    exam.date
                );

            return (
                date &&
                date >= today
            );
        })
        .sort(
            (a, b) =>
                a.date.localeCompare(
                    b.date
                )
        );
}


function getNearestUpcomingExam() {

    const upcoming =
        getUpcomingExams();

    return upcoming.length
        ? upcoming[0]
        : null;
}


/* =========================================================
   PRESSIONE ESAME
   RIDUZIONE GRADUALE
========================================================= */

function getExamPressureFactor() {

    const today =
        getToday();

    const upcoming =
        getUpcomingExams();

    if (!upcoming.length) {
        return 1;
    }

    let closestDays = Infinity;

    upcoming.forEach(exam => {

        const date =
            parseLocalDate(
                exam.date
            );

        const diff =
            daysBetween(
                today,
                date
            );

        closestDays =
            Math.min(
                closestDays,
                Math.max(0, diff)
            );
    });


    /*
     * Lontano dall'esame:
     * 100%
     *
     * 43-56 giorni:
     * 90%
     *
     * 29-42:
     * 75%
     *
     * 15-28:
     * 50%
     *
     * 8-14:
     * 25%
     *
     * 0-7:
     * 0%
     *
     * Quindi il tirocinio non
     * crolla improvvisamente da
     * 30 a 0.
     */

    if (closestDays > 56) {
        return 1;
    }

    if (closestDays > 42) {
        return .90;
    }

    if (closestDays > 28) {
        return .75;
    }

    if (closestDays > 14) {
        return .50;
    }

    if (closestDays > 7) {
        return .25;
    }

    return 0;
}


/* =========================================================
   DATA FINE E MARGINE ESAME FINALE
========================================================= */

function getFinalExamDate() {

    return parseLocalDate(
        settings.finalExamDate
    );
}


function getInternshipDeadline() {

    const finalExam =
        getFinalExamDate();

    if (!finalExam) {
        return null;
    }

    const deadline =
        new Date(finalExam);

    deadline.setDate(
        deadline.getDate() -
        Number(
            settings.finalExamBufferDays
        )
    );

    deadline.setHours(
        0,
        0,
        0,
        0
    );

    return deadline;
}


/* =========================================================
   GIORNI DISPONIBILI FINO AL DEADLINE
========================================================= */

function getAvailableDaysUntilDeadline() {

    const today =
        getToday();

    const deadline =
        getInternshipDeadline();

    if (!deadline) {
        return 0;
    }

    if (deadline < today) {
        return 0;
    }

    let availableDays = 0;

    const cursor =
        new Date(today);

    while (cursor <= deadline) {

        if (
            !isDateBlocked(cursor)
        ) {
            availableDays++;
        }

        cursor.setDate(
            cursor.getDate() + 1
        );
    }

    return availableDays;
}


/* =========================================================
   SETTIMANE EFFETTIVE
========================================================= */

function getEffectiveWeeks() {

    const availableDays =
        getAvailableDaysUntilDeadline();

    return Math.max(
        1,
        availableDays / 7
    );
}


/* =========================================================
   ALGORITMO TIROCINIO
========================================================= */

function calculateInternshipTarget() {

    const remaining =
        getRemainingInternshipHours();

    if (remaining <= 0) {
        return 0;
    }

    const availableDays =
        getAvailableDaysUntilDeadline();

    if (availableDays <= 0) {
        return 0;
    }

    /*
     * Necessità media reale
     * per settimana.
     */

    const baseWeeklyNeed =
        remaining /
        getEffectiveWeeks();


    /*
     * Pressione esame.
     */

    const pressure =
        getExamPressureFactor();


    /*
     * Se siamo nella settimana
     * dell'esame, si può arrivare
     * realmente a zero.
     */

    let target =
        baseWeeklyNeed *
        pressure;


    /*
     * Credito/debito precedente.
     *
     * Il recupero è volutamente
     * limitato per non generare
     * settimane assurde.
     */

    const balance =
        Number(
            pacing.balance || 0
        );

    if (balance < 0) {

        target += Math.min(
            Math.abs(balance) * .25,
            4
        );

    } else if (balance > 0) {

        target -= Math.min(
            balance * .20,
            3
        );
    }


    /*
     * Se il target è quasi zero
     * per l'esame, deve rimanere
     * effettivamente zero.
     */

    if (pressure === 0) {
        return 0;
    }


    /*
     * Limite assoluto settimanale.
     */

    return clamp(
        Math.round(
            target * 2
        ) / 2,
        0,
        MAX_INTERNSHIP_HOURS_PER_WEEK
    );
}


/* =========================================================
   AGGIORNAMENTO CREDITO / DEBITO SETTIMANALE
========================================================= */

function settlePreviousWeek() {

    const currentStart =
        getStartOfWeek();

    const currentStartString =
        dateToString(
            currentStart
        );


    /*
     * Prima apertura.
     */

    if (!pacing.weekStart) {

        pacing.weekStart =
            currentStartString;

        saveData();

        return;
    }


    const storedStart =
        parseLocalDate(
            pacing.weekStart
        );

    if (!storedStart) {

        pacing.weekStart =
            currentStartString;

        saveData();

        return;
    }


    /*
     * Siamo ancora nella
     * stessa settimana.
     */

    if (
        storedStart.getTime() ===
        currentStart.getTime()
    ) {
        return;
    }


    /*
     * Recuperiamo tutte le
     * settimane trascorse.
     */

    let weekStart =
        new Date(storedStart);


    while (
        weekStart <
        currentStart
    ) {

        const weekEnd =
            new Date(weekStart);

        weekEnd.setDate(
            weekEnd.getDate() + 6
        );


        const actual =
            getHoursForRange(
                "internship",
                weekStart,
                weekEnd
            );


        /*
         * Il target della settimana
         * precedente viene ricostruito
         * usando la situazione corrente
         * non è perfetto storicamente,
         * ma evita di perdere il credito.
         */

        const target =
            Math.min(
                MAX_INTERNSHIP_HOURS_PER_WEEK,
                Math.max(
                    0,
                    calculateHistoricalTarget(
                        weekStart
                    )
                )
            );


        pacing.balance =
            clamp(
                Number(
                    pacing.balance || 0
                ) +
                actual -
                target,
                -20,
                20
            );


        weekStart.setDate(
            weekStart.getDate() + 7
        );
    }


    pacing.weekStart =
        currentStartString;

    saveData();
}


/*
 * Calcolo storico semplice.
 */

function calculateHistoricalTarget(
    weekStart
) {

    const deadline =
        getInternshipDeadline();

    if (
        !deadline ||
        weekStart > deadline
    ) {
        return 0;
    }


    const weekEnd =
        new Date(weekStart);

    weekEnd.setDate(
        weekEnd.getDate() + 6
    );


    const remaining =
        getRemainingInternshipHours();


    const daysRemaining =
        Math.max(
            1,
            getDaysInRange(
                weekStart,
                deadline
            )
        );


    return (
        remaining /
        (daysRemaining / 7)
    );
}


/* =========================================================
   STATO GENERALE
========================================================= */

function getPacingStatus() {

    const target =
        calculateInternshipTarget();

    const actual =
        getWeeklyHours(
            "internship"
        );


    if (
        target === 0
    ) {

        if (
            getExamPressureFactor() === 0
        ) {
            return {
                label: "Focus esami",
                className: "status-on-track"
            };
        }

        return {
            label: "Tirocinio completato",
            className: "status-ahead"
        };
    }


    const difference =
        actual - target;


    if (difference >= 3) {

        return {
            label:
                `+${Math.round(difference)}h In anticipo`,
            className: "status-ahead"
        };
    }


    if (difference >= -2) {

        return {
            label: "In pari",
            className: "status-on-track"
        };
    }


    return {
        label:
            `${Math.round(
                Math.abs(difference)
            )}h da recuperare`,
        className: "status-behind"
    };
}


/* =========================================================
   STUDIO
========================================================= */

function getStudyHoursForExam(
    examId
) {

    return activities
        .filter(
            activity =>
                activity.type === "study" &&
                String(
                    activity.examId || ""
                ) === String(examId)
        )
        .reduce(
            (sum, activity) =>
                sum +
                Number(
                    activity.hours || 0
                ),
            0
        );
}


function getRemainingStudyHours(
    exam
) {

    const estimated =
        Number(
            exam.studyHours || 0
        );

    const done =
        getStudyHoursForExam(
            exam.id
        );

    return Math.max(
        estimated - done,
        0
    );
}


function calculateWeeklyStudyTarget() {

    const today =
        getToday();

    let target = 0;


    getUpcomingExams()
        .forEach(exam => {

            const examDate =
                parseLocalDate(
                    exam.date
                );

            if (!examDate) {
                return;
            }


            const remaining =
                getRemainingStudyHours(
                    exam
                );

            if (
                remaining <= 0
            ) {
                return;
            }


            const days =
                Math.max(
                    1,
                    daysBetween(
                        today,
                        examDate
                    )
                );


            /*
             * L'obiettivo settimanale
             * viene ricavato dalla stima
             * personale inserita per
             * quell'esame.
             *
             * Nessun rapporto fisso
             * CFU -> ore.
             */

            target +=
                remaining /
                (days / 7);
        });


    return Math.max(
        0,
        Math.round(
            target * 2
        ) / 2
    );
}


/* =========================================================
   INDICATORI SVG
========================================================= */

function updateArc(
    progressElement,
    outlineElement,
    dotElement,
    current,
    maximum
) {

    if (
        !progressElement ||
        !outlineElement
    ) {
        return;
    }


    const percentage =
        maximum > 0
            ? clamp(
                current / maximum,
                0,
                1
            )
            : 0;


    const totalLength =
        progressElement.getTotalLength();


    const visibleLength =
        totalLength *
        percentage;


    let dashArray;


    if (
        percentage >= 1
    ) {

        dashArray =
            `${totalLength} 0`;

    } else if (
        percentage <= 0
    ) {

        dashArray =
            `0 ${totalLength}`;

    } else {

        dashArray =
            `${visibleLength} ${totalLength - visibleLength}`;
    }


    progressElement.style.strokeDasharray =
        dashArray;

    progressElement.style.strokeDashoffset =
        "0";


    outlineElement.style.strokeDasharray =
        dashArray;

    outlineElement.style.strokeDashoffset =
        "0";


    if (
        dotElement
    ) {

        const point =
            progressElement.getPointAtLength(
                visibleLength
            );

        dotElement.setAttribute(
            "cx",
            point.x
        );

        dotElement.setAttribute(
            "cy",
            point.y
        );
    }
}


/* =========================================================
   HOME
========================================================= */

function updatePacingIndicator() {

    const dot =
        document.getElementById(
            "pacingDot"
        );

    const text =
        document.getElementById(
            "pacingText"
        );

    if (!dot || !text) {
        return;
    }


    const status =
        getPacingStatus();


    dot.setAttribute(
        "class",
        `center-status-dot ${status.className}`
    );

    text.setAttribute(
        "class",
        `center-status-text ${status.className}`
    );

    text.textContent =
        status.label;


    const width =
        status.label.length *
        5.2;


    const startX =
        -(width / 2);


    dot.setAttribute(
        "cx",
        startX - 8
    );

    text.setAttribute(
        "x",
        startX
    );
}


function updateHome() {

    settlePreviousWeek();


    const completed =
        getCompletedInternshipHours();

    const remaining =
        getRemainingInternshipHours();

    const weeklyInternship =
        getWeeklyHours(
            "internship"
        );

    const weeklyStudy =
        getWeeklyHours(
            "study"
        );


    const internshipTarget =
        calculateInternshipTarget();

    const studyTarget =
        calculateWeeklyStudyTarget();


    els.remainingHours.textContent =
        Math.round(
            remaining
        );


    updateArc(
        els.internshipProgress,
        els.internshipOutline,
        els.internshipDot,
        completed,
        TOTAL_INTERNSHIP_HOURS
    );


    updateArc(
        els.weeklyInternshipProgress,
        els.weeklyInternshipOutline,
        els.weeklyInternshipDot,
        weeklyInternship,
        internshipTarget
    );


    updateArc(
        els.weeklyStudyProgress,
        els.weeklyStudyOutline,
        els.weeklyStudyDot,
        weeklyStudy,
        studyTarget
    );


    updatePacingIndicator();

    updateAdaptiveStatus();

    updateOtherPage();
}


/* =========================================================
   STATO ADATTIVO VISIBILE
========================================================= */

function updateAdaptiveStatus() {

    const element =
        document.getElementById(
            "adaptiveStatus"
        );

    if (!element) {
        return;
    }


    const internshipTarget =
        calculateInternshipTarget();

    const studyTarget =
        calculateWeeklyStudyTarget();

    const pressure =
        getExamPressureFactor();

    const remaining =
        getRemainingInternshipHours();


    if (
        remaining <= 0
    ) {

        element.textContent =
            "Tirocinio completato. Il percorso è in fase di chiusura.";

        return;
    }


    let pressureText;


    if (pressure === 1) {
        pressureText =
            "carico normale";
    } else if (pressure >= .75) {
        pressureText =
            "riduzione leggera per avvicinamento agli esami";
    } else if (pressure >= .50) {
        pressureText =
            "riduzione progressiva per priorità studio";
    } else if (pressure > 0) {
        pressureText =
            "forte riduzione per priorità esame";
    } else {
        pressureText =
            "tirocinio temporaneamente a zero per esame";
    }


    element.textContent =
        `Restano ${Math.round(remaining)} h. ` +
        `Target attuale: ${internshipTarget} h di tirocinio e ` +
        `${studyTarget} h di studio questa settimana; ` +
        `${pressureText}.`;
}


/* =========================================================
   ALTRO
========================================================= */

function updateOtherPage() {

    const deadline =
        getInternshipDeadline();

    const finalExam =
        getFinalExamDate();


    const deadlineInfo =
        document.getElementById(
            "deadlineInfo"
        );

    const finalExamInfo =
        document.getElementById(
            "finalExamInfo"
        );


    if (deadlineInfo) {

        deadlineInfo.textContent =
            deadline
                ? `${formatItalianDateLong(
                    dateToString(deadline)
                )} — termine operativo con margine`
                : "Data non impostata";
    }


    if (finalExamInfo) {

        finalExamInfo.textContent =
            finalExam
                ? `${formatItalianDateLong(
                    dateToString(finalExam)
                )} — ${settings.finalExamBufferDays} giorni di preparazione`
                : "Data non impostata";
    }
}


/* =========================================================
   CALENDARIO
========================================================= */

function renderCalendar() {

    const grid =
        document.getElementById(
            "calendarGrid"
        );

    const label =
        document.getElementById(
            "calendarMonthLabel"
        );


    if (!grid || !label) {
        return;
    }


    grid.innerHTML = "";


    const year =
        currentCalendarDate.getFullYear();

    const month =
        currentCalendarDate.getMonth();


    const monthNames = [
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre"
    ];


    label.textContent =
        `${monthNames[month]} ${year}`;


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    const lastDay =
        new Date(
            year,
            month + 1,
            0
        );


    let startDay =
        firstDay.getDay() - 1;


    if (startDay === -1) {
        startDay = 6;
    }


    for (
        let i = 0;
        i < startDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "calendar-day empty";

        grid.appendChild(
            empty
        );
    }


    const todayString =
        dateToString(
            getToday()
        );


    for (
        let day = 1;
        day <= lastDay.getDate();
        day++
    ) {

        const dateString =
            `${year}-${String(
                month + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;


        const cell =
            document.createElement(
                "div"
            );

        cell.className =
            "calendar-day";


        if (
            dateString ===
            todayString
        ) {
            cell.classList.add(
                "today"
            );
        }


        const number =
            document.createElement(
                "span"
            );

        number.className =
            "day-number";

        number.textContent =
            day;


        cell.appendChild(
            number
        );


        const dots =
            document.createElement(
                "div"
            );

        dots.className =
            "day-dots";


        if (
            activities.some(
                activity =>
                    activity.date ===
                        dateString &&
                    activity.type ===
                        "internship"
            )
        ) {

            const dot =
                document.createElement(
                    "div"
                );

            dot.className =
                "dot-indicator dot-internship";

            dots.appendChild(
                dot
            );
        }


        if (
            activities.some(
                activity =>
                    activity.date ===
                        dateString &&
                    activity.type ===
                        "study"
            )
        ) {

            const dot =
                document.createElement(
                    "div"
                );

            dot.className =
                "dot-indicator dot-study";

            dots.appendChild(
                dot
            );
        }


        if (
            exams.some(
                exam =>
                    exam.date ===
                    dateString
            )
        ) {

            const dot =
                document.createElement(
                    "div"
                );

            dot.className =
                "dot-indicator dot-exam";

            dots.appendChild(
                dot
            );
        }


        if (
            events.some(
                event =>
                    dateString >=
                        event.startDate &&
                    dateString <=
                        event.endDate
            )
        ) {

            const dot =
                document.createElement(
                    "div"
                );

            dot.className =
                "dot-indicator dot-event";

            dots.appendChild(
                dot
            );
        }


        cell.appendChild(
            dots
        );


        cell.addEventListener(
            "click",
            () => {

                openActivityModal(
                    dateString
                );
            }
        );


        grid.appendChild(
            cell
        );
    }
}


/* =========================================================
   PAGINE
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(
            page => {

                page.classList.toggle(
                    "active",
                    page.id === pageId
                );
            }
        );


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                    pageId
                );
            }
        );


    if (
        pageId ===
        "calendarViewPage"
    ) {

        renderCalendar();
    }


    if (
        pageId ===
        "calendarPage"
    ) {

        renderActivities();
    }


    if (
        pageId ===
        "otherPage"
    ) {

        updateOtherPage();
        renderActivities();
    }
}


/* =========================================================
   MODALE ATTIVITÀ
========================================================= */

function populateStudyExamSelect() {

    const select =
        document.getElementById(
            "studyExam"
        );

    if (!select) {
        return;
    }


    const previous =
        select.value;


    select.innerHTML =
        `<option value="">Studio generale</option>`;


    exams
        .filter(
            exam =>
                exam.status !==
                "passed"
        )
        .sort(
            (a, b) =>
                a.date.localeCompare(
                    b.date
                )
        )
        .forEach(
            exam => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    exam.id;

                option.textContent =
                    `${exam.title} — ${formatItalianDate(
                        exam.date
                    )}`;

                select.appendChild(
                    option
                );
            }
        );


    if (
        previous &&
        [
            ...select.options
        ].some(
            option =>
                option.value ===
                previous
        )
    ) {

        select.value =
            previous;
    }
}


function updateActivityTypeUI() {

    document
        .querySelectorAll(
            ".type-button"
        )
        .forEach(
            button => {

                if (
                    !button.dataset.type
                ) {
                    return;
                }

                button.classList.toggle(
                    "selected",
                    button.dataset.type ===
                    selectedActivityType
                );
            }
        );


    const studyContainer =
        document.getElementById(
            "studyExamContainer"
        );


    if (studyContainer) {

        studyContainer.style.display =
            selectedActivityType ===
            "study"
                ? "block"
                : "none";
    }
}


function openActivityModal(
    date = ""
) {

    populateStudyExamSelect();

    document.getElementById(
        "activityDate"
    ).value =
        date ||
        dateToString(
            getToday()
        );

    document.getElementById(
        "activityHours"
    ).value = "";

    document.getElementById(
        "studyExam"
    ).value = "";


    updateActivityTypeUI();


    els.activityModal.classList.remove(
        "hidden"
    );
}


function closeActivityModal() {

    els.activityModal.classList.add(
        "hidden"
    );
}


function validateInternshipEntry(
    date,
    hours
) {

    const dateObject =
        parseLocalDate(
            date
        );

    if (!dateObject) {

        alert(
            "Inserisci una data valida."
        );

        return false;
    }


    if (
        isDateBlocked(
            dateObject
        )
    ) {

        alert(
            "Questa giornata è occupata da un rientro/vacanza."
        );

        return false;
    }


    if (
        hours > MAX_INTERNSHIP_HOURS_PER_DAY
    ) {

        alert(
            `Il massimo giornaliero è ${MAX_INTERNSHIP_HOURS_PER_DAY} ore.`
        );

        return false;
    }


    const dayAlready =
        getHoursForDay(
            "internship",
            date
        );


    if (
        dayAlready +
        hours >
        MAX_INTERNSHIP_HOURS_PER_DAY
    ) {

        alert(
            `In questa giornata puoi registrare al massimo ${MAX_INTERNSHIP_HOURS_PER_DAY} ore complessive.`
        );

        return false;
    }


    const weekStart =
        getStartOfWeek(
            dateObject
        );

    const weekEnd =
        getEndOfWeek(
            dateObject
        );


    const weekHours =
        getHoursForRange(
            "internship",
            weekStart,
            weekEnd
        );


    if (
        weekHours +
        hours >
        MAX_INTERNSHIP_HOURS_PER_WEEK
    ) {

        alert(
            `Il limite settimanale è ${MAX_INTERNSHIP_HOURS_PER_WEEK} ore.`
        );

        return false;
    }


    /*
     * Una sola giornata da oltre
     * 6 ore nella settimana.
     */

    const existingLongDays =
        new Set();


    activities
        .filter(
            activity =>
                activity.type ===
                "internship"
        )
        .forEach(
            activity => {

                const activityDate =
                    parseLocalDate(
                        activity.date
                    );

                if (
                    activityDate >=
                        weekStart &&
                    activityDate <=
                        weekEnd
                ) {

                    const hoursOnDay =
                        getHoursForDay(
                            "internship",
                            activity.date
                        );

                    if (
                        hoursOnDay >
                        NORMAL_INTERNSHIP_HOURS_PER_DAY
                    ) {

                        existingLongDays.add(
                            activity.date
                        );
                    }
                }
            }
        );


    const newDayTotal =
        dayAlready +
        hours;


    if (
        newDayTotal >
            NORMAL_INTERNSHIP_HOURS_PER_DAY &&
        !existingLongDays.has(date) &&
        existingLongDays.size >= 1
    ) {

        alert(
            "Questa settimana hai già utilizzato la giornata estesa oltre le 6 ore."
        );

        return false;
    }


    if (
        newDayTotal >
            NORMAL_INTERNSHIP_HOURS_PER_DAY &&
        newDayTotal <=
            MAX_INTERNSHIP_HOURS_PER_DAY
    ) {

        /*
         * Consentito: è la singola
         * giornata estesa della settimana.
         */

        if (
            existingLongDays.size >= 1 &&
            !existingLongDays.has(date)
        ) {

            alert(
                "Può esserci una sola giornata oltre le 6 ore nella stessa settimana."
            );

            return false;
        }
    }


    if (
        hours >
        getRemainingInternshipHours()
    ) {

        alert(
            "Le ore inserite superano il tirocinio ancora da completare."
        );

        return false;
    }


    return true;
}


function handleSaveActivity() {

    const date =
        document.getElementById(
            "activityDate"
        ).value;

    const hours =
        Number(
            document.getElementById(
                "activityHours"
            ).value
        );


    if (!date) {

        alert(
            "Inserisci una data."
        );

        return;
    }


    if (
        !hours ||
        hours <= 0
    ) {

        alert(
            "Inserisci un numero di ore valido."
        );

        return;
    }


    if (
        hours % .5 !== 0
    ) {

        alert(
            "Le ore devono essere inserite a intervalli di 0,5."
        );

        return;
    }


    if (
        selectedActivityType ===
        "internship"
    ) {

        if (
            !validateInternshipEntry(
                date,
                hours
            )
        ) {
            return;
        }
    }


    const studyExam =
        document.getElementById(
            "studyExam"
        ).value;


    activities.push({

        id:
            Date.now(),

        type:
            selectedActivityType,

        date,

        hours,

        examId:
            selectedActivityType ===
            "study" &&
            studyExam
                ? studyExam
                : null
    });


    saveData();

    closeActivityModal();

    updateHome();

    renderActivities();

    renderCalendar();
}


/* =========================================================
   LIBRETTO
========================================================= */

function updateLibrettoStats() {

    const passed =
        exams.filter(
            exam =>
                exam.status ===
                "passed"
        );


    let totalCFU = 0;
    let weightedSum = 0;


    passed.forEach(
        exam => {

            const cfu =
                Number(
                    exam.cfu || 0
                );

            const grade =
                Number(
                    exam.grade || 0
                );


            if (
                cfu > 0 &&
                grade >= 18
            ) {

                totalCFU +=
                    cfu;

                weightedSum +=
                    grade *
                    cfu;
            }
        }
    );


    const average =
        totalCFU > 0
            ? (
                weightedSum /
                totalCFU
            ).toFixed(2)
            : "--";


    document.getElementById(
        "weightedAverage"
    ).textContent =
        average;


    document.getElementById(
        "totalCFU"
    ).textContent =
        totalCFU;
}


/* =========================================================
   RENDER ATTIVITÀ / ESAMI / EVENTI
========================================================= */

function renderActivities() {

    const list =
        document.getElementById(
            "activitiesList"
        );


    if (list) {

        if (
            activities.length === 0
        ) {

            list.innerHTML =
                `<div class="activity-card-info">
                    Nessuna attività registrata.
                </div>`;

        } else {

            const sorted =
                [...activities]
                    .sort(
                        (a, b) =>
                            b.date.localeCompare(
                                a.date
                            )
                    );


            list.innerHTML =
                sorted
                    .map(
                        activity => {

                            const type =
                                activity.type ===
                                "internship"
                                    ? "Tirocinio"
                                    : "Studio";


                            let extra = "";


                            if (
                                activity.type ===
                                    "study" &&
                                activity.examId
                            ) {

                                const exam =
                                    exams.find(
                                        item =>
                                            String(
                                                item.id
                                            ) ===
                                            String(
                                                activity.examId
                                            )
                                    );


                                if (exam) {

                                    extra =
                                        ` · ${escapeHtml(
                                            exam.title
                                        )}`;
                                }
                            }


                            return `
                                <div class="activity-card">

                                    <div class="activity-card-title">
                                        ${type}
                                    </div>

                                    <div class="activity-card-info">
                                        ${formatItalianDate(
                                            activity.date
                                        )}
                                        ·
                                        ${activity.hours} h
                                        ${extra}
                                    </div>

                                    <button
                                        class="delete-activity"
                                        data-id="${activity.id}"
                                        data-kind="activity"
                                    >
                                        Elimina
                                    </button>

                                </div>
                            `;
                        }
                    )
                    .join("");
        }
    }


    const examsList =
        document.getElementById(
            "examsList"
        );


    if (examsList) {

        if (
            exams.length === 0
        ) {

            examsList.innerHTML =
                `<div class="activity-card-info">
                    Nessun esame inserito.
                </div>`;

        } else {

            const sorted =
                [...exams]
                    .sort(
                        (a, b) =>
                            a.date.localeCompare(
                                b.date
                            )
                    );


            examsList.innerHTML =
                sorted
                    .map(
                        exam => {

                            const estimated =
                                Number(
                                    exam.studyHours ||
                                    0
                                );

                            const studied =
                                getStudyHoursForExam(
                                    exam.id
                                );

                            const remainingStudy =
                                Math.max(
                                    estimated -
                                    studied,
                                    0
                                );


                            const statusText =
                                exam.status ===
                                "passed"

                                    ? `Superato con ${exam.grade}`

                                    : `In programma · ${formatItalianDate(
                                        exam.date
                                    )}`;


                            const studyText =
                                exam.status ===
                                    "passed"
                                    ? ""
                                    : `
                                        <br>
                                        Studio:
                                        ${studied}/${estimated} h
                                        ·
                                        ${remainingStudy} h rimanenti
                                    `;


                            return `
                                <div class="activity-card">

                                    <div class="activity-card-title">
                                        ${escapeHtml(
                                            exam.title
                                        )}
                                        (${exam.cfu} CFU)
                                    </div>

                                    <div class="activity-card-info">
                                        ${statusText}
                                        ${studyText}
                                    </div>

                                    <button
                                        class="edit-activity"
                                        data-id="${exam.id}"
                                        data-kind="exam"
                                    >
                                        Modifica
                                    </button>

                                    <button
                                        class="delete-activity"
                                        data-id="${exam.id}"
                                        data-kind="exam"
                                    >
                                        Elimina
                                    </button>

                                </div>
                            `;
                        }
                    )
                    .join("");
        }
    }


    const eventsList =
        document.getElementById(
            "eventsList"
        );


    if (eventsList) {

        if (
            events.length === 0
        ) {

            eventsList.innerHTML =
                `<div class="activity-card-info">
                    Nessun rientro o vacanza inserita.
                </div>`;

        } else {

            const sorted =
                [...events]
                    .sort(
                        (a, b) =>
                            a.startDate.localeCompare(
                                b.startDate
                            )
                    );


            eventsList.innerHTML =
                sorted
                    .map(
                        event => `
                            <div class="activity-card">

                                <div class="activity-card-title">
                                    ${
                                        event.type ===
                                        "home"
                                            ? "Rientro a Casa"
                                            : "Vacanza"
                                    }
                                </div>

                                <div class="activity-card-info">
                                    Dal
                                    ${formatItalianDate(
                                        event.startDate
                                    )}
                                    al
                                    ${formatItalianDate(
                                        event.endDate
                                    )}
                                </div>

                                <button
                                    class="delete-activity"
                                    data-id="${event.id}"
                                    data-kind="event"
                                >
                                    Elimina
                                </button>

                            </div>
                        `
                    )
                    .join("");
        }
    }


    updateLibrettoStats();

    populateStudyExamSelect();

    bindDynamicButtons();
}


/* =========================================================
   SICUREZZA HTML
========================================================= */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   MODIFICA ESAME
========================================================= */

function openExamModal(
    exam = null
) {

    editingExamId =
        exam
            ? exam.id
            : null;


    document.getElementById(
        "examModalTitle"
    ).textContent =
        exam
            ? "Modifica Esame"
            : "Esame / Materia";


    document.getElementById(
        "examTitle"
    ).value =
        exam
            ? exam.title
            : "";


    document.getElementById(
        "examCFU"
    ).value =
        exam
            ? exam.cfu
            : "";


    document.getElementById(
        "examDate"
    ).value =
        exam
            ? exam.date
            : "";


    document.getElementById(
        "examStudyHours"
    ).value =
        exam
            ? Number(
                exam.studyHours || 0
            )
            : "";


    document.getElementById(
        "examStatus"
    ).value =
        exam
            ? exam.status
            : "planned";


    document.getElementById(
        "examGrade"
    ).value =
        exam &&
        exam.grade
            ? exam.grade
            : "";


    updateGradeVisibility();


    document.getElementById(
        "examModal"
    ).classList.remove(
        "hidden"
    );
}


function updateGradeVisibility() {

    const status =
        document.getElementById(
            "examStatus"
        ).value;


    document.getElementById(
        "gradeContainer"
    ).style.display =
        status ===
        "passed"
            ? "block"
            : "none";
}


function saveExam() {

    const title =
        document.getElementById(
            "examTitle"
        ).value.trim();


    const cfu =
        Number(
            document.getElementById(
                "examCFU"
            ).value
        );


    const date =
        document.getElementById(
            "examDate"
        ).value;


    const studyHours =
        Number(
            document.getElementById(
                "examStudyHours"
            ).value
        );


    const status =
        document.getElementById(
            "examStatus"
        ).value;


    const grade =
        Number(
            document.getElementById(
                "examGrade"
            ).value
        );


    if (
        !title ||
        !date ||
        !cfu ||
        cfu <= 0
    ) {

        alert(
            "Compila materia, CFU e data."
        );

        return;
    }


    if (
        studyHours < 0 ||
        Number.isNaN(
            studyHours
        )
    ) {

        alert(
            "Inserisci una stima di studio valida."
        );

        return;
    }


    if (
        status === "passed" &&
        (
            grade < 18 ||
            grade > 30
        )
    ) {

        alert(
            "Per un esame superato inserisci un voto tra 18 e 30."
        );

        return;
    }


    const data = {

        title,

        cfu,

        date,

        studyHours,

        status,

        grade:
            status === "passed"
                ? grade
                : null
    };


    if (
        editingExamId
    ) {

        const index =
            exams.findIndex(
                exam =>
                    String(
                        exam.id
                    ) ===
                    String(
                        editingExamId
                    )
            );


        if (
            index !== -1
        ) {

            exams[index] = {
                ...exams[index],
                ...data
            };
        }

    } else {

        exams.push({

            id:
                Date.now(),

            ...data
        });
    }


    saveData();

    document.getElementById(
        "examModal"
    ).classList.add(
        "hidden"
    );


    editingExamId =
        null;


    updateHome();

    renderActivities();

    renderCalendar();
}


/* =========================================================
   EVENTI
========================================================= */

function saveEvent() {

    const startDate =
        document.getElementById(
            "eventStartDate"
        ).value;


    const endDate =
        document.getElementById(
            "eventEndDate"
        ).value;


    if (
        !startDate ||
        !endDate
    ) {

        alert(
            "Inserisci data di inizio e fine."
        );

        return;
    }


    const start =
        parseLocalDate(
            startDate
        );

    const end =
        parseLocalDate(
            endDate
        );


    if (
        !start ||
        !end ||
        end < start
    ) {

        alert(
            "L'intervallo di date non è valido."
        );

        return;
    }


    events.push({

        id:
            Date.now(),

        type:
            selectedEventType,

        startDate,

        endDate
    });


    saveData();


    document.getElementById(
        "eventModal"
    ).classList.add(
        "hidden"
    );


    updateHome();

    renderActivities();

    renderCalendar();
}


/* =========================================================
   PULSANTI DINAMICI
========================================================= */

function bindDynamicButtons() {

    document
        .querySelectorAll(
            ".delete-activity"
        )
        .forEach(
            button => {

                button.onclick =
                    () => {

                        const id =
                            Number(
                                button.dataset.id
                            );

                        const kind =
                            button.dataset.kind;


                        if (
                            !confirm(
                                "Eliminare questa voce?"
                            )
                        ) {
                            return;
                        }


                        if (
                            kind ===
                            "activity"
                        ) {

                            activities =
                                activities.filter(
                                    activity =>
                                        activity.id !==
                                        id
                                );
                        }


                        if (
                            kind ===
                            "exam"
                        ) {

                            exams =
                                exams.filter(
                                    exam =>
                                        exam.id !==
                                        id
                                );


                            /*
                             * Se elimini un esame,
                             * lo studio associato
                             * torna studio generale.
                             */

                            activities.forEach(
                                activity => {

                                    if (
                                        String(
                                            activity.examId
                                        ) ===
                                        String(id)
                                    ) {

                                        activity.examId =
                                            null;
                                    }
                                }
                            );
                        }


                        if (
                            kind ===
                            "event"
                        ) {

                            events =
                                events.filter(
                                    event =>
                                        event.id !==
                                        id
                                );
                        }


                        saveData();

                        updateHome();

                        renderActivities();

                        renderCalendar();
                    };
            }
        );


    document
        .querySelectorAll(
            ".edit-activity"
        )
        .forEach(
            button => {

                button.onclick =
                    () => {

                        const id =
                            Number(
                                button.dataset.id
                            );


                        const exam =
                            exams.find(
                                item =>
                                    item.id ===
                                    id
                            );


                        if (exam) {

                            openExamModal(
                                exam
                            );
                        }
                    };
            }
        );
}


/* =========================================================
   IMPOSTAZIONI
========================================================= */

function loadSettingsIntoUI() {

    const dateInput =
        document.getElementById(
            "finalExamDate"
        );

    const bufferInput =
        document.getElementById(
            "finalExamBuffer"
        );


    if (dateInput) {

        dateInput.value =
            settings.finalExamDate;
    }


    if (bufferInput) {

        bufferInput.value =
            settings.finalExamBufferDays;
    }


    updateOtherPage();
}


function saveSettings() {

    const finalExamDate =
        document.getElementById(
            "finalExamDate"
        ).value;


    const buffer =
        Number(
            document.getElementById(
                "finalExamBuffer"
            ).value
        );


    if (!finalExamDate) {

        alert(
            "Inserisci la data dell'esame finale."
        );

        return;
    }


    if (
        Number.isNaN(buffer) ||
        buffer < 0 ||
        buffer > 90
    ) {

        alert(
            "Il margine deve essere compreso tra 0 e 90 giorni."
        );

        return;
    }


    const finalExam =
        parseLocalDate(
            finalExamDate
        );


    const today =
        getToday();


    if (
        finalExam &&
        finalExam <= today
    ) {

        alert(
            "La data dell'esame finale deve essere futura."
        );

        return;
    }


    settings.finalExamDate =
        finalExamDate;

    settings.finalExamBufferDays =
        buffer;


    saveData();

    updateHome();

    loadSettingsIntoUI();


    alert(
        "Impostazioni salvate."
    );
}


/* =========================================================
   INIZIALIZZAZIONE ELEMENTI
========================================================= */

function initElements() {

    els.remainingHours =
        document.getElementById(
            "remainingHours"
        );


    els.internshipProgress =
        document.getElementById(
            "internshipProgress"
        );

    els.internshipOutline =
        document.getElementById(
            "internshipOutline"
        );

    els.weeklyInternshipProgress =
        document.getElementById(
            "weeklyInternshipProgress"
        );

    els.weeklyInternshipOutline =
        document.getElementById(
            "weeklyInternshipOutline"
        );

    els.weeklyStudyProgress =
        document.getElementById(
            "weeklyStudyProgress"
        );

    els.weeklyStudyOutline =
        document.getElementById(
            "weeklyStudyOutline"
        );


    els.internshipDot =
        document.getElementById(
            "internshipDot"
        );

    els.weeklyInternshipDot =
        document.getElementById(
            "weeklyInternshipDot"
        );

    els.weeklyStudyDot =
        document.getElementById(
            "weeklyStudyDot"
        );


    els.activityModal =
        document.getElementById(
            "activityModal"
        );
}


/* =========================================================
   EVENTI PRINCIPALI
========================================================= */

function bindEvents() {

    /*
     * NAVIGAZIONE
     */

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        showPage(
                            button.dataset.page
                        );
                    }
                );
            }
        );


    /*
     * ATTIVITÀ
     */

    document
        .getElementById(
            "addActivityButton"
        )
        .addEventListener(
            "click",
            () => {

                openActivityModal();
            }
        );


    document
        .getElementById(
            "closeModal"
        )
        .addEventListener(
            "click",
            closeActivityModal
        );


    document
        .querySelectorAll(
            ".type-button"
        )
        .forEach(
            button => {

                if (
                    !button.dataset.type
                ) {
                    return;
                }


                button.addEventListener(
                    "click",
                    () => {

                        selectedActivityType =
                            button.dataset.type;

                        updateActivityTypeUI();
                    }
                );
            }
        );


    document
        .getElementById(
            "saveActivity"
        )
        .addEventListener(
            "click",
            handleSaveActivity
        );


    /*
     * CALENDARIO
     */

    document
        .getElementById(
            "prevMonthBtn"
        )
        .addEventListener(
            "click",
            () => {

                currentCalendarDate.setMonth(
                    currentCalendarDate.getMonth() - 1
                );

                renderCalendar();
            }
        );


    document
        .getElementById(
            "nextMonthBtn"
        )
        .addEventListener(
            "click",
            () => {

                currentCalendarDate.setMonth(
                    currentCalendarDate.getMonth() + 1
                );

                renderCalendar();
            }
        );


    /*
     * ESAMI
     */

    document
        .getElementById(
            "addExamButton"
        )
        .addEventListener(
            "click",
            () => {

                openExamModal();
            }
        );


    document
        .getElementById(
            "closeExamModal"
        )
        .addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "examModal"
                    )
                    .classList.add(
                        "hidden"
                    );

                editingExamId =
                    null;
            }
        );


    document
        .getElementById(
            "examStatus"
        )
        .addEventListener(
            "change",
            updateGradeVisibility
        );


    document
        .getElementById(
            "saveExam"
        )
        .addEventListener(
            "click",
            saveExam
        );


    /*
     * EVENTI
     */

    document
        .getElementById(
            "addEventButton"
        )
        .addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "eventModal"
                    )
                    .classList.remove(
                        "hidden"
                    );
            }
        );


    document
        .getElementById(
            "closeEventModal"
        )
        .addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "eventModal"
                    )
                    .classList.add(
                        "hidden"
                    );
            }
        );


    document
        .querySelectorAll(
            ".event-type-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedEventType =
                            button.dataset.eventtype;


                        document
                            .querySelectorAll(
                                ".event-type-btn"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "selected"
                                    )
                            );


                        button.classList.add(
                            "selected"
                        );
                    }
                );
            }
        );


    document
        .getElementById(
            "saveEvent"
        )
        .addEventListener(
            "click",
            saveEvent
        );


    /*
     * IMPOSTAZIONI
     */

    document
        .getElementById(
            "saveSettings"
        )
        .addEventListener(
            "click",
            saveSettings
        );
}


/* =========================================================
   AVVIO
========================================================= */

function init() {

    initElements();

    loadData();

    bindEvents();

    loadSettingsIntoUI();

    updateActivityTypeUI();

    updateHome();

    renderActivities();

    renderCalendar();
}


document.addEventListener(
    "DOMContentLoaded",
    init
);