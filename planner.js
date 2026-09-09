/* =========================================================
   PLANNER ENGINE — Algoritmo Flessibile & Memoria Utente
========================================================= */

const DEADLINE_DATE = new Date(2027, 8, 15); // Target: 15 Settembre 2027 (Buffer di sicurezza)

/**
 * Calcola lo stato del piano basandosi sugli eventi inseriti e sulla memoria storica
 */
function calculateAdaptivePlan(activities, events, exams) {
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Calcola Giorni e Settimane rimanenti
    const diffTime = DEADLINE_DATE - today;
    const remainingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const remainingWeeks = remainingDays / 7;

    // 2. Ore Tirocinio Totali e Mancanti
    const completedInternship = getCompletedInternshipHours();
    const remainingInternshipHours = Math.max(0, TOTAL_INTERNSHIP_HOURS - completedInternship);

    // Calcolo giorni bloccati da rientri a casa o vacanze
    let unavailableInternshipDays = 0;
    events.forEach(e => {
        if (e.type === "home" || e.type === "vacation") {
            const start = new Date(e.startDate);
            const end = new Date(e.endDate);
            if (end >= today) {
                const days = Math.ceil((end - (start > today ? start : today)) / (1000 * 60 * 60 * 24)) + 1;
                unavailableInternshipDays += days;
            }
        }
    });

    const availableDaysForInternship = Math.max(1, remainingDays - unavailableInternshipDays);
    const requiredWeeklyInternshipHours = (remainingInternshipHours / (availableDaysForInternship / 7));

    // 3. Stima Ore Studio Necessarie (con Memoria delle Abitudini)
    const totalExamCFU = exams.reduce((sum, e) => sum + (Number(e.cfu) || 6), 0);
    const baseStudyHoursPerCFU = 18; // Media di riferimento per logopedia
    
    // Calcola il Fattore di Rendimento dell'Utente (Memoria Storica)
    const userEfficiencyFactor = computeUserStudyEfficiency(activities);

    const totalEstimatedStudyHours = totalExamCFU * baseStudyHoursPerCFU * userEfficiencyFactor;
    const completedStudyHours = activities
        .filter(a => a.type === "study")
        .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);

    const remainingStudyHours = Math.max(0, totalEstimatedStudyHours - completedStudyHours);
    const requiredWeeklyStudyHours = remainingStudyHours / remainingWeeks;

    return {
        remainingDays,
        remainingWeeks,
        remainingInternshipHours,
        requiredWeeklyInternshipHours: Math.min(40, Math.round(requiredWeeklyInternshipHours)),
        remainingStudyHours: Math.round(remainingStudyHours),
        requiredWeeklyStudyHours: Math.round(requiredWeeklyStudyHours),
        userEfficiencyFactor: userEfficiencyFactor.toFixed(2)
    };
}

/**
 * Memoria Adattiva: confronta il pianificato con il reale.
 * Se l'utente studia più/meno del previsto, adatta la stima futura.
 */
function computeUserStudyEfficiency(activities) {
    const studySessions = activities.filter(a => a.type === "study");
    if (studySessions.length < 5) return 1.0; // Valore predefinito se ci sono pochi dati

    const avgHoursPerSession = studySessions.reduce((s, a) => s + Number(a.hours), 0) / studySessions.length;
    
    // Se la media delle sessioni è elevata, ottimizza e riduce il tempo stimato necessario
    if (avgHoursPerSession > 4) return 0.9;
    if (avgHoursPerSession < 2) return 1.15;
    return 1.0;
}