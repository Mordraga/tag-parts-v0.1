import { getLogEntries, renderLogEntries } from './log.js';
import { loadPartsIndex } from './utils.js';

const FILTER_TYPES = {
  NONE: '',
  PART: 'part',
  DATE: 'date',
  LOCATION: 'location',
  KEYWORD: 'keyword',
  AWARENESS: 'awareness'
};

const state = {
  activeMonth: new Date(),
  selectedDateKey: null,
  logs: [],
  filter: { type: FILTER_TYPES.NONE, value: null },
  filteredDates: new Set(),
  dateRange: null,
  locationHints: []
};

const refs = {
  grid: null,
  monthLabel: null,
  dayDetail: null,
  dayLabel: null,
  dayLogs: null,
  prevBtn: null,
  nextBtn: null,
  todayBtn: null,
  closeBtn: null,
  filterType: null,
  filterContainer: null,
  clearFilter: null,
  filterSummary: null,
  locationOptions: null
};

window.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  attachEvents();
  renderFilterControls();
  refreshCalendar();
});

function cacheElements() {
  refs.grid = document.getElementById('calendarGrid');
  refs.monthLabel = document.getElementById('calendarMonthLabel');
  refs.dayDetail = document.getElementById('dayDetail');
  refs.dayLabel = document.getElementById('dayDetailLabel');
  refs.dayLogs = document.getElementById('dayLogs');
  refs.prevBtn = document.getElementById('prevMonth');
  refs.nextBtn = document.getElementById('nextMonth');
  refs.todayBtn = document.getElementById('todayBtn');
  refs.closeBtn = document.getElementById('closeDayDetail');
  refs.filterType = document.getElementById('filterType');
  refs.filterContainer = document.getElementById('filterControlContainer');
  refs.clearFilter = document.getElementById('clearFilter');
  refs.filterSummary = document.getElementById('filterSummary');
  refs.locationOptions = document.getElementById('locationOptions');
}

function attachEvents() {
  refs.prevBtn?.addEventListener('click', () => changeMonthBy(-1));
  refs.nextBtn?.addEventListener('click', () => changeMonthBy(1));
  refs.todayBtn?.addEventListener('click', () => {
    state.activeMonth = new Date();
    state.selectedDateKey = null;
    refreshCalendar();
  });
  refs.closeBtn?.addEventListener('click', () => {
    collapseDayDetail(true);
  });
  refs.filterType?.addEventListener('change', handleFilterTypeChange);
  refs.clearFilter?.addEventListener('click', clearFilterSelection);
}

function handleFilterTypeChange() {
  const nextType = refs.filterType?.value || FILTER_TYPES.NONE;
  state.filter = { type: nextType, value: null };
  state.dateRange = null;
  renderFilterControls();
  refreshCalendar(state.selectedDateKey);
}

function clearFilterSelection() {
  state.filter = { type: FILTER_TYPES.NONE, value: null };
  state.dateRange = null;
  if (refs.filterType) {
    refs.filterType.value = FILTER_TYPES.NONE;
  }
  renderFilterControls();
  refreshCalendar(state.selectedDateKey);
}

function renderFilterControls() {
  if (!refs.filterContainer) return;
  refs.filterContainer.innerHTML = '';
  const { type, value } = state.filter;
  if (!type) {
    refs.filterContainer.innerHTML =
      '<p class="filter-note inline-note">Choose a filter to highlight specific logs.</p>';
    return;
  }

  switch (type) {
    case FILTER_TYPES.PART:
      renderPartFilterControl(value);
      break;
    case FILTER_TYPES.DATE:
      renderDateFilterControl(value);
      break;
    case FILTER_TYPES.LOCATION:
      renderLocationFilterControl(value);
      break;
    case FILTER_TYPES.KEYWORD:
      renderKeywordFilterControl(value);
      break;
    case FILTER_TYPES.AWARENESS:
      renderAwarenessFilterControl(value);
      break;
    default:
      refs.filterContainer.innerHTML =
        '<p class="filter-note inline-note">Filter not recognized.</p>';
  }
}

