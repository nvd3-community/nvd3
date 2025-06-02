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

  function scatterData(data, xKey, yKey, groupKey) {
    const grouped = groupBy(data, groupKey || 'Default Group');
    return Object.keys(grouped).map((groupName) => ({
      key: groupName,
      values: grouped[groupName].map((row) => ({
        x: +row[xKey] || 0,
        y: +row[yKey] || 0,
        size: 0.1,
        shape: 'circle',
      })),
    }));
  }

  function roiData(data, groupKey, contributionKey, investmentKey) {
    const grouped = groupBy(data, groupKey);
    return Object.keys(grouped).map((groupName) => {
      const groupData = grouped[groupName];
      const totalContribution = groupData.reduce((sum, row) => sum + (+row[contributionKey] || 0), 0);
      const totalInvestment = groupData.reduce((sum, row) => sum + (+row[investmentKey] || 0), 0);
      let roi = 0;
      if (totalInvestment !== 0) {
        roi = (totalContribution - totalInvestment) / totalInvestment;
      }
      return {
        label: groupName,
        value: roi,
      };
    });
  }

  /* ────────────────────────────────────────
   * 3. Generic chart component (NVD3)
   * ────────────────────────────────────────*/
  function Chart({ config, data }) {
    useEffect(() => {
      const el = document.getElementById(config.id);
      if (!el) return;
      el.innerHTML = '';

      console.log('Chart config:', config);
      console.log('Chart data:', data);

      let chart;
      let chartData = [];

      if (config.type === 'line') {
        chart = nv.models.lineChart();
        chart.x((d) => d.x).y((d) => d.y);
        chartData = lineData(data, config.xKey, config.yKey);
      } else if (config.type === 'bar') {
        chart = nv.models.discreteBarChart().staggerLabels(true);
        chartData = barData(data, config.xKey, config.yKey);
      } else if (config.type === 'scatter') {
        chart = nv.models.scatterChart();
        chart.showDistX(true).showDistY(true);
        chart.useVoronoi(true);
        chart.duration(300);
        chart.xAxis.tickFormat(d3.format('.02f')).axisLabel(config.xKey); // Or config.xLabel
        chart.yAxis.tickFormat(d3.format('.02f')).axisLabel(config.yKey); // Or config.yLabel
        chart.tooltip.headerFormatter(function(d) { return 'Group: ' + d; });
        chartData = scatterData(data, config.xKey, config.yKey, config.groupKey);
      } else if (config.type === 'roiBar') {
        chart = nv.models.discreteBarChart().staggerLabels(true);
        // Assuming roiData returns [{ label: groupName, value: roiValue }, ...]
        // discreteBarChart expects data in the format [{ key: 'someKey', values: [...] }]
        const roiValues = roiData(data, config.groupKey, config.contributionKey, config.investmentKey);
        chartData = [{ key: 'ROI', values: roiValues }];
        chart.xAxis.axisLabel(config.groupKey);
        chart.yAxis.axisLabel('ROI').tickFormat(d3.format('.2%'));
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
  function buildConfigs(struct) { // struct can be ignored
  return [
    // Page 1
    {
      id: 'contribucion-time',
      title: 'Contribución en el Tiempo',
      type: 'line',
      xKey: 'Date', // Assuming 'Date' is the actual column name for dates
      yKey: 'contribuci\u00f3n' // Assuming 'contribución' is for contribution
    },
    {
      id: 'inversion-time',
      title: 'Inversión en el Tiempo',
      type: 'line',
      xKey: 'Date',
      yKey: 'Media_costs' // Assuming 'Media_costs' is for investment
    },
    {
      id: 'contribucion-by-grouping',
      title: 'Contribución por Grouping',
      type: 'bar',
      xKey: 'Grouping', // Assuming 'Grouping' is the column name
      yKey: 'contribuci\u00f3n'
    },
    {
      id: 'contribucion-by-channel',
      title: 'Contribución por Channel',
      type: 'bar',
      xKey: 'Channel', // Assuming 'Channel' is the column name
      yKey: 'contribuci\u00f3n'
    },
    // Page 2
    {
      id: 'scatter-contribucion-inversion-by-grouping',
      title: 'Inversión vs. Contribución por Grouping',
      type: 'scatter',
      xKey: 'Media_costs',
      yKey: 'contribuci\u00f3n',
      groupKey: 'Grouping'
    },
    {
      id: 'scatter-contribucion-inversion-by-channel',
      title: 'Inversión vs. Contribución por Channel',
      type: 'scatter',
      xKey: 'Media_costs',
      yKey: 'contribuci\u00f3n',
      groupKey: 'Channel'
    },
    {
      id: 'roi-by-grouping',
      title: 'ROI por Grouping',
      type: 'roiBar', // Using the 'roiBar' type created by the worker in the previous step
      groupKey: 'Grouping', // For roiData, this is the key to group by
      contributionKey: 'contribuci\u00f3n',
      investmentKey: 'Media_costs',
      // The 'roiBar' chart type in Chart.js should use these keys with roiData
      // xKey will likely be derived by roiData (labels of the bars)
      // yKey will be the ROI value itself.
      // Ensure the Chart component's 'roiBar' section handles these keys appropriately with roiData.
      // Specifically, roiData(data, config.groupKey, config.contributionKey, config.investmentKey)
      // And the axis labels might need to be generic like "Grouping" and "ROI" respectively.
      // The discreteBarChart for 'roiBar' should be configured in Chart.js:
      // chart.xAxis.axisLabel('Grouping');
      // chart.yAxis.axisLabel('ROI').tickFormat(d3.format('.2%'));
    },
    {
      id: 'roi-by-channel',
      title: 'ROI por Channel',
      type: 'roiBar',
      groupKey: 'Channel',
      contributionKey: 'contribuci\u00f3n',
      investmentKey: 'Media_costs',
      // Similar to above, ensure Chart.js handles this config for 'roiBar'
      // chart.xAxis.axisLabel('Channel');
      // chart.yAxis.axisLabel('ROI').tickFormat(d3.format('.2%'));
    }
  ];
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