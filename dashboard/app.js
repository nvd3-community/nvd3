(function(){
  const { useState, useEffect, useMemo } = React;

  /* ────────────────────────────────────────
   * 1. Helpers to load data & structure
   * ────────────────────────────────────────*/
  function excelDateToJSDate(num) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + num * 24 * 60 * 60 * 1000);
  }

  function loadData() {
    return fetch('/api/data')
      .then((resp) => resp.arrayBuffer())
      .then((buf) => {
        const workbook = XLSX.read(new Uint8Array(buf), {
          type: 'array',
          cellDates: true,
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
        return raw.map((row) => {
          if (row.Date != null) {
            if (row.Date instanceof Date) {
              // use as is
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

  function loadStructure() {
    return fetch('/api/structure').then((r) => r.json());
  }

  /* ────────────────────────────────────────
   * 2. Small utilities for chart data
   * ────────────────────────────────────────*/
  function groupBy(arr, key) {
    const map = {};
    arr.forEach((row) => {
      let k = row[key] ?? 'Unknown';
      if (row[key] instanceof Date) {
        k = row[key].toISOString().split('T')[0];
      }
      if (!map[k]) map[k] = [];
      map[k].push(row);
    });
    return map;
  }

  function lineData(data, xKey, yKey) {
    const grouped = groupBy(data, xKey);
    return [
      {
        key: yKey,
        values: Object.keys(grouped)
          .sort()
          .map((k) => ({
            x: new Date(k),
            y: grouped[k].reduce((a, b) => a + (+b[yKey] || 0), 0),
          })),
      },
    ];
  }

  function barData(data, xKey, yKey) {
    const grouped = groupBy(data, xKey);
    return [
      {
        key: yKey,
        values: Object.keys(grouped).map((k) => ({
          label: k,
          value: grouped[k].reduce((a, b) => a + (+b[yKey] || 0), 0),
        })),
      },
    ];
  }

  /* ────────────────────────────────────────
   * 3. Generic chart component (NVD3)
   * ────────────────────────────────────────*/
  function Chart({ config, data }) {
    useEffect(() => {
      const el = document.getElementById(config.id);
      if (!el) return;
      el.innerHTML = '';

      let chart;
      let chartData = [];

      if (config.type === 'line') {
        chart = nv.models.lineChart();
        chart.x((d) => d.x).y((d) => d.y);
        chartData = lineData(data, config.xKey, config.yKey);
      } else if (config.type === 'bar') {
        chart = nv.models.discreteBarChart().staggerLabels(true);
        chartData = barData(data, config.xKey, config.yKey);
      }

      if (chart) {
        d3.select(el).append('svg').datum(chartData).call(chart);
        nv.utils.windowResize(chart.update);
      }
    }, [data, config]);

    return React.createElement(
      'div',
      { className: 'chart-wrapper' },
      React.createElement('h2', null, config.title),
      React.createElement('div', { id: config.id, className: 'chart-container' })
    );
  }

  /* ────────────────────────────────────────
   * 4. Build chart configs dynamically from structure.json
   * ────────────────────────────────────────*/
  function buildConfigs(struct) {
    const dateCol = struct.find((c) => c.type === 'date');
    const numeric = struct.filter((c) => c.type === 'numeric');
    const categorical = struct.filter((c) => c.type === 'category');

    const cfgs = [];
    numeric.forEach((num) => {
      if (dateCol) {
        cfgs.push({
          id: `${num.name}-time`,
          title: `${num.name} en el tiempo`,
          type: 'line',
          xKey: dateCol.name,
          yKey: num.name,
        });
      }
      categorical.forEach((cat) => {
        cfgs.push({
          id: `${num.name}-by-${cat.name}`,
          title: `${num.name} por ${cat.name}`,
          type: 'bar',
          xKey: cat.name,
          yKey: num.name,
        });
      });
    });
    return cfgs;
  }

  /* ────────────────────────────────────────
   * 5. Main Dashboard component
   * ────────────────────────────────────────*/
  function Dashboard() {
    const [data, setData] = useState([]);
    const [structure, setStructure] = useState([]);
    const [configs, setConfigs] = useState([]);
    const [page, setPage] = useState(1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    /* Load raw data & structure once */
    useEffect(() => {
      loadData().then(setData).catch(console.error);
      loadStructure().then(setStructure).catch(console.error);
    }, []);

    /* Build chart configs when structure arrives */
    useEffect(() => {
      if (structure.length > 0) {
        setConfigs(buildConfigs(structure));
      }
    }, [structure]);

    /* Apply date filter efficiently */
    const filteredData = useMemo(() => {
      if (data.length === 0) return [];
      return data.filter((row) => {
        const dateValue = row.Date instanceof Date ? row.Date : new Date(row.Date);
        if (isNaN(dateValue)) return false;
        if (startDate && dateValue < new Date(startDate)) return false;
        if (endDate && dateValue > new Date(endDate)) return false;
        return true;
      });
    }, [data, startDate, endDate]);

    /* Pagination */
    const chartsPerPage = 4;
    const pages = Math.ceil(configs.length / chartsPerPage) || 1;
    const toShow = configs.slice((page - 1) * chartsPerPage, page * chartsPerPage);

    /* Render */
    return React.createElement(
      'div',
      null,
      React.createElement('h1', { style: { marginLeft: '20px' } }, 'Marketing Mix Dashboard'),
      React.createElement(
        'div',
        { style: { margin: '0 20px 20px 20px' } },
        /* Pagination buttons */
        Array.from({ length: pages }, (_, i) =>
          React.createElement(
            'button',
            {
              key: i,
              onClick: () => setPage(i + 1),
              disabled: page === i + 1,
              style: { marginRight: '10px' },
            },
            `Página ${i + 1}`
          )
        ),
        /* Date filters */
        React.createElement(
          'label',
          { style: { marginLeft: '20px' } },
          'Desde:',
          React.createElement('input', {
            type: 'date',
            value: startDate,
            onChange: (e) => setStartDate(e.target.value),
          })
        ),
        React.createElement(
          'label',
          { style: { marginLeft: '10px' } },
          'Hasta:',
          React.createElement('input', {
            type: 'date',
            value: endDate,
            onChange: (e) => setEndDate(e.target.value),
          })
        )
      ),
      /* Charts grid */
      React.createElement(
        'div',
        { className: 'charts-grid' },
        toShow.map((cfg) => React.createElement(Chart, { key: cfg.id, config: cfg, data: filteredData }))
      )
    );
  }

  /* ────────────────────────────────────────
   * 6. Mount the app
   * ────────────────────────────────────────*/
  ReactDOM.render(React.createElement(Dashboard), document.getElementById('root'));
})();