function renderPartFilterControl(currentValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';
  wrapper.innerHTML = `
    <label for="filterPartSelect">Select Part</label>
    <select id="filterPartSelect">
      <option value="">All Parts</option>
    </select>
  `;
  const select = wrapper.querySelector('select');
  const partsIndex = loadPartsIndex() || [];
  partsIndex
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((part) => {
      const option = document.createElement('option');
      option.value = part.name;
      option.textContent = part.name;
      select.appendChild(option);
    });
  select.value = currentValue || '';
  select.addEventListener('change', () => {
    const value = select.value.trim();
    setFilterValue(value || null);
  });

  refs.filterContainer.appendChild(wrapper);
}

function renderDateFilterControl(currentValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';
  wrapper.innerHTML = `
    <label>Date Range</label>
    <div class="date-range">
      <input type="date" id="filterStart" />
      <span class="date-separator">to</span>
      <input type="date" id="filterEnd" />
    </div>
  `;
  const startInput = wrapper.querySelector('#filterStart');
  const endInput = wrapper.querySelector('#filterEnd');
  if (currentValue?.start) startInput.value = currentValue.start;
  if (currentValue?.end) endInput.value = currentValue.end;

  const handleChange = () => {
    const startVal = startInput.value;
    const endVal = endInput.value;
    if (!startVal || !endVal) {
      setFilterValue(null);
      return;
    }
    let start = startVal;
    let end = endVal;
    if (start > end) {
      [start, end] = [end, start];
      startInput.value = start;
      endInput.value = end;
    }
    setFilterValue({ start, end });
  };

  startInput.addEventListener('change', handleChange);
  endInput.addEventListener('change', handleChange);

  refs.filterContainer.appendChild(wrapper);
}

function renderLocationFilterControl(currentValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';
  wrapper.innerHTML = `
    <label for="filterLocationInput">Location Contains</label>
    <input id="filterLocationInput" type="text" placeholder="Start typing location" list="locationOptions" />
  `;
  const input = wrapper.querySelector('input');
  input.value = currentValue || '';
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    setFilterValue(val || null);
  });
  refs.filterContainer.appendChild(wrapper);
}

function renderKeywordFilterControl(currentValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';
  wrapper.innerHTML = `
    <label for="filterKeywordInput">Keyword</label>
    <input id="filterKeywordInput" type="text" placeholder="Search messages" />
  `;
  const input = wrapper.querySelector('input');
  input.value = currentValue || '';
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    setFilterValue(val || null);
  });
  refs.filterContainer.appendChild(wrapper);
}

function renderAwarenessFilterControl(currentValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';
  const initialValue = typeof currentValue === 'number' ? currentValue : 5;
  wrapper.innerHTML = `
    <label for="filterAwareness">Awareness (minimum): <span id="awarenessDisplay">${initialValue}</span></label>
    <input type="range" id="filterAwareness" min="1" max="10" value="${initialValue}" />
  `;
  const slider = wrapper.querySelector('#filterAwareness');
  const display = wrapper.querySelector('#awarenessDisplay');
  slider.addEventListener('input', () => {
    display.textContent = slider.value;
    setFilterValue(Number(slider.value));
  });
  refs.filterContainer.appendChild(wrapper);
}

function setFilterValue(value) {
  state.filter.value = value;
  state.dateRange =
    state.filter.type === FILTER_TYPES.DATE && value?.start && value?.end
      ? value
      : null;
  refreshCalendar(state.selectedDateKey);
}

function refreshCalendar(dateKeyOverride) {
  state.logs = getLogEntries();
  updateLocationHints();
  state.filteredDates = computeFilteredDates(state.logs);
  const targetKey = dateKeyOverride || state.selectedDateKey;
  const monthKey = toMonthKey(state.activeMonth);
  const buckets = buildBucketsForMonth(state.logs, monthKey);
  renderCalendarGrid(buckets);
  updateMonthLabel();
  updateFilterSummary();

  if (targetKey) {
    const logsForDay = state.logs.filter((log) => log.dateKey === targetKey);
    if (logsForDay.length) {
      const labelDate = parseDateKey(targetKey);
      showDayDetail(targetKey, labelDate, logsForDay);
      return;
    }
  }
  collapseDayDetail(!dateKeyOverride);
}

