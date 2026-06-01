/* dashboard-viz.js — D3.js visualizations */

const ACCENT = "#6c63ff";
const ACCENT2 = "#f5c518";
const GRAY = "#e2e2ee";
const TEXT = "#1c1c2e";

const GENRE_COLORS = [
  "#6c63ff","#f5c518","#e63946","#2ec4b6","#ff9f1c",
  "#a8dadc","#457b9d","#e76f51","#8ecae6","#264653"
];

async function loadDashboard() {
  const loading = document.getElementById("viz-loading");
  const empty = document.getElementById("viz-empty");

  try {
    const res = await fetch("/api/dashboard-stats");
    const data = await res.json();

    loading.style.display = "none";

    const hasData = data.watchedCount > 0 || data.ratedCount > 0;
    if (!hasData) {
      empty.style.display = "flex";
      return;
    }

    // Pokaż sekcje
    ["viz-kpis","viz-charts","viz-row2","viz-row3"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === "viz-kpis" ? "grid" : "flex";
    });

    // KPI
    document.getElementById("kpi-hours").textContent = data.totalHours;
    document.getElementById("kpi-watched").textContent = data.watchedCount;
    document.getElementById("kpi-rated").textContent = data.ratedCount;
    document.getElementById("kpi-watchlist").textContent =
      Math.round(data.watchlistMinutes / 60);

    // Wykresy
    if (data.activityData.length > 0) drawActivityHeatmap(data.activityData);
    if (data.genreData.length > 0) drawGenreDonut(data.genreData);
    if (data.watchTimeByMonth.length > 0) drawWatchTimeBar(data.watchTimeByMonth);
    if (data.ratingDist.some(d => d.count > 0)) drawRatingsDist(data.ratingDist);
    if (data.ratingsOverTime.length > 0) drawRatingsLine(data.ratingsOverTime);

  } catch (err) {
    loading.textContent = "Błąd ładowania danych.";
    console.error(err);
  }
}

/* ===== ACTIVITY HEATMAP ===== */
function drawActivityHeatmap(activityData) {
  const el = document.getElementById("chart-activity");
  const width = el.offsetWidth || 700;
  const cellSize = Math.max(12, Math.floor((width - 60) / 53));
  const height = cellSize * 7 + 30;

  const svg = d3.select("#chart-activity")
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const dataMap = {};
  activityData.forEach(d => { dataMap[d.date] = d.count; });

  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);

  const days = [];
  for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const maxCount = d3.max(activityData, d => d.count) || 1;
  const colorScale = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolate("#eef", ACCENT));

  const tooltip = d3.select("body").select(".viz-tooltip").empty()
    ? d3.select("body").append("div").attr("class", "viz-tooltip")
    : d3.select(".viz-tooltip");

  // Oblicz offset startowy (żeby poniedziałek był na górze)
  const firstDay = days[0];
  const startWeek = d3.timeMonday.count(yearAgo, firstDay);

  svg.selectAll("rect")
    .data(days)
    .enter()
    .append("rect")
    .attr("x", d => {
      const week = d3.timeMonday.count(yearAgo, d);
      return week * (cellSize + 2) + 30;
    })
    .attr("y", d => ((d.getDay() + 6) % 7) * (cellSize + 2))
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("rx", 2)
    .attr("fill", d => {
      const key = d.toISOString().slice(0, 10);
      return dataMap[key] ? colorScale(dataMap[key]) : GRAY;
    })
    .on("mouseover", (event, d) => {
      const key = d.toISOString().slice(0, 10);
      const count = dataMap[key] || 0;
      tooltip.style("display", "block")
        .html(`<strong>${key}</strong><br>${count} film${count === 1 ? "" : "ów"}`);
    })
    .on("mousemove", event => {
      tooltip.style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => tooltip.style("display", "none"));

  // Etykiety dni tygodnia
  const dayLabels = ["Pon","Śr","Pt"];
  const dayPos = [0, 2, 4];
  dayLabels.forEach((label, i) => {
    svg.append("text")
      .attr("x", 0)
      .attr("y", dayPos[i] * (cellSize + 2) + cellSize * 0.8)
      .attr("font-size", 10)
      .attr("fill", "#999")
      .text(label);
  });
}

/* ===== GENRE DONUT ===== */
function drawGenreDonut(genreData) {
  const el = document.getElementById("chart-genres");
  const size = Math.min(el.offsetWidth || 300, 300);
  const radius = size / 2 - 10;

  const svg = d3.select("#chart-genres")
    .append("svg")
    .attr("viewBox", `0 0 ${size + 180} ${size}`)
    .attr("width", "100%");

  const g = svg.append("g")
    .attr("transform", `translate(${size / 2}, ${size / 2})`);

  const pie = d3.pie().value(d => d.count).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
  const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius + 8);

  const tooltip = d3.select(".viz-tooltip").empty()
    ? d3.select("body").append("div").attr("class", "viz-tooltip")
    : d3.select(".viz-tooltip");

  const slices = g.selectAll("path")
    .data(pie(genreData))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => GENRE_COLORS[i % GENRE_COLORS.length])
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      d3.select(this).transition().duration(150).attr("d", arcHover);
      const total = d3.sum(genreData, g => g.count);
      const pct = Math.round(d.data.count / total * 100);
      tooltip.style("display","block")
        .html(`<strong>${d.data.name}</strong><br>${d.data.count} filmów (${pct}%)`);
    })
    .on("mousemove", event => {
      tooltip.style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", function() {
      d3.select(this).transition().duration(150).attr("d", arc);
      tooltip.style("display","none");
    });

  // Legenda
  const legend = svg.append("g").attr("transform", `translate(${size + 10}, 20)`);
  genreData.slice(0, 8).forEach((d, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
    row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3)
      .attr("fill", GENRE_COLORS[i % GENRE_COLORS.length]);
    row.append("text").attr("x", 18).attr("y", 10)
      .attr("font-size", 11).attr("fill", TEXT)
      .text(d.name.length > 14 ? d.name.slice(0,13)+"…" : d.name);
  });
}

