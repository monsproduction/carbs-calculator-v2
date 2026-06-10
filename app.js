(function () {
  'use strict';

  /* ============================================
     DOM
     ============================================ */
  var form          = document.getElementById('calcForm');
  var resultsEl     = document.getElementById('results');
  var heroEl        = document.getElementById('results-hero');
  var noteEl        = document.getElementById('result-note');
  var warnEl        = document.getElementById('absorption-warning');
  var warnTextEl    = document.getElementById('warning-text');
  var durationPrev  = document.getElementById('duration-preview');
  var durationText  = document.getElementById('duration-text');
  var resetBtn      = document.getElementById('resetBtn');

  /* ============================================
     Reset / Clear Saved Data
     ============================================ */
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (confirm('Möchtest du wirklich alle eingegebenen und gespeicherten Daten löschen?')) {
        try {
          localStorage.removeItem('fuel-rechner-form-state');
        } catch(e) {}
        form.reset();
        
        // Reset gender selector to default
        gender = 'male';
        document.querySelectorAll('.gender-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.dataset.value === gender);
        });

        // Clear quick selection active classes
        document.querySelectorAll('.quick-btn').forEach(function (btn) {
          btn.classList.remove('active');
        });

        // Hide results and preview
        resultsEl.classList.remove('visible');
        updateDurationPreview();
      }
    });
  }

  /* ============================================
     Gender Selector
     ============================================ */
  var gender = 'male';
  document.querySelectorAll('.gender-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.gender-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      gender = this.dataset.value;
    });
  });

  /* ============================================
     Quick-Select Distance Buttons
     ============================================ */
  document.querySelectorAll('.quick-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('distance').value = this.dataset.value;
      document.querySelectorAll('.quick-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      updateDurationPreview();
    });
  });

  /* ============================================
     Live Duration Preview
     ============================================ */
  ['distance', 'target-min', 'target-sec'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', updateDurationPreview);
  });

  function updateDurationPreview() {
    var dist = parseFloat(document.getElementById('distance').value);
    var pMin = parseInt(document.getElementById('target-min').value, 10);
    var pSec = parseInt(document.getElementById('target-sec').value, 10) || 0;

    if (isNaN(dist) || isNaN(pMin) || dist <= 0 || pMin <= 0) {
      durationPrev.classList.remove('visible');
      return;
    }

    var pace     = pMin + pSec / 60;
    var totalMin = Math.round(dist * pace);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;

    durationText.textContent = h > 0 ? h + 'h ' + m + ' min' : m + ' min';
    durationPrev.classList.add('visible');
  }

  /* ============================================
     Form Submit
     ============================================ */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var inp = getInputs();
    if (!inp) return;

    saveFormState();

    var r = calculate(inp);
    displayResults(r);

    setTimeout(function () {
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  });

  /* ============================================
     Input Gathering & Validation
     ============================================ */
  function getInputs() {
    var height  = parseFloat(document.getElementById('height').value);
    var weight  = parseFloat(document.getElementById('weight').value);
    var tMin    = parseInt(document.getElementById('threshold-min').value, 10);
    var tSec    = parseInt(document.getElementById('threshold-sec').value, 10);
    var dist    = parseFloat(document.getElementById('distance').value);
    var pMin    = parseInt(document.getElementById('target-min').value, 10);
    var pSec    = parseInt(document.getElementById('target-sec').value, 10);
    var elev    = parseFloat(document.getElementById('elevation').value);
    var vo2max  = parseFloat(document.getElementById('vo2max').value);
    var age     = parseInt(document.getElementById('age').value, 10);

    if (isNaN(tSec)) tSec = 0;
    if (isNaN(pSec)) pSec = 0;
    if (isNaN(elev) || elev < 0) elev = 0;
    if (isNaN(vo2max) || vo2max <= 0) vo2max = 0;   // 0 = not provided

    var ok = true;
    if (isNaN(height) || height < 120 || height > 230)    { mark('height');        ok = false; }
    if (isNaN(weight) || weight < 30  || weight > 200)    { mark('weight');        ok = false; }
    if (isNaN(tMin)   || tMin < 2     || tMin > 12)       { mark('threshold-min'); ok = false; }
    if (tSec < 0 || tSec > 59)                            { mark('threshold-sec'); ok = false; }
    if (isNaN(dist)   || dist < 1     || dist > 250)      { mark('distance');      ok = false; }
    if (isNaN(pMin)   || pMin < 2     || pMin > 15)       { mark('target-min');    ok = false; }
    if (pSec < 0 || pSec > 59)                            { mark('target-sec');    ok = false; }
    if (isNaN(age)    || age < 10     || age > 100)       { mark('age');           ok = false; }

    if (!ok) return null;

    return {
      height: height,
      weight: weight,
      gender: gender,
      thresholdPace: tMin + tSec / 60,
      distance: dist,
      targetPace: pMin + pSec / 60,
      elevation: elev,
      vo2max: vo2max,
      age: age
    };
  }

  /* ============================================
     Core Calculation
     ============================================ */
  function calculate(inp) {
    // --- Speed ---
    var speedMMin = 1000 / inp.targetPace;                      // m/min

    // --- Grade from elevation ---
    var grade = inp.elevation > 0 ? inp.elevation / (inp.distance * 1000) : 0;

    // --- VO₂ (Adjusted ACSM running equation with grade) ---
    var vo2Run = 3.5 + 0.18 * speedMMin + 0.9 * speedMMin * grade; // ml/kg/min (0.18 factor avoids overestimation and matches Garmin)

    // --- Energy (Mifflin-St Jeor for resting, adjusted net ACSM for active) ---
    var rmrKcalDay;
    if (inp.gender === 'female') {
      rmrKcalDay = 10 * inp.weight + 6.25 * inp.height - 5 * inp.age - 161;
    } else {
      rmrKcalDay = 10 * inp.weight + 6.25 * inp.height - 5 * inp.age + 5;
    }
    var kcalPerMinResting = rmrKcalDay / 1440;
    var vo2RunActive = 0.18 * speedMMin + 0.9 * speedMMin * grade; // ml/kg/min (net active running cost)
    var kcalPerMinActive = (vo2RunActive * inp.weight) / 200;

    var kcalPerMin = kcalPerMinActive + kcalPerMinResting;
    var duration   = inp.distance * inp.targetPace;              // minutes
    var totalKcal  = kcalPerMin * duration;

    // --- Intensity (fraction of threshold speed) ---
    var rawIntensity = inp.thresholdPace / inp.targetPace;
    var intensity    = clamp(rawIntensity, 0.4, 1.3);

    // --- %VO₂max (if provided) ---
    var pctVO2max = null;
    if (inp.vo2max > 0) {
      pctVO2max = vo2Run / inp.vo2max;                           // fraction
    }

    // --- Substrate split ---
    var carbFrac = getCarbFraction(intensity);

    //  Adjust for VO₂max (training level shifts crossover point)
    if (inp.vo2max > 0) {
      var shift = (inp.vo2max - 50) * 0.003;
      carbFrac = clamp(carbFrac - shift, 0.25, 0.99);
    }

    //  Adjust for gender (women oxidize ~5-8 % more fat)
    if (inp.gender === 'female') {
      carbFrac = clamp(carbFrac - 0.07, 0.25, 0.99);
    }

    var fatFrac  = 1 - carbFrac;
    var carbKcal = totalKcal * carbFrac;
    var fatKcal  = totalKcal * fatFrac;

    // --- Glycogen estimation ---
    var bmi = inp.weight / Math.pow(inp.height / 100, 2);
    var leanRatio;
    if (inp.gender === 'female') {
      if (bmi < 20) leanRatio = 0.82;
      else if (bmi < 25) leanRatio = 0.75;
      else if (bmi < 30) leanRatio = 0.68;
      else leanRatio = 0.60;
    } else {
      if (bmi < 20) leanRatio = 0.88;
      else if (bmi < 25) leanRatio = 0.82;
      else if (bmi < 30) leanRatio = 0.75;
      else leanRatio = 0.68;
    }

    var muscleMass       = inp.weight * leanRatio * 0.48;        // kg
    var totalGlycogenG   = muscleMass * 15 + 90;                 // g (muscle + liver)
    var availGlycogenG   = totalGlycogenG * 0.75;                // 75 % usable
    var glycogenKcal     = availGlycogenG * 4;

    // --- External carb deficit & fueling recommendation ---
    var deficitKcal   = Math.max(0, carbKcal - glycogenKcal);
    var minCarbsG     = deficitKcal / 4;
    var durationH     = duration / 60;

    // Performance-based recommended carb rate (g/h) based on duration and intensity
    var recommendedRate = 0;
    if (duration >= 60) {
      if (duration < 90) {
        recommendedRate = (intensity >= 0.85) ? 30 : 20; // Zone 3/4/5/GA2
      } else if (duration < 150) {
        recommendedRate = (intensity >= 0.85) ? 60 : 40;
      } else {
        recommendedRate = (intensity >= 0.85) ? 80 : 50;
      }
    }

    // Minimum rate required to cover physical glycogen depletion
    var deficitRate = durationH > 0 ? minCarbsG / durationH : 0;
    var finalRate = Math.max(recommendedRate, deficitRate);

    // Split between Maltodextrin and Fructose (minimum required Fructose)
    var maltoRate = 0;
    var fructoseRate = 0;
    if (finalRate > 0) {
      if (finalRate <= 60) {
        maltoRate = finalRate;
        fructoseRate = 0;
      } else {
        maltoRate = 60;
        fructoseRate = finalRate - 60;
      }
    }

    var maltoG     = Math.ceil(maltoRate * durationH);
    var fructoseG  = Math.ceil(fructoseRate * durationH);
    var externalG  = maltoG + fructoseG;

    // --- Water (80 g / L) ---
    var waterMl = externalG > 0 ? (externalG / 80) * 1000 : 0;

    // --- Average grade % ---
    var avgGradePct = grade > 0 ? Math.round(grade * 1000) / 10 : 0;  // e.g. 2.4

    return {
      totalKcal:        Math.round(totalKcal),
      duration:         Math.round(duration),
      speedKmH:         Math.round((60 / inp.targetPace) * 10) / 10,
      intensityPct:     Math.round(intensity * 100),
      pctVO2max:        pctVO2max !== null ? Math.round(pctVO2max * 100) : null,
      carbPct:          Math.round(carbFrac * 100),
      fatPct:           Math.round(fatFrac * 100),
      carbKcal:         Math.round(carbKcal),
      fatKcal:          Math.round(fatKcal),
      totalGlycogenG:   Math.round(totalGlycogenG),
      availGlycogenG:   Math.round(availGlycogenG),
      glycogenKcal:     Math.round(glycogenKcal),
      deficitKcal:      Math.round(deficitKcal),
      externalG:        externalG,
      maltoG:           maltoG,
      fructoseG:        fructoseG,
      waterMl:          Math.round(waterMl / 10) * 10,
      absorptionRate:   Math.round(finalRate),
      fructoseRate:     Math.round(fructoseRate),
      zone:             getZone(intensity),
      avgGradePct:      avgGradePct,
      hasElevation:     inp.elevation > 0,
      hasVO2max:        inp.vo2max > 0,
      needsCarbs:       externalG > 0.5,
      aboveVO2max:      pctVO2max !== null && pctVO2max > 1.0,
      needsFructose:    fructoseG > 0
    };
  }

  /* ============================================
     Crossover Curve  (piecewise linear)
     ============================================ */
  function getCarbFraction(intensity) {
    var pts = [
      [0.40,0.35],[0.50,0.42],[0.60,0.52],[0.70,0.62],
      [0.75,0.68],[0.80,0.75],[0.85,0.82],[0.90,0.87],
      [0.95,0.91],[1.00,0.94],[1.10,0.96],[1.20,0.97],[1.30,0.98]
    ];
    if (intensity <= pts[0][0]) return pts[0][1];
    if (intensity >= pts[pts.length-1][0]) return pts[pts.length-1][1];
    for (var i = 0; i < pts.length - 1; i++) {
      if (intensity <= pts[i+1][0]) {
        var x0=pts[i][0],y0=pts[i][1],x1=pts[i+1][0],y1=pts[i+1][1];
        return y0 + (y1-y0)*((intensity-x0)/(x1-x0));
      }
    }
    return pts[pts.length-1][1];
  }

  /* ============================================
     Intensity Zone Label
     ============================================ */
  function getZone(r) {
    if (r < 0.65) return 'Regeneration';
    if (r < 0.75) return 'GA1';
    if (r < 0.85) return 'GA2';
    if (r < 0.95) return 'Tempobereich';
    if (r <= 1.00) return 'Schwelle';
    return 'Überschwellig';
  }

  /* ============================================
     Display Results
     ============================================ */
  function displayResults(r) {
    resultsEl.classList.add('visible');
    warnTextEl.textContent = '';
    warnEl.style.display = 'none';

    /* --- Hero cards --- */
    if (r.needsCarbs) {
      if (r.needsFructose) {
        heroEl.innerHTML =
          '<div class="result-card primary"><div class="result-label">Maltodextrin</div>' +
          '<div class="result-value"><span id="carbs-value" class="value-number">0</span><span class="value-unit">g</span></div></div>' +
          '<div class="result-card primary"><div class="result-label">Fruktose</div>' +
          '<div class="result-value"><span id="fructose-value" class="value-number">0</span><span class="value-unit">g</span></div></div>' +
          '<div class="result-card primary" style="grid-column: 1 / -1"><div class="result-label">Wasser</div>' +
          '<div class="result-value"><span id="water-value" class="value-number">0</span><span class="value-unit">ml</span></div></div>';

        animateValue('carbs-value', 0, r.maltoG, 800);
        animateValue('fructose-value', 0, r.fructoseG, 800);
        animateValue('water-value', 0, r.waterMl, 800);
      } else {
        heroEl.innerHTML =
          '<div class="result-card primary"><div class="result-label">Maltodextrin</div>' +
          '<div class="result-value"><span id="carbs-value" class="value-number">0</span><span class="value-unit">g</span></div></div>' +
          '<div class="result-card primary"><div class="result-label">Wasser</div>' +
          '<div class="result-value"><span id="water-value" class="value-number">0</span><span class="value-unit">ml</span></div></div>';

        animateValue('carbs-value', 0, r.maltoG, 800);
        animateValue('water-value', 0, r.waterMl, 800);
      }

      if (r.deficitKcal > 0) {
        noteEl.textContent = 'Mischverhältnis: 80 g Kohlenhydrate pro Liter Wasser. Zufuhr notwendig, da deine Glykogenspeicher rechnerisch erschöpft sind.';
      } else {
        noteEl.textContent = 'Mischverhältnis: 80 g Kohlenhydrate pro Liter Wasser. Empfohlen zur Leistungssicherung und ZNS-Entlastung bei Läufen ab 60 min.';
      }
      noteEl.style.display = '';

      if (r.needsFructose) {
        warnEl.style.display = '';
        warnTextEl.textContent =
          'Fruktose-Zusatz erforderlich: Die benötigte Kohlenhydratrate von ' + r.absorptionRate + ' g/h übersteigt das Absorptionslimit von reinem Maltodextrin (60 g/h). ' +
          'Es müssen ' + r.fructoseRate + ' g/h Fruktose hinzugefügt werden. Hinweis: Fruktose kann bei manchen Menschen Magen-Darm-Beschwerden (Blähungen, Krämpfe, Durchfall) verursachen. ' +
          'Daher wird hier nur das absolut benötigte Minimum an Fruktose berechnet, um das Maltodextrin-Limit von 60 g/h zu ergänzen.';
      } else {
        warnEl.style.display = 'none';
      }
    } else {
      heroEl.innerHTML =
        '<div class="result-card no-carbs"><div class="result-label">Ergebnis</div>' +
        '<div class="result-value"><span class="value-number">✅&nbsp; Keine zusätzlichen Carbs nötig</span></div></div>';

      noteEl.textContent = 'Für diese kurze Einheit (< 60 min) ist keine zusätzliche Zufuhr notwendig.';
      noteEl.style.display = '';
      warnEl.style.display = 'none';
    }

    /* --- Above VO2max warning --- */
    if (r.aboveVO2max) {
      warnEl.style.display = '';
      var existing = warnTextEl.textContent;
      var extra = 'Diese Zielpace übersteigt deine aerobe Kapazität (' + r.pctVO2max + ' % VO₂max). ' +
                  'Diese Intensität ist nicht rein aerob zu leisten.';
      warnTextEl.textContent = existing ? existing + ' · ' + extra : extra;
    }

    /* --- Duration string --- */
    var dH = Math.floor(r.duration / 60);
    var dM = r.duration % 60;
    var durStr = dH > 0 ? dH + 'h ' + dM + ' min' : dM + ' min';

    /* --- Overview stats --- */
    setText('stat-total-kcal',  r.totalKcal + ' kcal');
    setText('stat-duration',    durStr);
    setText('stat-intensity',   r.intensityPct + ' %');
    setText('stat-zone',        r.zone);

    // Optional: %VO₂max
    var vo2Row = document.getElementById('stat-vo2max-row');
    if (r.hasVO2max) {
      vo2Row.style.display = '';
      setText('stat-vo2max-pct', r.pctVO2max + ' %');
    } else {
      vo2Row.style.display = 'none';
    }

    // Optional: average grade
    var gradeRow = document.getElementById('stat-grade-row');
    if (r.hasElevation) {
      gradeRow.style.display = '';
      setText('stat-grade', r.avgGradePct + ' %');
    } else {
      gradeRow.style.display = 'none';
    }

    /* --- Energy split --- */
    setText('stat-carb-kcal',           r.carbKcal + ' kcal (' + r.carbPct + ' %)');
    setText('stat-fat-kcal',            r.fatKcal  + ' kcal (' + r.fatPct  + ' %)');

    /* --- Glycogen --- */
    setText('stat-glycogen-total',      r.totalGlycogenG + ' g  (' + (r.totalGlycogenG * 4) + ' kcal)');
    setText('stat-glycogen-available',  r.availGlycogenG + ' g  (' + r.glycogenKcal + ' kcal)');
    setText('stat-carb-deficit',        r.needsCarbs
      ? (r.deficitKcal > 0
        ? Math.ceil(r.deficitKcal / 4) + ' g  (' + r.deficitKcal + ' kcal)'
        : 'Kein Defizit (Zufuhr zur Leistungssicherung empfohlen)')
      : 'Kein Defizit');

    /* --- Energy bar --- */
    updateEnergyBar(r);

    /* --- Re-trigger stat animations --- */
    document.querySelectorAll('.details .stat-item').forEach(function (el) {
      el.style.animation = 'none'; void el.offsetHeight; el.style.animation = '';
    });
  }

  /* ============================================
     Energy Bar
     ============================================ */
  function updateEnergyBar(r) {
    var glycPct = Math.min(r.carbPct, (r.glycogenKcal / r.totalKcal) * 100);
    var extPct  = Math.max(0, r.carbPct - glycPct);
    var fatPct  = r.fatPct;

    setTimeout(function () {
      setWidth('bar-glycogen', glycPct);
      setWidth('bar-external', extPct);
      setWidth('bar-fat',      fatPct);
      toggleSegmentLabel('bar-glycogen', glycPct);
      toggleSegmentLabel('bar-external', extPct);
      toggleSegmentLabel('bar-fat',      fatPct);
    }, 350);
  }

  function setWidth(id, pct)  { document.getElementById(id).style.width = pct + '%'; }
  function toggleSegmentLabel(id, pct) {
    var s = document.getElementById(id).querySelector('span');
    if (s) s.style.display = pct < 12 ? 'none' : '';
  }

  /* ============================================
     Animated Counter
     ============================================ */
  function animateValue(id, start, end, dur) {
    var el = document.getElementById(id);
    if (!el) return;
    var range = end - start, t0 = performance.now();
    function step(now) {
      var p = Math.min((now - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + range * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ============================================
     Helpers
     ============================================ */
  function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }
  function mark(id)       { var el = document.getElementById(id); if (el) el.classList.add('error'); }
  function clearErrors()  { document.querySelectorAll('.error').forEach(function(e){e.classList.remove('error');}); }
  function clamp(v,lo,hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ============================================
     Form State Persistence (Cookies/LocalStorage)
     ============================================ */
  function saveFormState() {
    var state = {
      height:       document.getElementById('height').value,
      weight:       document.getElementById('weight').value,
      gender:       gender,
      thresholdMin: document.getElementById('threshold-min').value,
      thresholdSec: document.getElementById('threshold-sec').value,
      vo2max:       document.getElementById('vo2max').value,
      age:          document.getElementById('age').value,
      distance:     document.getElementById('distance').value,
      elevation:    document.getElementById('elevation').value,
      targetMin:    document.getElementById('target-min').value,
      targetSec:    document.getElementById('target-sec').value
    };
    try {
      localStorage.setItem('fuel-rechner-form-state', JSON.stringify(state));
    } catch(e) {}
  }

  function loadFormState() {
    try {
      var data = localStorage.getItem('fuel-rechner-form-state');
      if (!data) return;
      var state = JSON.parse(data);
      if (!state) return;

      if (state.height)       document.getElementById('height').value = state.height;
      if (state.weight)       document.getElementById('weight').value = state.weight;
      if (state.vo2max)       document.getElementById('vo2max').value = state.vo2max;
      if (state.age)          document.getElementById('age').value = state.age;
      if (state.distance)     document.getElementById('distance').value = state.distance;
      if (state.elevation)    document.getElementById('elevation').value = state.elevation;
      if (state.thresholdMin) document.getElementById('threshold-min').value = state.thresholdMin;
      if (state.thresholdSec) document.getElementById('threshold-sec').value = state.thresholdSec;
      if (state.targetMin)    document.getElementById('target-min').value = state.targetMin;
      if (state.targetSec)    document.getElementById('target-sec').value = state.targetSec;

      if (state.gender) {
        gender = state.gender;
        document.querySelectorAll('.gender-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.dataset.value === gender);
        });
      }

      // Update active state of quick distance buttons if match
      document.querySelectorAll('.quick-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.value === state.distance);
      });

      updateDurationPreview();
    } catch(e) {}
  }

  loadFormState();

})();
