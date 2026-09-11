document.addEventListener("DOMContentLoaded", () => {
    let state = {
        activities: JSON.parse(localStorage.getItem("logopedia_activities")) || [],
        exams: JSON.parse(localStorage.getItem("logopedia_exams")) || [],
        events: JSON.parse(localStorage.getItem("logopedia_events")) || [],
        settings: JSON.parse(localStorage.getItem("logopedia_settings")) || {
            finalExamDate: "",
            finalExamBuffer: 15
        }
    };

    // ---------------------------------------------------------
    // NAVIGAZIONE PAGINE
    // ---------------------------------------------------------
    const navButtons = document.querySelectorAll(".nav-button");
    const pages = document.querySelectorAll(".page");

    navButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetPage = button.getAttribute("data-page");
            if (!targetPage) return;
            
            navButtons.forEach(btn => btn.classList.remove("active"));
            pages.forEach(pg => pg.classList.remove("active"));

            button.classList.add("active");
            const targetEl = document.getElementById(targetPage);
            if (targetEl) targetEl.classList.add("active");
            
            if (targetPage === "calendarViewPage") {
                renderCalendar();
            } else if (targetPage === "historyPage") {
                renderHistory();
            }
        });
    });

    // ---------------------------------------------------------
    // GESTIONE MODALI UNIVERSALE
    // ---------------------------------------------------------
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove("hidden");
            modal.style.display = "flex";
            modal.style.visibility = "visible";
            modal.style.opacity = "1";
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.style.display = "none";
        }
    }

    const triggerMap = [
        { openBtn: "addActivityButton", modal: "activityModal", closeBtn: "closeModal", isActivity: true },
        { openBtn: "addExamButton", modal: "examModal", closeBtn: "closeExamModal", isActivity: false },
        { openBtn: "addEventButton", modal: "eventModal", closeBtn: "closeEventModal", isActivity: false },
        { openBtn: "addClinicButton", modal: "clinicModal", closeBtn: "closeClinicModal", isActivity: false }
    ];

    triggerMap.forEach(item => {
        const openBtn = document.getElementById(item.openBtn);
        const closeBtn = document.getElementById(item.closeBtn);

        if (openBtn) {
            openBtn.addEventListener("click", () => {
                openModal(item.modal);
                if (item.isActivity) {
                    updateExamSelects();
                    populateStudyTitlesList();
                    checkActivityTypeVisibility();
                }
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                closeModal(item.modal);
            });
        }
    });

    const closeDayDetailBtn = document.getElementById("closeDayDetailModal");
    if (closeDayDetailBtn) {
        closeDayDetailBtn.addEventListener("click", () => {
            closeModal("dayDetailModal");
        });
    }

    // ---------------------------------------------------------
    // ANELLI HOME
    // ---------------------------------------------------------
    function updateRings() {
        let totalInternshipDone = 645; 
        let weeklyInternshipDone = 0;
        let weeklyStudyDone = 0;

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

        updateSvgRing("internshipProgress", "internshipDot", totalInternshipDone, TOTAL_INTERNSHIP_GOAL, 160);
        updateSvgRing("weeklyInternshipProgress", "weeklyInternshipDot", weeklyInternshipDone, 35, 130); 
        updateSvgRing("weeklyStudyProgress", "weeklyStudyDot", weeklyStudyDone, 25, 100); 
    }

    function updateSvgRing(progressId, dotId, current, max, radius = 160) {
        const el = document.getElementById(progressId);
        const dot = document.getElementById(dotId);
        if (!el) return;

        const percent = Math.min(1, Math.max(0, current / max));
        const length = (typeof el.getTotalLength === 'function') ? el.getTotalLength() : 1000;
        
        el.style.strokeDasharray = length;
        el.style.strokeDashoffset = length * (1 - percent);

        if (dot) {
            try {
                if (typeof el.getPointAtLength === 'function' && length > 0) {
                    const point = el.getPointAtLength(length * percent);
                    dot.setAttribute("cx", point.x);
                    dot.setAttribute("cy", point.y);
                } else {
                    throw new Error("Fallback");
                }
            } catch (e) {
                const angle = (percent * 360 - 90) * (Math.PI / 180);
                const cx = 200 + radius * Math.cos(angle);
                const cy = 200 + radius * Math.sin(angle);
                dot.setAttribute("cx", cx);
                dot.setAttribute("cy", cy);
            }
        }
    }

    // ---------------------------------------------------------
    // STORICO E GRAFICI (SCHEDA ALTRO)
    // ---------------------------------------------------------
    let historyWeekOffset = 0;

    function renderHistory() {
        const weekLabel = document.getElementById("weekLabel");
        const indicatorSelect = document.getElementById("indicatorSelect");
        const ring = document.getElementById("historyProgressRing");
        const valSpan = document.getElementById("historyRingValue");
        const maxSpan = document.getElementById("historyRingMax");
        const chartTitle = document.getElementById("chartTitle");
        const descEl = document.getElementById("historyDescription");

        if (!ring || !indicatorSelect) return;

        const now = new Date();
        const dayOfWeek = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + 1 + (historyWeekOffset * 7));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const formatDateStr = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        if (weekLabel) {
            weekLabel.textContent = historyWeekOffset === 0 ? "Questa settimana" : `${formatDateStr(monday)} - ${formatDateStr(sunday)}`;
        }

        let totalInternshipDone = 645;
        let weeklyInternshipDone = 0;
        let weeklyStudyDone = 0;

        state.activities.forEach(act => {
            const actDate = new Date(act.date);
            if (act.type === 'internship') {
                totalInternshipDone += parseFloat(act.hours) || 0;
                if (actDate >= monday && actDate <= sunday) {
                    weeklyInternshipDone += parseFloat(act.hours) || 0;
                }
            } else if (act.type === 'study') {
                if (actDate >= monday && actDate <= sunday) {
                    weeklyStudyDone += parseFloat(act.hours) || 0;
                }
            }
        });

        const selectedIndicator = indicatorSelect.value;
        const length = 1005;
        let current = 0;
        let max = 1500;
        let color = "#ff9f0a";

        if (selectedIndicator === "internshipTotal") {
            current = totalInternshipDone;
            max = 1500;
            color = "#ff9f0a";
            if (chartTitle) chartTitle.textContent = "Tirocinio Totale (Progresso Globale)";
            if (maxSpan) maxSpan.textContent = "/ 1500 ore";
            if (descEl) descEl.textContent = "Ore accumulate complessivamente nel percorso di tirocinio.";
        } else if (selectedIndicator === "weeklyInternship") {
            current = weeklyInternshipDone;
            max = 35;
            color = "#ff9f0a";
            if (chartTitle) chartTitle.textContent = "Tirocinio Settimanale";
            if (maxSpan) maxSpan.textContent = "/ 35 ore";
            if (descEl) descEl.textContent = "Ore di tirocinio svolte nella settimana selezionata.";
        } else if (selectedIndicator === "weeklyStudy") {
            current = weeklyStudyDone;
            max = 25;
            color = "#32d74b";
            if (chartTitle) chartTitle.textContent = "Studio Settimanale";
            if (maxSpan) maxSpan.textContent = "/ 25 ore";
            if (descEl) descEl.textContent = "Ore dedicate allo studio nella settimana selezionata.";
        }

        if (valSpan) valSpan.textContent = current;
        ring.style.stroke = color;

        const percent = Math.min(1, Math.max(0, current / max));
        ring.style.strokeDashoffset = length * (1 - percent);
    }

    const prevWeekBtn = document.getElementById("prevWeekBtn");
    const nextWeekBtn = document.getElementById("nextWeekBtn");
    const indicatorSelect = document.getElementById("indicatorSelect");

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener("click", () => {
            historyWeekOffset--;
            renderHistory();
        });
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener("click", () => {
            historyWeekOffset++;
            renderHistory();
        });
    }
    if (indicatorSelect) {
        indicatorSelect.addEventListener("change", () => {
            renderHistory();
        });
    }

    // ---------------------------------------------------------
    // CALENDARIO E GESTIONE INTERATTIVA GIORNI
    // ---------------------------------------------------------
    let calendarDate = new Date();
    let selectedCalendarDate = "";

    function renderCalendar() {
        const grid = document.getElementById("calendarGrid");
        const monthLabel = document.getElementById("calendarMonthLabel");
        if (!grid || !monthLabel) return;

        grid.innerHTML = "";

        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        monthLabel.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; 
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevTotalDays = new Date(year, month, 0).getDate();

        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayDiv = document.createElement("div");
            dayDiv.className = "calendar-day muted";
            dayDiv.textContent = prevTotalDays - i;
            dayDiv.style.opacity = "0.4";
            grid.appendChild(dayDiv);
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= totalDays; d++) {
            const dayDiv = document.createElement("div");
            dayDiv.className = "calendar-day";
            dayDiv.style.cssText = "cursor: pointer; position: relative; min-height: 60px; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.03);";
            
            const formattedMonth = (month + 1).toString().padStart(2, '0');
            const formattedDay = d.toString().padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            if (dateStr === todayStr) {
                dayDiv.style.border = "1px solid #0a84ff";
            }

            const numberSpan = document.createElement("span");
            numberSpan.className = "day-number";
            numberSpan.textContent = d;
            numberSpan.style.pointerEvents = "none";
            dayDiv.appendChild(numberSpan);

            const dayActivities = state.activities.filter(a => String(a.date).trim() === String(dateStr).trim());
            const hasExam = state.exams.some(e => String(e.date).trim() === String(dateStr).trim());
            const hasEvent = state.events.some(ev => dateStr >= ev.startDate && dateStr <= ev.endDate);

            if (dayActivities.length > 0 || hasExam || hasEvent) {
                const indicatorsContainer = document.createElement("div");
                indicatorsContainer.style.cssText = "display: flex; gap: 3px; margin-top: 4px; pointer-events: none;";

                if (dayActivities.some(a => a.type === 'internship')) {
                    const intDot = document.createElement("div");
                    intDot.style.cssText = "width: 5px; height: 5px; background-color: #ff9f0a; border-radius: 50%;";
                    indicatorsContainer.appendChild(intDot);
                }

                if (dayActivities.some(a => a.type === 'study')) {
                    const studyDot = document.createElement("div");
                    studyDot.style.cssText = "width: 5px; height: 5px; background-color: #32d74b; border-radius: 50%;";
                    indicatorsContainer.appendChild(studyDot);
                }

                if (hasExam || hasEvent) {
                    const examDot = document.createElement("div");
                    examDot.style.cssText = "width: 5px; height: 5px; background-color: #0a84ff; border-radius: 50%;";
                    indicatorsContainer.appendChild(examDot);
                }

                dayDiv.appendChild(indicatorsContainer);
            }

            dayDiv.addEventListener("click", (e) => {
                e.stopPropagation();
                selectedCalendarDate = dateStr;
                openDayDetailModal(dateStr);
            });

            grid.appendChild(dayDiv);
        }
    }

    function openDayDetailModal(dateStr) {
        selectedCalendarDate = dateStr;
        const titleEl = document.getElementById("dayDetailTitle");
        const contentEl = document.getElementById("dayDetailContent");
        if (!contentEl) return;

        if (titleEl) titleEl.textContent = `Attività del ${dateStr}`;
        
        const acts = state.activities.filter(a => String(a.date).trim() === String(dateStr).trim());
        const exms = state.exams.filter(e => String(e.date).trim() === String(dateStr).trim());
        const evts = state.events.filter(ev => dateStr >= ev.startDate && dateStr <= ev.endDate);

        let html = "";
        
        if (acts.length > 0) {
            html += `<div style="margin-bottom:6px; font-weight:600;">📌 Attività:</div>`;
            acts.forEach(a => {
                const typeLabel = a.type === 'internship' ? 'Tirocinio' : 'Studio';
                const titleText = a.title ? ` - <em>${a.title}</em>` : '';
                const examText = a.exam ? ` (${a.exam})` : '';
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
                    <div><strong>${typeLabel}</strong>${titleText}: ${a.hours} ore${examText}</div>
                    <button class="delete-btn" data-type="activity" data-id="${a.id}" style="background:#ff453a; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">Elimina</button>
                </div>`;
            });
        }

        if (exms.length > 0) {
            html += `<div style="margin:10px 0 6px 0; font-weight:600;">🎓 Esami:</div>`;
            exms.forEach(e => {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
                    <div>${e.name} (${e.cfu} CFU)</div>
                    <button class="delete-btn" data-type="exam" data-id="${e.id}" style="background:#ff453a; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">Elimina</button>
                </div>`;
            });
        }

        if (evts.length > 0) {
            html += `<div style="margin:10px 0 6px 0; font-weight:600;">✈️ Eventi:</div>`;
            evts.forEach(ev => {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
                    <div>${ev.title}</div>
                    <button class="delete-btn" data-type="event" data-id="${ev.id}" style="background:#ff453a; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">Elimina</button>
                </div>`;
            });
        }

        if (html === "") {
            html = `<p style="text-align:center; color:#8e8e93; padding: 10px 0;">Nessun elemento registrato in questa data.</p>`;
        }

        contentEl.innerHTML = html;
        openModal("dayDetailModal");

        contentEl.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const type = e.target.getAttribute("data-type");
                const id = Number(e.target.getAttribute("data-id"));
                deleteItem(type, id);
            });
        });
    }

    function deleteItem(type, id) {
        const confirmModal = document.getElementById("confirmModal");
        const confirmOkBtn = document.getElementById("confirmOkBtn");
        const confirmCancelBtn = document.getElementById("confirmCancelBtn");
        
        if (!confirmModal) {
            if (!window.confirm("Sei sicuro di voler eliminare questo elemento?")) return;
            executeDelete(type, id);
            return;
        }

        confirmModal.classList.remove("hidden");
        confirmModal.style.display = "flex";

        const newOkBtn = confirmOkBtn.cloneNode(true);
        const newCancelBtn = confirmCancelBtn.cloneNode(true);
        confirmOkBtn.parentNode.replaceChild(newOkBtn, confirmOkBtn);
        confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);

        newOkBtn.addEventListener("click", () => {
            confirmModal.style.display = "none";
            confirmModal.classList.add("hidden");
            executeDelete(type, id);
        });

        newCancelBtn.addEventListener("click", () => {
            confirmModal.style.display = "none";
            confirmModal.classList.add("hidden");
        });
    }

    function executeDelete(type, id) {
        if (type === 'activity') {
            state.activities = state.activities.filter(a => a.id !== id);
            localStorage.setItem("logopedia_activities", JSON.stringify(state.activities));
            updateRings();
        } else if (type === 'exam') {
            state.exams = state.exams.filter(e => e.id !== id);
            localStorage.setItem("logopedia_exams", JSON.stringify(state.exams));
            calculateWeightedAverage();
        } else if (type === 'event') {
            state.events = state.events.filter(ev => ev.id !== id);
            localStorage.setItem("logopedia_events", JSON.stringify(state.events));
        }

        renderCalendar();
        if (selectedCalendarDate) {
            openDayDetailModal(selectedCalendarDate);
        }
    }

    const addActivityFromDetailBtn = document.getElementById("addActivityFromDetail");
    if (addActivityFromDetailBtn) {
        addActivityFromDetailBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeModal("dayDetailModal");
            const actDateInput = document.getElementById("activityDate");
            if (actDateInput) actDateInput.value = selectedCalendarDate;
            updateExamSelects();
            populateStudyTitlesList();
            openModal("activityModal");
            checkActivityTypeVisibility();
        });
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

    function populateStudyTitlesList() {
        const datalist = document.getElementById("savedStudyTitles");
        if (!datalist) return;
        datalist.innerHTML = "";
        
        const uniqueTitles = [...new Set(state.activities.filter(a => a.type === 'study' && a.title).map(a => a.title))];
        uniqueTitles.forEach(title => {
            const opt = document.createElement("option");
            opt.value = title;
            datalist.appendChild(opt);
        });
    }

    function updateExamSelects() {
        const studyExamInput = document.getElementById("studyExam");
        if (!studyExamInput) return;
        
        let datalist = document.getElementById("savedStudyExams");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "savedStudyExams";
            document.body.appendChild(datalist);
            studyExamInput.setAttribute("list", "savedStudyExams");
        }
        
        datalist.innerHTML = "";
        
        const officialExams = state.exams.map(e => e.name);
        const customExams = state.activities.filter(a => a.type === 'study' && a.exam).map(a => a.exam);
        const uniqueExams = [...new Set([...officialExams, ...customExams])];

        uniqueExams.forEach(examName => {
            const opt = document.createElement("option");
            opt.value = examName;
            datalist.appendChild(opt);
        });
    }

    const typeButtons = document.querySelectorAll(".activity-type .type-button");
    const studyExamContainer = document.getElementById("studyExamContainer");
    const studyTitleContainer = document.getElementById("studyTitleContainer");

    function checkActivityTypeVisibility() {
        const activeBtn = document.querySelector(".activity-type .type-button.selected");
        const type = activeBtn ? activeBtn.getAttribute("data-type") : "internship";

        const targets = [
            studyExamContainer, 
            studyTitleContainer,
            document.getElementById("studyExam")?.closest('.form-group'),
            document.getElementById("activityTitleInput")?.closest('.form-group')
        ];

        targets.forEach(el => {
            if (el) {
                el.style.display = (type === "study") ? "block" : "none";
            }
        });
    }

    typeButtons.forEach(btn => {
        if (!btn.getAttribute("data-type")) {
            btn.setAttribute("data-type", btn.textContent.toLowerCase().includes("studio") ? "study" : "internship");
        }

        btn.addEventListener("click", (e) => {
            typeButtons.forEach(b => {
                b.classList.remove("selected");
                b.style.background = "";
                b.style.color = "";
            });

            const currentBtn = e.currentTarget;
            currentBtn.classList.add("selected");
            
            typeButtons.forEach(b => {
                if (b.classList.contains("selected")) {
                    b.style.background = "#3a3a3c";
                    b.style.color = "#ffffff";
                } else {
                    b.style.background = "#1c1c1e";
                    b.style.color = "#8e8e93";
                }
            });

            checkActivityTypeVisibility();
        });
    });

    if (typeButtons.length > 0) {
        typeButtons[0].classList.add("selected");
        typeButtons[0].style.background = "#3a3a3c";
        typeButtons[0].style.color = "#ffffff";
        if (typeButtons[1]) {
            typeButtons[1].style.background = "#1c1c1e";
            typeButtons[1].style.color = "#8e8e93";
        }
    }

    setTimeout(checkActivityTypeVisibility, 50);

    const saveActivityBtn = document.getElementById("saveActivity");
    if (saveActivityBtn) {
        saveActivityBtn.addEventListener("click", () => {
            const dateInput = document.getElementById("activityDate");
            const hoursInput = document.getElementById("activityHours");
            const titleInput = document.getElementById("activityTitleInput");
            
            const activeTypeBtn = document.querySelector(".activity-type .type-button.selected");
            const type = activeTypeBtn ? activeTypeBtn.getAttribute("data-type") : "internship";
            const associatedExam = document.getElementById("studyExam")?.value.trim() || "";

            const date = dateInput ? dateInput.value : "";
            const hours = hoursInput ? hoursInput.value : "";
            const title = titleInput ? titleInput.value.trim() : "";

            if (!date || !hours) {
                alert("Inserisci data e ore valide.");
                return;
            }

            state.activities.push({ 
                id: Date.now(), 
                type, 
                date, 
                hours: parseFloat(hours),
                title: type === 'study' ? title : '',
                exam: type === 'study' ? associatedExam : ''
            });

            localStorage.setItem("logopedia_activities", JSON.stringify(state.activities));
            closeModal("activityModal");

            if (dateInput) dateInput.value = "";
            if (hoursInput) hoursInput.value = "";
            if (titleInput) titleInput.value = "";
            const examInputEl = document.getElementById("studyExam");
            if (examInputEl) examInputEl.value = "";

            updateRings();
            renderCalendar();
        });
    }

    const saveExamBtn = document.getElementById("saveExam");
    if (saveExamBtn) {
        saveExamBtn.addEventListener("click", () => {
            const name = document.getElementById("examTitle")?.value;
            const cfu = document.getElementById("examCFU")?.value;
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
            closeModal("examModal");

            calculateWeightedAverage();
            renderCalendar();
        });
    }

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

    calculateWeightedAverage();
    updateRings();
    renderCalendar();
});