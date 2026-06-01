/* viz.js — D3.js dashboard, purple theme */

const VIZ = {
  loaded: false,
  data: null,

  PURPLE: "#7c3aed",
  PURPLE_LIGHT: "#a78bfa",
  PURPLE_DARK: "#4c1d95",
  GOLD: "#f59e0b",
  TEAL: "#06b6d4",
  ROSE: "#f43f5e",
  GREEN: "#10b981",
  ORANGE: "#f97316",
  PINK: "#ec4899",
  SKY: "#38bdf8",

  PALETTE: ["#7c3aed","#a78bfa","#06b6d4","#f59e0b","#f43f5e","#10b981","#f97316","#ec4899","#38bdf8","#c084fc"],

  tooltip: null,

  init() {
    this.tooltip = document.createElement("div");
    this.tooltip.className = "viz-tooltip";
    document.body.appendChild(this.tooltip);

    const vizTab = document.getElementById("tab-viz");
    if (vizTab && vizTab.classList.contains("active")) {
      this.load();
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
      if (btn.dataset.tab === "viz") {
        btn.addEventListener("click", () => this.load());
      }
    });
  },

  showTooltip(event, html) {
    this.tooltip.style.display = "block";
    this.tooltip.innerHTML = html;
    this.moveTooltip(event);
  },

  moveTooltip(event) {
    this.tooltip.style.left = (event.clientX + 14) + "px";
    this.tooltip.style.top = (event.clientY - 36) + "px";
  },

  hideTooltip() {
    this.tooltip.style.display = "none";
  },

  clear(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
    return el;
  },

  async load() {
    if (this.loaded && this.data) {
      requestAnimationFrame(() => this.render(this.data));
      return;
    }

    const loading = document.getElementById("viz-loading");
    if (loading) loading.style.display = "block";

    try {
      const res = await fetch("/api/dashboard-stats", { credentials: "same-origin" });
      if (!res.ok) {
        const errText = await res.text();
        console.error("dashboard-stats error:", res.status, errText);
        if (loading) loading.textContent = "Błąd ładowania (" + res.status + ").";
        return;
      }
      this.data = await res.json();
      console.log("dashboard-stats:", this.data); // DEBUG
      this.loaded = true;
      if (loading) loading.style.display = "none";
      this.render(this.data);
    } catch (err) {
      if (loading) loading.textContent = "Błąd ładowania danych.";
      console.error("viz load error:", err);
    }
  },

  render(data) {
    const empty = document.getElementById("viz-empty");
    const hasData = data.watchedCount > 0 || data.ratedCount > 0;

    if (!hasData) {
      if (empty) empty.style.display = "flex";
      return;
    }
    if (empty) empty.style.display = "none";

    // KPI
    const kpis = document.getElementById("viz-kpis");
    if (kpis) kpis.style.display = "grid";
    this.setKpi("kpi-hours", (data.totalHours).toFixed(1).replace(".",",") + " h");
    this.setKpi("kpi-watched", data.watchedCount);
    this.setKpi("kpi-rated", data.ratedCount);
    this.setKpi("kpi-watchlist", (data.watchlistHours ?? Math.round(data.watchlistMinutes / 60)).toFixed(1).replace(".",",") + " h");

    // Pokaż sekcje
    ["viz-charts","viz-row2","viz-row3"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "flex";
    });

    // Wyczyść i przerysuj
    if (data.activityData.length > 0) this.drawHeatmap(data.activityData);
    if (data.genreData.length > 0) this.drawDonut(data.genreData);
    if (data.watchTimeByMonth.length > 0) this.drawWatchTime(data.watchTimeByMonth);
    if (data.ratingDist.some(d => d.count > 0)) this.drawRatingsDist(data.ratingDist);
    this.drawRatingsLine(data.ratingsOverTime);
  },

  setKpi(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  /* ===== HEATMAP ===== */
  drawHeatmap(activityData) {
    const el = this.clear("chart-activity");
    if (!el) return;

    const dataMap = {};
    activityData.forEach(d => { dataMap[d.date] = d.count; });

    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);

    const days = [];
    for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const cellSize = 14;
    const cellGap = 3;
    const step = cellSize + cellGap;
    const weeks = Math.ceil(days.length / 7) + 1;
    const width = weeks * step + 40;
    const height = 7 * step + 24;

    const svg = d3.select("#chart-activity")
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%");

    const maxCount = d3.max(activityData, d => d.count) || 1;
    const colorScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolate("#e9d5ff", this.PURPLE));

    svg.selectAll("rect")
      .data(days)
      .enter()
      .append("rect")
      .attr("x", d => {
        const week = d3.timeMonday.count(yearAgo, d);
        return week * step + 36;
      })
      .attr("y", d => ((d.getDay() + 6) % 7) * step + 20)
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("rx", 3)
      .attr("fill", d => {
        const key = d.toISOString().slice(0, 10);
        return dataMap[key] ? colorScale(dataMap[key]) : "#ede9fe";
      })
      .on("mouseover", (event, d) => {
        const key = d.toISOString().slice(0, 10);
        const count = dataMap[key] || 0;
        this.showTooltip(event,
          `<strong>${key}</strong><br>${count} film${count === 1 ? "" : "ów"}`);
      })
      .on("mousemove", event => this.moveTooltip(event))
      .on("mouseout", () => this.hideTooltip());

    // Etykiety dni
    [["Pon", 0], ["Śr", 2], ["Pt", 4]].forEach(([label, row]) => {
      svg.append("text")
        .attr("x", 0).attr("y", row * step + 32)
        .attr("font-size", 10).attr("fill", "#9ca3af")
        .attr("dominant-baseline", "middle")
        .text(label);
    });

    // Etykiety miesięcy
    const monthsSeen = new Set();
    days.forEach(d => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthsSeen.has(key) && d.getDate() <= 7) {
        monthsSeen.add(key);
        const week = d3.timeMonday.count(yearAgo, d);
        svg.append("text")
          .attr("x", week * step + 36)
          .attr("y", 12)
          .attr("font-size", 10)
          .attr("fill", "#9ca3af")
          .text(d.toLocaleDateString("pl-PL", { month: "short" }));
      }
    });
  },

  /* ===== DONUT ===== */
  drawDonut(genreData) {
    const el = this.clear("chart-genres");
    if (!el) return;

    const size = 260;
    const radius = size / 2 - 8;

    const svg = d3.select("#chart-genres")
      .append("svg")
      .attr("viewBox", `0 0 ${size + 200} ${size}`)
      .attr("width", "100%");

    const g = svg.append("g")
      .attr("transform", `translate(${size / 2}, ${size / 2})`);

    const pie = d3.pie().value(d => d.count).sort(null).padAngle(0.03);
    const arc = d3.arc().innerRadius(radius * 0.52).outerRadius(radius).cornerRadius(4);
    const arcHover = d3.arc().innerRadius(radius * 0.48).outerRadius(radius + 10).cornerRadius(4);

    g.selectAll("path")
      .data(pie(genreData))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => this.PALETTE[i % this.PALETTE.length])
      .attr("opacity", 0)
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(150).attr("d", arcHover).attr("opacity", 1);
        const total = d3.sum(genreData, g => g.count);
        const pct = Math.round(d.data.count / total * 100);
        VIZ.showTooltip(event,
          `<strong>${d.data.name}</strong><br>${d.data.count} filmów · ${pct}%`);
      })
      .on("mousemove", event => this.moveTooltip(event))
      .on("mouseout", function() {
        d3.select(this).transition().duration(150).attr("d", arc).attr("opacity", 1);
        VIZ.hideTooltip();
      })
      .transition().duration(600).delay((d, i) => i * 60)
      .attr("opacity", 1);

    // Środkowy tekst
    g.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em")
      .attr("font-size", 22).attr("font-weight", 700).attr("fill", "#1c1c2e")
      .text(d3.sum(genreData, d => d.count));
    g.append("text").attr("text-anchor", "middle").attr("dy", "1.2em")
      .attr("font-size", 11).attr("fill", "#9ca3af").text("filmów");

    // Legenda
    const legend = svg.append("g").attr("transform", `translate(${size + 12}, 20)`);
    genreData.forEach((d, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 26})`);
      row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 4)
        .attr("fill", this.PALETTE[i % this.PALETTE.length]);
      row.append("text").attr("x", 18).attr("y", 10)
        .attr("font-size", 12).attr("fill", "#374151")
        .text((d.name.length > 13 ? d.name.slice(0, 12) + "…" : d.name) + ` (${d.count})`);
    });
  },

  /* ===== WATCH TIME BAR ===== */
  drawWatchTime(data) {
    const el = this.clear("chart-watchtime");
    if (!el) return;

    const w = el.offsetWidth || 340;
    const h = 220;
    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const iW = w - m.left - m.right;
    const iH = h - m.top - m.bottom;

    const svg = d3.select("#chart-watchtime").append("svg")
      .attr("viewBox", `0 0 ${w} ${h}`).attr("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scaleBand().domain(data.map(d => d.month)).range([0, iW])
      .paddingInner(0.3).paddingOuter(data.length === 1 ? 0 : 0.15);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hours) * 1.2 || 1]).range([iH, 0]);

    // Gradient
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "bar-grad")
      .attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
    grad.append("stop").attr("offset", "0%").attr("stop-color", this.PURPLE);
    grad.append("stop").attr("offset", "100%").attr("stop-color", this.PURPLE_LIGHT);

    // Grid lines
    y.ticks(4).forEach(tick => {
      g.append("line").attr("x1", 0).attr("x2", iW)
        .attr("y1", y(tick)).attr("y2", y(tick))
        .attr("stroke", "#e9d5ff").attr("stroke-dasharray", "4,3").attr("opacity", 0.6);
    });

    g.selectAll("rect").data(data).enter().append("rect")
      .attr("x", d => x(d.month))
      .attr("y", iH).attr("width", x.bandwidth()).attr("height", 0)
      .attr("fill", "url(#bar-grad)").attr("rx", 6)
      .on("mouseover", (event, d) => {
        this.showTooltip(event, `<strong>${d.month}</strong><br>${d.hours}h`);
      })
      .on("mousemove", event => this.moveTooltip(event))
      .on("mouseout", () => this.hideTooltip())
      .transition().duration(700).ease(d3.easeCubicOut)
      .attr("y", d => y(d.hours))
      .attr("height", d => iH - y(d.hours));

    // Wartości nad słupkami
    g.selectAll(".bar-label").data(data).enter().append("text")
      .attr("class", "bar-label")
      .attr("x", d => x(d.month) + x.bandwidth() / 2)
      .attr("y", d => y(d.hours) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", 10).attr("font-weight", 600).attr("fill", this.PURPLE)
      .attr("opacity", 0)
      .text(d => d.hours > 0 ? d.hours + "h" : "")
      .transition().delay(700).attr("opacity", 1);

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size", 10).attr("fill", "#9ca3af");

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + "h"))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size", 10).attr("fill", "#9ca3af");

    g.selectAll(".tick line").attr("stroke", "none");
  },

  /* ===== RATINGS DISTRIBUTION ===== */
  drawRatingsDist(data) {
    const el = this.clear("chart-ratings-dist");
    if (!el) return;

    const w = el.offsetWidth || 340;
    const h = 220;
    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const iW = w - m.left - m.right;
    const iH = h - m.top - m.bottom;

    const svg = d3.select("#chart-ratings-dist").append("svg")
      .attr("viewBox", `0 0 ${w} ${h}`).attr("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scaleBand().domain(data.map(d => d.star)).range([0, iW]).padding(0.35);
    const y = d3.scaleLinear()
      .domain([0, (d3.max(data, d => d.count) + 1) || 1]).range([iH, 0]);

    const colorScale = d3.scaleSequential()
      .domain([1, 5])
      .interpolator(d3.interpolate("#c4b5fd", this.PURPLE));

    y.ticks(Math.min(4, d3.max(data, d => d.count) + 1)).forEach(tick => {
      g.append("line").attr("x1", 0).attr("x2", iW)
        .attr("y1", y(tick)).attr("y2", y(tick))
        .attr("stroke", "#e9d5ff").attr("stroke-dasharray", "4,3").attr("opacity", 0.6);
    });

    g.selectAll("rect").data(data).enter().append("rect")
      .attr("x", d => x(d.star))
      .attr("y", iH).attr("width", x.bandwidth()).attr("height", 0)
      .attr("fill", d => colorScale(d.star)).attr("rx", 6)
      .on("mouseover", (event, d) => {
        this.showTooltip(event, `<strong>${d.star} ★</strong><br>${d.count} filmów`);
      })
      .on("mousemove", event => this.moveTooltip(event))
      .on("mouseout", () => this.hideTooltip())
      .transition().duration(700).ease(d3.easeCubicOut)
      .attr("y", d => y(d.count))
      .attr("height", d => iH - y(d.count));

    g.selectAll(".bar-label").data(data).enter().append("text")
      .attr("class","bar-label")
      .attr("x", d => x(d.star) + x.bandwidth() / 2)
      .attr("y", d => y(d.count) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", 11).attr("font-weight", 700)
      .attr("fill", d => colorScale(d.star))
      .attr("opacity", 0)
      .text(d => d.count > 0 ? d.count : "")
      .transition().delay(700).attr("opacity", 1);

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickFormat(d => "★".repeat(d)))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size", 13).attr("fill", "#f59e0b");

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => Math.floor(d)))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size", 10).attr("fill", "#9ca3af");

    g.selectAll(".tick line").attr("stroke", "none");
  },

  /* ===== RATINGS LINE ===== */
  drawRatingsLine(data) {
    const el = this.clear("chart-ratings-time");
    if (!el) return;

    if (!data || data.length < 2) {
      el.innerHTML = '<p class="viz-no-data">Za mało danych — oceń więcej filmów w różnych miesiącach!</p>';
      return;
    }

    const w = el.offsetWidth || 340;
    const h = 220;
    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const iW = w - m.left - m.right;
    const iH = h - m.top - m.bottom;

    const svg = d3.select("#chart-ratings-time").append("svg")
      .attr("viewBox", `0 0 ${w} ${h}`).attr("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scalePoint().domain(data.map(d => d.month)).range([0, iW]);
    const y = d3.scaleLinear().domain([0.5, 5.5]).range([iH, 0]);

    // Gradient pod linią
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "line-area-grad")
      .attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    grad.append("stop").attr("offset","0%").attr("stop-color", this.PURPLE).attr("stop-opacity", 0.25);
    grad.append("stop").attr("offset","100%").attr("stop-color", this.PURPLE).attr("stop-opacity", 0);

    // Grid
    [1,2,3,4,5].forEach(tick => {
      g.append("line").attr("x1",0).attr("x2",iW)
        .attr("y1",y(tick)).attr("y2",y(tick))
        .attr("stroke","#e9d5ff").attr("stroke-dasharray","4,3").attr("opacity",0.6);
    });

    const area = d3.area()
      .x(d => x(d.month)).y0(iH).y1(d => y(d.avg))
      .curve(d3.curveCatmullRom);
    const line = d3.line()
      .x(d => x(d.month)).y(d => y(d.avg))
      .curve(d3.curveCatmullRom);

    g.append("path").datum(data).attr("fill","url(#line-area-grad)").attr("d", area);

    const path = g.append("path").datum(data)
      .attr("fill","none").attr("stroke", this.PURPLE)
      .attr("stroke-width", 2.5).attr("stroke-linecap","round")
      .attr("d", line);

    // Animacja rysowania linii
    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len)
      .transition().duration(1000).ease(d3.easeLinear).attr("stroke-dashoffset", 0);

    g.selectAll("circle").data(data).enter().append("circle")
      .attr("cx", d => x(d.month)).attr("cy", d => y(d.avg))
      .attr("r", 5).attr("fill", "#fff")
      .attr("stroke", this.PURPLE).attr("stroke-width", 2.5)
      .on("mouseover", (event, d) => {
        this.showTooltip(event,
          `<strong>${d.month}</strong><br>Średnia: ${d.avg} ★<br>${d.count} ocen`);
      })
      .on("mousemove", event => this.moveTooltip(event))
      .on("mouseout", () => this.hideTooltip());

    g.append("g").attr("transform",`translate(0,${iH})`)
      .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size",10).attr("fill","#9ca3af");

    g.append("g")
      .call(d3.axisLeft(y).tickValues([1,2,3,4,5]).tickFormat(d => d + "★"))
      .call(g => g.select(".domain").remove())
      .selectAll("text").attr("font-size",10).attr("fill","#9ca3af");

    g.selectAll(".tick line").attr("stroke","none");
  },
};

document.addEventListener("DOMContentLoaded", () => VIZ.init());