function updateLocationHints() {
  const hints = Array.from(
    new Set(
      state.logs
        .map((log) => (log.where || '').trim())
        .filter((value) => value.length)
    )
  ).sort((a, b) => a.localeCompare(b));
  state.locationHints = hints;
  if (refs.locationOptions) {
    refs.locationOptions.innerHTML = hints
      .map((hint) => `<option value="${hint}"></option>`)
      .join('');
  }
}

function buildBucketsForMonth(logs, monthKey) {
  return logs.reduce((acc, log) => {
    if (!log.dateKey || log.monthKey !== monthKey) {
      return acc;
    }
    if (!acc[log.dateKey]) {
      acc[log.dateKey] = [];
    }
    acc[log.dateKey].push(log);
    return acc;
  }, {});
}

function renderCalendarGrid(buckets) {
  if (!refs.grid) return;
  refs.grid.innerHTML = '';
  const workingDate = new Date(
    state.activeMonth.getFullYear(),
    state.activeMonth.getMonth(),
    1
  );
  const startShift = workingDate.getDay();
  workingDate.setDate(workingDate.getDate() - startShift);

  const filterActive = isFilterActive();
  for (let i = 0; i < 35; i += 1) {
    const cellDate = new Date(workingDate);
    cellDate.setDate(workingDate.getDate() + i);
    const dateKey = toDateKey(cellDate);
    const logs = buckets[dateKey] || [];
    const filteredLogs = filterActive ? logs.filter((log) => matchesFilter(log)) : logs;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-cell';
    if (cellDate.getMonth() !== state.activeMonth.getMonth()) {
      cell.classList.add('muted');
    }
    if (logs.length) {
      cell.classList.add('has-logs');
    }
    if (state.dateRange && isDateWithinRange(dateKey, state.dateRange)) {
      cell.classList.add('filter-range');
    }
    if (state.filteredDates.has(dateKey) || filteredLogs.length) {
      cell.classList.add('filter-match');
    }
    if (state.selectedDateKey === dateKey) {
      cell.classList.add('selected');
    }

    const countLabel = filterActive ? filteredLogs.length : logs.length;
    cell.innerHTML = `
      <span class="date-number">${cellDate.getDate()}</span>
      <span class="log-count">${countLabel ? countLabel : ''}</span>
    `;
    cell.addEventListener('click', () => {
      const dayLogs = filterActive ? filteredLogs : logs;
      showDayDetail(dateKey, cellDate, dayLogs);
    });
    refs.grid.appendChild(cell);
  }
}

function updateMonthLabel() {
  if (!refs.monthLabel) return;
  refs.monthLabel.textContent = state.activeMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric'
  });
}

function showDayDetail(dateKey, dateObj, logsForDay = []) {
  state.selectedDateKey = dateKey;
  if (!refs.dayDetail || !refs.dayLogs || !refs.dayLabel) return;
  refs.dayDetail.classList.remove('collapsed');
  refs.dayLabel.textContent = formatDayLabel(dateObj);

  const exactLogs =
    logsForDay.length > 0
      ? logsForDay
      : state.logs.filter((log) => log.dateKey === dateKey);
  const logs = isFilterActive() ? filterLogs(exactLogs) : exactLogs;

  if (!logs.length) {
    refs.dayLogs.innerHTML =
      '<p class="empty">No logs meet the current filter for this date.</p>';
    return;
  }

  const refresh = () => refreshCalendar(dateKey);
  renderLogEntries(logs, refs.dayLogs, { onRefresh: refresh });
}