/* ===== WATCH TIME BAR ===== */
function drawWatchTimeBar(data) {
  const el = document.getElementById("chart-watchtime");
  const w = el.offsetWidth || 340;
  const h = 200;
  const margin = { top: 10, right: 10, bottom: 40, left: 36 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const svg = d3.select("#chart-watchtime")
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.month)).range([0, innerW]).padding(0.25);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hours) * 1.15]).range([innerH, 0]);

  const tooltip = d3.select(".viz-tooltip");

  g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", d => x(d.month))
    .attr("y", innerH)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", ACCENT)
    .attr("rx", 4)
    .on("mouseover", (event, d) => {
      tooltip.style("display","block")
        .html(`<strong>${d.month}</strong><br>${d.hours}h`);
    })
    .on("mousemove", event => {
      tooltip.style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", () => tooltip.style("display","none"))
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr("y", d => y(d.hours))
    .attr("height", d => innerH - y(d.hours));

  // Osie
  g.append("g").attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
    .selectAll("text").attr("font-size", 10).attr("fill", "#999");

  g.append("g")
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + "h"))
    .selectAll("text").attr("font-size", 10).attr("fill", "#999");

  g.selectAll(".domain, .tick line").attr("stroke", GRAY);
}

/* ===== RATINGS DISTRIBUTION ===== */
function drawRatingsDist(data) {
  const el = document.getElementById("chart-ratings-dist");
  const w = el.offsetWidth || 340;
  const h = 200;
  const margin = { top: 10, right: 10, bottom: 40, left: 36 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const svg = d3.select("#chart-ratings-dist")
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.star)).range([0, innerW]).padding(0.3);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) + 1]).range([innerH, 0]);

  const starColor = d3.scaleSequential().domain([1, 5])
    .interpolator(d3.interpolate("#a0a0cc", ACCENT2));

  const tooltip = d3.select(".viz-tooltip");

  g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", d => x(d.star))
    .attr("y", innerH)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", d => starColor(d.star))
    .attr("rx", 4)
    .on("mouseover", (event, d) => {
      tooltip.style("display","block")
        .html(`<strong>${d.star} ★</strong><br>${d.count} filmów`);
    })
    .on("mousemove", event => {
      tooltip.style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", () => tooltip.style("display","none"))
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr("y", d => y(d.count))
    .attr("height", d => innerH - y(d.count));

  g.append("g").attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d => d + " ★"))
    .selectAll("text").attr("font-size", 11).attr("fill", "#999");

  g.append("g")
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => Math.round(d)))
    .selectAll("text").attr("font-size", 10).attr("fill", "#999");

  g.selectAll(".domain, .tick line").attr("stroke", GRAY);
}

/* ===== RATINGS OVER TIME (line chart) ===== */
function drawRatingsLine(data) {
  if (data.length < 2) {
    document.getElementById("chart-ratings-time").innerHTML =
      '<p style="color:#999;padding:20px;font-size:0.85rem">Za mało danych — oceń więcej filmów!</p>';
    return;
  }

  const el = document.getElementById("chart-ratings-time");
  const w = el.offsetWidth || 340;
  const h = 200;
  const margin = { top: 10, right: 10, bottom: 40, left: 36 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const svg = d3.select("#chart-ratings-time")
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint().domain(data.map(d => d.month)).range([0, innerW]);
  const y = d3.scaleLinear().domain([0, 5.5]).range([innerH, 0]);

  // Linia
  const line = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.avg))
    .curve(d3.curveCatmullRom);

  // Gradient pod linią
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id","line-grad")
    .attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
  grad.append("stop").attr("offset","0%").attr("stop-color", ACCENT).attr("stop-opacity", 0.3);
  grad.append("stop").attr("offset","100%").attr("stop-color", ACCENT).attr("stop-opacity", 0);

  const area = d3.area()
    .x(d => x(d.month))
    .y0(innerH)
    .y1(d => y(d.avg))
    .curve(d3.curveCatmullRom);

  g.append("path").datum(data).attr("fill","url(#line-grad)").attr("d", area);
  g.append("path").datum(data).attr("fill","none")
    .attr("stroke", ACCENT).attr("stroke-width", 2.5).attr("d", line);

  const tooltip = d3.select(".viz-tooltip");

  g.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => x(d.month))
    .attr("cy", d => y(d.avg))
    .attr("r", 4)
    .attr("fill", ACCENT)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", (event, d) => {
      tooltip.style("display","block")
        .html(`<strong>${d.month}</strong><br>Średnia: ${d.avg} ★<br>${d.count} ocen`);
    })
    .on("mousemove", event => {
      tooltip.style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", () => tooltip.style("display","none"));

  g.append("g").attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
    .selectAll("text").attr("font-size", 10).attr("fill","#999");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "★"))
    .selectAll("text").attr("font-size", 10).attr("fill","#999");

  g.selectAll(".domain, .tick line").attr("stroke", GRAY);
}

// Załaduj gdy zakładka Dashboard jest aktywna
document.addEventListener("DOMContentLoaded", () => {
  // Załaduj od razu jeśli aktywna
  const vizTab = document.getElementById("tab-viz");
  if (vizTab && vizTab.classList.contains("active")) loadDashboard();

  // Lub przy kliknięciu
  let loaded = false;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.dataset.tab === "viz") {
      btn.addEventListener("click", () => {
        if (!loaded) { loaded = true; loadDashboard(); }
      });
    }
  });
});
