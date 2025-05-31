// MMM specific dashboard with dedicated components for various NVD3 charts
(function(){
  const { useState, useEffect } = React;

  function excelDateToJSDate(num) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + num * 24 * 60 * 60 * 1000);
  }

  function loadData() {
    return fetch('../data/Results_v2 3.xlsx')
      .then(resp => resp.arrayBuffer())
      .then(buf => {
        const workbook = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
        return raw.map(row => {
          if (row.Date != null) {
            if (row.Date instanceof Date) {
              // ok
            } else if (typeof row.Date === 'number') {
              row.Date = excelDateToJSDate(row.Date);
            } else {
              const d = new Date(row.Date);
              if (!isNaN(d)) row.Date = d;
            }
          }
          return row;
        });
      });
  }

  /* Utility helpers */
  function groupSum(data, key, valueKey) {
    const map = {};
    data.forEach(r => {
      const k = r[key] ?? 'Unknown';
      const v = +r[valueKey] || 0;
      if (!map[k]) map[k] = 0;
      map[k] += v;
    });
    return Object.keys(map).map(k => ({ label: k, value: map[k] }));
  }

  function seriesByGroup(data, groupKey, xKey, yKey) {
    const m = {};
    data.forEach(r => {
      const g = r[groupKey] ?? 'Unknown';
      if (!m[g]) m[g] = [];
      m[g].push({ x: r[xKey], y: +r[yKey] || 0 });
    });
    return Object.keys(m).map(k => ({ key: k, values: m[k] }));
  }

  /* ───── Chart Components ─────*/
  function CumulativeLineChart({ data }) {
    useEffect(() => {
      const el = document.getElementById('cumulativeChart');
      if (!el) return;
      el.innerHTML = '';
      let cum = 0;
      const sorted = [...data].sort((a,b)=> new Date(a.Date) - new Date(b.Date));
      const values = sorted.map(r => {
        cum += +r['contribuci\u00f3n'] || 0;
        return { x: r.Date, y: cum };
      });
      const chart = nv.models.cumulativeLineChart().useInteractiveGuideline(true);
      chart.xAxis.tickFormat(d => d3.time.format('%Y-%m-%d')(new Date(d)));
      chart.yAxis.tickFormat(d3.format(',.2f'));
      d3.select(el).append('svg')
        .datum([{ key: 'Contribuci\u00f3n acumulada', values }])
        .call(chart);
      nv.utils.windowResize(chart.update);
    }, [data]);
    return React.createElement('div', { className: 'chart-wrapper' },
      React.createElement('h2', null, 'Contribuci\u00f3n acumulada'),
      React.createElement('div', { id: 'cumulativeChart', className: 'chart-container' })
    );
  }

  function MultiBarChart({ data }) {
    useEffect(() => {
      const el = document.getElementById('multiBarChart');
      if (!el) return;
      el.innerHTML = '';
      const series = seriesByGroup(data, 'Channel', 'Date', 'contribuci\u00f3n');
      const chart = nv.models.multiBarChart().stacked(true);
      chart.x(d => d.x).y(d => d.y);
      chart.xAxis.tickFormat(d => d3.time.format('%Y-%m-%d')(new Date(d)));
      chart.yAxis.tickFormat(d3.format(',.2f'));
      d3.select(el).append('svg').datum(series).call(chart);
      nv.utils.windowResize(chart.update);
    }, [data]);
    return React.createElement('div', { className: 'chart-wrapper' },
      React.createElement('h2', null, 'Contribuci\u00f3n por Canal'),
      React.createElement('div', { id: 'multiBarChart', className: 'chart-container' })
    );
  }

  function DonutChart({ data }) {
    useEffect(() => {
      const el = document.getElementById('donutChart');
      if (!el) return;
      el.innerHTML = '';
      const values = groupSum(data, 'Channel', 'contribuci\u00f3n');
      const chart = nv.models.pieChart().donut(true).x(d => d.label).y(d => d.value);
      chart.pie.padAngle(.04).cornerRadius(0);
      d3.select(el).append('svg').datum(values).call(chart);
      nv.utils.windowResize(chart.update);
    }, [data]);
    return React.createElement('div', { className: 'chart-wrapper' },
      React.createElement('h2', null, 'Participaci\u00f3n por Canal'),
      React.createElement('div', { id: 'donutChart', className: 'chart-container' })
    );
  }

  function ScatterChart({ data }) {
    useEffect(() => {
      const el = document.getElementById('scatterChart');
      if (!el) return;
      el.innerHTML = '';
      const values = data.map(r => ({
        x: +r['Media_costs'] || 0,
        y: +r['contribuci\u00f3n'] || 0,
        size: 0.1,
        shape: 'circle'
      }));
      const chartData = [{ key: 'Costo vs Contribuci\u00f3n', values }];
      const chart = nv.models.scatterChart().showDistX(true).showDistY(true);
      chart.xAxis.tickFormat(d3.format(',.2f')).axisLabel('Media Costs');
      chart.yAxis.tickFormat(d3.format(',.2f')).axisLabel('Contribuci\u00f3n');
      d3.select(el).append('svg').datum(chartData).call(chart);
      nv.utils.windowResize(chart.update);
    }, [data]);
    return React.createElement('div', { className: 'chart-wrapper' },
      React.createElement('h2', null, 'Costo vs Contribuci\u00f3n'),
      React.createElement('div', { id: 'scatterChart', className: 'chart-container' })
    );
  }

  function MultiBarHorizontalChart({ data }) {
    useEffect(() => {
      const el = document.getElementById('horizontalBarChart');
      if (!el) return;
      el.innerHTML = '';
      const values = groupSum(data, 'Variable', 'contribuci\u00f3n');
      const chartData = [{ key: 'Contribuci\u00f3n', values }];
      const chart = nv.models.multiBarHorizontalChart().stacked(true)
        .x(d => d.label).y(d => d.value).margin({left: 120});
      chart.yAxis.tickFormat(d3.format(',.2f'));
      d3.select(el).append('svg').datum(chartData).call(chart);
      nv.utils.windowResize(chart.update);
    }, [data]);
    return React.createElement('div', { className: 'chart-wrapper' },
      React.createElement('h2', null, 'Contribuci\u00f3n por Variable'),
      React.createElement('div', { id: 'horizontalBarChart', className: 'chart-container' })
    );
  }

  function Dashboard() {
    const [data, setData] = useState([]);
    useEffect(() => { loadData().then(setData).catch(console.error); }, []);
    if (data.length === 0) return React.createElement('div', null, 'Cargando datos...');
    return React.createElement('div', null,
      React.createElement('h1', { style: { marginLeft: '20px' } }, 'Resultados MMM'),
      React.createElement('div', { className: 'charts-grid' },
        React.createElement(CumulativeLineChart, { data }),
        React.createElement(MultiBarChart, { data }),
        React.createElement(DonutChart, { data }),
        React.createElement(ScatterChart, { data }),
        React.createElement(MultiBarHorizontalChart, { data })
      )
    );
  }

  ReactDOM.render(React.createElement(Dashboard), document.getElementById('root'));
})();