function collapseDayDetail(resetSelection = false) {
  if (resetSelection) {
    state.selectedDateKey = null;
  }
  if (!refs.dayDetail || !refs.dayLogs || !refs.dayLabel) return;
  refs.dayDetail.classList.add('collapsed');
  refs.dayLabel.textContent = 'Select a day';
  refs.dayLogs.innerHTML =
    '<p class="empty">Pick a date to see detailed logs.</p>';
}

function changeMonthBy(delta) {
  const newMonth = new Date(
    state.activeMonth.getFullYear(),
    state.activeMonth.getMonth() + delta,
    1
  );
  state.activeMonth = newMonth;
  state.selectedDateKey = null;
  refreshCalendar();
}

function computeFilteredDates(logs) {
  if (!isFilterActive()) return new Set();
  const matches = filterLogs(logs);
  return new Set(matches.map((log) => log.dateKey).filter(Boolean));
}

function filterLogs(logs) {
  if (!isFilterActive()) return logs;
  return logs.filter((log) => matchesFilter(log));
}

function isFilterActive() {
  const { type, value } = state.filter;
  if (!type) return false;
  if (type === FILTER_TYPES.DATE) {
    return Boolean(value?.start && value?.end);
  }
  if (type === FILTER_TYPES.AWARENESS) {
    return typeof value === 'number';
  }
  return Boolean(value && (typeof value === 'number' || value.length));
}

function matchesFilter(log) {
  const { type, value } = state.filter;
  if (!type) return false;
  switch (type) {
    case FILTER_TYPES.PART: {
      if (!value) return false;
      const target = value.trim().toLowerCase();
      const partRef = (log.partRef || '').trim().toLowerCase();
      const who = (log.who || '').trim().toLowerCase();
      return partRef === target || who === target;
    }
    case FILTER_TYPES.DATE:
      return (
        Boolean(value?.start && value?.end && log.dateKey) &&
        log.dateKey >= value.start &&
        log.dateKey <= value.end
      );
    case FILTER_TYPES.LOCATION:
      return Boolean(
        value && (log.where || '').toLowerCase().includes(value)
      );
    case FILTER_TYPES.KEYWORD:
      return Boolean(
        value && (log.msg || '').toLowerCase().includes(value)
      );
    case FILTER_TYPES.AWARENESS:
      return (
        typeof value === 'number' &&
        Number(log.awareness || 0) >= value
      );
    default:
      return false;
  }
}

function isDateWithinRange(dateKey, range) {
  if (!dateKey || !range?.start || !range?.end) return false;
  return dateKey >= range.start && dateKey <= range.end;
}

function updateFilterSummary() {
  if (!refs.filterSummary) return;
  const { type, value } = state.filter;
  if (!type) {
    refs.filterSummary.textContent =
      'Select a filter to highlight days with matching logs.';
    return;
  }

  const matches = state.filteredDates.size;
  const descriptor = describeFilter(type, value);
  if (!matches) {
    refs.filterSummary.textContent = `No days match ${descriptor} yet.`;
    return;
  }

  const label = matches === 1 ? 'day' : 'days';
  refs.filterSummary.textContent = `Highlighting ${matches} ${label} for ${descriptor}.`;
}

function describeFilter(type, value) {
  switch (type) {
    case FILTER_TYPES.PART:
      return value ? `Part: ${value}` : 'selected part';
    case FILTER_TYPES.DATE:
      return value
        ? `dates ${value.start} → ${value.end}`
        : 'selected dates';
    case FILTER_TYPES.LOCATION:
      return value ? `location containing "${value}"` : 'location filter';
    case FILTER_TYPES.KEYWORD:
      return value ? `keyword "${value}"` : 'keyword filter';
    case FILTER_TYPES.AWARENESS:
      return value
        ? `awareness ≥ ${value}`
        : 'awareness threshold';
    default:
      return 'current filter';
  }
}

function toDateKey(date) {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  return utc.toISOString().slice(0, 10);
}

function toMonthKey(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  return utc.toISOString().slice(0, 7);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey
    .split('-')
    .map((val) => parseInt(val, 10));
  return new Date(year, month - 1, day);
}

function formatDayLabel(date) {
  if (!(date instanceof Date)) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}
