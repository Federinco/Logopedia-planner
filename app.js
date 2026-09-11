document.addEventListener("DOMContentLoaded", () => {
    // Stato dell'applicazione con caricamento da localStorage
    let state = {
        activities: JSON.parse(localStorage.getItem("logopedia_activities")) || [],
        exams: JSON.parse(localStorage.getItem("logopedia_exams")) || [],
        events: JSON.parse(localStorage.getItem("logopedia_events")) || [],
        clinic: JSON.parse(localStorage.getItem("logopedia_clinic")) || [],
        settings: JSON.parse(localStorage.getItem("logopedia_settings")) || {
            finalExamDate: "",
            finalExamBuffer: 15
        }
    };

    // Navigazione tra le pagine
    const navButtons = document.querySelectorAll(".nav-button");
    const pages = document.querySelectorAll(".page");

    navButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetPage = button.getAttribute("data-page");
            
            navButtons.forEach(btn => btn.classList.remove("active"));
            pages.forEach(pg => pg.classList.remove("active"));

            button.classList.add("active");
            const targetEl = document.getElementById(targetPage);
            if (targetEl) targetEl.classList.add("active");
            
            if (targetPage === "calendarViewPage") {
                renderCalendar();
            }
        });
    });

    // ---------------------------------------------------------
    // 1. GESTIONE ANELLI HOME E SEGNALINI TONDI (CON ANCORAGGIO ALLA PUNTA)
    // ---------------------------------------------------------
    function updateRings() {
        let totalInternshipDone = 645; // Ore iniziali pregresse già svolte
        let weeklyInternshipDone = 0;
        let weeklyStudyDone = 0;

        // Calcolo settimana corrente (da Lunedì a Domenica)
        const now = new Date();
        const dayOfWeek = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);

        state.activities.forEach(act => {
            const actDate = new Date(act.date);
            if (act.type === 'internship') {
                totalInternshipDone += parseFloat(act.hours) || 0;
                if (actDate >= monday) {
                    weeklyInternshipDone += parseFloat(act.hours) || 0;
                }
            } else if (act.type === 'study') {
                if (actDate >= monday) {
                    weeklyStudyDone += parseFloat(act.hours) || 0;
                }
            }
        });

        const TOTAL_INTERNSHIP_GOAL = 1500; 
        const remaining = Math.max(0, TOTAL_INTERNSHIP_GOAL - totalInternshipDone);
        const remainingEl = document.getElementById("remainingHours");
        if (remainingEl) remainingEl.textContent = remaining;

        // Aggiornamento anelli e posizionamento dei pallini tramite coordinate reali del path SVG
        updateSvgRing("internshipProgress", "internshipDot", totalInternshipDone, TOTAL_INTERNSHIP_GOAL);
        updateSvgRing("weeklyInternshipProgress", "weeklyInternshipDot", weeklyInternshipDone, 35); 
        updateSvgRing("weeklyStudyProgress", "weeklyStudyDot", weeklyStudyDone, 25); 
    }

    function updateSvgRing(progressId, dotId, current, max) {
        const el = document.getElementById(progressId);
        const dot = document.getElementById(dotId);
        if (!el) return;

        const percent = Math.min(1, Math.max(0, current / max));
        const length = el.getTotalLength ? el.getTotalLength() : 1000;
        
        el.style.strokeDasharray = length;
        el.style.strokeDashoffset = length * (1 - percent);

        // Posizionamento nativo perfetto sulla punta dell'arco SVG
        if (dot && typeof el.getPointAtLength === 'function') {
            const point = el.getPointAtLength(length * percent);
            dot.setAttribute("cx", point.x);
            dot.setAttribute("cy", point.y);
        }
    }

    // ---------------------------------------------------------
    // 2. CALENDARIO GIORNO PER GIORNO
    // ---------------------------------------------------------
    let calendarDate = new Date();

    function renderCalendar() {
        const grid = document.getElementById("calendarGrid");
        const monthLabel = document.getElementById("calendarMonthLabel");
        if (!grid || !monthLabel) return;

        const daysContainer = grid;
        daysContainer.innerHTML = "";

        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        monthLabel.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunedì = 0
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevTotalDays = new Date(year, month, 0).getDate();

        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayDiv = document.createElement("div");
            dayDiv.className = "calendar-day muted";
            dayDiv.textContent = prevTotalDays - i;
            daysContainer.appendChild(dayDiv);
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= totalDays; d++) {
            const dayDiv = document.createElement("div");
            dayDiv.className = "calendar-day";
            
            const formattedMonth = (month + 1).toString().padStart(2, '0');
            const formattedDay = d.toString().padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            if (dateStr === todayStr) {
                dayDiv.classList.add("today");
            }

            const numberSpan = document.createElement("span");
            numberSpan.className = "day-number";
            numberSpan.textContent = d;
            dayDiv.appendChild(numberSpan);

            const hasActivity = state.activities.some(a => a.date === dateStr);
            const hasExam = state.exams.some(e => e.date === dateStr);
            const hasEvent = state.events.some(ev => dateStr >= ev.startDate && dateStr <= ev.endDate);

            if (hasActivity || hasExam || hasEvent) {
                const indicator = document.createElement("div");
                indicator.className = "day-indicator";
                dayDiv.appendChild(indicator);
            }

            dayDiv.addEventListener("click", () => {
                const actDateInput = document.getElementById("activityDate");
                if (actDateInput) actDateInput.value = dateStr;
                const modal = document.getElementById("activityModal");
                if (modal) {
                    modal.classList.remove("hidden");
                    modal.style.display = "block";
                }
            });

            daysContainer.appendChild(dayDiv);
        }
    }

    const prevMonthBtn = document.getElementById("prevMonthBtn");
    const nextMonthBtn = document.getElementById("nextMonthBtn");

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        });
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // ---------------------------------------------------------
    // 3. SIMULATORE LAUREA & BONUS TESI
    // ---------------------------------------------------------
    const rangeInput = document.getElementById("laureaBonusRange");
    const bonusValSpan = document.getElementById("laureaBonusVal");
    const baseValSpan = document.getElementById("laureaBaseVal");
    const finalValSpan = document.getElementById("laureaFinalVal");

    function calculateWeightedAverage() {
        let totalPoints = 0;
        let totalCFU = 0;

        state.exams.forEach(exam => {
            if (exam.status === "passed" && exam.grade) {
                totalPoints += parseFloat(exam.grade) * parseFloat(exam.cfu);
                totalCFU += parseFloat(exam.cfu);
            }
        });

        const avg = totalCFU > 0 ? (totalPoints / totalCFU) : 0;
        const base = avg > 0 ? (avg * 110) / 30 : 0;

        const avgEl = document.getElementById("weightedAverage");
        const cfuEl = document.getElementById("totalCFU");
        if (avgEl) avgEl.textContent = avg > 0 ? avg.toFixed(2) : "--";
        if (cfuEl) cfuEl.textContent = totalCFU;

        if (baseValSpan) baseValSpan.textContent = base.toFixed(2);
        
        const bonus = rangeInput ? parseInt(rangeInput.value) || 0 : 0;
        if (bonusValSpan) bonusValSpan.textContent = bonus;

        const final = base > 0 ? Math.min(110, base + bonus) : 0;
        if (finalValSpan) finalValSpan.textContent = final.toFixed(2);
    }

    if (rangeInput) {
        rangeInput.addEventListener("input", () => {
            if (bonusValSpan) bonusValSpan.textContent = rangeInput.value;
            calculateWeightedAverage();
        });
    }

    // ---------------------------------------------------------
    // 4. TIMER POMODORO CON AUDIO NATIVO
    // ---------------------------------------------------------
    let timerInterval = null;
    let timeLeft = 25 * 60;
    let isRunning = false;

    const timerDisplay = document.getElementById("timerDisplay");
    const timerMinutesInput = document.getElementById("timerMinutesInput");
    const timerStartBtn = document.getElementById("timerStartBtn");
    const timerStopBtn = document.getElementById("timerStopBtn");

    function updateTimerDisplay() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    function playAlarmSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 587.33;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 800);
        } catch (e) {
            console.log("Audio non supportato");
        }
    }

    if (timerMinutesInput) {
        timerMinutesInput.addEventListener("change", () => {
            if (!isRunning) {
                const val = parseInt(timerMinutesInput.value) || 25;
                timeLeft = val * 60;
                updateTimerDisplay();
            }
        });
    }

    if (timerStartBtn) {
        timerStartBtn.addEventListener("click", () => {
            if (!isRunning) {
                if (timerMinutesInput && !timerInterval) {
                    timeLeft = (parseInt(timerMinutesInput.value) || 25) * 60;
                }
                isRunning = true;
                timerStartBtn.textContent = "Pausa";
                if (timerStopBtn) timerStopBtn.disabled = false;

                timerInterval = setInterval(() => {
                    if (timeLeft > 0) {
                        timeLeft--;
                        updateTimerDisplay();
                    } else {
                        clearInterval(timerInterval);
                        isRunning = false;
                        timerStartBtn.textContent = "Avvia";
                        playAlarmSound();
                        alert("Tempo scaduto! Sessione completata.");
                    }
                }, 1000);
            } else {
                clearInterval(timerInterval);
                isRunning = false;
                timerStartBtn.textContent = "Riprendi";
            }
        });
    }

    if (timerStopBtn) {
        timerStopBtn.addEventListener("click", () => {
            clearInterval(timerInterval);
            isRunning = false;
            if (timerStartBtn) timerStartBtn.textContent = "Avvia";
            if (timerMinutesInput) {
                timeLeft = (parseInt(timerMinutesInput.value) || 25) * 60;
            }
            updateTimerDisplay();
            timerStopBtn.disabled = true;
        });
    }

    // ---------------------------------------------------------
    // 5. GESTIONE MODALI E SALVATAGGIO COMPLETO DATI (BLINDATO)
    // ---------------------------------------------------------
    function setupModal(openBtnId, modalId, closeBtnId) {
        const openBtn = document.getElementById(openBtnId);
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeBtnId);

        if (openBtn && modal) {
            openBtn.addEventListener("click", () => {
                modal.classList.remove("hidden");
                modal.style.display = "block";
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener("click", () => {
                modal.classList.add("hidden");
                modal.style.display = "none";
            });
        }
    }

    // Inizializzazione modali principali
    setupModal("addActivityButton", "activityModal", "closeModal");
    setupModal("addExamButton", "examModal", "closeExamModal");
    setupModal("addEventButton", "eventModal", "closeEventModal");
    setupModal("addClinicButton", "clinicModal", "closeClinicModal");

    // Selezione pulsanti tipo attività nel modale (supporta sia .selected che .active)
    document.querySelectorAll(".activity-type .type-button").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".activity-type .type-button").forEach(b => {
                b.classList.remove("selected");
                b.classList.remove("active");
            });
            e.target.classList.add("selected");
            e.target.classList.add("active");
        });
    });

    // Salvataggio Attività (Studio / Tirocinio) - Rende sicuro il recupero degli ID
    const saveActivityBtn = document.getElementById("saveActivity") || document.getElementById("saveActivityButton");
    if (saveActivityBtn) {
        saveActivityBtn.addEventListener("click", () => {
            const dateInput = document.getElementById("activityDate");
            const hoursInput = document.getElementById("activityHours");
            
            const date = dateInput ? dateInput.value : "";
            const hours = hoursInput ? hoursInput.value : "";
            
            let activeTypeBtn = document.querySelector(".activity-type .type-button.selected") || 
                                document.querySelector(".activity-type .type-button.active") ||
                                document.querySelector(".activity-type .type-button");
            
            const type = activeTypeBtn ? (activeTypeBtn.getAttribute("data-type") || "internship") : "internship";

            if (!date || !hours) {
                alert("Per favore, inserisci sia la data che il numero di ore.");
                return;
            }

            state.activities.push({ 
                id: Date.now(), 
                type: type, 
                date: date, 
                hours: parseFloat(hours) 
            });

            localStorage.setItem("logopedia_activities", JSON.stringify(state.activities));
            
            const modal = document.getElementById("activityModal");
            if (modal) {
                modal.classList.add("hidden");
                modal.style.display = "none"; 
            }

            if (dateInput) dateInput.value = "";
            if (hoursInput) hoursInput.value = "";

            updateRings();
            renderCalendar();
            
            alert("Attività salvata con successo!");
        });
    }

    // Salvataggio Esame
    const saveExamBtn = document.getElementById("saveExam") || document.getElementById("saveExamButton");
    if (saveExamBtn) {
        saveExamBtn.addEventListener("click", () => {
            const name = document.getElementById("examName")?.value;
            const cfu = document.getElementById("examCfu")?.value;
            const date = document.getElementById("examDate")?.value;
            const grade = document.getElementById("examGrade")?.value;
            const status = document.getElementById("examStatus")?.value || "pending";

            if (!name || !cfu) {
                alert("Inserisci almeno il nome dell'esame e i CFU.");
                return;
            }

            state.exams.push({
                id: Date.now(),
                name,
                cfu: parseFloat(cfu) || 0,
                date: date || "",
                grade: grade ? parseFloat(grade) : null,
                status
            });

            localStorage.setItem("logopedia_exams", JSON.stringify(state.exams));
            const examModal = document.getElementById("examModal");
            if (examModal) {
                examModal.classList.add("hidden");
                examModal.style.display = "none";
            }

            calculateWeightedAverage();
            renderCalendar();
            alert("Esame salvato con successo!");
        });
    }

    // Salvataggio Evento
    const saveEventBtn = document.getElementById("saveEvent") || document.getElementById("saveEventButton");
    if (saveEventBtn) {
        saveEventBtn.addEventListener("click", () => {
            const title = document.getElementById("eventTitle")?.value;
            const startDate = document.getElementById("eventStartDate")?.value;
            const endDate = document.getElementById("eventEndDate")?.value || startDate;

            if (!title || !startDate) {
                alert("Inserisci titolo e data di inizio evento.");
                return;
            }

            state.events.push({
                id: Date.now(),
                title,
                startDate,
                endDate
            });

            localStorage.setItem("logopedia_events", JSON.stringify(state.events));
            const eventModal = document.getElementById("eventModal");
            if (eventModal) {
                eventModal.classList.add("hidden");
                eventModal.style.display = "none";
            }

            renderCalendar();
            alert("Evento salvato con successo!");
        });
    }

    // Salvataggio Tirocinio Clinico (Clinic)
    const saveClinicBtn = document.getElementById("saveClinic") || document.getElementById("saveClinicButton");
    if (saveClinicBtn) {
        saveClinicBtn.addEventListener("click", () => {
            const description = document.getElementById("clinicDescription")?.value;
            const hours = document.getElementById("clinicHours")?.value;
            const date = document.getElementById("clinicDate")?.value;

            if (!hours || !date) {
                alert("Inserisci ore e data del tirocinio clinico.");
                return;
            }

            state.clinic.push({
                id: Date.now(),
                description: description || "Clinica",
                hours: parseFloat(hours) || 0,
                date
            });

            localStorage.setItem("logopedia_clinic", JSON.stringify(state.clinic));
            const clinicModal = document.getElementById("clinicModal");
            if (clinicModal) {
                clinicModal.classList.add("hidden");
                clinicModal.style.display = "none";
            }

            alert("Tirocinio clinico salvato con successo!");
        });
    }

    // Avvio calcoli e rendering iniziale
    calculateWeightedAverage();
    updateRings();
    renderCalendar();
});git add .
git commit -m "Fix definitivo salvataggio attivita e modali in app.js"
git push origin main